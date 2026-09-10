"use client";

import { getSupabaseBrowserClient } from "../supabase/client";

// POSTERS ONLY. Mirrors see_media_admin/lib/bunnyUpload.ts: attach the Supabase
// access token, post a multipart body to our own route, and let that route talk
// to Bunny Storage.
//
// The film itself does NOT come through here — it goes browser → Bunny Stream
// directly over tus (lib/challenge/films/upload.ts). The split is not stylistic:
// Bunny *Storage* authenticates with a zone-wide AccessKey and has no
// per-object signature, so its bytes must pass through a server holding that
// key, and a Vercel function caps a request body at 4.5 MB. Posters fit under
// that; films never did.
//
// XMLHttpRequest rather than fetch — fetch gives no upload progress.

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export type UploadKind = "poster" | "horizontal_poster";

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
// copy just saves the entrant an upload that ends in a refusal.
export function checkFile(file: File, _kind: UploadKind): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Зөвхөн JPG, PNG, WebP зураг оруулах боломжтой.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return `Зураг ${formatBytes(MAX_IMAGE_SIZE)}-аас бага байх ёстой. Сонгосон файл: ${formatBytes(file.size)}.`;
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
          message: "Зураг хэт том байна. Багасгаад дахин оролдоно уу.",
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
