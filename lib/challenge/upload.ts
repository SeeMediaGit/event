"use client";

import { getSupabaseBrowserClient } from "../supabase/client";

// Client half of the challenge uploads, mirroring
// see_media_admin/lib/bunnyUpload.ts: attach the Supabase access token, post a
// multipart body to our own route, and let that route talk to Bunny.
//
// XMLHttpRequest rather than fetch — the one thing this differs on. fetch gives
// no upload progress, and a film is not a poster: a hundred-megabyte upload
// with no progress bar is indistinguishable from a hung page.

export const ACCEPTED_FILM_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
];

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const MAX_FILM_SIZE = 200 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export type UploadKind = "poster" | "horizontal_poster" | "film";

export type UploadResult =
  | { ok: true; url: string; path: string }
  | { ok: false; message: string };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Checked here as well as in the route. The route is the one that counts — this
// copy just saves the entrant a long upload that ends in a refusal.
export function checkFile(file: File, kind: UploadKind): string | null {
  const isFilm = kind === "film";
  const types = isFilm ? ACCEPTED_FILM_TYPES : ACCEPTED_IMAGE_TYPES;
  const max = isFilm ? MAX_FILM_SIZE : MAX_IMAGE_SIZE;

  if (!types.includes(file.type)) {
    return isFilm
      ? "Зөвхөн MP4, MOV, WebM, MKV бичлэг оруулах боломжтой."
      : "Зөвхөн JPG, PNG, WebP зураг оруулах боломжтой.";
  }
  if (file.size > max) {
    return `Файл ${formatBytes(max)}-аас бага байх ёстой. Сонгосон файл: ${formatBytes(file.size)}.`;
  }
  return null;
}

export async function uploadChallengeFile({
  file,
  filmId,
  kind,
  onProgress,
}: {
  file: File;
  filmId: string;
  kind: UploadKind;
  onProgress?: (percent: number) => void;
}): Promise<UploadResult> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { ok: false, message: "Нэвтрэлт дууссан байна. Дахин нэвтэрнэ үү." };
  }

  const body = new FormData();
  body.append("file", file);
  body.append("filmId", filmId);
  body.append("kind", kind);

  return new Promise<UploadResult>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/challenge/upload");
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      let parsed: { url?: string; path?: string; error?: string } | null = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && parsed?.url && parsed?.path) {
        resolve({ ok: true, url: parsed.url, path: parsed.path });
        return;
      }

      // 413 is worth naming separately: on Vercel it is the platform rejecting
      // the request body before the route ever runs, so the route's own message
      // never arrives and a generic "upload failed" would be misleading.
      if (xhr.status === 413) {
        resolve({
          ok: false,
          message:
            kind === "film"
              ? "Файл хэт том байна. Одоогоор 4.5MB-аас том бичлэг серверээр дамжихгүй."
              : "Зураг хэт том байна. Багасгаад дахин оролдоно уу.",
        });
        return;
      }

      resolve({
        ok: false,
        message: parsed?.error || "Байршуулж чадсангүй. Дахин оролдоно уу.",
      });
    });

    xhr.addEventListener("error", () => {
      resolve({
        ok: false,
        message: "Сүлжээний алдаа. Интернэтээ шалгаад дахин оролдоно уу.",
      });
    });

    xhr.addEventListener("abort", () => {
      resolve({ ok: false, message: "Байршуулалт цуцлагдлаа." });
    });

    xhr.send(body);
  });
}
