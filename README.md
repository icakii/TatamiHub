# Tatami Hub

Internal admin app for managing every karate club running on the Tatami platform: clubs, members, payments, billing and cross-club announcements. Used only by the platform's two admins, not by clubs or students.

## Stack

- React 18 + TypeScript (strict), built with Vite
- React Router
- Supabase (Postgres + Auth + Row Level Security)
- TanStack Query
- Tailwind CSS

## Getting started

```bash
npm install
cp .env.example .env   # fill in the two Supabase values, see below
npm run dev
```

## Environment variables

| Variable | Where to get it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project settings -> API -> Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase project settings -> API -> anon public key |

Never put a Supabase service-role key or any other secret in a `VITE_*` variable — anything with that prefix is bundled into the client and is publicly readable.

## Scripts

- `npm run dev` - start the local dev server
- `npm run build` - type-check and build for production
- `npm run lint` - run the linter
- `npm run preview` - preview the production build locally
