# SeeMedia Events — архитектур

`events.seemedia.mn` — SeeMedia-гийн зохион байгуулж буй **уралдаан тэмцээн**-үүдийг харуулах, нэвтрэлтийн ард байрлах сайт.

## 1. Юу хийдэг вэ

1. SeeMedia аппликейшны хэрэглэгч утас + нууц үгээрээ нэвтэрнэ.
2. Нэвтэрсний дараа уралдаан тэмцээний жагсаалт харагдана.
3. Тэмцээн дээр дарвал дэлгэрэнгүй хуудас.

**Байхгүй зүйлс (санаатайгаар):** бүртгүүлэх хуудас, нууц үг сэргээх, тасалбар, төлбөр, эрхийн шалгалт. Аккаунт зөвхөн мобайл апп дээр үүсдэг; энэ сайт тэр аккаунтыг зөвхөн танина.

## 2. Байршил ба хамаарал

```
seemedia/
├── mobile/          React Native — аккаунт энд үүснэ
├── landing/         seemedia.mn + /watch (кино үзэх, QPay)
├── see_media_admin  админ панел
└── events/          ← ЭНЭ. events.seemedia.mn, тусдаа Vercel project
```

Гурвуулаа **нэг Supabase project** дээр (`sxvnidtuspoxcgpzffdo`) сууна. Тиймээс `auth.users` нийтлэг — мобайл аппад бүртгүүлсэн хүн энд шууд нэвтэрнэ.

Код хуваалцах давхарга (shared package) байхгүй. `lib/supabase/*` болон `normalizePhone` нь `landing/`-аас **хуулсан**. Энэ нь monorepo хийхээс хямд, төслийн одоогийн хэв маягтай нийцнэ (`landing/lib/watch/access.ts` өөрөө `mobile/`-оос хуулсан байгаа). Хариуцлага: `normalizePhone`-ыг өөрчилвөл **гурван** газар зэрэг өөрчил, эс тэгвэл ижил дугаар өөр өөр auth identity рүү очно.

## 3. Технологи

| Юу | Юуг сонгосон | Яагаад |
|---|---|---|
| Framework | Next.js 15 App Router | landing-тэй ижил, Vercel дээр асуудалгүй |
| Style | Tailwind, ижил өнгөний палитр | нэг брэнд шиг харагдана |
| Auth | `supabase-js` browser client, localStorage | landing/`watch`-тай ижил загвар |
| DB | Supabase Postgres, RLS | ижил project |
| Icons | lucide-react | landing-тай ижил |

`@supabase/ssr` cookie-based session ашиглаагүй — landing бүхэлдээ client-side session дээр ажилладаг, ижилхэн байлгах нь дэмжихэд амархан.

## 4. Файлын бүтэц

```
events/
├── app/
│   ├── layout.tsx              AuthProvider-ээр бүх зүйлийг ороосон
│   ├── globals.css
│   ├── login/page.tsx          нэвтрэх (guard-ийн ГАДНА)
│   └── (app)/                  ← route group: бүгд guard-ийн ДОТОР
│       ├── layout.tsx          AuthGuard + Navbar
│       ├── page.tsx            тэмцээний жагсаалт
│       └── events/[id]/page.tsx  дэлгэрэнгүй
├── components/
│   ├── AuthProvider.tsx        session + profile
│   ├── AuthGuard.tsx           нэвтрээгүй бол /login руу
│   ├── LoginForm.tsx
│   ├── Navbar.tsx  Brand.tsx
│   ├── EventList.tsx           татаж, үе шатаар нь бүлэглэнэ
│   ├── EventCard.tsx  EventDetail.tsx  PhaseBadge.tsx
│   ├── EventListSkeleton.tsx
│   └── challenge/
│       ├── ChallengeShell.tsx    4 алхмын gating, URL-д ?step=N
│       ├── IntroStep.tsx  ApplicationForm.tsx  FeeStep.tsx
│       ├── FilmsStep.tsx         ← 4-р алхам: кинонуудын жагсаалт
│       ├── FilmForm.tsx          нэг киноны маягт + постер/бичлэг upload
│       └── FormFields.tsx  Stepper.tsx  MyApplications.tsx
├── lib/
│   ├── supabase/{config,client,server}.ts
│   ├── events/{types,api,format}.ts
│   └── challenge/
│       ├── {types,api,form,upload}.ts    анкет (challenge_applications)
│       └── films/{types,api,form}.ts     кино  (challenge_films)
└── supabase/migrations/
    ├── 20260729_events_schema.sql
    ├── 20260907_challenge_applications.sql
    ├── 20260908_events_anon_challenge_read.sql
    ├── 20260909_challenge_film_upload.sql
    └── 20260910_challenge_films_and_payments.sql
```

