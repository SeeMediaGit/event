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

### 7.2 Кино — Supabase **Storage**, browser → Storage шууд

```
1. Browser → POST /api/challenge/film-ticket    (жижигхэн JSON: { filmId, kind, fileType })
2. Server  → 7.1-ийн эзэмшигч / paid / хугацааны шалгалтыг ЯГ ИЖИЛ хийнэ
           → зам шийднэ:  <auth.uid()>/<film_id>/film-<ts>.<ext>
           → хуучин файл байвал bucket-ээс устгана (service role)
           → challenge_films-д film_path, film_url (public URL),
             film_status='pending' бичнэ (service role — client grant-гүй)
           → буцаана { bucket, objectName, url }
3. Browser → tus-js-client → <SUPABASE_URL>/storage/v1/upload/resumable
             headers: authorization: Bearer <өөрийн session JWT>, x-upsert
             metadata: bucketName, objectName, contentType
             6MB chunk (Supabase-ийн шаардлага), тасарвал үргэлжилнэ
           ← storage.objects policy: эхний хавтас = auth.uid() бол зөвшөөрнө
4. Browser → POST /api/challenge/film-status    (нэг удаа, хэрэгтэй бол 2 сек тутам)
   Server  → storage.from('challenge-films').info(film_path)
             байвал film_status='ready', film_uploaded_at=now()
```

Bucket, policy: `see_media_admin/supabase/migrations/20260913000000_challenge_films_supabase_storage.sql`.
Хадгалагдах зүйл: `film_path` = bucket доторх зам (file id-гийн үүрэг),
`film_url` = тэр объектын public URL (татах / тоглуулах холбоос).
`film_video_id` одоо NULL. Трейлэр ижил замаар `trailer-<ts>.<ext>` нэрээр орно;
түүнд тусдаа path багана байхгүй тул `lib/challenge/films/storage.ts`
URL-ээс нь буцааж уншина.

**Яагаад Bunny Stream-ээс шилжсэн бэ (20260913).** Bunny Stream нь upload
дууссаны дараа transcode хийдэг тул оролцогч «боловсруулж байна» гэж хэдэн
минут хүлээж, ганц ч байт ирээгүй үед ч тэр мессежийг харж байсан. Storage-д
сүүлийн chunk буусан мөчид файл бэлэн — нэг л алхам, нэг л төлөв (pending →
ready). Мөн Bunny Stream-ийн 4 env, video объект үүсгэх, гарын үсэг зурах
алхам бүгд хасагдсан; бүх зүйл нэг Supabase project дотор.

**Яагаад ticket route хэвээр байгаа вэ.** Storage policy зөвхөн «эхний хавтас
миний auth.uid() мөн үү» гэдгийг л мэднэ. Тэр film мөр минийх үү, төлбөр
төлөгдсөн үү, хугацаа дууссан уу гэдгийг challenge_films /
challenge_applications / events-ээс service role-оор шалгах газар нь энэ route.
`film_*` баганыг ч client бичихгүй — route л бичнэ.

Тэгэх ёстой ч байсан: Vercel-ийн serverless function-ий request body хязгаар
**4.5 MB**. Байт Vercel-ийн дундуур огт өнгөрөхгүй хэвээр.

⚠️ **Хэмжээний хязгаар хоёр газар.** Bucket-ийн `file_size_limit` = 5 GB, мөн
project-ийн Dashboard → Storage → Settings → **Global file size limit** мөн
хүчинтэй (default 50 MB). Free plan дээр 50 MB-аас дээш боломжгүй; Pro дээр
тохиргоог 5 GB болгоно (resumable upload-аар 50 GB хүртэл). Хязгаараас том
файл 413-аар унана — UI «Файл storage-ийн зөвшөөрөгдсөн хэмжээнээс том» гэж
хэлнэ.

**`film_url` дангаараа «бичлэг орсон» гэсэн үг БИШ.** Түүнийг 2-р алхамд, ганц ч
байт ирэхээс өмнө бичдэг. Бодит хариу нь `film_status = 'ready'` — UI болон
илгээх шалгалт хоёулаа түүгээр шийднэ.

Bucket public тул admin панел, шүүгч `film_url`-ийг `<video>`-д шууд тавьж
тоглуулна (mp4/webm — HLS биш). Хаалттай болгох бол `public = false` болгоод
admin талд `createSignedUrl` ашиглана. 20260913-аас өмнөх мөрүүд Bunny-гийн
`…/playlist.m3u8` URL-тэй хэвээр, тэдгээр Bunny дээр ажилласаар байна.

### 7.3 Нийтлэх — Bunny, ГАРААР (20260921)

