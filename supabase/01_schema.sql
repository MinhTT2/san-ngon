-- ============================================================
-- Sân Ngon — 01. Schema
-- Bản chốt theo tài liệu "Thiết kế CSDL". Chạy 1 lần.
-- ============================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------- Enums ----------
do $$ begin create type user_role as enum ('player','owner','admin');
exception when duplicate_object then null; end $$;

do $$ begin create type venue_status as enum ('draft','pending','active','rejected');
exception when duplicate_object then null; end $$;

do $$ begin create type sport_type as enum ('football5','football7','football11','badminton','pickleball','tennis');
exception when duplicate_object then null; end $$;

do $$ begin create type booking_status as enum ('pending','confirmed','completed','cancelled','no_show');
exception when duplicate_object then null; end $$;

do $$ begin create type refund_status as enum ('none','needed','done');
exception when duplicate_object then null; end $$;

do $$ begin create type notif_kind as enum ('new_booking','deposit_paid','expiring_soon','rescheduled','venue_approved');
exception when duplicate_object then null; end $$;

do $$ begin create type notif_channel as enum ('app','email','telegram');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists profiles (
  id               uuid primary key references auth.users on delete cascade,
  role             user_role not null default 'player',
  full_name        text,
  phone            text,
  avatar_url       text,
  telegram_chat_id text,
  telegram_link_token_hash text,
  telegram_link_expires_at timestamptz,
  payout_bank      text,
  payout_account   text,
  created_at       timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- ---------- venues ----------
create table if not exists venues (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references profiles(id) on delete cascade,
  slug                 text unique not null,
  name                 text not null,
  address              text not null,
  district             text not null,
  city                 text not null default 'Hà Nội',
  lat                  double precision,
  lng                  double precision,
  phone                text,
  description          text,
  images               text[] not null default '{}',
  amenities            text[] not null default '{}',
  open_time            time not null default '05:00',
  close_time           time not null default '23:00',
  deposit_pct          int  not null default 30 check (deposit_pct between 0 and 100),
  booking_horizon_days int  not null default 30 check (booking_horizon_days between 1 and 180),
  status               venue_status not null default 'draft',
  created_at           timestamptz not null default now()
);

create index if not exists venues_district_idx on venues (district) where status = 'active';
create index if not exists venues_owner_idx    on venues (owner_id);
-- Một tài khoản chỉ mở một hồ sơ trong MVP. Ràng buộc ở DB để hai lần gửi
-- đồng thời không thể tạo ra hai cụm sân.
create unique index if not exists venues_one_per_owner_idx
  on venues (owner_id) where status in ('draft', 'pending');

-- ---------- courts ----------
create table if not exists courts (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references venues(id) on delete cascade,
  name         text not null,
  sport        sport_type not null,
  surface      text,
  is_indoor    boolean not null default false,
  slot_minutes int not null default 60 check (slot_minutes in (30,60,90,120)),
  open_time    time,   -- null = lấy theo venues
  close_time   time,   -- null = lấy theo venues
  is_active    boolean not null default true,
  sort_order   int not null default 0
);

create index if not exists courts_venue_idx on courts (venue_id) where is_active;

-- ---------- price_rules ----------
create table if not exists price_rules (
  id             uuid primary key default gen_random_uuid(),
  court_id       uuid not null references courts(id) on delete cascade,
  label          text,
  days           int[] not null default '{0,1,2,3,4,5,6}',
  start_time     time not null,
  end_time       time not null,
  price_per_hour int not null check (price_per_hour >= 0),
  priority       int not null default 0,
  check (end_time > start_time)
);

create index if not exists price_rules_court_idx on price_rules (court_id);

-- ---------- bookings ----------
create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  court_id        uuid not null references courts(id) on delete restrict,
  user_id         uuid not null references profiles(id) on delete restrict,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  total_amount    int not null check (total_amount >= 0),
  deposit_amount  int not null check (deposit_amount >= 0),
  status          booking_status not null default 'pending',
  refund_status   refund_status,
  customer_name   text,
  customer_phone  text not null,
  note            text,
  expires_at      timestamptz not null default now() + interval '15 minutes',
  paid_at         timestamptz,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now(),
  constraint bookings_valid_range check (ends_at > starts_at)
);

-- *** Ràng buộc quan trọng nhất của cả hệ thống ***
alter table bookings drop constraint if exists bookings_no_overlap;
alter table bookings add constraint bookings_no_overlap
  exclude using gist (
    court_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending','confirmed'));

create index if not exists bookings_user_idx    on bookings (user_id, starts_at desc);
create index if not exists bookings_court_idx   on bookings (court_id, starts_at);
create index if not exists bookings_pending_idx on bookings (expires_at) where status = 'pending';
create index if not exists bookings_finish_idx  on bookings (ends_at) where status = 'confirmed';

-- ---------- payments ----------
create table if not exists payments (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  provider   text not null default 'sepay',
  amount     int not null,
  ref_code   text not null,
  bank_tx_id text unique,
  status     text not null default 'pending',
  raw        jsonb,
  created_at timestamptz not null default now(),
  paid_at    timestamptz
);

create index if not exists payments_ref_idx on payments (ref_code);

-- ---------- notifications ----------
create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  booking_id    uuid references bookings(id) on delete cascade,
  kind          notif_kind not null,
  channel       notif_channel not null default 'app',
  title         text not null,
  body          text,
  sent_at       timestamptz,
  failed_reason text,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notif_user_idx on notifications (user_id, created_at desc);
create index if not exists notif_unread_idx on notifications (user_id) where read_at is null and channel = 'app';