## 5. Өгөгдлийн загвар

Дөрвөн хүснэгт: `events`, `challenge_applications`, `challenge_films`,
`challenge_payments`.

```
events ──┬── challenge_applications   1 хүн : 1 бүртгэл  (unique event_id,user_id)
         │        ├── challenge_films      1 бүртгэл : N кино
         │        └── challenge_payments   QPay нэхэмжлэх
         └── (энгийн event-үүд, анкетгүй)
```

**Гол шийдэл: анкет бол ОРОЛЦОГЧ, кино биш.** 20260910 хүртэл киноны талбарууд
анкетын мөрөн дотор сууж, `unique (event_id, user_id)` нь нэг хүнийг нэг
киногоор хязгаарлаж байсан. Одоо анкет нь бүртгэл (нэг бүртгэлийн дугаар, нэг
хураамж), кино бүр `challenge_films`-д тусдаа мөр. Анкет дээрх хуучин `film_*`
багануудыг **устгаагүй** — 20260910-ийн 6-р хэсэг тэднийг хуулсан, эх нь
байрандаа үлдсэн тул буцах зам нээлттэй.

`challenge_films`-ийн багана нэрс `public.movies`-тэй **зориуд ижил**
(`poster_url`, `horizontal_poster_url`, `director`, `actors`, `studio`,
`age_rating`, `duration_minutes`, `trailer_url`). Ялагчийг каталог руу оруулах
нь нэг `insert into movies … select … from challenge_films` болно.

### `public.events`

```
id  name  slug  subtitle  description
poster_url  cover_url  location
status               draft | published | archived
starts_at  ends_at  registration_ends_at
is_featured  sort_order  created_at  updated_at
```

**Гол шийдэл: "явагдаж байна / удахгүй / дууссан" гэдгийг хадгалдаггүй.**
`starts_at` / `ends_at`-аас уншиж байх бүрд нь `getEventPhase()` тооцоолно
([lib/events/types.ts](lib/events/types.ts)). Ингэснээр шөнө дунд status-ыг
эргүүлэх cron / scheduled function хэрэггүй, мөн статус хэзээ ч хоцрохгүй.

### RLS

| Хэн | Юу хийж чадах |
|---|---|
| `anon` (нэвтрээгүй) | **юу ч үгүй** — policy огт байхгүй |
| `authenticated` | `status = 'published'` мөрүүдийг унших |
| `service_role` | бүгд (RLS-ийг тойрдог) |

`insert/update/delete` policy **зориуд үүсгээгүй**. Тиймээс ямар ч client key бичиж чадахгүй — зөвхөн SQL editor эсвэл service role.

Анхаарах: жинхэнэ хамгаалалт бол `AuthGuard` биш, **RLS**. anon key нь JS bundle дотор явдаг тул зарлаагүй тэмцээнийг нуудаг зүйл бол `to authenticated` гэсэн тэр мөр.

### `select("*")` бүү бич

`lib/events/api.ts` дотор `EVENT_COLUMNS` гэж багануудаа нэрлээд жагсаасан. Дараа нь дотоод хэрэгцээний багана нэмэхэд (админ тэмдэглэл, Bunny video id, нийтлэгдээгүй playback URL) тэр нь browser руу **чимээгүй** явахгүй. `landing/lib/watch/api.ts`-ийн `MOVIE_COLUMNS` яг ижил зорилготой.

## 6. Аюулгүй байдлын шугам

