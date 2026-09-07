-- Reel Film Challenge — 1-р үе шат: анкет.
--
-- HOW TO APPLY: Supabase SQL editor дээр бүхэлд нь буулгаад Run. Бүгд
-- begin/commit дотор тул дунд нь алдаа гарвал юу ч өөрчлөгдөхгүй.
-- Migration history хоосон (20260729_events_schema.sql-ийн тайлбарыг үз),
-- тиймээс энэ файл л бүртгэл болно.
--
-- PRODUCTION-Д АЮУЛГҮЙ: зөвхөн нэмэлт өөрчлөлт.
--   * events-д default-тай багана нэмнэ (metadata-only, агшин зуур).
--     events сайт EVENT_COLUMNS-оор багана нэрлэж татдаг тул шинэ багана
--     browser руу явахгүй.
--   * challenge_applications шинэ хүснэгт. Одоо ажиллаж байгаа mobile / web /
--     admin үүнийг мэдэхгүй, тиймээс нөлөөлөхгүй.
--   * Одоо байгаа ямар ч policy, багана, constraint-д хүрэхгүй.
--
-- ACCESS MODEL:
--   * anon              — юу ч үгүй. Grant-ийг нь хүртэл хураана.
--   * authenticated     — зөвхөн ӨӨРИЙН мөр. Бичиж чадах багана нь анкетын
--                         талбарууд л; registration_no, paid_at, reviewed_*
--                         зэрэг зохион байгуулагчийн баганыг бичиж чадахгүй
--                         (column-level grant). status-ийг зөвхөн draft эсвэл
--                         submitted болгож чадна — paid / approved руу хэзээ ч
--                         биш.
--   * service_role      — бүгд (RLS-ийг тойрдог). qpay-callback болон admin
--                         route-ууд үүгээр бичнэ.

begin;

-- ---------------------------------------------------------------------------
-- 1. events — уралдааны тохиргоо
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists kind                 text        not null default 'event',
  add column if not exists entry_fee            numeric     check (entry_fee is null or entry_fee >= 0),
  add column if not exists submission_ends_at   timestamptz,
  add column if not exists rules                text,
  add column if not exists show_on_home         boolean     not null default false,
  add column if not exists registration_prefix  text,
  add column if not exists next_registration_no integer     not null default 1;

alter table public.events
  drop constraint if exists events_kind_check;
alter table public.events
  add constraint events_kind_check check (kind in ('event', 'challenge'));

comment on column public.events.kind                 is 'event = энгийн дэлгэрэнгүй; challenge = анкет/төлбөр/upload урсгалтай';
comment on column public.events.entry_fee            is 'Суурь хураамж ₮. Сервер энэ дүнгээр нэхэмжлэх үүсгэнэ, client-ээс дүн авахгүй';
comment on column public.events.submission_ends_at   is 'Бүтээл оруулах эцсийн хугацаа (registration_ends_at-аас тусдаа)';
comment on column public.events.show_on_home         is 'Mobile / web нүүрний strip-д гарах эсэх';
comment on column public.events.registration_prefix  is 'Бүртгэлийн дугаарын угтвар, жишээ нь RFC26';
comment on column public.events.next_registration_no is 'Дараагийн бүртгэлийн дугаар. Төлбөр орсон үед qpay-callback нэмэгдүүлнэ';

