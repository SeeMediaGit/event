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
│   └── EventListSkeleton.tsx
├── lib/
│   ├── supabase/{config,client,server}.ts
│   └── events/{types,api,format}.ts
└── supabase/migrations/20260729_events_schema.sql
```

## 5. Өгөгдлийн загвар

Ганц хүснэгт: `public.events`.

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

## 7. Том файл оруулах (Bunny) — Vercel-ийн хязгаар

**Vercel-ийн serverless function-ий request body хязгаар 4.5 MB.** 4–5 GB кино түүгээр орох боломжгүй — timeout-д ч хүрэхгүй, эхний мегабайт дээрээ таг зогсоно. Тиймээс файлын байт **Vercel-ийн дундуур огт өнгөрөх ёсгүй**.

Зөв урсгал — browser → Bunny шууд, Vercel зөвхөн гарын үсэг өгнө:

```
1. Browser → POST /api/bunny/upload-ticket        (жижигхэн JSON)
2. Server  → Bunny: POST /library/{lib}/videos → videoId
3. Server  → expire = now + 1 цаг
             signature = sha256(libraryId + BUNNY_API_KEY + expire + videoId)
             буцаана { libraryId, videoId, expire, signature }
             ← BUNNY_API_KEY өөрөө ХЭЗЭЭ Ч browser руу явахгүй
4. Browser → tus-js-client → https://video.bunnycdn.com/tusupload
             headers: AuthorizationSignature, AuthorizationExpire,
                      VideoId, LibraryId
             chunk-чилсэн, тасарвал үргэлжилдэг, 5 GB асуудалгүй
5. Bunny   → transcode → HLS → webhook → Supabase-д hls_url бичнэ
```

Vercel-ээр bandwidth өнгөрөхгүй тул төлбөр ч, хязгаар ч байхгүй.

Жижиг зураг (poster, cover) → Supabase Storage хэвээр, тэр нь асуудалгүй.

`BUNNY_STREAM_API_KEY`-г **заавал** server-only env-д тавь. `NEXT_PUBLIC_` угтвартай болговол bundle дотор нийтлэгдэж, тэр key-тэй хүн танай бүх видеог устгаж чадна.

## 8. Deploy

Vercel дээр **шинэ project**, root directory = `events/`.

Env variables:

| Нэр | Хаана | Тэмдэглэл |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | нийтийн |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | нийтийн, bundle дотор явна |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | одоо хэрэггүй, дараа нь |
| `BUNNY_STREAM_LIBRARY_ID` | server only | дараа нь |
| `BUNNY_STREAM_API_KEY` | **server only** | дараа нь |

Домэйн: `events.seemedia.mn` (CNAME → Vercel).

⚠️ **Session нь origin тус бүрээр тусдаа.** `seemedia.mn/watch` дээр нэвтэрсэн хүн `events.seemedia.mn` дээр дахин нэг удаа нэвтэрнэ. Ганц удаа нэвтрэх шаардлагатай бол хоёуланг нь нэг домэйн дор (`seemedia.mn/events`) байрлуулах хэрэгтэй — өөр аргагүй.

## 9. Одоогийн хязгаарлалт / дараагийн алхмууд

Одоо байхгүй, гэхдээ схем нь саадгүй өргөжинө:

- **Админ UI.** Одоогоор Supabase SQL editor-оос гараар мөр нэмнэ. Дараа нь `see_media_admin`-д `/admin/events` нэмэх нь зөв — санамж: тэр төсөл дээр `npm run route:generate` эвдэрсэн, `routeTree.gen.ts`-ийг гараар засна.
- **Оролцогчийн бүртгэл.** `event_entries (id, event_id, user_id, title, video_id, status, created_at)` + өөрийн мөрөө уншиж/бичих RLS.
- **Санал хураалт.** `event_votes (event_id, entry_id, user_id)` + `unique(entry_id, user_id)` — нэг хүн нэг удаа.
- **Видео тоглуулах.** Тоглуулах URL-ыг `events` дээр бүү тавь — **тусдаа `event_media` хүснэгтэд, policy огт үүсгэлгүй** байрлуул. Тэгвэл `select` бичихдээ алдсан ч гоожихгүй; `movies` дээр `hls_url` ижил мөрөн дээрээ байгаа болохоор `MOVIE_COLUMNS`-оос мартаж гаргавал шууд алдана. Дараа нь `/api/events/stream` нь `landing/app/api/watch/stream/route.ts`-ийг хуулж хийнэ.
- **Slug URL.** `slug` багана бэлэн; `/events/[id]`-г `/events/[slug]` болгоход л хангалттай.
