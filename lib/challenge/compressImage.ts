"use client";

import imageCompression from "browser-image-compression";

// Posters are the ONLY thing this site still pushes through its own server, and
// a Vercel function refuses a request body over 4.5 MB before the route ever
// runs — no error of ours reaches the browser, just a bare 413. A phone photo
// is routinely 6-12 MB, so without this step "оруулах" simply failed for the
// entrants most likely to shoot on a phone.
//
// see_media_admin/lib/compressImage.ts does the same for the admin panel; the
// difference here is what happens when it does NOT help. The admin uploads the
// original and lets its bigger limit absorb it. This one refuses, because
// uploading anyway means a 413 the entrant cannot interpret.

// Well under Vercel's 4.5 MB, with room for the multipart envelope.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Below this a poster is already smaller than anything the UI needs, so
// re-encoding would only cost quality.
const COMPRESSION_THRESHOLD = 400 * 1024;

// 1600px covers a full-bleed cover on a 3x tablet; a 2:3 poster never needs more.
const MAX_DIMENSION = 1600;

export type CompressResult =
  | { ok: true; file: File }
  | { ok: false; message: string };

export async function compressPoster(file: File): Promise<CompressResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "Зөвхөн зураг оруулах боломжтой." };
  }

  if (file.size <= COMPRESSION_THRESHOLD) {
    return { ok: true, file };
  }

  let candidate = file;
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.82,
      fileType: file.type,
    });
    candidate =
      compressed instanceof File
        ? compressed
        : new File([compressed], file.name, { type: file.type });
  } catch (error) {
    // Fall through with the original: it may still be small enough, and the
    // size check below is what actually protects the upload.
    console.warn("Poster compression failed:", error);
  }

  if (candidate.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message:
        "Зураг хэт том байна. Багасгаад эсвэл өөр зураг сонгоод дахин оролдоно уу.",
    };
  }

  return { ok: true, file: candidate };
}
