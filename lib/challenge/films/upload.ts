"use client";

import * as tus from "tus-js-client";
import { getSupabaseBrowserClient } from "../../supabase/client";
import { FILM_UPLOAD_ENDPOINT } from "./storage";

// Video upload, browser → Supabase Storage directly. Serves both videos an
// entry carries: the film and its trailer.
//
// The bytes never touch our server. /api/challenge/film-ticket decides the
// object path (after checking ownership, payment and the deadline) and writes
// it to the row; tus then streams the file into the `challenge-films` bucket
// in chunks, authorised by the entrant's own session JWT and the bucket policy
// ("first folder = my user id"). This is what removes the 4.5 MB Vercel body
// limit that made the old server-proxied upload unusable in production — and
// tus resumes rather than restarting when a phone changes network mid-upload.
//
// Until 20260913 the target was Bunny Stream, which transcoded after upload
// and made the entrant wait through "боловсруулж байна". Storage has no such
// step: once the last chunk lands the file is there and playable.
//
// Posters still go through /api/challenge/upload to Bunny Storage — images are
// small, so that is fine.

// The bucket's file_size_limit is 5 GB too. Note the project's global limit
// (Dashboard → Storage → Settings) has to be raised to match; it defaults to
// 50 MB and storage refuses anything larger regardless of what this says.
export const MAX_FILM_SIZE = 5 * 1024 * 1024 * 1024;

export const ACCEPTED_FILM_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
];

// Supabase's resumable endpoint accepts exactly 6 MB chunks — anything else
// is rejected — so this is not tunable the way the old 50 MB Bunny chunk was.
const CHUNK_SIZE = 6 * 1024 * 1024;

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
  bucket: string;
  objectName: string;
  url: string;
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
  //    ownership / paid / deadline check happens and where the row is pointed
  //    at the path the file is about to land in.
  let ticket: Ticket;
  try {
    const res = await fetch("/api/challenge/film-ticket", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ filmId, kind, fileType: file.type }),
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

  // 2. The file itself, straight to Supabase Storage.
  return uploadToBucket({
    file,
    token,
    bucket: ticket.bucket,
    objectName: ticket.objectName,
    onProgress,
  });
}

// The tus half on its own: everything from "we know where this file goes" to
// "the last chunk landed". Split out of uploadFilm so that the dev-only test
// page (app/dev/upload) exercises THIS code rather than a copy of it — a test
// button that tests a parallel implementation proves nothing.
//
// It takes the object name rather than deciding one: only /api/challenge/
// film-ticket may decide a path for a real entry, because that is where
// ownership, payment and the deadline are checked.
export function uploadToBucket({
  file,
  token,
  bucket,
  objectName,
  onProgress,
}: {
  file: File;
  token: string;
  bucket: string;
  objectName: string;
  onProgress?: (percent: number) => void;
}): Promise<FilmUploadResult> {
  return new Promise<FilmUploadResult>((resolve) => {
    const upload = new tus.Upload(file, {
      endpoint: FILM_UPLOAD_ENDPOINT,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: CHUNK_SIZE,
      // Supabase's protocol wants the first chunk in the creation request and
      // a fresh fingerprint per finished upload — both straight from their
      // resumable-upload docs.
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${token}`,
        // Overwrite if a half-finished object with this exact name is already
        // there (a retried upload). The name carries a timestamp, so this
        // never clobbers a DIFFERENT film.
        "x-upsert": "true",
      },
      metadata: {
        bucketName: bucket,
        objectName,
        contentType: file.type,
        cacheControl: "3600",
      },
      // Scope the resume key to THIS object, not just to the file.
      //
      // tus-js-client remembers unfinished uploads by a fingerprint of the
      // file, so picking the same film again would resume the PREVIOUS
      // attempt's upload URL — which belongs to the previous ticket's object
      // name. The bytes would then land under that older name while the row
      // pointed at the new, empty one.
      fingerprint: async (f) =>
        ["supabase", objectName, f.name, f.size, f.lastModified].join("-"),
      onProgress: (uploaded, total) => {
        onProgress?.(Math.round((uploaded / total) * 100));
      },
      onSuccess: () => resolve({ ok: true }),
      onError: (error) => {
        console.error("tus upload error:", error);
        const status = (error as { originalResponse?: { getStatus?: () => number } })
          .originalResponse?.getStatus?.();
        resolve({
          ok: false,
          message:
            status === 413
              ? "Файл storage-ийн зөвшөөрөгдсөн хэмжээнээс том байна."
              : status === 403 || status === 401
                ? "Байршуулах эрх алга. Дахин нэвтэрч орно уу."
                : "Байршуулалт тасарлаа. Интернэтээ шалгаад дахин оролдоно уу.",
        });
      },
    });

    // Resume rather than restart when an attempt AGAINST THIS SAME OBJECT left
    // a half-finished upload behind. A new ticket means a new object name, so
    // it deliberately finds nothing and starts clean.
    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}

export type FilmEncodeStatus = "pending" | "processing" | "ready" | "failed";

// Ask our server, which asks storage. "The upload call returned" and "the
// object is in the bucket" are different facts and only the second one means
// the entry is really in — it is also the call that flips film_status to
// ready, which the browser has no grant to do itself.
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
