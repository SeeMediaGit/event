-- challenge_applications — бүтээлийн файл (4-р алхам).
--
-- HOW TO APPLY: Supabase SQL editor дээр буулгаад Run. Migration history хоосон
-- (20260729_events_schema.sql-ийн тайлбарыг үз), тиймээс энэ файл л бүртгэл
-- болно. Би өөрөө ажиллуулахгүй.
--
-- PRODUCTION-Д АЮУЛГҮЙ: зөвхөн nullable багана нэмнэ. Одоо байгаа policy,
-- constraint, багананд хүрэхгүй.
--
-- ЯАГААД CLIENT-Д GRANT ӨГӨӨГҮЙ ВЭ: файлыг browser-оос Bunny руу шууд тавих
-- боломжгүй — Bunny Storage нь `AccessKey` header шаарддаг бөгөөд түүнийг
-- browser-т өгвөл хэн ч бүх зоныг устгаж чадна. Тиймээс upload нь
-- see_media_admin/app/api/admin/bunny/upload/route.ts-тэй яг ижил хэлбэрээр
-- server route-аар дамжина, тэр route service role-оор доорх багануудыг бичнэ.
-- registration_no / paid_at-тай ижил зарчим: зохион байгуулагчийн бичдэг зүйлийг
-- client бичихгүй.

begin;

alter table public.challenge_applications
  add column if not exists film_file_url   text,
  add column if not exists film_file_path  text,
  add column if not exists film_uploaded_at timestamptz;

comment on column public.challenge_applications.film_file_url  is 'Bunny CDN дээрх бүтээлийн бүтэн URL. Зөвхөн service role бичнэ';
comment on column public.challenge_applications.film_file_path is 'Bunny storage zone доторх зам, ж: campaign_reels/<event_id>/<application_id>/film-....mp4';
comment on column public.challenge_applications.film_uploaded_at is 'Бүтээл хамгийн сүүлд ирсэн огноо';

-- Client-д эдгээрийг бичих эрх ЗОРИУД өгөхгүй. 20260907-гийн
-- `grant insert (...)` / `grant update (...)` жагсаалт хэвээр үлдэнэ, тиймээс
-- browser-оос эдгээрийг илгээхийг оролдвол 42501-ээр бүхэл хүсэлт унана.
-- Уншихад нь 20260907-гийн `grant select` хангалттай.

commit;

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- a) Гурван багана нэмэгдсэн:
--
--    select column_name, data_type
--    from   information_schema.columns
--    where  table_schema = 'public' and table_name = 'challenge_applications'
--       and column_name in ('film_file_url', 'film_file_path', 'film_uploaded_at');
--
-- b) authenticated-д эдгээрт INSERT / UPDATE эрх БАЙХГҮЙ (мөр буцах ёсгүй):
--
--    select column_name, privilege_type
--    from   information_schema.column_privileges
--    where  table_schema = 'public' and table_name = 'challenge_applications'
--       and grantee = 'authenticated'
--       and privilege_type in ('INSERT', 'UPDATE')
--       and column_name in ('film_file_url', 'film_file_path', 'film_uploaded_at');
