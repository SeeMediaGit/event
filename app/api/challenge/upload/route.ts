import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseAnonClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

// Film upload for step 4, built the same way see_media_admin does it
// (app/api/admin/bunny/upload/route.ts): the browser posts the file here, this
// route holds the Bunny Storage access key and PUTs the bytes on to the CDN.
//
// It is NOT Bunny Stream. Nothing here creates a video object, waits for a
// transcode, or hands back an HLS URL — the file lands in the storage zone as a
// plain object and is served straight off BUNNY_CDN_BASE_URL, exactly like the
// admin panel's posters and banner clips.
//
// WHY THE KEY CANNOT GO TO THE BROWSER: Bunny Storage authenticates with an
// `AccessKey` header and has no per-object signed upload. A browser holding that
// key could overwrite or delete the entire zone, so the bytes have to pass
// through a server that keeps it.

export const runtime = "nodejs";
// The whole point of this route is receiving a file; nothing about it can be
// cached or statically evaluated.
export const dynamic = "force-dynamic";

// One folder for every film in the challenge. Change this one constant to
// rename the folder in the storage zone.
const CAMPAIGN_FOLDER = "campaign_reels";

const MAX_FILM_SIZE = 200 * 1024 * 1024;

const ALLOWED_VIDEO_TYPES = new Map<string, string>([
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
  ["video/x-matroska", "mkv"],
]);

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
    // could name its own applicationId could upload into someone else's entry.
    const { data: userData, error: userError } = await getSupabaseAnonClient()
      .auth.getUser(accessToken);

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
    const eventId = String(formData.get("eventId") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Файл сонгогдоогүй байна." },
        { status: 400 },
      );
    }
    if (!eventId) {
      return NextResponse.json(
        { error: "Уралдаан тодорхойгүй байна." },
        { status: 400 },
      );
    }

    const extension = ALLOWED_VIDEO_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: "Зөвхөн MP4, MOV, WebM, MKV бичлэг оруулах боломжтой." },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILM_SIZE) {
      return NextResponse.json(
        { error: "Бичлэг 200MB-аас бага байх ёстой." },
        { status: 413 },
      );
    }

    const supabase = getSupabaseServiceClient();

    // The application is looked up by (event, caller) — the pair is unique — so
    // the row that gets written is always the caller's own, whatever the body
    // claimed. Status is checked here too: step 4 opens after payment.
    const { data: application, error: appError } = await supabase
      .from("challenge_applications")
      .select("id, status, film_file_path")
      .eq("event_id", eventId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (appError) {
      console.error("upload: application lookup failed", appError);
      return NextResponse.json(
        { error: "Анкет уншиж чадсангүй." },
        { status: 500 },
      );
    }
    if (!application) {
      return NextResponse.json(
        { error: "Энэ уралдаанд таны анкет олдсонгүй." },
        { status: 403 },
      );
    }

    const UPLOADABLE = new Set(["paid", "uploaded", "under_review", "rejected"]);
    if (!UPLOADABLE.has(application.status)) {
      return NextResponse.json(
        { error: "Төлбөр төлсний дараа бүтээлээ оруулах боломжтой." },
        { status: 403 },
      );
    }

    const fileName = `film-${Date.now()}.${extension}`;
    const storagePath = `${CAMPAIGN_FOLDER}/${sanitizePathPart(eventId)}/${sanitizePathPart(application.id)}/${fileName}`;
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

    // Service role, so this can touch the columns the client has no grant on
    // and move the status past 'submitted' — both of which RLS and the column
    // grants deliberately forbid from the browser.
    const { error: updateError } = await supabase
      .from("challenge_applications")
      .update({
        film_file_url: url,
        film_file_path: storagePath,
        film_uploaded_at: new Date().toISOString(),
        status: "uploaded",
      })
      .eq("id", application.id);

    if (updateError) {
      // The bytes are on the CDN but the row does not point at them. Say so
      // plainly rather than reporting success — a silent half-write here means
      // an entry that looks delivered and is not.
      console.error("upload: row update failed", updateError, { storagePath });
      return NextResponse.json(
        { error: "Файл хуулагдсан ч анкетад бүртгэгдсэнгүй. Дахин оролдоно уу." },
        { status: 500 },
      );
    }

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
