# Vercel Multi-Device Collaboration and Security Runbook

This runbook keeps multi-device collaboration smooth without sharing secrets in chat.

## Scope

- Workspace: `le-web`
- Projects:
  - `mini-love-web`
  - `fitness-app`

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
2. Update Vercel env:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
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
