-- Core schema for the Tatami platform: clubs, members, payments, classes,
-- announcements/notifications, and platform-admin/billing bookkeeping.
create extension if not exists pgcrypto;

create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  default_locale text not null default 'bg' check (default_locale in ('bg', 'en')),
  theme jsonb not null default '{}'::jsonb,
  plan text not null default 'basic' check (plan in ('basic', 'pro')),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused')),
  online_payments_enabled boolean not null default false,
  channels jsonb not null default '{"in_app": true, "email": true, "viber": false, "sms": false}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists club_domains (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  hostname text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists belts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  rank int not null,
  name_bg text not null,
  name_en text not null,
  color_hex text not null,
  unique (club_id, rank)
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  role text not null default 'student' check (role in ('owner', 'coach', 'student')),
  full_name text not null,
  email text,
  phone text,
  belt_id uuid references belts (id) on delete set null,
  status text not null default 'trial' check (status in ('active', 'trial', 'paused', 'left')),
  joined_at date not null default current_date,
  birth_year int,
  guardian_consent boolean not null default false,
  consent_at timestamptz,
  invite_code text unique,
  created_at timestamptz not null default now()
);

create index if not exists members_club_id_idx on members (club_id);
create unique index if not exists members_user_id_idx on members (user_id) where user_id is not null;

-- Coach-only notes, split out of members so RLS can hide them from the
-- student the note is about while still letting them read their own row.
create table if not exists member_notes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  body text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'EUR',
  method text not null check (method in ('cash', 'card', 'bank', 'online')),
  period_start date not null,
  period_end date not null,
  status text not null default 'due' check (status in ('paid', 'due', 'overdue', 'waived')),
  recorded_by uuid references auth.users (id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists payments_member_id_idx on payments (member_id);
create index if not exists payments_club_id_idx on payments (club_id);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  title text not null,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  duration_min int not null check (duration_min > 0),
  coach_member_id uuid references members (id) on delete set null,
  belt_min_rank int,
  belt_max_rank int
);

-- One-off "time changed" notices for a specific class occurrence, surfaced
-- on the student home card with the red "ПРОМЯНА" badge.
create table if not exists class_notices (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  effective_date date not null,
  new_start_time time,
  note text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  title text not null,
  body_bg text not null,
  body_en text,
  audience jsonb not null default '{"all": true}'::jsonb,
  channels text[] not null default array['in_app'],
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  announcement_id uuid references announcements (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_member_id_idx on notifications (member_id);

create table if not exists platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- What each club pays US. Never exposed to club owners/coaches.
create table if not exists club_billing (
  club_id uuid primary key references clubs (id) on delete cascade,
  plan text not null default 'basic',
  monthly_price_cents int not null default 0,
  build_fee_cents int not null default 0,
  paid_until date,
  notes text
);
