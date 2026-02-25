# 🎮 Alphabet Game

AI-judged multiplayer word game. Fill categories starting with a random letter, beat the clock, and let Claude validate your answers.

## Tech Stack

- **Next.js** — frontend + API routes
- **Supabase** — database for rooms & matchmaking queue
- **Anthropic Claude** — AI answer validation (server-side)
- **Vercel** — hosting

---

## Setup Guide

### 1. Supabase — create tables

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **SQL Editor** and run this SQL:

```sql
-- Matchmaking queue
create table queue (
  player_id text primary key,
  player_name text not null,
  joined_at timestamptz default now()
);

-- Game rooms
create table rooms (
  id text primary key,
  letter text not null,
  status text default 'waiting',
  players jsonb default '[]',
  player_ids jsonb default '[]',
  answers jsonb default '{}',
  validation jsonb default '{}',
  created_at timestamptz default now()
);

-- Allow public read/write (the API routes use the service role key
-- so this is fine — your keys stay server-side)
alter table queue enable row level security;
alter table rooms enable row level security;

create policy "Allow all" on queue for all using (true) with check (true);
create policy "Allow all" on rooms for all using (true) with check (true);
```

4. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 2. Anthropic — get API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and go to **API Keys**
3. Create a new key and copy it

### 3. Local development

```bash
# Clone your repo
git clone https://github.com/YOUR_USERNAME/alphabet-game
cd alphabet-game

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local and fill in your keys

# Run locally
npm run dev
# Open http://localhost:3000
```

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables on Vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ANTHROPIC_API_KEY

# Redeploy with env vars
vercel --prod
```

**Or use the Vercel dashboard:**
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project → select your repo
3. Before deploying, go to **Environment Variables** and add all 5 keys from `.env.local.example`
4. Click Deploy

---

## Project Structure

```
alphabet-game/
├── pages/
│   ├── index.js          ← Main game UI
│   ├── _app.js
│   └── api/
│       ├── validate.js   ← Calls Anthropic (server-side)
│       ├── matchmake.js  ← Join queue / create room
│       ├── match-status.js ← Poll for match
│       ├── room.js       ← Get / update room
│       └── leave-queue.js
├── lib/
│   └── supabase.js       ← Supabase client
├── styles/
│   └── globals.css
├── .env.local.example    ← Copy to .env.local and fill in
└── README.md
```
