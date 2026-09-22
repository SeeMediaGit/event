"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ACCEPTED_FILM_TYPES,
  checkFilmFile,
  formatBytes,
  uploadToBucket,
} from "@/lib/challenge/films/upload";
import { FILM_BUCKET, publicUrl } from "@/lib/challenge/films/storage";

/**
 * Байршуулалтын ТУРШИЛТЫН хуудас — зөвхөн хөгжүүлэлтэд.
 *
 * ЗОРИЛГО: уралдаан, анкет, төлбөр, хугацаа — юу ч байхгүй үед tus-ээр
 * Supabase Storage руу файл орж байгаа эсэхийг ганцаарчлан шалгах. Уралдаан
 * идэвхгүй, эсвэл өгөгдлийн санд нэг ч event байхгүй үед ч ажиллана.
 *
 * ЯАГААД TICKET ROUTE ДУУДАХГҮЙ ВЭ: /api/challenge/film-ticket нь бодит
 * бүтээлийн зам шийддэг бөгөөд тэр нь challenge_films мөр, төлсөн анкет,
 * дуусаагүй хугацаа гурвыг шаардана. Турших гэж тэр шалгалтуудыг сулруулах нь
 * буруу — оронд нь энэ хуудас bucket-ийн policy зөвшөөрдөг цорын ганц өөр зам
 * руу бичнэ: өөрийн `auth.uid()` хавтас дотор, `_test/` дэд хавтаст.
 * Өгөгдлийн санд ЮУ Ч бичихгүй.
 *
 * ЯГ ТЭР КОДЫГ ТУРШИНА: доорх `uploadToBucket` нь бодит байршуулалт ашигладаг
 * яг тэр функц (lib/challenge/films/upload.ts). Хуулбар биш — хуулбар туршвал
 * юу ч батлахгүй.
 *
 * PRODUCTION-Д ГАРАХГҮЙ: `next build` дээр NODE_ENV=production тул хуудас
 * өөрөө 404 буцаана. Deploy дээр санаатайгаар нээх шаардлагатай бол
 * `NEXT_PUBLIC_ENABLE_TEST_UPLOAD=true` env тавина.
 *
 * НЭВТРЭЛТ ЗААВАЛ: storage.objects-ийн policy «замын эхний хавтас = миний
 * auth.uid()» гэж шалгадаг тул session-гүйгээр байршуулах арга ҮГҮЙ.
 * /login дээр утас + нууц үгээрээ нэвтэрсэн байх хэрэгтэй.
 */

const ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ENABLE_TEST_UPLOAD === "true";

type Log = { at: string; text: string };

