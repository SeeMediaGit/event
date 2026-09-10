import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseAnonClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

// Step 2 of the film upload: ask Bunny whether the video has finished encoding
// and write the answer to the row.
//
// The browser cannot be trusted to report this — it uploaded the bytes, but
// "Bunny accepted them" and "Bunny produced a playable stream" are different
// facts, and only Bunny knows the second one. So the client calls this and this
// asks Bunny.
//
// A webhook would also work and would save the polling, but it needs a public
// endpoint registered in the Bunny dashboard and a shared secret to verify. One
// route the entrant's own page can call is fewer moving parts for the same
// outcome, and it also lets an organiser refresh a stuck row on demand.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bunny Stream video.status
//   0 Queued · 1 Processing · 2 Encoding · 3 Finished
//   4 Resolution finished · 5 Failed
function mapStatus(status: number): "processing" | "ready" | "failed" {
  if (status === 3 || status === 4) return "ready";
  if (status === 5) return "failed";
  return "processing";
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

    const { data: userData, error: userError } =
      await getSupabaseAnonClient().auth.getUser(accessToken);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "Нэвтрэлт хүчингүй байна. Дахин нэвтэрнэ үү." },
        { status: 401 },
      );
    }

    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID?.trim();
    const apiKey = process.env.BUNNY_STREAM_API_KEY?.trim();
    if (!libraryId || !apiKey) {
      return NextResponse.json(
        { error: "Bunny Stream тохиргоо дутуу байна." },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => null);
    const filmId = String(body?.filmId ?? "").trim();
    if (!filmId) {
      return NextResponse.json({ error: "Кино тодорхойгүй байна." }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: film, error: filmError } = await supabase
      .from("challenge_films")
      .select("id, application_id, film_video_id, film_status")
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

    if (!film.film_video_id) {
      return NextResponse.json({ status: "pending" });
    }

    const res = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${film.film_video_id}`,
      { headers: { AccessKey: apiKey }, cache: "no-store" },
    );

    if (!res.ok) {
      const details = await res.text().catch(() => "");
      console.error("Bunny Stream video fetch failed", { status: res.status, details });
      // Not an error the entrant caused, and not a reason to mark the film
      // failed — report the status we already have and let them retry.
      return NextResponse.json({ status: film.film_status });
    }

    const video = (await res.json()) as {
      status?: number;
      length?: number;
      encodeProgress?: number;
    };

    const mapped = mapStatus(Number(video.status ?? 0));

    if (mapped !== film.film_status) {
      const { error: updateError } = await supabase
        .from("challenge_films")
        .update({
          film_status: mapped,
          // Stamp the arrival time when the stream first becomes playable —
          // that is the moment the entry is genuinely in the organiser's hands.
          ...(mapped === "ready"
            ? { film_uploaded_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", film.id);

      if (updateError) {
        console.error("film-status: row update failed", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      status: mapped,
      encodeProgress: video.encodeProgress ?? null,
      durationSeconds: video.length ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("film-status route error", error);
    return NextResponse.json(
      { error: "Төлөв шалгахад алдаа гарлаа.", details: message },
      { status: 500 },
    );
  }
}
