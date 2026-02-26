# 🎮 Alphabet Game

AI-judged multiplayer word game. Fill 7 categories starting with a random letter, beat the 60-second clock, and let Wikipedia validate your answers. Supports English and Hebrew.

## Tech Stack

- **Next.js** — frontend + API routes
- **Supabase** — database for rooms & matchmaking queue
- **Wikipedia API** — answer validation (no AI key needed)
- **Vercel** — hosting

---

## Setup Guide

### 1. Supabase — create tables

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Go to **SQL Editor** and run this SQL:

```sql
-- Matchmaking queue (lang column added for Hebrew/English letter support)
create table if not exists queue (
  player_id   text primary key,
  player_name text not null,
  lang        text default 'en',
  joined_at   timestamptz default now()
);

-- Game rooms
create table if not exists rooms (
  id         text primary key,
  letter     text not null,
  status     text default 'waiting',
  players    jsonb default '[]',
  player_ids jsonb default '[]',
  answers    jsonb default '{}',
  validation jsonb default '{}',
  created_at timestamptz default now()
);

-- Private lobbies
create table if not exists lobbies (
  id         text primary key,
  host_id    text not null,
  host_name  text not null,
  guest_id   text,
  guest_name text,
  letter     text not null,
  status     text default 'waiting',
  created_at timestamptz default now()
);

-- RLS
alter table queue   enable row level security;
alter table rooms   enable row level security;
alter table lobbies enable row level security;

create policy "Allow all" on queue   for all using (true) with check (true);
create policy "Allow all" on rooms   for all using (true) with check (true);
create policy "Allow all" on lobbies for all using (true) with check (true);
```

> **Upgrading from a previous version?** Run this to add the `lang` column:
> ```sql
> alter table queue add column if not exists lang text default 'en';
> ```

3. Go to **Settings → API** and copy:
   - Project URL → `SUPABASE_URL`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Local development

```bash
cp .env.local.example .env.local
# Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

### 3. Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy ✓

---

## Features

- 🎮 Solo mode + 1v1 online (random matchmaking & private lobbies)
- 🌍 Hebrew & English — full UI translation, Hebrew Wikipedia validation, Hebrew letters
- 🔗 Private lobby share: "Invite Friend" opens native share sheet (mobile) or share modal (desktop)
- ⏱️ 60-second timer, AI-style Wikipedia validation
- 🔁 Rematch in private rooms
