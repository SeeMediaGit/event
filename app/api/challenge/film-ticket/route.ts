import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseAnonClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

// Step 1 of a video upload: create an empty video object in the Bunny Stream
// library and hand the browser a short-lived signature for it.
//
// Serves BOTH videos an entry carries — the film and its trailer — told apart by
// `kind`. They differ only in which three columns the answer is written to; the
// ownership checks, the signature and the tus flow are identical, so splitting
// this into two routes would be two copies of the same rules drifting apart.
//
// WHY NOT THROUGH THIS SERVER: the bytes of a film do not fit through a Vercel
// function — the platform caps a request body at 4.5 MB, so the old
// /api/challenge/upload path died on the first megabyte of any real entry. Here
// only a small JSON travels through Vercel; the file itself goes browser →
// Bunny directly over tus (resumable, chunked, gigabytes are fine).
//
// WHY A SIGNATURE AND NOT THE KEY: Bunny Stream accepts a per-video signature
// — sha256(libraryId + apiKey + expire + videoId) — that authorises uploading
// to THAT ONE video until it expires. The library's API key stays on the
// server. This is exactly what Bunny Storage lacks (AccessKey-only, no
// per-object signing), which is why posters still go through the server route
// and films no longer do.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One hour. Long enough for a slow phone on a bad connection to finish a
// gigabyte, short enough that a leaked ticket is worthless by the time anyone
// finds it. It authorises writing one video that we just created, nothing else.
const TICKET_TTL_SECONDS = 60 * 60;

const UPLOADABLE_APPLICATION_STATUSES = new Set([
  "paid",
  "uploaded",
  "under_review",
  "approved",
]);

function getAccessToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

function streamConfig() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID?.trim();
  const apiKey = process.env.BUNNY_STREAM_API_KEY?.trim();
  const cdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  // Optional: the "reel_challenge" collection inside the library. Without it
  // the video lands in the library root, mixed in with the catalogue.
  //
  // Only a bare GUID is accepted. Copying the id out of the Bunny dashboard's
  // URL drags a `?colid=…` query string along with it, and Bunny answers that
  // with `Collection does not exist` — which reads like the collection was
  // deleted rather than like a typo in an environment variable.
  const rawCollection = process.env.BUNNY_STREAM_COLLECTION_ID?.trim() ?? "";
  const collectionId = /^[0-9a-f-]{36}$/i.test(rawCollection)
    ? rawCollection
    : null;

  if (rawCollection && !collectionId) {
    // Loud, but NOT fatal. An entry landing in the library root is a tidiness
    // problem for the organiser; refusing the upload would be a closed door for
    // the entrant, possibly hours before a deadline.
    console.error(
      "BUNNY_STREAM_COLLECTION_ID is not a bare GUID, ignoring it:",
      rawCollection,
    );
  }

  if (!libraryId || !apiKey || !cdnHostname) {
    return null;
  }
  return { libraryId, apiKey, cdnHostname, collectionId };
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

    const config = streamConfig();
    if (!config) {
      console.error("Bunny Stream env missing", {
        hasLibrary: Boolean(process.env.BUNNY_STREAM_LIBRARY_ID),
        hasKey: Boolean(process.env.BUNNY_STREAM_API_KEY),
        hasCdn: Boolean(process.env.BUNNY_STREAM_CDN_HOSTNAME),
      });
      return NextResponse.json(
        { error: "Bunny Stream тохиргоо дутуу байна." },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => null);
    const filmId = String(body?.filmId ?? "").trim();
    const fileName = String(body?.fileName ?? "").trim();
    const kind = body?.kind === "trailer" ? "trailer" : "film";

    if (!filmId) {
      return NextResponse.json({ error: "Кино тодорхойгүй байна." }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // film → application → event. Ownership comes from the application's
    // user_id against the verified caller, never from the request body.
    const { data: film, error: filmError } = await supabase
      .from("challenge_films")
      .select("id, application_id, event_id, status, title")
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

    // Create the video object. Bunny needs it to exist before anything can be
    // uploaded into it — the tus upload targets this guid.
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${config.libraryId}/videos`,
      {
        method: "POST",
        headers: {
          AccessKey: config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // The title is what an organiser sees in the Bunny dashboard, so it
          // has to say which of the two videos this is.
          title: `${kind === "trailer" ? "[Трейлэр] " : ""}${
            film.title?.trim() || fileName || film.id
          }`,
          ...(config.collectionId ? { collectionId: config.collectionId } : {}),
        }),
      },
    );

    if (!createRes.ok) {
      const details = await createRes.text().catch(() => "");
      console.error("Bunny Stream create video failed", {
        status: createRes.status,
        details,
      });
      return NextResponse.json(
        {
          error: details.includes("Collection does not exist")
            ? "Bunny-гийн collection олдсонгүй. BUNNY_STREAM_COLLECTION_ID-г шалгана уу."
            : "Bunny дээр видео үүсгэж чадсангүй.",
          details,
        },
        { status: 502 },
      );
    }

    const created = (await createRes.json()) as { guid?: string };
    const videoId = created.guid;
    if (!videoId) {
      return NextResponse.json(
        { error: "Bunny видеоны id буцаасангүй." },
        { status: 502 },
      );
    }

    const expire = Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS;
    const signature = createHash("sha256")
      .update(`${config.libraryId}${config.apiKey}${expire}${videoId}`)
      .digest("hex");

    // HLS rather than play_1080p.mp4: the playlist exists for every encoded
    // video, while a given mp4 rendition only exists if that resolution was
    // enabled and finished. The catalogue's own hls_url is the same shape.
    const playUrl = `https://${config.cdnHostname}/${videoId}/playlist.m3u8`;

    // Point the row at the new video straight away, under the service role —
    // the client holds no grant on any of these columns. `processing` rather
    // than `ready`: the bytes have not been sent yet, let alone encoded.
    const patch =
      kind === "trailer"
        ? {
            trailer_video_id: videoId,
            trailer_url: playUrl,
            trailer_status: "processing",
            trailer_uploaded_at: null,
          }
        : {
            film_video_id: videoId,
            film_url: playUrl,
            film_path: `${config.libraryId}/${videoId}`,
            film_status: "processing",
            film_uploaded_at: null,
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
      libraryId: config.libraryId,
      videoId,
      expire,
      signature,
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
