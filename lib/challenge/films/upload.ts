"use client";

import * as tus from "tus-js-client";
import { getSupabaseBrowserClient } from "../../supabase/client";

// Video upload, browser → Bunny Stream directly. Serves both videos an entry
// carries: the film and its trailer.
//
// The bytes never touch our server. /api/challenge/film-ticket creates the
// video object and returns a signature that authorises writing to THAT ONE
// video for an hour; tus then streams the file to Bunny in chunks. This is what
// removes the 4.5 MB Vercel body limit that made the old server-proxied upload
// unusable in production — and tus resumes rather than restarting when a phone
// changes network mid-upload.
//
// Posters still go through /api/challenge/upload: Bunny *Storage* has no
// per-object signature, only a zone-wide AccessKey, so those bytes have to pass
// through a server that keeps the key. Images are small, so that is fine.

// Bunny Stream handles far larger, but an entry that big is a mistake rather
// than a film — and the entrant deserves to be told before spending an hour
// uploading it.
export const MAX_FILM_SIZE = 5 * 1024 * 1024 * 1024;

export const ACCEPTED_FILM_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
];

// 50 MB chunks. Small enough that a dropped connection loses little, large
// enough that a 2 GB film is ~40 requests rather than hundreds.
const CHUNK_SIZE = 50 * 1024 * 1024;

export type VideoKind = "film" | "trailer";

export type FilmUploadResult =
  | { ok: true }
  | { ok: false; message: string };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Checked here as well as in the route. The route is the one that counts — this
// copy just saves the entrant a long upload that ends in a refusal.
export function checkFilmFile(file: File): string | null {
  if (!ACCEPTED_FILM_TYPES.includes(file.type)) {
    return "Зөвхөн MP4, MOV, WebM, MKV бичлэг оруулах боломжтой.";
  }
  if (file.size > MAX_FILM_SIZE) {
    return `Бичлэг ${formatBytes(MAX_FILM_SIZE)}-аас бага байх ёстой. Сонгосон файл: ${formatBytes(file.size)}.`;
  }
  return null;
}

async function accessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

type Ticket = {
  libraryId: string;
  videoId: string;
  expire: number;
  signature: string;
};

export async function uploadFilm({
  file,
  filmId,
  kind = "film",
  onProgress,
}: {
  file: File;
  filmId: string;
  kind?: VideoKind;
  onProgress?: (percent: number) => void;
}): Promise<FilmUploadResult> {
  const token = await accessToken();
  if (!token) {
    return { ok: false, message: "Нэвтрэлт дууссан байна. Дахин нэвтэрнэ үү." };
  }

  // 1. Ticket. Small JSON through our own server, which is where every
  //    ownership / paid / deadline check happens.
  let ticket: Ticket;
  try {
    const res = await fetch("/api/challenge/film-ticket", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ filmId, kind, fileName: file.name }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        message: body?.error ?? "Байршуулалт эхлүүлж чадсангүй.",
      };
    }
    ticket = body as Ticket;
  } catch (error) {
    console.error("film ticket error:", error);
    return {
      ok: false,
      message: "Сүлжээний алдаа. Интернэтээ шалгаад дахин оролдоно уу.",
    };
  }

  // 2. The file itself, straight to Bunny.
  return new Promise<FilmUploadResult>((resolve) => {
    const upload = new tus.Upload(file, {
      endpoint: "https://video.bunnycdn.com/tusupload",
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: CHUNK_SIZE,
      headers: {
        AuthorizationSignature: ticket.signature,
        AuthorizationExpire: String(ticket.expire),
        VideoId: ticket.videoId,
        LibraryId: ticket.libraryId,
      },
      metadata: {
        filetype: file.type,
        title: file.name,
      },
      onProgress: (uploaded, total) => {
        onProgress?.(Math.round((uploaded / total) * 100));
      },
      onSuccess: () => resolve({ ok: true }),
      onError: (error) => {
        console.error("tus upload error:", error);
        resolve({
          ok: false,
          message:
            "Байршуулалт тасарлаа. Интернэтээ шалгаад дахин оролдоно уу.",
        });
      },
    });

    // Resume rather than restart when a previous attempt for this same file
    // left a half-finished upload behind.
    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}

export type FilmEncodeStatus = "pending" | "processing" | "ready" | "failed";

// Ask our server, which asks Bunny. "Bunny accepted the bytes" and "Bunny
// produced a playable stream" are different facts and only the second one means
// the entry is really in.
export async function checkFilmStatus(
  filmId: string,
  kind: VideoKind = "film",
): Promise<{ status: FilmEncodeStatus; encodeProgress: number | null }> {
  const token = await accessToken();
  if (!token) return { status: "processing", encodeProgress: null };

  try {
    const res = await fetch("/api/challenge/film-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ filmId, kind }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { status: "processing", encodeProgress: null };
    return {
      status: (body?.status as FilmEncodeStatus) ?? "processing",
      encodeProgress: body?.encodeProgress ?? null,
    };
  } catch (error) {
    console.error("checkFilmStatus error:", error);
    return { status: "processing", encodeProgress: null };
  }
}