export default function DevUploadPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [result, setResult] = useState<
    { ok: true; url: string; objectName: string } | { ok: false; message: string } | null
  >(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const startedAt = useRef<number>(0);

  const log = (text: string) =>
    setLogs((prev) => [
      ...prev,
      { at: new Date().toLocaleTimeString("mn-MN"), text },
    ]);

  useEffect(() => {
    if (!ENABLED) return;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
      setChecking(false);
    });
  }, []);

  // Жинхэнэ 404 — production build дээр энэ route огт үүсэхгүй. ENABLED нь
  // build-ийн үед тогтмол болдог тул prerender дээрээ унаж, хуудас гарахгүй.
  if (!ENABLED) notFound();

  const start = async () => {
    if (!file) return;

    const invalid = checkFilmFile(file);
    if (invalid) {
      setResult({ ok: false, message: invalid });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setResult({ ok: false, message: "Нэвтрэлт алга. /login дээр нэвтэрнэ үү." });
      return;
    }

    // Policy: (storage.foldername(name))[1] = auth.uid(). `_test` дэд хавтас нь
    // бодит бүтээлийн <film_id> хавтаснуудаас ялгаж таниулна.
    const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const objectName = `${session.user.id}/_test/test-${Date.now()}.${extension}`;

    setResult(null);
    setPercent(0);
    setLogs([]);
    startedAt.current = Date.now();
    log(`Эхэллээ · ${file.name} · ${formatBytes(file.size)}`);
    log(`Зам: ${objectName}`);

    const res = await uploadToBucket({
      file,
      token: session.access_token,
      bucket: FILM_BUCKET,
      objectName,
      onProgress: setPercent,
    });

    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    if (res.ok) {
      const speed = formatBytes(Math.round(file.size / seconds));
      log(`Дууслаа · ${seconds} сек · ~${speed}/сек`);
      setResult({ ok: true, url: publicUrl(objectName), objectName });
    } else {
      log(`Алдаа: ${res.message}`);
      setResult({ ok: false, message: res.message });
    }
    setPercent(null);
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10 text-neutral-200">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-white">
          Байршуулалтын туршилт
        </h1>
        <p className="text-sm text-neutral-400">
          Supabase Storage · bucket <code className="text-neutral-300">{FILM_BUCKET}</code>{" "}
          · tus (resumable). Уралдаан, анкет, төлбөр шаардахгүй. Өгөгдлийн санд
          юу ч бичихгүй.
        </p>
      </header>

      {/* Нэвтрэлт — policy-гийн шалгуур учраас алгасах боломжгүй. */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-sm">
        {checking ? (
          <p className="text-neutral-400">Session шалгаж байна…</p>
        ) : userId ? (
          <p>
            Нэвтэрсэн:{" "}
            <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-emerald-400">
              {userId}
            </code>
            <span className="mt-1 block text-xs text-neutral-500">
              Файл энэ id-тай хавтас дотор орно — bucket-ийн policy яг үүнийг
              шалгадаг.
            </span>
          </p>
        ) : (
          <p className="text-amber-400">
            Нэвтрээгүй байна. Storage policy «эхний хавтас = миний auth.uid()»
            гэж шалгадаг тул нэвтрэхгүйгээр байршуулах арга байхгүй.{" "}
            <Link href="/login" className="underline">
              /login
            </Link>
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <input
          type="file"
          accept={ACCEPTED_FILM_TYPES.join(",")}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
            setLogs([]);
          }}
          className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-700 file:px-3 file:py-2 file:text-sm file:text-white"
        />

        {file && (
          <p className="text-xs text-neutral-400">
            {file.name} · {formatBytes(file.size)} · {file.type || "төрөл тодорхойгүй"}
          </p>
        )}

        <button
          type="button"
          onClick={start}
          disabled={!file || !userId || percent !== null}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-700"
        >
          {percent !== null ? `Байршуулж байна… ${percent}%` : "Туршиж байршуулах"}
        </button>

        {percent !== null && (
          <div className="h-2 w-full overflow-hidden rounded bg-neutral-800">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </section>

      {result?.ok === true && (
        <section className="space-y-2 rounded-lg border border-emerald-800 bg-emerald-950/40 p-4 text-sm">
          <p className="font-medium text-emerald-300">Амжилттай.</p>
          <p className="break-all text-xs text-neutral-300">{result.objectName}</p>
          <video src={result.url} controls className="w-full rounded-md bg-black" />
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="inline-block break-all text-xs text-emerald-400 underline"
          >
            {result.url}
          </a>
          <p className="text-xs text-neutral-500">
            Цэвэрлэх: Supabase Dashboard → Storage → {FILM_BUCKET} →{" "}
            <code>{userId}/_test/</code>. Bucket дээр delete policy байхгүй тул
            browser-оос устгах боломжгүй — санаатай.
          </p>
        </section>
      )}

      {result?.ok === false && (
        <section className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {result.message}
        </section>
      )}

      {logs.length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-black/40 p-3 font-mono text-xs text-neutral-400">
          {logs.map((entry, i) => (
            <div key={i}>
              <span className="text-neutral-600">{entry.at}</span> {entry.text}
            </div>
          ))}
        </section>
      )}

      <p className="text-xs text-neutral-600">
        Энэ хуудас production build дээр 404 буцаана
        (NEXT_PUBLIC_ENABLE_TEST_UPLOAD=true-ээс бусад тохиолдолд).
      </p>
    </main>
  );
}
