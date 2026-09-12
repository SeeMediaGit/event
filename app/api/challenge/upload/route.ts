import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseAnonClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

// POSTER uploads for one film of a challenge entry, built the same way
// see_media_admin does it (app/api/admin/bunny/upload/route.ts): the browser
// posts the image here, this route holds the Bunny Storage access key and PUTs
// the bytes on to the CDN.
//
// Two kinds, told apart by the `kind` field:
//   poster            — босоо постер
//   horizontal_poster — хэвтээ постер
//
// THE FILM ITSELF NO LONGER COMES THROUGH HERE. A Vercel function caps a
// request body at 4.5 MB, which no real entry fits under, so films go browser →
// Bunny Stream directly over tus: /api/challenge/film-ticket issues a
// per-video signature and the bytes never touch this server.
//
// Posters cannot do the same, and that is the whole reason for the split: Bunny
// *Storage* authenticates with a zone-wide `AccessKey` header and has no
// per-object signed upload, so a browser holding that key could overwrite or
// delete the entire zone. Bunny *Stream* does offer a per-video signature.
// Images are small, so passing them through a server costs nothing.
//
// The URL travels one way only: it comes back and the *client* saves it,
// because poster_url and horizontal_poster_url are inside the entrant's column
// grant. Nothing here writes to the database.

export const runtime = "nodejs";
// The whole point of this route is receiving a file; nothing about it can be
// cached or statically evaluated.
export const dynamic = "force-dynamic";

// One folder for every film in the challenge. Change this one constant to
// rename the folder in the storage zone.
const CAMPAIGN_FOLDER = "campaign_reels";

// 4 MB, not 10: a Vercel function's request body is capped at 4.5 MB by the
// platform, so anything above that is rejected before this route runs and the
// browser sees a bare 413. The client shrinks posters below this first
// (lib/challenge/compressImage.ts); this is the backstop.
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

// The status the entry has to be in for anything to be accepted. Mirrors the
// challenge_films INSERT policy — the service role bypasses RLS, so every check
// that policy makes has to be made again here by hand.
const UPLOADABLE_APPLICATION_STATUSES = new Set([
  "paid",
  "uploaded",
  "under_review",
  "approved",
]);

type UploadKind = "poster" | "horizontal_poster";

const KIND_PREFIX: Record<UploadKind, string> = {
  poster: "poster",
  horizontal_poster: "poster-h",
};

