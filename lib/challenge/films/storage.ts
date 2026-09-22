import { SUPABASE_URL } from "../../supabase/config";

// Where a film's bytes live: the `challenge-films` bucket in Supabase Storage,
// created by 20260913000000_challenge_films_supabase_storage.sql.
//
// Shared by the two routes (film-ticket decides the path, film-status checks
// it exists) and the browser uploader (which needs the bucket name for tus
// metadata). Nothing here is secret — the bucket is public and SUPABASE_URL
// ships in every bundle — so this file is deliberately NOT `server-only`.

export const FILM_BUCKET = "challenge-films";

// tus upload endpoint. Supabase's resumable protocol lives at one fixed path
// per project; the bucket and object name go in the upload's metadata.
export const FILM_UPLOAD_ENDPOINT = `${SUPABASE_URL}/storage/v1/upload/resumable`;

const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${FILM_BUCKET}/`;

export function publicUrl(objectName: string): string {
  return `${PUBLIC_PREFIX}${objectName}`;
}

// Inverse of publicUrl. The trailer has no `trailer_path` column (only the
// film got one in 20260909), so its object name is read back out of the URL.
// Returns null for anything that is not one of our storage URLs — a Bunny
// playlist from before 20260913, an entrant's old pasted link.
export function objectNameFromUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith(PUBLIC_PREFIX) ? url.slice(PUBLIC_PREFIX.length) : null;
}
