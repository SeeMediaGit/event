"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  FileVideo,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { fetchMyApplication } from "@/lib/challenge/api";
import type { ChallengeApplication } from "@/lib/challenge/types";
import {
  ACCEPTED_FILM_TYPES,
  formatBytes,
  MAX_FILM_SIZE,
  uploadFilm,
} from "@/lib/challenge/upload";
import { formatDateTime } from "@/lib/events/format";
import { isSubmissionOpen, type SeeEvent } from "@/lib/events/types";

// Step 4. The file goes to /api/challenge/upload, which puts it in the Bunny
// storage zone under campaign_reels/ — the same storage-zone upload the admin
// panel uses for its own media, not Bunny Stream.
export default function UploadStep({
  event,
  application,
  onUploaded,
}: {
  event: SeeEvent;
  application: ChallengeApplication | null;
  onUploaded: (application: ChallengeApplication) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = isSubmissionOpen(event);
  const uploaded = Boolean(application?.film_file_url);
  const busy = progress !== null;

  const pick = (selected: File | null) => {
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    // Checked here as well as in the route. The route is the one that counts —
    // this copy just saves the applicant a long upload that ends in a refusal.
    if (!ACCEPTED_FILM_TYPES.includes(selected.type)) {
      setError("Зөвхөн MP4, MOV, WebM, MKV бичлэг оруулах боломжтой.");
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILM_SIZE) {
      setError(
        `Бичлэг ${formatBytes(MAX_FILM_SIZE)}-аас бага байх ёстой. Сонгосон файл: ${formatBytes(selected.size)}.`,
      );
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const send = async () => {
    if (!file || !application) return;
    setError(null);
    setProgress(0);

    const result = await uploadFilm({
      file,
      eventId: event.id,
      onProgress: setProgress,
    });

    if (!result.ok) {
      setProgress(null);
      setError(result.message);
      return;
    }

    // The route wrote the row under the service role, so re-read it rather than
    // patching a guess into local state — that read is also what proves the
    // write landed.
    const fresh = await fetchMyApplication(event.id);
    setProgress(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    if (fresh) onUploaded(fresh);
  };

  return (
    <div className="space-y-5">
      {uploaded && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              Бүтээл хүлээн авлаа.
            </p>
            <p className="mt-1 break-all text-xs text-muted">
              {application?.film_file_path}
            </p>
            {application?.film_uploaded_at && (
              <p className="mt-1 text-xs text-muted">
                {formatDateTime(application.film_uploaded_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {!open ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
          <Clapperboard size={30} className="mb-4 text-white/20" />
          <p className="text-sm font-semibold text-white/80">
            Бүтээл хүлээн авах хугацаа дууссан.
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {event.submission_ends_at
              ? `${formatDateTime(event.submission_ends_at)}-д хаагдсан.`
              : ""}
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-ink-surface/60 p-5 backdrop-blur-md transition-colors hover:border-brand/25 sm:p-6">
          {/* Faint brand bloom in the corner — the only depth cue; no drop
              shadows anywhere in this design. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-brand/5 blur-[60px]"
          />
          <h2 className="relative text-sm font-bold text-white">
            {uploaded ? "Бүтээлээ солих" : "Бүтээлээ оруулах"}
          </h2>
          <p className="relative mt-1 text-xs text-muted">
            MP4, MOV, WebM, MKV. Дээд хэмжээ {formatBytes(MAX_FILM_SIZE)}.
          </p>

          <label
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-ink px-6 py-10 text-center transition hover:border-brand/40 ${
              busy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FILM_TYPES.join(",")}
              className="sr-only"
              disabled={busy}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <span
              className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full border transition ${
                file
                  ? "border-brand/40 bg-brand/10 text-brand shadow-glow"
                  : "border-white/10 bg-ink-elevated text-white/30"
              }`}
            >
              {file ? <FileVideo size={26} /> : <UploadCloud size={26} />}
            </span>
            {file ? (
              <>
                <span className="max-w-full break-all text-sm font-bold text-white">
                  {file.name}
                </span>
                <span className="mt-1 text-xs text-muted">
                  {formatBytes(file.size)}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-white/80">
                  Файлаа сонгоно уу
                </span>
                <span className="mt-1 text-xs text-muted">
                  Энд дарж компьютерээсээ сонгоно
                </span>
              </>
            )}

            {/* Progress lives inside the drop zone, directly under the file it
                describes, rather than floating below the card. */}
            {busy && file && (
              <span className="mt-6 block w-full">
                <span className="mb-2 flex items-end justify-between">
                  <span className="text-xs text-muted">Байршуулж байна…</span>
                  <span className="text-sm font-bold text-brand">
                    {progress}%
                  </span>
                </span>
                <span className="block h-2 w-full overflow-hidden rounded-full border border-white/8 bg-ink-elevated">
                  <span
                    className="block h-full rounded-full bg-brand shadow-[0_0_10px_rgba(34,197,94,0.5)] transition-[width] duration-200 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </span>
                <span className="mt-2 block text-xs text-muted">
                  {formatBytes(Math.round((file.size * (progress ?? 0)) / 100))}{" "}
                  / {formatBytes(file.size)}
                </span>
              </span>
            )}
          </label>

          {error && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={send}
            disabled={!file || busy || !application}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-bold text-black shadow-glow transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <UploadCloud size={16} />
            )}
            {busy ? "Байршуулж байна…" : "Илгээх"}
          </button>
        </div>
      )}

      {event.submission_ends_at && open && (
        <p className="text-xs text-muted">
          Эцсийн хугацаа:{" "}
          <span className="font-semibold text-white/80">
            {formatDateTime(event.submission_ends_at)}
          </span>
        </p>
      )}
    </div>
  );
}
