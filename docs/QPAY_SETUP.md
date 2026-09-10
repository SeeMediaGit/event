# QPay — уралдааны суурь хураамж: тавих заавар

Код бүрэн бичигдсэн. Доорхийг **дарааллаар нь** хийнэ. Алхам бүр өмнөхөөсөө
хамаарна, тиймээс дундуур нь үсрэхгүй.

Нийт 6 алхам, ~15 минут.

---

## 0. Урьдчилсан нөхцөл

`see_media_admin/supabase/migrations/20260910_challenge_films_and_payments.sql` ажилласан
байх ёстой (`challenge_payments` хүснэгт үүссэн байна). Ажилласан.

---

## 1. SQL — нэг багана нэмнэ

Supabase SQL editor дээр
`see_media_admin/supabase/migrations/20260911_challenge_payments_ebarimt.sql`-ийг
буулгаад Run.

Нэг nullable багана (`ebarimt_receipt_id`) нэмнэ — төлбөр бүрийн и-баримт явсан
эсэхийг админ панелаас харах боломжтой болгоно. Файлын доод талд VERIFY бий.

> Энэ алхмыг алгасвал төлбөр ажиллах боловч callback лог дээр
> `ebarimt_receipt_id write failed` гэж бичээд өнгөрнө — баримт өөрөө явсан хэвээр.

---

## 2. Supabase CLI-г холбоно

```bash
cd see_media_admin
supabase link --project-ref sxvnidtuspoxcgpzffdo
```

`see_media_admin/supabase/config.toml` бэлэн байгаа — бүх 17 функцийн тохиргоо нэг
файлд, хоёр шинэ функцийн `verify_jwt = false` мөн тэнд.

> 2026-09-10-нд бүх supabase хавтас `see_media_admin/`-д нэгтгэгдсэн. Өмнө нь
> `events/` дотроос link хийсэн бол одоо тэр холбоос ажиллахгүй — дээрх
> командыг admin repo дотор дахин ажиллуулна.

---

## 3. Secrets тавина

```bash
supabase secrets set QPAY_CLIENT_ID=SEEMEDIA QPAY_CLIENT_SECRET=c0WA3nR1
```

Утгууд нь `see_media_admin/supabase/functions/qpay-callback/index.ts`-д кодонд бичээстэй
байгаа тэр хоёр. Шинэ код тэднийг **кодонд бичихгүй**, `Deno.env`-ээс уншина —
QPay-гийн нууц үг солиход secret солино, дахин deploy хийхгүй.

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` гурвыг Supabase
өөрөө edge function-д өгдөг тул тавих шаардлагагүй.

Шалгах:

```bash
supabase secrets list
```

---

## 4. Хоёр функцийг deploy хийнэ

```bash
supabase functions deploy challenge-payment-create
supabase functions deploy challenge-payment-callback
```

`_shared/` доторх `qpay.ts`, `ebarimt.ts` хоёр автоматаар хамт орно.

> **Одоо байгаа `qpay-callback`-д ГАР ХҮРЭХГҮЙ.** Тэр функц захиалга, кино,
> reel-ийн төлбөрийг хариуцдаг. Уралдааны хураамж түүнээс бүрэн тусдаа.

Deploy болсныг шалгах — төлөгдөөгүй id өгвөл `Payment not found` буцаах ёстой:

```bash
curl "https://sxvnidtuspoxcgpzffdo.supabase.co/functions/v1/challenge-payment-callback?transactionId=TEST"
```

---

## 5. Уралдааны мөрөө шалгана

Админ панелийн **Уралдаанууд** хуудсаас тухайн event дээр эдгээр бөглөгдсөн
байх ёстой:

| Талбар | Яагаад |
|---|---|
| `entry_fee` | Хураамжийн дүн. **Энэ л дүнгээр нэхэмжлэх үүснэ** — client дүн илгээхгүй. `0` эсвэл хоосон бол төлбөргүй гэж үзээд шууд бүртгэнэ |
| `registration_prefix` | ж: `RFC26`. **Байхгүй бол төлбөр орсон ч дугаар олгогдохгүй** бөгөөд callback алдаа буцаана |
| `status` = `published`, `kind` = `challenge` | Эс тэгвэл функц «Уралдаан олдсонгүй» гэнэ |

SQL-ээр шалгах:

```sql
select name, kind, status, entry_fee, registration_prefix, next_registration_no
from   public.events where kind = 'challenge';
```

---

## 6. Deploy + туршилт

**Web** — `events/` төслийг Vercel руу дахин deploy хийнэ. Шинэ env хэрэггүй,
одоо байгаа `NEXT_PUBLIC_SUPABASE_URL` дээр функцийн хаяг тулгуурлана.

**Mobile** — шинэ EAS build. Native dependency нэмээгүй тул OTA update-аар ч
явж болно.

### Туршилтын урсгал

1. Апп эсвэл `events.seemedia.mn/challenge/<slug>` дээр нэвтэрнэ
2. Анкетаа бөглөж **илгээнэ** (`submitted` болно)
3. 3-р алхам → **«QPay-ээр төлөх»** → QR гарч ирнэ
4. Төлнө. 4 секунд тутам өөрөө шалгана
5. Төлөгдмөгц: анкет `paid`, **бүртгэлийн дугаар** гарч ирнэ, 4-р алхам нээгдэнэ
6. И-баримт бүртгэлтэй и-мэйл рүү очно

Хэрэв гацвал:

```bash
supabase functions logs challenge-payment-callback
```

`[ebarimt]` гэсэн мөрүүд баримтын явцыг харуулна. **И-баримт унасан ч төлбөр
хүчинтэй хэвээр** — оролцогч төлсөн, бүртгэгдсэн, баримтыг админ панелаас
гараар үүсгэж болно. Тэгж зориуд бичсэн: баримтын алдаа мөнгө орсон гүйлгээг
хэзээ ч буцаах ёсгүй.

---

## Юу яаж ажилладаг вэ (товчхон)

```
web + mobile ──POST { eventId } + JWT──► challenge-payment-create
                                          ├ JWT → хэн бэ
                                          ├ анкет нь submitted эсэх
                                          ├ amount = events.entry_fee   ← ЗӨВХӨН ЭНД
                                          ├ QPay invoice
                                          └ challenge_payments мөр + QR буцаана

QPay ─────────────────────────────────► challenge-payment-callback?transactionId=…
web/mobile poll (4 сек тутам) ─────────►  ├ QPay payment/check ← ЦОРЫН ГАНЦ БАТАЛГАА
                                          ├ payments.status = paid (optimistic lock)
                                          ├ application: paid + registration_no
                                          └ и-баримт + имэйл
```

**Дүн query param-аар ХЭЗЭЭ Ч явахгүй.** Callback URL-ыг QPay харна, лог руу
орно, хэн ч эвлүүлж чадна — тэнд дүн байвал хэн ч 1₮ төлөөд бүртгүүлнэ.
Callback-д зөвхөн `transactionId` явна: агуулгагүй, таамаглах боломжгүй түлхүүр.

**Тусдаа "status" endpoint байхгүй.** Callback идэмхий биш (idempotent) тул
client түүнийг түлхэх нь өөрөө poll болно, эцсийн хариуг `challenge_payments`-ээс
шууд уншина (RLS өөрийн мөрийг нээсэн).

**`invoices` хүснэгтийг ашиглаагүй.** Түүний `type` нь
`check (subscription|movie|reel)`-тэй бөгөөд `qpay-callback` edge функц түүгээр
эрх нээдэг. Тийш нь чихвэл production төлбөрийн замд гар хүрнэ.