Storage дахь файл бол **эх материал**. Хэрэглэгч түүнийг хэзээ ч харахгүй.

```
оролцогч → Supabase Storage        (7.2, эх материал)
                 ↓  админ татаж үзнэ  (admin панел → «Татах холбоос»)
                 ↓  Bunny дээр ГАРААР байршуулна  (Stream library эсвэл Storage zone)
                 ↓  гарсан URL-ыг admin панелийн «Нийтлэх (Bunny)» талбарт буулгаад Хэрэглэх
                 ↓  PATCH /api/admin/challenge/films/[id]  { action: 'set_bunny_url' }
           challenge_films.bunny_url  ← service role
                 ↓
хэрэглэгч ← challenge_films_public view → мобайлын галерей
```

**Яагаад автоматжуулаагүй вэ.** Bunny руу програмаар байршуулах боломж
одоогоор нээгдээгүй (2026-09-21). Тиймээс дамжуулах алхмыг хүн гүйцэтгэнэ —
gating нь үүнээс хамаарахгүй, автоматжуулах боломж нээгдвэл зөвхөн энэ нэг
алхам солигдоно (Bunny Stream-ийн `POST /library/{id}/videos/fetch` нь signed
URL өгөхөд сервер талдаа өөрөө татдаг).

**Нийтлэгдсэн эсэхийн ЦОРЫН ГАНЦ шалгуур нь `bunny_url`.** Тусдаа
`is_published` туг зориуд байхгүй: тугийг query бүрт давтан шүүх ёстой болж,
нэгийг нь мартахад гоожно (`mobile/src/lib/reels.ts`-ийн `withPreviewEpisode`
нь `reel_videos.is_active`-ыг яг ингэж мартсан). Эх сурвалж байхгүй бол
тоглуулах юм ч байхгүй.

`challenge_films_public` view (20260921000000) — гарсан: `film_url`,
`trailer_url` (Supabase дахь эх материал). Орсон: `bunny_url`,
`bunny_trailer_url`. Шүүлтүүр: `status = 'approved' and bunny_url is not null`.

**Гурван газар автоматаар цэвэрлэгдэнэ:**

| Хэзээ | Юу болох | Хаана |
|---|---|---|
| Оролцогч файлаа дахин байршуулна | `bunny_url = null` → галерейгээс алга | [film-ticket route](app/api/challenge/film-ticket/route.ts) |
| Админ бүтээлийг буцаана (`rejected`) | `bunny_url = null` | admin films route |
| Админ «Нийтлэлтийг цуцлах» дарна | `bunny_url = null` | admin панел |

Эхнийх нь хамгийн чухал: батлагдсаны дараа киногоо сольсон хүн Bunny дээрх
ХУУЧИН хувилбараараа нийтлэгдсэн хэвээр үлдэх ёсгүй.

URL-ыг route талд шалгана — хост нь `BUNNY_CDN_BASE_URL` /
`BUNNY_STREAM_CDN_HOSTNAME` эсвэл `*.b-cdn.net` / `*.bunnycdn.com` байх ёстой.
Гараар хуулахад нэг үсэг дутуу үлдэхэд хэрэглэгч хоосон player хардаг, харин
админ мэдэхгүй — тиймээс хүлээж авахын өмнө шалгана.

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

`BUNNY_STREAM_*` хувьсагчид 20260913-аас хойш хэрэггүй (кино Supabase Storage-д
орно, 7.2). Байвал гэм алга, уншихгүй.

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
- **Кино байршуулах.** Хийгдсэн — Supabase Storage + tus (7.2). Vercel-ийн
  4.5 MB хязгаар арилсан; transcode алхам байхгүй.
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
- **Уралдааны бүтээлийг нийтлэх.** Хийгдсэн — 7.3 (гараар Bunny). Дараагийн
  алхам нь Bunny-гийн `videos/fetch` API-аар нэг товч болгох; өгөгдлийн загвар
  (`bunny_url`) өөрчлөгдөхгүй.
- **Видео тоглуулах.** Тоглуулах URL-ыг `events` дээр бүү тавь — **тусдаа `event_media` хүснэгтэд, policy огт үүсгэлгүй** байрлуул. Тэгвэл `select` бичихдээ алдсан ч гоожихгүй; `movies` дээр `hls_url` ижил мөрөн дээрээ байгаа болохоор `MOVIE_COLUMNS`-оос мартаж гаргавал шууд алдана. Дараа нь `/api/events/stream` нь `landing/app/api/watch/stream/route.ts`-ийг хуулж хийнэ.
- **Slug URL.** `slug` багана бэлэн; `/events/[id]`-г `/events/[slug]` болгоход л хангалттай.