// Same shape as the admin route: BUNNY_STORAGE_ENDPOINT wins if set, otherwise
// the region prefixes the hostname, and Frankfurt (Bunny's default) has no
// prefix at all.
function getStorageEndpoint(): string {
  const configured = process.env.BUNNY_STORAGE_ENDPOINT?.trim();
  if (configured) {
    return configured.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  const region = process.env.BUNNY_STORAGE_REGION?.trim().toLowerCase();
  if (!region || region === "de" || region === "frankfurt") {
    return "storage.bunnycdn.com";
  }
  return `${region}.storage.bunnycdn.com`;
}

function sanitizePathPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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

    // Verify the caller against Supabase before anything else. The user id used
    // below comes from this check, never from the request body — a client that
    // could name its own filmId could otherwise upload into someone else's entry.
    const { data: userData, error: userError } =
      await getSupabaseAnonClient().auth.getUser(accessToken);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "Нэвтрэлт хүчингүй байна. Дахин нэвтэрнэ үү." },
        { status: 401 },
      );
    }

    const storageZone = process.env.BUNNY_STORAGE_ZONE?.trim();
    const storageAccessKey = process.env.BUNNY_STORAGE_ACCESS_KEY?.trim();
    const cdnBaseUrl = process.env.BUNNY_CDN_BASE_URL?.trim().replace(/\/$/, "");

    if (!storageZone || !storageAccessKey || !cdnBaseUrl) {
      console.error("Bunny env missing", {
        hasZone: Boolean(storageZone),
        hasKey: Boolean(storageAccessKey),
        hasCdn: Boolean(cdnBaseUrl),
      });
      return NextResponse.json(
        { error: "Bunny CDN тохиргоо дутуу байна." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const filmId = String(formData.get("filmId") || "").trim();
    const kind = String(formData.get("kind") || "").trim() as UploadKind;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Файл сонгогдоогүй байна." },
        { status: 400 },
      );
    }
    if (!filmId) {
      return NextResponse.json({ error: "Кино тодорхойгүй байна." }, { status: 400 });
    }
    if (!(kind in KIND_PREFIX)) {
      return NextResponse.json({ error: "kind буруу байна." }, { status: 400 });
    }

    const extension = ALLOWED_IMAGE_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: "Зөвхөн JPG, PNG, WebP зураг оруулах боломжтой." },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "Зураг 4MB-аас бага байх ёстой." },
        { status: 413 },
      );
    }

    const supabase = getSupabaseServiceClient();

    // Two reads rather than one embed: film → application → event. Ownership is
    // decided by the application's user_id against the verified caller, so
    // whatever the body claimed about the film is irrelevant.
    const { data: film, error: filmError } = await supabase
      .from("challenge_films")
      .select("id, application_id, event_id, status")
      .eq("id", filmId)
      .maybeSingle();

    if (filmError) {
      console.error("upload: film lookup failed", filmError);
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
      console.error("upload: application lookup failed", appError);
      return NextResponse.json({ error: "Анкет уншиж чадсангүй." }, { status: 500 });
    }
    if (!application || application.user_id !== userData.user.id) {
      // Same answer for "not yours" and "does not exist" — telling them apart
      // would confirm that someone else's film id is real.
      return NextResponse.json({ error: "Кино олдсонгүй." }, { status: 404 });
    }
    if (!UPLOADABLE_APPLICATION_STATUSES.has(application.status)) {
      return NextResponse.json(
        { error: "Төлбөр төлсний дараа бүтээлээ оруулах боломжтой." },
        { status: 403 },
      );
    }

    // The service role bypasses RLS, so the deadline the INSERT policy enforces
    // has to be enforced again here — otherwise the one path that writes the
    // film file is also the one path that ignores the closing date.
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, submission_ends_at")
      .eq("id", film.event_id)
      .maybeSingle();

    if (eventError) {
      console.error("upload: event lookup failed", eventError);
      return NextResponse.json({ error: "Уралдаан уншиж чадсангүй." }, { status: 500 });
    }
    if (
      event?.submission_ends_at &&
      Date.now() > new Date(event.submission_ends_at).getTime()
    ) {
      return NextResponse.json(
        { error: "Бүтээл хүлээн авах хугацаа дууссан." },
        { status: 403 },
      );
    }

    // A film that has left the entrant's hands is not theirs to replace.
    if (film.status !== "draft" && film.status !== "submitted") {
      return NextResponse.json(
        { error: "Хянагдаж эхэлсэн киног солих боломжгүй." },
        { status: 403 },
      );
    }

    const fileName = `${KIND_PREFIX[kind]}-${Date.now()}.${extension}`;
    const storagePath = `${CAMPAIGN_FOLDER}/${sanitizePathPart(film.event_id)}/${sanitizePathPart(film.application_id)}/${sanitizePathPart(film.id)}/${fileName}`;
    const uploadUrl = `https://${getStorageEndpoint()}/${storageZone}/${storagePath}`;

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: storageAccessKey,
        "Content-Type": file.type,
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("Bunny upload failed", {
        status: response.status,
        details,
        storagePath,
      });
      return NextResponse.json(
        { error: "Bunny руу байршуулж чадсангүй.", details },
        { status: response.status },
      );
    }

    const url = `${cdnBaseUrl}/${storagePath}`;

    // Nothing is written to the row here: the entrant saves poster_url with the
    // rest of the form, so picking a poster and then abandoning the form does
    // not silently change a saved entry.
    return NextResponse.json({ url, path: storagePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("challenge upload route error", error);
    return NextResponse.json(
      { error: "Байршуулахад алдаа гарлаа.", details: message },
      { status: 500 },
    );
  }
}