-- ---------------------------------------------------------------------------
-- 2. challenge_applications — анкет
-- ---------------------------------------------------------------------------
create table if not exists public.challenge_applications (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid        not null references public.events(id) on delete cascade,
  -- default auth.uid(): client user_id илгээх шаардлагагүй, өөр хүний id
  -- илгээвэл доорх policy-д унана.
  user_id             uuid        not null default auth.uid() references auth.users(id) on delete cascade,

  -- Төлөв. paid-аас хойшхи утгуудыг зөвхөн service role бичнэ.
  status              text        not null default 'draft'
                      check (status in ('draft', 'submitted', 'paid', 'uploaded',
                                        'under_review', 'approved', 'rejected')),
  registration_no     text        unique,
  submitted_at        timestamptz,
  paid_at             timestamptz,

  -- 1. Хувийн мэдээлэл
  full_name           text,
  age                 integer     check (age is null or age between 1 and 120),
  gender              text        check (gender is null or gender in ('male', 'female', 'other')),
  phone               text,                       -- text: эхний 0 болон + алдагдахгүй
  email               text,
  social_url          text,                       -- Facebook / Instagram
  city                text,                       -- Хот / Аймаг

  -- 2. Багийн мэдээлэл
  participation       text        check (participation is null or participation in ('solo', 'team')),
  team_name           text,
  team_leader         text,
  team_size           integer     check (team_size is null or team_size >= 1),

  -- 3. Киноны мэдээлэл
  film_title          text,
  film_genre          text[]      not null default '{}',   -- инээдэм, романтик, аймшиг, адал явдал, тулаант, драм, уран зөгнөл, бусад
  film_genre_other    text,
  film_synopsis       text,

  -- 4. Бүтээлийн мэдээлэл
  shot_with           text        check (shot_with is null or shot_with in ('phone', 'camera', 'mixed')),
  edit_software       text[]      not null default '{}',   -- CapCut, VN, Premiere Pro, DaVinci Resolve, Final Cut Pro, other
  edit_software_other text,

  -- 5. Нэмэлт мэдээлэл
  has_prior_films     boolean,
  prior_films_note    text,

  -- Зохион байгуулагчийн хэсэг (зөвхөн service role)
  reviewed_by         uuid        references public.profiles(id) on delete set null,
  reviewed_at         timestamptz,
  review_note         text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Нэг хүн нэг уралдаанд нэг л өргөдөл.
  unique (event_id, user_id)
);

comment on table public.challenge_applications is
  'Уралдааны анкет. Read/write: өөрийн мөр (authenticated). paid+ төлөв, registration_no, reviewed_*: service role only.';

-- ---------------------------------------------------------------------------
-- 3. Индекс
-- ---------------------------------------------------------------------------
create index if not exists challenge_applications_event_status_idx
  on public.challenge_applications (event_id, status);

create index if not exists challenge_applications_user_idx
  on public.challenge_applications (user_id);

-- ---------------------------------------------------------------------------
-- 4. updated_at trigger — 20260729_events_schema.sql-д үүссэн функцийг
--    дахин ашиглана (create or replace нь idempotent).
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists challenge_applications_set_updated_at on public.challenge_applications;
create trigger challenge_applications_set_updated_at
  before update on public.challenge_applications
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Grant — RLS-ээс ӨМНӨ. Supabase шинэ хүснэгтэд anon / authenticated-д
--    бүх эрхийг автоматаар өгдөг. Үүнийг нарийсгана:
--      anon          → юу ч үгүй
--      authenticated → select бүх багана; insert / update зөвхөн анкетын
--                      багана. Зохион байгуулагчийн баганыг бичих гэвэл
--                      42501 permission denied.
-- ---------------------------------------------------------------------------
revoke all on public.challenge_applications from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.challenge_applications from authenticated;

grant select on public.challenge_applications to authenticated;

grant insert (
  event_id, user_id, status, submitted_at,
  full_name, age, gender, phone, email, social_url, city,
  participation, team_name, team_leader, team_size,
  film_title, film_genre, film_genre_other, film_synopsis,
  shot_with, edit_software, edit_software_other,
  has_prior_films, prior_films_note
) on public.challenge_applications to authenticated;

grant update (
  status, submitted_at,
  full_name, age, gender, phone, email, social_url, city,
  participation, team_name, team_leader, team_size,
  film_title, film_genre, film_genre_other, film_synopsis,
  shot_with, edit_software, edit_software_other,
  has_prior_films, prior_films_note
) on public.challenge_applications to authenticated;

grant delete on public.challenge_applications to authenticated;  -- policy доор зөвхөн draft-д хязгаарлана

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.challenge_applications enable row level security;

