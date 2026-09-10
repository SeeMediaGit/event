# Bunny Stream — кино байршуулах: тавих заавар

Код бүрэн бичигдсэн. Чамаас **дөрвөн утга** + Vercel дээр тавих ажил хэрэгтэй.

Кино одооноос **browser-оос Bunny руу шууд** очно — Vercel-ийн 4.5 MB хязгаар
арилсан. Постер хуучин замаараа (сервер дундуур) хэвээр.

---

## 1. Collection үүсгэх

Bunny dashboard → **Stream** → `seemedia` library → **Collections** → шинэ
collection нэмээд нэрийг нь `reel_challenge` гэж өг.

Үүсгэсний дараа тэр collection дээр дарахад **URL дотор нь guid** гарч ирнэ:

```
dash.bunny.net/stream/476065/library/collections/<ЭНЭ ХЭСЭГ нь collection guid>
```

Тэр guid-ыг хуулж ав.

> Яагаад collection вэ: library дотор чинь 1,145 жинхэнэ кино бий. Уралдааны
> бүтээл тэдэнтэй холилдвол шүүх, тоолох, устгахад төвөгтэй болно.

---

## 2. Дөрвөн утгыг цуглуулах

| Хувьсагч | Хаанаас |
|---|---|
| `BUNNY_STREAM_LIBRARY_ID` | `476065` (dashboard-ийн URL дотор) |
| `BUNNY_STREAM_API_KEY` | Stream → library → **API** таб |
| `BUNNY_STREAM_COLLECTION_ID` | 1-р алхмын guid |
| `BUNNY_STREAM_CDN_HOSTNAME` | Stream → library → **Delivery** (эсвэл одоогийн киноны URL-аас): `vz-19386c30-38d.b-cdn.net` |

⚠️ `BUNNY_STREAM_API_KEY` нь `BUNNY_STORAGE_ACCESS_KEY`-**ЭЭС ӨӨР**. Storage-ийн
key энд ажиллахгүй, Stream-ийн key Storage дээр ажиллахгүй.

---

## 3. Vercel дээр тавих

`events` project → Settings → Environment Variables. Дөрвүүлэнг нь нэмээд
**Production + Preview** хоёуланд нь тэмдэглэ.

`NEXT_PUBLIC_` угтвар **бүү** тавь. Эдгээр нь зөвхөн server route-оос уншигдана
(`app/api/challenge/film-ticket`, `film-status`), тиймээс browser bundle руу
орохгүй.

Локал туршихад `events/.env.local`-д мөн адил дөрвийг нэм.

---

## 4. Deploy + туршилт

`events` төслийг дахин deploy хий (шинэ env хэрэгжинэ).

### Урсгал

1. Нэвтэрч, анкетаа илгээж, хураамжаа төл
2. 4-р алхам → «Кино нэмэх» → маягтаа бөглө
3. **«Бичлэг байршуулах»** → хувь харагдана. Файл серверээр **дамжихгүй**
4. Дуусмагц «Bunny боловсруулж байна…» гарч, 5 сек тутам шалгана
5. Bunny transcode дуусмагц «Бүтээл хүлээн авлаа» болж, **Илгээх** нээгдэнэ

### Шалгах

- Bunny dashboard → Stream → `reel_challenge` collection дотор видео гарч ирсэн эсэх
- Админ панел → өргөдөл нээх → кино дээр тоглуулагч ажиллаж байгаа эсэх

### Гацвал

Vercel → events → Logs → `film-ticket` эсвэл `film-status` route.

| Алдаа | Шалтгаан |
|---|---|
| `Bunny Stream тохиргоо дутуу байна` | 4 хувьсагчийн аль нэг нь тавигдаагүй |
| `Bunny дээр видео үүсгэж чадсангүй` | API key буруу, эсвэл library id буруу |
| Байршуулалт 401-ээр унана | Stream-ийн key биш, Storage-ийн key тавьсан байна |
| Видео library-ийн үндэст ороод байна | `BUNNY_STREAM_COLLECTION_ID` тавигдаагүй |

---

## Юу яаж ажилладаг вэ

```
Browser → POST /api/challenge/film-ticket  { filmId }         ← жижигхэн JSON
Server  → эзэмшигч мөн үү, анкет paid уу, хугацаа гараагүй юу
        → Bunny: POST /library/476065/videos → videoId
        → signature = sha256(libraryId + API_KEY + expire + videoId)
        → challenge_films: film_video_id, film_url, film_status='processing'
        → { libraryId, videoId, expire, signature }   ← API key буцахгүй

Browser → tus → video.bunnycdn.com/tusupload                  ← БАЙТ ЭНД ЯВНА
          50MB chunk, тасарвал үргэлжилнэ

Browser → POST /api/challenge/film-status  (5 сек тутам)
Server  → Bunny-гээс status уншаад processing → ready → бичнэ
```

**API key browser руу хэзээ ч явахгүй.** Гарын үсэг нь **нэг видеог**, **нэг
цаг** бичих эрх л өгнө — өөр видео, өөр library, хугацаа өнгөрсний дараа юу ч
хийж чадахгүй.

**Постер яагаад өөр замаар вэ:** Bunny **Storage** нь зоны хэмжээний `AccessKey`
header-ээр л танидаг, объект тус бүрийн гарын үсэг **байхгүй**. Тэр key-тэй
browser бүх зоныг устгаж чадна. Bunny **Stream** харин видео тус бүрийн гарын
үсэг өгдөг — яг үүнээс болж кино серверийг тойрч чадаж байгаа юм.

**`film_url` дангаараа «бичлэг орсон» гэсэн үг биш** — түүнийг ticket авахад,
ганц ч байт ирэхээс өмнө бичдэг. Бодит хариу нь `film_status = 'ready'`.
