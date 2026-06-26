# Vercel Multi-Device Collaboration and Security Runbook

This runbook keeps multi-device collaboration smooth without sharing secrets in chat.

## Scope

- Workspace: `le-web`
- Projects:
  - `mini-love-web`
  - `fitness-app`
  - `quadrant-todo`

## Team Rule (Single Source of Truth)

- Store environment variables in Vercel only.
- Each developer pulls env locally from Vercel.
- Never send tokens/keys in IM, docs, or screenshots.

## One-Time Setup Per Device

Run these steps once on each device, for each project.

### mini-love-web

```bash
cd /Users/apple/Documents/code/other/le-web/mini-love-web
vercel login
vercel link
vercel env pull .env.local
```

### fitness-app

```bash
cd /Users/apple/Documents/code/other/le-web/fitness-app
vercel login
vercel link
vercel env pull .env.local
```

### quadrant-todo

```bash
cd /Users/apple/Documents/code/other/le-web/quadrant-todo
vercel login
vercel link
vercel env pull .env.local
```

> Note: `quadrant-todo` uses a different env set than the other two projects.
> It authenticates server-side with the Supabase **service role key**, not the
> anon key, so its variables are:
>
> - `SUPABASE_URL`
> - `SUPABASE_SERVICE_ROLE_KEY` (highly sensitive — server-only, never expose to the client)
> - `PUBLIC_REGISTRATION` (optional, defaults to `true`)

## Daily Dev Flow

If env values changed in Vercel, refresh local copy:

```bash
vercel env pull .env.local
```

Then run:

```bash
vercel dev
```

## Security Incident Response (Vercel Bulletin Style)

If there is a Vercel/security bulletin:

1. Rotate relevant values in provider first (for this repo: Supabase keys if needed).
2. Update Vercel env (per project):
   - `mini-love-web`, `fitness-app`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - `quadrant-todo`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (rotating this invalidates all sessions), `PUBLIC_REGISTRATION` (optional)
3. Re-pull env on every device:
   - `vercel env pull .env.local`
4. Redeploy production:
   - `vercel --prod`

## Local Hygiene

- `.env.local` must stay uncommitted.
- Delete stale local tokens immediately if found.
- If `VERCEL_OIDC_TOKEN` appears in local files, clear it and re-login.

## Current Hardening Applied (2026-04-22)

- Removed hardcoded Supabase fallback values from:
  - `fitness-app/api/env.js`
- Cleared local token residue from:
  - `fitness-app/.env.local`

## Changelog (2026-06-22)

- Added `quadrant-todo` to scope, one-time setup, and incident response.
- Documented its distinct env set (`SUPABASE_SERVICE_ROLE_KEY` + optional
  `PUBLIC_REGISTRATION`); unlike the other projects it runs server-side auth
  and must never ship the service role key to the client.