```
Browser  ──anon key──►  PostgREST  ──RLS──►  events (published only)
                                   ✗ anon
Browser  ──JWT──────►  /api/*  ──service role──►  бүх зүйл
                        └─ token-ыг ЭХЛЭЭД getUser()-ээр шалгана
```

Service role key зөвхөн `lib/supabase/server.ts` дотор, тэр нь `import "server-only"` тул client component-д импортлох гэвэл build дээр л унана. Одоогийн хуудсууд түүнийг хэрэглэдэггүй — жагсаалт RLS-ээр шууд ирнэ.

## 7. Файл оруулах (Bunny)

Хоёр өөр зам, **файлын хэмжээгээр** биш **Bunny-гийн API-аар** салдаг.

### 7.1 Постер — Bunny **Storage**, server-ээр дамжина

```
Browser → POST /api/challenge/upload   (multipart, Authorization: Bearer <token>)
                                        file, filmId, kind=poster|horizontal_poster
Server  → getUser(token)-оор дуудагчийг батална
        → challenge_films → challenge_applications → events гэж уншаад:
            эзэмшигч мөн үү, анкет paid уу, submission_ends_at гараагүй юу,
            кино хянагдаж эхлээгүй юу
          (service role RLS-ийг тойрдог тул policy-гийн шалгалт бүрийг ЭНД
           давтах ёстой)
        → PUT https://<endpoint>/<zone>/campaign_reels/<event>/<application>/<film>/poster-<ts>.jpg
          headers: AccessKey: BUNNY_STORAGE_ACCESS_KEY
        → буцаана { url, path } — өгөгдлийн санд ЮУ Ч бичихгүй
Client  → poster_url-даа маягтынхаа хамт хадгална (тэр багана нь client-ийн grant дотор)
```

⚠️ **Постер нь энэ сайтаас Vercel-ийн дундуур өнгөрдөг ЦОРЫН ГАНЦ файл.** Тэр
функцийн request body 4.5 MB-аар хаагддаг тул зураг үүнээс том бол route
ажиллахаас ӨМНӨ таслагдаж, browser хоосон 413 авна — манай ямар ч мессеж
хүрэхгүй. Утасны зураг 6-12 MB байдаг тул `lib/challenge/compressImage.ts`
илгээхийн өмнө 1600px / ~0.8 MB болгож шахна; шахсан ч багтахгүй бол
**оролцогчид ойлгомжтой хэлээд зогсоно**, 413-д хүргэхгүй. Route-ийн
`MAX_IMAGE_SIZE` нь 4 MB — платформын хязгаараас ДООГУУР, дээгүүр биш.

Постер яагаад client талаас хадгалагддаг вэ: постер сонгоод маягтаа орхисон
хүний **хадгалагдсан** бүртгэл чимээгүй өөрчлөгдөх ёсгүй. Үнэ нь storage зон
дотор хэн ч заагаагүй объект үлдэх — хямд тал нь.

### 7.2 Кино — Bunny **Stream**, browser → Bunny шууд

```
1. Browser → POST /api/challenge/film-ticket    (жижигхэн JSON: { filmId })
2. Server  → 7.1-ийн эзэмшигч / paid / хугацааны шалгалтыг ЯГ ИЖИЛ хийнэ
           → Bunny: POST /library/{lib}/videos  (collectionId = reel_challenge)
                    → videoId (guid)
           → expire = now + 1 цаг
             signature = sha256(libraryId + BUNNY_STREAM_API_KEY + expire + videoId)
           → challenge_films-д film_video_id, film_url, film_status='processing'
             бичнэ (service role — client эдгээрт grant-гүй)
           → буцаана { libraryId, videoId, expire, signature }
             ← API key өөрөө ХЭЗЭЭ Ч browser руу явахгүй
3. Browser → tus-js-client → https://video.bunnycdn.com/tusupload
             headers: AuthorizationSignature, AuthorizationExpire,
                      VideoId, LibraryId
             50MB chunk, тасарвал үргэлжилнэ, GB-ууд асуудалгүй
4. Bunny   → transcode → HLS
5. Browser → POST /api/challenge/film-status    (5 сек тутам)
   Server  → Bunny-гээс видеоны status уншаад film_status-ыг
             processing / ready / failed болгоно
```

