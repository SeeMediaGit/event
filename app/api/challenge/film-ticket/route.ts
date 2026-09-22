import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseAnonClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import {
  FILM_BUCKET,
  objectNameFromUrl,
  publicUrl,
} from "@/lib/challenge/films/storage";

// Step 1 of a video upload: decide WHERE in Supabase Storage the file goes,
// point the row at it, and hand the browser that path.
//
// Serves BOTH videos an entry carries — the film and its trailer — told apart by
// `kind`. They differ only in which columns the answer is written to; the
// ownership checks and the upload flow are identical, so splitting this into
// two routes would be two copies of the same rules drifting apart.
//
// WHY NOT THROUGH THIS SERVER: the bytes of a film do not fit through a Vercel
// function — the platform caps a request body at 4.5 MB. Here only a small JSON
// travels through Vercel; the file itself goes browser → Supabase Storage
// directly over tus (resumable, chunked, gigabytes are fine).
//
// WHY THIS ROUTE STILL EXISTS when the browser could write to storage on its
// own: the storage policy only knows "is the first folder my own user id". It
// cannot tell whether the film row belongs to this user, whether the fee is
// paid, or whether the submission window is still open — those live in
// challenge_films / challenge_applications / events, and this route is where
// they are checked under the service role before a path is handed out. The
// film_* columns are also written here: the client holds no grant on them.
//
// Until 20260913 this created a Bunny Stream video and signed a per-video
// ticket. Storage needs no ticket — the browser's own session JWT plus the
// bucket policy in 20260913000000_challenge_films_supabase_storage.sql is
// the authorisation — and there is no transcode step afterwards, so a file is
// playable the moment it lands.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOADABLE_APPLICATION_STATUSES = new Set([
  "paid",
  "uploaded",
  "under_review",
  "approved",
]);

// Same list as ACCEPTED_FILM_TYPES in lib/challenge/films/upload.ts, and as
// the bucket's allowed_mime_types. The extension is derived from the MIME type
// rather than taken from the file name so that a name like "кино.MOV" or
// "film" (no extension) still yields a sensible object key.
const EXTENSION_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
};

function getAccessToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Нэвтрээгүй байна." }, { status: 401 });
    }

    const { data: userData, error: userError } =
      await getSupabaseAnonClient().auth.getUser(accessToken);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "Нэвтрэлт хүчингүй байна. Дахин нэвтэрнэ үү." },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    const filmId = String(body?.filmId ?? "").trim();
    const fileType = String(body?.fileType ?? "").trim();
    const kind = body?.kind === "trailer" ? "trailer" : "film";

    if (!filmId) {
      return NextResponse.json({ error: "Кино тодорхойгүй байна." }, { status: 400 });
    }
    const extension = EXTENSION_BY_TYPE[fileType];
    if (!extension) {
      return NextResponse.json(
        { error: "Зөвхөн MP4, MOV, WebM, MKV бичлэг оруулах боломжтой." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServiceClient();

    // film → application → event. Ownership comes from the application's
    // user_id against the verified caller, never from the request body.
    const { data: film, error: filmError } = await supabase
      .from("challenge_films")
      .select("id, application_id, event_id, status, film_path, trailer_url")
      .eq("id", filmId)
      .maybeSingle();

    if (filmError) {
      console.error("film-ticket: film lookup failed", filmError);
      return NextResponse.json({ error: "Кино уншиж чадсангүй." }, { status: 500 });
    }
    if (!film) {
      return NextResponse.json({ error: "Кино олдсонгүй." }, { status: 404 });
    }

    const { data: application, error: appError } = await supabase
      .from("challenge_applications")
      .select("id, user_id, status")
      .eq("id", film.application_id)
      .maybeSingle();

    if (appError) {
      console.error("film-ticket: application lookup failed", appError);
      return NextResponse.json({ error: "Анкет уншиж чадсангүй." }, { status: 500 });
    }
    // Same answer for "not yours" and "does not exist" — telling them apart
    // would confirm that someone else's film id is real.
    if (!application || application.user_id !== userData.user.id) {
      return NextResponse.json({ error: "Кино олдсонгүй." }, { status: 404 });
    }
    if (!UPLOADABLE_APPLICATION_STATUSES.has(application.status)) {
      return NextResponse.json(
        { error: "Төлбөр төлсний дараа бүтээлээ оруулах боломжтой." },
        { status: 403 },
      );
    }
    if (film.status !== "draft" && film.status !== "submitted") {
      return NextResponse.json(
        { error: "Хянагдаж эхэлсэн киног солих боломжгүй." },
        { status: 403 },
      );
    }

    // The service role bypasses RLS, so the deadline the INSERT policy enforces
    // has to be enforced again here.
    const { data: event } = await supabase
      .from("events")
      .select("id, submission_ends_at")
      .eq("id", film.event_id)
      .maybeSingle();

    if (
      event?.submission_ends_at &&
      Date.now() > new Date(event.submission_ends_at).getTime()
    ) {
      return NextResponse.json(
        { error: "Бүтээл хүлээн авах хугацаа дууссан." },
        { status: 403 },
      );
    }

    // <user_id>/<film_id>/<kind>-<ts>.<ext>
    //
    // The user id comes FIRST because that is the one thing the storage policy
    // can check: `(storage.foldername(name))[1] = auth.uid()`. A timestamp
    // rather than a fixed name so that replacing a film never collides with a
    // half-finished upload of the previous one, and so a CDN never serves a
    // stale cached copy under the same key.
    const objectName = `${userData.user.id}/${film.id}/${kind}-${Date.now()}.${extension}`;
    const url = publicUrl(objectName);

    // Drop the previous file for this slot, if it was one of ours. Best effort:
    // an orphaned object is a storage-cost problem, not a reason to refuse the
    // entrant a new upload. Bunny-era rows carry a `<libraryId>/<guid>` path
    // that never existed in the bucket, so removing it is a harmless no-op.
    const previous =
      kind === "trailer"
        ? objectNameFromUrl(film.trailer_url)
        : film.film_path;
    if (previous) {
      const { error: removeError } = await supabase.storage
        .from(FILM_BUCKET)
        .remove([previous]);
      if (removeError) {
        console.warn("film-ticket: previous object not removed", {
          previous,
          removeError,
        });
      }
    }

    // Point the row at the new object straight away, under the service role —
    // the client holds no grant on any of these columns.
    //
    // `pending`, NOT `ready`: at this moment the path is decided and nothing
    // is in it. film-status flips it to `ready` once the object is actually
    // there, so a closed tab mid-upload never leaves a row claiming a film
    // that does not exist.
    // `bunny_*` нь мөн цэвэрлэгдэнэ (20260921000000). Нийтэд харагдаж байгаа
    // зүйл бол админы Bunny дээр тавьсан хуулбар, энэ файл биш — тэр хуулбар
    // одооноос хуучирлаа. Цэвэрлэхгүй бол батлагдсаны дараа киногоо сольсон
    // хүн Bunny дээрх ӨМНӨХ хувилбараараа нийтлэгдсэн хэвээр үлдэнэ.
    const patch =
      kind === "trailer"
        ? {
            trailer_video_id: null,
            trailer_url: url,
            trailer_status: "pending",
            trailer_uploaded_at: null,
            bunny_trailer_url: null,
          }
        : {
            film_video_id: null,
            film_url: url,
            film_path: objectName,
            film_status: "pending",
            film_uploaded_at: null,
            bunny_url: null,
            published_at: null,
            published_by: null,
          };

    const { error: updateError } = await supabase
      .from("challenge_films")
      .update(patch)
      .eq("id", film.id);

    if (updateError) {
      console.error("film-ticket: row update failed", updateError);
      return NextResponse.json(
        { error: "Видеог анкетад бүртгэж чадсангүй." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      bucket: FILM_BUCKET,
      objectName,
      url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("film-ticket route error", error);
    return NextResponse.json(
      { error: "Байршуулалт эхлүүлэхэд алдаа гарлаа.", details: message },
      { status: 500 },
    );
  }
}
