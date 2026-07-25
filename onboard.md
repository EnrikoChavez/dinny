# Dinny collaborator onboarding

This guide gives a new collaborator everything needed to change Dinny, test it
locally, and contribute safely.

## 1. Access Enriko needs to grant

### GitHub

1. Ask the collaborator for her GitHub username.
2. Open the
   [Dinny repository access settings](https://github.com/EnrikoChavez/dinny/settings/access).
3. Select **Add people**, choose her account, and send the invitation.
4. She must accept the invitation before cloning or pushing.

This is a personal-account repository, so an accepted collaborator can read and
push code. See
[GitHub's collaborator guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository).

### Supabase

1. Open the
   [food_rec Supabase project](https://supabase.com/dashboard/project/azzoxboweksmkmrefcrp).
2. Open the organization settings, then **Team**.
3. Invite her email with the **Developer** role.
4. She should accept promptly; Supabase invitations expire after 24 hours.

Developer is the normal role for app and database work. It can work with project
content but cannot change project settings. Use **Administrator** only if she
also needs to change authentication providers, redirect URLs, API settings, or
other project configuration. Project-scoped roles may only be available on paid
Supabase plans. See
[Supabase access control](https://supabase.com/docs/guides/platform/access-control).

### Vercel (optional)

GitHub access is enough to contribute. Every merge to `main` automatically
deploys Dinny to production.

Invite her to Vercel only if she needs to inspect deployment logs, manage
environment variables, or trigger/roll back deployments herself. Vercel team
seats can depend on the current plan. See
[Vercel team-member access](https://vercel.com/docs/rbac/managing-team-members).

## 2. Install the local tools

Install:

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/) 20.9 or newer; Node 22 is recommended
- A code editor such as [VS Code](https://code.visualstudio.com/)

Next.js 16 requires Node.js 20.9 or newer. See the
[Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation).

Confirm the tools are available:

```bash
git --version
node --version
npm --version
```

Set a Git identity once:

```bash
git config --global user.name "Her Name"
git config --global user.email "her-github-email@example.com"
```

## 3. Clone and install Dinny

```bash
git clone https://github.com/EnrikoChavez/dinny.git
cd dinny
npm install
cp .env.example .env.local
```

If GitHub asks for authentication, sign in with GitHub Desktop or run
`gh auth login` after installing the
[GitHub CLI](https://cli.github.com/).

## 4. Configure local environment variables

Open `.env.local` and fill in:

```text
NEXT_PUBLIC_SUPABASE_URL=https://azzoxboweksmkmrefcrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=copy-from-supabase
OPENAI_API_KEY=optional-personal-development-key
OPENAI_MODEL=gpt-5-nano
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

To get the Supabase anon/publishable key, open the project and use **Connect** or
open **Project Settings → API Keys**. The URL and anon/publishable key are
intended for the browser. Never use the Supabase `service_role` key in this app.

`OPENAI_API_KEY` is optional for basic local UI work. Without it, Dinny uses its
curated fallback recipes. For live AI testing, create a separate development
key with a small spending limit; do not copy the production key into messages,
documents, or source code.

`.env.local` is ignored by Git. Never commit it.

## 5. Run and verify locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then:

1. Sign in with Google or an email link.
2. Complete the profile onboarding.
3. Ask Dinny for recipes.
4. Open a recipe and use **Made this** only when testing cooking history.
5. Confirm **Last used** contains only recipes marked as made.

If Google login fails locally, verify that
`http://localhost:3000/auth/callback` is still allowed in Supabase
**Authentication → URL Configuration**.

Before opening a pull request, run:

```bash
npm run lint
npm run build
```

## 6. Make a change safely

Do not work directly on `main`. Start from the latest production code:

```bash
git switch main
git pull --ff-only
git switch -c feature/short-description
```

After making and testing the change:

```bash
git status
git add path/to/changed-file
git commit -m "Describe the change"
git push -u origin HEAD
```

Open a pull request into `main` from GitHub. Review the preview and code together,
then merge. Merging into `main` triggers the Vercel production deployment at
[foodrecapp.vercel.app](https://foodrecapp.vercel.app/).

## 7. Where things live

- `app/page.tsx` — main interface, authentication, onboarding, and history UI
- `app/globals.css` — visual styling
- `app/api/recommend/route.ts` — authenticated recommendation API and OpenAI call
- `lib/recipes.ts` — curated fallback recipes and dietary compatibility
- `lib/supabase-browser.ts` — browser-side Supabase client
- `supabase/schema.sql` — database tables, policies, and triggers
- `app/layout.tsx` — page and social-sharing metadata

For database changes, update `supabase/schema.sql` in the same pull request.
Review the SQL before applying it to the production Supabase project. This keeps
the repository and live database definition aligned.

## 8. Security rules

- Never commit `.env.local`, API keys, passwords, or database secrets.
- Never expose `OPENAI_API_KEY` or a Supabase `service_role` key to browser code.
- Only variables intentionally prefixed with `NEXT_PUBLIC_` may reach the client.
- Do not paste secrets into GitHub issues, pull requests, screenshots, or chat.
- Use a feature branch and pull request for changes that affect production data,
  authentication, or billing.

## First-day checklist

- [ ] GitHub invitation accepted
- [ ] Supabase invitation accepted
- [ ] Repository cloned
- [ ] `.env.local` configured
- [ ] `npm run dev` works
- [ ] Local sign-in works
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] First feature branch pushed
- [ ] First pull request opened
