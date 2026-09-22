import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseAnonClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import { FILM_BUCKET, objectNameFromUrl } from "@/lib/challenge/films/storage";

// Step 2 of a video upload: confirm the object is really in the bucket and
// write the answer to the row. Serves both the film and its trailer, told
// apart by `kind` — same as film-ticket.
//
// The browser cannot be trusted to report this — it uploaded the bytes, but
// "the upload call returned" and "the object exists in storage" are different
// facts, and only storage knows the second one. So the client calls this and
// this asks storage under the service role, then flips film_status, which the
// client holds no grant on.
//
// Until 20260913 this asked Bunny Stream whether transcoding had finished.
// Storage has no transcode step: the object either exists (ready) or it does
// not (pending). `processing` is kept in the type for rows written before the
// switch; nothing writes it any more.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FileStatus = "pending" | "processing" | "ready" | "failed";

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
    const kind = body?.kind === "trailer" ? "trailer" : "film";
    if (!filmId) {
      return NextResponse.json({ error: "Кино тодорхойгүй байна." }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: film, error: filmError } = await supabase
      .from("challenge_films")
      .select(
        "id, application_id, film_path, film_status, trailer_url, trailer_status",
      )
      .eq("id", filmId)
      .maybeSingle();

    if (filmError) {
      console.error("film-status: film lookup failed", filmError);
      return NextResponse.json({ error: "Кино уншиж чадсангүй." }, { status: 500 });
    }
    if (!film) {
      return NextResponse.json({ error: "Кино олдсонгүй." }, { status: 404 });
    }

    const { data: application } = await supabase
      .from("challenge_applications")
      .select("id, user_id")
      .eq("id", film.application_id)
      .maybeSingle();

    if (!application || application.user_id !== userData.user.id) {
      return NextResponse.json({ error: "Кино олдсонгүй." }, { status: 404 });
    }

    const objectName =
      kind === "trailer"
        ? objectNameFromUrl(film.trailer_url)
        : film.film_path;
    const currentStatus: FileStatus =
      kind === "trailer" ? film.trailer_status : film.film_status;

    // No storage path on the row: either no ticket was ever issued, or the row
    // still points at a Bunny Stream video from before the switch. In the
    // second case whatever status Bunny left behind stands — there is nothing
    // in the bucket to check against and rewriting it would lose a good film.
    if (!objectName || !objectName.includes("/")) {
      return NextResponse.json({ status: currentStatus, encodeProgress: null });
    }

    // Already confirmed once. Storage objects do not un-exist on their own, so
    // a second round-trip would only cost the entrant a wait.
    if (currentStatus === "ready") {
      return NextResponse.json({ status: "ready", encodeProgress: null });
    }

    const { data: info, error: infoError } = await supabase.storage
      .from(FILM_BUCKET)
      .info(objectName);

    // A missing object is the normal answer while the upload is still in
    // flight (or was abandoned), so it is `pending` — not an error, and not
    // `failed`. Anything other than "not found" is a storage problem that is
    // not the entrant's fault: report what we already have and let them retry.
    if (infoError) {
      const code = String(
        (infoError as { statusCode?: string | number }).statusCode ?? "",
      );
      const notFound =
        code === "404" || /not found|does not exist/i.test(infoError.message);
      if (!notFound) {
        console.error("film-status: storage info failed", infoError);
        return NextResponse.json({ status: currentStatus, encodeProgress: null });
      }
      return NextResponse.json({ status: "pending", encodeProgress: null });
    }
    if (!info) {
      return NextResponse.json({ status: "pending", encodeProgress: null });
    }

    // Storage accepts the object as soon as the last tus chunk lands, but a
    // zero-byte object is not a film — treat it like nothing arrived.
    if (info.size !== undefined && info.size !== null && info.size <= 0) {
      return NextResponse.json({ status: "pending", encodeProgress: null });
    }

    const now = new Date().toISOString();
    const patch =
      kind === "trailer"
        ? { trailer_status: "ready", trailer_uploaded_at: now }
        : { film_status: "ready", film_uploaded_at: now };

    const { error: updateError } = await supabase
      .from("challenge_films")
      .update(patch)
      .eq("id", film.id);

    if (updateError) {
      console.error("film-status: row update failed", updateError);
      return NextResponse.json({ error: "Төлөв хадгалж чадсангүй." }, { status: 500 });
    }

    return NextResponse.json({ status: "ready", encodeProgress: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("film-status route error", error);
    return NextResponse.json(
      { error: "Төлөв шалгахад алдаа гарлаа.", details: message },
      { status: 500 },
    );
  }
}
