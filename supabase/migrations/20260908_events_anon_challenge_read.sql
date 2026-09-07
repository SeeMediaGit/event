-- events — нэвтрээгүй зочинд уралдааны танилцуулгыг харуулах.
--
-- HOW TO APPLY: Supabase SQL editor дээр буулгаад Run. Migration history
-- хоосон (20260729_events_schema.sql-ийн тайлбарыг үз), тиймээс энэ файл л
-- бүртгэл болно. Би өөрөө ажиллуулахгүй.
--
-- ЯАГААД: /challenge/[slug]-ийн 1-р алхам (танилцуулга) нэвтрэлтийн ГАДНА
-- байрлана — хүн уралдааныг эхлээд хараад дараа нь «Оролцох» дарж нэвтэрдэг.
-- 20260729-д anon-д policy огт үүсгээгүй тул одоо anon key-ээр events уншихад
-- хоосон массив ирдэг. Доорх policy яг нэг цонх нээнэ:
--
--   status = 'published'  →  ноорог / архивласан мөр гарахгүй
--   kind   = 'challenge'  →  энгийн event-үүд нэвтрэлтийн ард ХЭВЭЭР
--
-- Өөрөөр хэлбэл зарлаагүй тэмцээнийг нуудаг зүйл нь AuthGuard биш, энэ мөр.
--
-- ХАМРАХ ХҮРЭЭ: зөвхөн select. insert / update / delete policy anon-д
-- байхгүй хэвээр, тиймээс ямар ч client key бичиж чадахгүй.
--
-- ЖИЧ: challenge_applications-д anon-ын grant-ийг 20260907 хурааж авсан.
-- Энэ policy түүнд хамаагүй — анкет нэвтэрсэн хүнд л харагдана.

drop policy if exists "events_select_published_challenge_anon" on public.events;

create policy "events_select_published_challenge_anon"
  on public.events
  for select
  to anon
  using (status = 'published' and kind = 'challenge');

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- a) Хоёр select policy — {authenticated} ба {anon}:
--
--    select policyname, cmd, roles, qual
--    from   pg_policies
--    where  schemaname = 'public' and tablename = 'events'
--    order  by policyname;
--
-- b) anon key-ээр зөвхөн challenge мөр ирнэ (энгийн event ирэх ёсгүй):
--
--    curl "$SUPABASE_URL/rest/v1/events?select=id,name,kind,status" \
--         -H "apikey: <anon key>"