-- Уншилт: зөвхөн өөрийн мөр.
drop policy if exists "challenge_applications_select_own" on public.challenge_applications;
create policy "challenge_applications_select_own"
  on public.challenge_applications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Үүсгэх: өөрийн нэр дээр, зөвхөн draft эсвэл submitted төлөвтэй.
drop policy if exists "challenge_applications_insert_own" on public.challenge_applications;
create policy "challenge_applications_insert_own"
  on public.challenge_applications
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status in ('draft', 'submitted')
  );

-- Засах: зөвхөн төлөгдөөгүй (draft / submitted) мөрөө, зөвхөн draft / submitted
-- руу. using = аль мөрийг засаж болох, with check = ямар утгатай болгож болох.
-- Төлсний дараа анкет түгжигдэнэ; paid / approved руу client шилжүүлж чадахгүй.
drop policy if exists "challenge_applications_update_own" on public.challenge_applications;
create policy "challenge_applications_update_own"
  on public.challenge_applications
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and status in ('draft', 'submitted')
  )
  with check (
    auth.uid() = user_id
    and status in ('draft', 'submitted')
  );

-- Устгах: зөвхөн өөрийн draft.
drop policy if exists "challenge_applications_delete_own_draft" on public.challenge_applications;
create policy "challenge_applications_delete_own_draft"
  on public.challenge_applications
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and status = 'draft'
  );

-- anon-д policy зориуд байхгүй. service_role RLS-ийг тойрдог.

commit;

-- ---------------------------------------------------------------------------
-- 7. VERIFY — commit-ийн дараа тус тусад нь ажиллуул.
-- ---------------------------------------------------------------------------
-- a) 4 policy, бүгд roles = {authenticated}:
--
--    select policyname, cmd, roles
--    from   pg_policies
--    where  schemaname = 'public' and tablename = 'challenge_applications'
--    order  by policyname;
--
-- b) RLS асаалттай (rls_enabled = true):
--
--    select relname, relrowsecurity as rls_enabled
--    from   pg_class where oid = 'public.challenge_applications'::regclass;
--
-- c) anon-д хүснэгтийн grant огт байхгүй (мөр буцахгүй):
--
--    select grantee, privilege_type
--    from   information_schema.role_table_grants
--    where  table_schema = 'public' and table_name = 'challenge_applications'
--       and grantee = 'anon';
--
-- d) authenticated нь registration_no / paid_at / reviewed_* баганад
--    insert / update эрхгүй (эдгээр багана жагсаалтад гарч ирэх ёсгүй):
--
--    select column_name, privilege_type
--    from   information_schema.column_privileges
--    where  table_schema = 'public' and table_name = 'challenge_applications'
--       and grantee = 'authenticated'
--       and privilege_type in ('INSERT', 'UPDATE')
--       and column_name in ('registration_no', 'paid_at', 'reviewed_by', 'reviewed_at', 'review_note');
--
-- e) anon key-ээр REST дуудахад хоосон биш, 401/403 буцна:
--
--    curl "$SUPABASE_URL/rest/v1/challenge_applications?select=*" -H "apikey: <anon key>"
--
-- f) events-ийн шинэ багана байгаа, хуучин мөрүүд kind = 'event':
--
--    select id, name, kind, entry_fee, show_on_home, next_registration_no
--    from   public.events;

-- ---------------------------------------------------------------------------
-- 8. Seed — уралдааны мөрөө үүсгэх / шинэчлэх. Утгуудаа засаад ажиллуул.
-- ---------------------------------------------------------------------------
-- update public.events
-- set    kind                 = 'challenge',
--        entry_fee            = 20000,
--        registration_prefix  = 'RFC26',
--        submission_ends_at   = '2026-10-15 23:59+08',
--        show_on_home         = true,
--        rules                = E'• 18-35 насны иргэн\n• Кино 5-15 минут\n• Өмнө нь нийтлэгдээгүй бүтээл'
-- where  slug = 'reel-film-challenge-2026';
