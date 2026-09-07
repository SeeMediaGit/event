-- public.events — уралдаан тэмцээний жагсаалт (events.seemedia.mn).
--
-- HOW TO APPLY: paste into the Supabase SQL editor and run. This project's
-- remote migration history is empty and DDL cannot go through the service-role
-- REST API, so every schema change is applied by hand — same as
-- landing/supabase/migrations/20260727_lock_down_anon_reads.sql.
--
-- Verified 2026-07-29 against the live project: no table named `events`,
-- `event_entries` or `contests` exists yet, so nothing here collides.
--
-- ACCESS MODEL (deliberately simple, per product decision):
--   * anyone signed in sees every published event — no tickets, no payment,
--     no per-user entitlement. Logging in IS the gate.
--   * anonymous visitors see nothing. The anon key ships in the JS bundle, so
--     "no policy for anon" is what actually protects an unannounced contest,
--     not the login screen.
--   * writes belong to the service role / SQL editor only. No insert, update
--     or delete policy is created below, which means no client key of any kind
--     can write — the service role bypasses RLS and is unaffected.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id                   uuid primary key default gen_random_uuid(),

  -- What the user sees.
  name                 text        not null,
  slug                 text        unique,
  subtitle             text,
  description          text,

  -- Images live in Supabase Storage (small files) — full public URLs.
  poster_url           text,
  cover_url            text,

  location             text,

  -- draft   → invisible to everyone but the service role
  -- published → visible to every signed-in user
  -- archived  → hidden again, kept for the record
  status               text        not null default 'draft'
                       check (status in ('draft', 'published', 'archived')),

  -- The app derives "Явагдаж байна / Удахгүй / Дууссан" from these two on
  -- every read (lib/events/types.ts getEventPhase). Nothing is stored, so no
  -- cron job is needed to flip a stale status column at midnight.
  starts_at            timestamptz,
  ends_at              timestamptz,
  registration_ends_at timestamptz,

  is_featured          boolean     not null default false,
  sort_order           integer     not null default 0,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.events is
  'Уралдаан тэмцээн. Read: any authenticated user, published rows only. Write: service role only.';

-- ---------------------------------------------------------------------------
-- 2. Indexes — the list page orders by (sort_order, starts_at) over published
--    rows, which is the only query pattern that exists today.
-- ---------------------------------------------------------------------------
create index if not exists events_published_order_idx
  on public.events (sort_order, starts_at)
  where status = 'published';

create index if not exists events_starts_at_idx
  on public.events (starts_at desc nulls last);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
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

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;

drop policy if exists "events_select_published" on public.events;
create policy "events_select_published"
  on public.events
  for select
  to authenticated                 -- NOT `public`: that would include anon.
  using (status = 'published');

-- No insert / update / delete policies on purpose. See ACCESS MODEL above.

-- ---------------------------------------------------------------------------
-- 5. VERIFY after running
-- ---------------------------------------------------------------------------
-- a) Policy shape — expect exactly one row, roles = {authenticated}, cmd = SELECT.
--
--    select policyname, roles, cmd, qual
--    from   pg_policies
--    where  schemaname = 'public' and tablename = 'events';
--
-- b) RLS actually on — expect rls_enabled = true.
--
--    select relname, relrowsecurity as rls_enabled
--    from   pg_class where oid = 'public.events'::regclass;
--
-- c) Anonymous read must come back EMPTY even after step 6 inserts rows:
--
--    curl "$SUPABASE_URL/rest/v1/events?select=*" -H "apikey: <anon key>"
--
--    If that returns rows, a wide-open policy from somewhere else is in play —
--    find it with the query in (a) and drop it by name.

-- ---------------------------------------------------------------------------
-- 6. Seed — one row so the UI has something to render. Edit or delete freely.
-- ---------------------------------------------------------------------------
-- insert into public.events
--   (name, subtitle, description, status, starts_at, ends_at, registration_ends_at, location, sort_order)
-- values
--   ('Богино хэмжээний кино уралдаан 2026',
--    'Залуу найруулагчдад зориулсан жилийн шилдэг богино хэмжээний киноны уралдаан.',
--    E'Оролцох болзол:\n• 18-35 насны Монгол Улсын иргэн\n• Кино 5-15 минутын урттай\n• Өмнө нь хаана ч нийтлэгдээгүй бүтээл байх',
--    'published',
--    '2026-08-01 09:00+08',
--    '2026-09-30 18:00+08',
--    '2026-08-20 23:59+08',
--    'Улаанбаатар',
--    0);
