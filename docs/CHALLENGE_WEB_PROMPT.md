# Prompt — Reel Film Challenge web (events.seemedia.mn)

`events/` хавтсанд Claude Code нээгээд доорхийг бүхэлд нь өгнө.

---

Чи `events/` төслийг (Next.js 15 App Router, Tailwind, supabase-js, lucide-react) хөгжүүлж байна. Энэ нь `events.seemedia.mn` дээр deploy хийгддэг, нэвтрэлтийн ард байдаг уралдааны сайт. Эхлээд `ARCHITECTURE.md`, `supabase/migrations/20260729_events_schema.sql`, `supabase/migrations/20260907_challenge_applications.sql` гурвыг бүрэн унш. Дараа нь `components/`, `lib/`, `app/` доторх бүх файлыг унш. Одоо байгаа AuthProvider, AuthGuard, LoginForm, Navbar, lib/supabase/*, lib/events/* -ийг **дахин ашиглана**, дахин бичихгүй.

## Зорилго

«Reel Film Challenge» уралдааны оролцогчийн web-ийг хийнэ. Одоогийн жагсаалт + дэлгэрэнгүй хуудсыг хэвээр үлдээгээд, `events.kind = 'challenge'` мөрүүдэд зориулсан шинэ урсгал нэмнэ.

## Хуудас ба урсгал

`/challenge/[slug]` — нэг хуудас, 4 алхамтай stepper. Алхам бүр өмнөхийг дуусгасан үед л идэвхжинэ, төлөв нь `challenge_applications.status`-аас уншигдана.

1. **Танилцуулга** — 3D hero (доор), уралдааны нэр, subtitle, cover, `rules` (markdown → энгийн жагсаалт), огноонууд (`starts_at`, `registration_ends_at`, `submission_ends_at`), `entry_fee`, `PhaseBadge`. Нэвтрээгүй хүнд харагдана; «Оролцох» дарахад `/login?next=/challenge/[slug]` руу.
2. **Анкет** — `challenge_applications`-д бичнэ. 5 хэсэг, цаасан анкеттай яг ижил:
   - Хувийн: `full_name`, `age`, `gender` (male/female/other), `phone`, `email`, `social_url`, `city`
   - Багийн: `participation` (solo/team). `team` сонгосон үед л `team_name`, `team_leader`, `team_size` гарна
   - Киноны: `film_title`, `film_genre` text[] (Инээдэм, Романтик, Аймшиг, Адал явдал, Тулаант, Драм, Уран зөгнөл, Бусад — олон сонголт), «Бусад» үед `film_genre_other`, `film_synopsis`
   - Бүтээлийн: `shot_with` (phone/camera/mixed), `edit_software` text[] (CapCut, VN, Premiere Pro, DaVinci Resolve, Final Cut Pro, Бусад), «Бусад» үед `edit_software_other`
   - Нэмэлт: `has_prior_films`, тийм үед `prior_films_note`
   - «Түр хадгалах» → `status = 'draft'`. «Илгээх» → `status = 'submitted'`, `submitted_at = now()`. Илгээсний дараа форм зөвхөн уншигдана.
   - Формыг нээхэд `profiles`-оос `full_name`, `phone`, `email`-ийг урьдчилан бөглөнө (AuthProvider-ийн `appUser`).
3. **Суурь хураамж** — `status = 'submitted'` үед нээгдэнэ. Одоогоор зөвхөн дүн + «Төлбөрийн хэсэг удахгүй нээгдэнэ» гэсэн placeholder карт. `status = 'paid'` бол `registration_no`-г том харуулна. QPay-г энэ даалгаварт хийхгүй.
4. **Бүтээл** — `status = 'paid'` үед нээгдэнэ, одоогоор түгжээтэй placeholder («Upload хэсэг удахгүй»). Хүснэгт нь хараахан байхгүй.

`/challenge/[slug]`-д stepper-ийн одоогийн алхам URL-д хадгалагдана (`?step=2`), refresh хийхэд алдагдахгүй.

Жагсаалтын хуудас (`app/(app)/page.tsx`) дээр `kind = 'challenge'` мөрийн карт `/challenge/[slug]` руу, бусад нь одоогийнхоороо `/events/[id]` руу заана.

## Өгөгдөлд хандах дүрэм — заавал

- `challenge_applications`-д browser-оос supabase-js-ээр шууд бичнэ. Service role, API route, RPC **хэрэггүй**.
- Insert / update объектод **зөвхөн** анкетын талбарууд + `event_id`, `status`, `submitted_at` байна. `user_id` илгээхгүй (default `auth.uid()`). `registration_no`, `paid_at`, `reviewed_by`, `reviewed_at`, `review_note`, `created_at`, `updated_at`-г хэзээ ч илгээхгүй — column grant байхгүй тул бүхэл хүсэлт унана.
- `status`-д client зөвхөн `'draft'` эсвэл `'submitted'` бичнэ. Бусад утга RLS-д унана.
- `select("*")` бичихгүй. `lib/events/api.ts`-ийн `EVENT_COLUMNS` шиг `APPLICATION_COLUMNS` жагсаалт үүсгэ. `EVENT_COLUMNS`-д шинэ баганууд (`kind`, `entry_fee`, `submission_ends_at`, `rules`, `show_on_home`, `registration_prefix`) нэм. `next_registration_no`-г нэмэхгүй.
- `lib/events/types.ts`-ийн `SeeEvent`-д шинэ багана нэм, `ChallengeApplication` type + `ApplicationStatus` union нэм. Хүснэгттэй гараар sync — generated types байхгүй.
- Хугацааны шалгалт: `registration_ends_at` өнгөрсөн бол анкет илгээх товч идэвхгүй, шалтгааныг бичнэ.

Танилцуулгыг нэвтрээгүй хүнд харуулахын тулд `events`-д anon policy хэрэгтэй. `supabase/migrations/20260908_events_anon_challenge_read.sql` файл бич (би SQL editor дээр өөрөө ажиллуулна), агуулга: `create policy "events_select_published_challenge_anon" on public.events for select to anon using (status = 'published' and kind = 'challenge');`. Код нь энэ policy-гүй үед ч эвдрэхгүй (хоосон бол «Нэвтэрч үзнэ үү» карт).

## Загвар

App shell хэлбэртэй — admin.seemedia.mn, content-creator.seemedia.mn шиг dashboard: зүүн талд нарийн sidebar (Уралдаанууд / Миний өргөдөл / Гарах), дээр нь одоогийн Navbar-ийн хэв маяг. Мобайлд sidebar нь доод tab bar болно. Өнгө, фонт одоогийн `tailwind.config.ts`, `globals.css`-ийнх хэвээр: ink хар, brand ногоон, dot-grid background. Шинэ өнгө нэмэхгүй. Card, input, button-ийн стилийг `LoginForm.tsx`, `EventCard.tsx`-аас авч нэг мөр болго. Бүх текст монголоор. Loading үед skeleton, алдааг хэрэглэгчийн хэлээр («Анкет хадгалагдсангүй. Интернэтээ шалгаад дахин оролдоно уу.»).

## 3D animation — 1-р алхмын hero

`three` + `@react-three/fiber` + `@react-three/drei` нэм. Hero: хар орон зайд аажуу эргэх кино reel (2 диск + ирмэгийн нүхнүүд, metallic material, brand ногоон rim light), эргэн тойронд 5–6 хөвөгч босоо poster хавтгай (`poster_url` / `cover_url`-ийг texture болгож, байхгүй бол ногоон gradient). Mouse хөдөлгөөнд камер бага зэрэг дагана (parallax), scroll хийхэд reel хурдаа өөрчилнө. Дүрэм:

- `next/dynamic` + `ssr: false`, зөвхөн 1-р алхамд mount. Бусад алхамд unmount.
- `prefers-reduced-motion` бол статик frame (эргэлт, parallax байхгүй).
- Утсанд (`< 768px`) poster тоог 3 болгож, `dpr` дээд хязгаар 1.5.
- Canvas ачаалагдтал cover зурган fallback харагдана — «хар дөрвөлжин» хэзээ ч гарахгүй.
- Bundle: three-ийг зөвхөн энэ chunk-д, `first load JS` хэмжээг `next build` гаргалт дээр шалгаад хэл.
- Texture-ийг Supabase / Bunny домэйноос ачаалах тул `crossOrigin = "anonymous"` тавь; `next.config.ts`-ийн `remotePatterns` аль хэдийн `**.supabase.co`, `**.b-cdn.net`-ийг зөвшөөрсөн.

## Файлын бүтэц (санал, өөрчилж болно)

```
app/challenge/[slug]/page.tsx           server: slug → client component
app/login/page.tsx                      ?next= дэмжинэ (одоо байгаа бол засна)
components/challenge/ChallengeShell.tsx  sidebar + stepper + step router
components/challenge/Stepper.tsx
components/challenge/IntroStep.tsx       + Hero3D (dynamic)
components/challenge/hero/Hero3D.tsx     r3f canvas
components/challenge/hero/FilmReel.tsx
components/challenge/hero/PosterField.tsx
components/challenge/ApplicationForm.tsx 5 хэсэг, draft/submit
components/challenge/FeeStep.tsx         placeholder
components/challenge/UploadStep.tsx      placeholder
components/AppSidebar.tsx
lib/challenge/{types,api,form}.ts        types, APPLICATION_COLUMNS, validation
```

## Хийхгүй зүйлс

- Өөр төслийн (`landing/`, `mobile/`, `see_media_admin/`) файлд хүрэхгүй.
- Service role key, API route, edge function, RPC нэмэхгүй.
- Supabase-д миграци өөрөө ажиллуулахгүй — зөвхөн `.sql` файл бичнэ.
- `@supabase/ssr`, cookie session руу шилжихгүй — одоогийн localStorage session хэвээр.
- Form сан (react-hook-form, zod) нэмж болно, гэхдээ нэмсэн бол шалтгаанаа хэл.
- Dev server өөрөө асаахгүй. `npx tsc --noEmit` ба `npm run build` амжилттай болтол дуусгана, гаралтыг нь харуул.

## Дуусахад тайлагнах

1. Үүсгэсэн / өөрчилсөн файлын жагсаалт, тус бүрд нэг мөр.
2. `challenge_applications`-д илгээж буй яг ямар талбарууд (insert, update тус бүр).
3. `next build`-ийн route хэмжээний хүснэгт, three chunk хэдэн KB.
4. Миний гараар ажиллуулах SQL (anon policy).
5. Шалгаагүй үлдсэн зүйл байвал тодорхой бич.