**Яагаад хоёр өөр зам вэ.** Bunny **Storage** нь зоны хэмжээний `AccessKey`
header-ээр л танидаг — объект тус бүрийн гарын үсэг гэж **байхгүй**. Тэр key-тэй
browser бүх зоныг устгаж чадна (тэр зон дотор платформын бүх кино, постер бий),
тиймээс байт нь сервер дундуур явахаас өөр аргагүй. Bunny **Stream** харин
видео тус бүрийн гарын үсэг өгдөг тул кино серверийг тойрч чадна.

Тэгэх ёстой ч байсан: Vercel-ийн serverless function-ий request body хязгаар
**4.5 MB**. 20260910 хүртэл кино 7.1-ээр явж байсан бөгөөд production дээр
оролцогч бүр 413 авах байсан (локал `next dev` дээр ийм хязгаар байхгүй тул
deploy хийтэл мэдэгдэхгүй). Одоо байт Vercel-ийн дундуур огт өнгөрөхгүй.

**`film_url` дангаараа «бичлэг орсон» гэсэн үг БИШ.** Түүнийг 2-р алхамд, ганц ч
байт ирэхээс өмнө бичдэг. Бодит хариу нь `film_status = 'ready'` — UI болон
илгээх шалгалт хоёулаа түүгээр шийднэ.

Кино нь каталогийн кинотой **яг ижил хэлбэрийн URL** авна
(`https://vz-….b-cdn.net/<guid>/playlist.m3u8`), тиймээс ялагчийг `movies` руу
хөрвүүлэхэд тоглуулах зам аль хэдийн бэлэн.

## 8. Deploy

Vercel дээр **шинэ project**, root directory = `events/`.

Env variables:

Хувьсагчийн **нэрс нь `see_media_admin/.env`-тэй яг ижил** — нэг багц утгыг
хоёр төсөлд нэр өөрчлөхгүйгээр буулгаж болно. Жишээг
[.env.local.example](.env.local.example)-ээс үз.

| Нэр | Хаана | Тэмдэглэл |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | нийтийн |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | client | нийтийн, bundle дотор явна. Supabase-ийн шинэ нэр, өмнөх "anon key" |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | upload route. `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` нэрийг ч уншина (admin-ийн .env тэгж өгдөг) |
| `BUNNY_STORAGE_ZONE` | **server only** | |
| `BUNNY_STORAGE_REGION` | **server only** | хоосон / `de` бол Frankfurt |
| `BUNNY_STORAGE_ACCESS_KEY` | **server only** | browser руу гарвал бүх зон устгагдаж болно |
| `BUNNY_CDN_BASE_URL` | **server only** | буцаах URL-ийн эх |
| `BUNNY_STORAGE_ENDPOINT` | server only | заавал биш, REGION-ыг дарна |
| `BUNNY_STREAM_LIBRARY_ID` | **server only** | Stream library-ийн дугаар, ж: 476065 |
| `BUNNY_STREAM_API_KEY` | **server only** | Stream library-ийн API key. `BUNNY_STORAGE_ACCESS_KEY`-ЭЭС ӨӨР |
| `BUNNY_STREAM_COLLECTION_ID` | server only | `reel_challenge` collection-ий guid. Байхгүй бол library-ийн үндэст орно |
| `BUNNY_STREAM_CDN_HOSTNAME` | **server only** | ж: `vz-19386c30-38d.b-cdn.net` |

`NEXT_PUBLIC_` угтвар нь key-г автоматаар нийтэлдэггүй: Next нь **кодод
бичигдсэн газарт нь** текстээр орлуулдаг тул зөвхөн server файлаас уншсан
хувьсагч client bundle руу орохгүй. `lib/supabase/server.ts` нь
`import "server-only"` — client component-оос импортлох гэвэл build унана.
Батлагдсан: build-ийн дараа `.next/static/`-д service role key ч, Bunny access
key ч байхгүй.

Домэйн: `events.seemedia.mn` (CNAME → Vercel).

