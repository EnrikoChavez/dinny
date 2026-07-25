# Dinny

Dinny is a mobile-first AI recipe recommendation app built with Next.js,
TypeScript, Supabase, OpenAI, and Vercel.

The first iteration includes:

- Personalized recipe discovery with fast dietary filters
- Signed-in recommendations with an OpenAI-powered server route
- Google OAuth and password-free email verification through Supabase
- A persistent **Last used** tab with local-first history and account sync
- Responsive recipe detail views and production social metadata

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app works with curated sample recommendations when OpenAI credentials are
absent. Recommendation requests still require a signed-in Supabase user.
Add the environment values below to enable live authentication and AI results.

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor.
3. Enable the Google provider under Authentication → Providers.
4. Add `http://localhost:3000/auth/callback` and the production callback URL
   to Authentication → URL Configuration.
5. Copy the project URL and anon key into `.env.local`.

## Environment variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Keep `OPENAI_API_KEY` server-side. Never prefix it with `NEXT_PUBLIC_`.

## Vercel

Import the repository in Vercel or run `vercel` from this directory. Add the
same environment variables to the Vercel project, then redeploy. For Google
sign-in, add `https://YOUR_DOMAIN/auth/callback` to the authorized redirect
URLs in both Supabase and the Google OAuth client.
