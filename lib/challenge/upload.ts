"use client";

import { getSupabaseBrowserClient } from "../supabase/client";

// Client half of the film upload, mirroring
// see_media_admin/lib/bunnyUpload.ts: attach the Supabase access token, post a
// multipart body to our own route, and let that route talk to Bunny.
//
// XMLHttpRequest rather than fetch — the one thing this differs on. fetch gives
// no upload progress, and a film is not a poster: a hundred-megabyte upload with
// no progress bar is indistinguishable from a hung page.

export const ACCEPTED_FILM_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
];

export const MAX_FILM_SIZE = 200 * 1024 * 1024;

export type UploadResult =
  | { ok: true; url: string; path: string }
  | { ok: false; message: string };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export async function uploadFilm({
  file,
  eventId,
  onProgress,
}: {
  file: File;
  eventId: string;
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
  body.append("eventId", eventId);

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
          message: "Файл хэт том байна. Багасгаад дахин оролдоно уу.",
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