⚠️ **Session нь origin тус бүрээр тусдаа.** `seemedia.mn/watch` дээр нэвтэрсэн хүн `events.seemedia.mn` дээр дахин нэг удаа нэвтэрнэ. Ганц удаа нэвтрэх шаардлагатай бол хоёуланг нь нэг домэйн дор (`seemedia.mn/events`) байрлуулах хэрэгтэй — өөр аргагүй.

## 9. Одоогийн хязгаарлалт / дараагийн алхмууд

Одоо байхгүй, гэхдээ схем нь саадгүй өргөжинө:

- **Админ UI.** Одоогоор Supabase SQL editor-оос гараар мөр нэмнэ. Дараа нь `see_media_admin`-д `/admin/events` нэмэх нь зөв — санамж: тэр төсөл дээр `npm run route:generate` эвдэрсэн, `routeTree.gen.ts`-ийг гараар засна.
- **Оролцогчийн бүртгэл.** Хийгдсэн — `challenge_applications`
  (20260907_challenge_applications.sql) + `/challenge/[slug]` 4 алхамт урсгал.
- **Нэг хүн олон кино.** Хийгдсэн — `challenge_films`
  (20260910_challenge_films_and_payments.sql) + `FilmsStep` / `FilmForm`.
- **Кино байршуулах.** Хийгдсэн — Bunny Stream + tus (7.2). Vercel-ийн 4.5 MB
  хязгаар арилсан.
- **QPay.** Хийгдсэн — хоёр edge function
  (`supabase/functions/challenge-payment-{create,callback}`), тавих заавар
  [docs/QPAY_SETUP.md](docs/QPAY_SETUP.md). Web болон mobile ХОЁУЛАА яг тэр
  хоёрыг дууддаг тул логик нэг газар байна. Дүн `events.entry_fee`-ээс сервер
  дээр уншигдана; callback-д зөвхөн `transactionId` явна — дүн query param-аар
  явбал хэн ч 1₮ төлөөд бүртгүүлнэ. Тусдаа status endpoint байхгүй: callback
  идэмхий биш тул түүнийг түлхэх нь өөрөө poll болно, эцсийн хариуг
  `challenge_payments`-ээс RLS-ээр шууд уншина. Төлбөр батлагдмагц анкет `paid`
  болж, `registration_no` олгогдож, и-баримт имэйлээр явна.
- **Админ панел.** Хийгдсэн — `ChallengeFilmsSection` (кино тус бүрийг тусад нь
  хянана: нэг хүний нэг кино батлагдаж нөгөө нь буцаагдаж болно),
  `ChallengePaymentsSection`, «Кинонууд CSV» (кино тутамд нэг мөр),
  `EventForm`-д `max_films_per_user`. Бичилт нь
  `/api/admin/challenge/films/[id]` service-role route-оор — `challenge_films`
  дээр админд update policy үүсгээгүй, `reviewed_*` баганад grant ч байхгүй.
- **Мобайл дээр кино оруулах.** ХИЙХГҮЙ гэж шийдсэн (2026-09-10). Апп нь
  танилцуулга, анкет, төлбөр гурвыг хийж, бүтээл оруулахад
  `events.seemedia.mn/challenge/` рүү веб браузераар үсэрнэ. Тиймээс
  `mobile/src/lib/challenge.ts` дэх хуучин нэг-кино загварыг зориуд хэвээр
  үлдээв — тэр код зөвхөн анкет уншихад ажиллана.
- **Санал хураалт.** `event_votes (event_id, entry_id, user_id)` + `unique(entry_id, user_id)` — нэг хүн нэг удаа.
- **Видео тоглуулах.** Тоглуулах URL-ыг `events` дээр бүү тавь — **тусдаа `event_media` хүснэгтэд, policy огт үүсгэлгүй** байрлуул. Тэгвэл `select` бичихдээ алдсан ч гоожихгүй; `movies` дээр `hls_url` ижил мөрөн дээрээ байгаа болохоор `MOVIE_COLUMNS`-оос мартаж гаргавал шууд алдана. Дараа нь `/api/events/stream` нь `landing/app/api/watch/stream/route.ts`-ийг хуулж хийнэ.
- **Slug URL.** `slug` багана бэлэн; `/events/[id]`-г `/events/[slug]` болгоход л хангалттай.
