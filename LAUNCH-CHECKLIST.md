# Finance Home — Launch Checklist

Checked against the real code and the real Supabase project on 2026-10-22.
This replaces the guesses in `things-to-look-out.md`.

---

## Which folder is the real one — SETTLED

**`C:\Users\ddo31\Documents\Projects\APPDevelopment\finance-home` is now the one
and only working copy.** It was 11 commits behind; it has been fast-forwarded to
GitHub (18 commits, `fdc9dbc`) and every change from this session was copied in.

Verified before declaring it safe:

- Recursive file-by-file compare against Google Drive: **identical**, apart from
  Windows vs Unix line endings. 73 source files on both sides.
- The gitignored files GitHub never had were copied over too — `.env.local`
  (Supabase keys, and Drive was the *only* copy), `.vercel/` (project link) and
  `.claude/` (permission rules).
- `git fsck` clean, 18 commits, matches `origin/main`.
- `npm install` → typecheck clean → **196 tests pass** → production build succeeds.
- The new privacy screen was opened in a browser at desktop and phone width.

Two older things kept, not deleted:
- The hard drive's old uncommitted work — the unfinished **Notes page** plus the old
  TripPlanner edits — is saved on the git tag **`wip-notes-page`**. A tag is a
  permanent ref, so unlike a stash it can't be garbage-collected. Bring it back any
  time with `git show wip-notes-page` or `git checkout wip-notes-page -- <file>`.
  The separate `finance-home-backup-notes` folder held the same thing and has been
  removed, so everything now lives in this one folder.
- A stale `.git/index.lock` from 12 Aug was blocking every git write. Renamed to
  `.git/index.lock.stale-2026-08-12`, not deleted. Safe to delete once you're happy.

**Google Drive is now redundant and safe to remove.** Drive copies files while git
is writing to them and can corrupt `.git`, and it ignores `.gitignore` — which is
why `node_modules` (28,586 files, 282 MB) must never be installed there. Work on
`C:`, push to GitHub, let GitHub be the backup.

---

## The old doc's warnings — what's actually true

| Warning | Verdict |
|---|---|
| RLS might be off — "do this now" | **Already done.** RLS is on with 6 policies, all `auth.uid() = user_id`. Safe. |
| State blob will hit the 5 MB limit | **Architecture unchanged, and that's the right call.** The doc guessed 800 KB; the real biggest blob is **6 KB** — 0.1% of the browser limit, so you're ~800× away. The genuinely dangerous half of that warning *is* fixed: the silent `try/catch` it called out now shows a red banner (see item 4 below). Splitting the schema is a big refactor for a problem that isn't close. |
| Stock API breaks at 200 users | **Already solved.** `api/quote.ts` sends `Cache-Control: s-maxage=900`, so Vercel's CDN gives everyone one cached answer for 15 min. The suggested Edge Function + pg_cron is not needed. |
| Supabase 500 MB limit | At 6 KB per person that's ~80,000 users. Not a worry. |
| Add `public/_redirects` for SPA routing | **Not needed.** You're on Vercel, and `vercel.json` already rewrites to `index.html`. |
| Move to Cloudflare Pages | No reason to. Vercel is already set up and your API routes live there. |
| Store has no selective subscriptions | True but harmless. Every change re-renders everything. Zustand would fix it — a day of work for no visible gain. Skip. |
| Two devices at once = last write wins | True. Only hurts one person using two devices; it can't leak between users. Easy fix below. |
| Normalize the database | Not for years. |
| Add TanStack Query | Low value — `src/services/quotes.ts` already handles rate limits. |

---

## What the old doc missed

### 1. AI trip assistant spending cap ✅ DONE
`api/trip-assistant.ts` checked that you were signed in, but not *how often* you
asked — so any stranger with an account could run up the AI bill.

Now each account gets **10 searches a day** (change with `AI_DAILY_LIMIT` in Vercel).
The counting happens in Postgres, in `claim_ai_call()`, which reads the account from
the signed-in session rather than from anything the browser sends — so the counter
can't be faked or reset from the client. It fails closed: if the count can't be
recorded, the AI doesn't run. The `ai_usage` table has RLS on and *no* policies, so
only that one function can touch it.

Still worth doing by hand: set a **spend limit in the Vercel dashboard** as a backstop.

### 2. Leaked-password protection ⬜ YOUR TURN (2 minutes)
Supabase Dashboard → Authentication → Policies → turn on **Leaked password
protection**. Blocks passwords found in known breaches. Can't be done from code.

### 3. Privacy, terms, delete-my-account ✅ DONE
- `src/components/Legal/Legal.tsx` — privacy notice + terms, written from what the
  code actually does. Reachable from the account menu **and** from the sign-in
  screen, so it can be read before making an account.
- `src/components/Account/DeleteAccount.tsx` — asks twice (confirm step + type
  `DELETE`), then calls `delete_my_account()` in Postgres. Removing the login
  cascades to `user_data` and `ai_usage`, so one call clears everything. No
  service-role key needed anywhere.
- The sign-in footer used to say *"No data is ever shared"*, which stopped being
  true when the trip assistant shipped. It now says what actually happens.

### 4. Silent save failure ✅ DONE
`commit()` in `src/store/store.ts` now records *why* a save failed, and
`SaveErrorBanner` shows a red bar. Before, a full storage quota meant changes
looked saved and vanished on reload.

### 5. Email confirmation ⬜ YOUR TURN (2 minutes)
Supabase → Authentication → Sign In / Up → require email confirmation, so people
can't sign up with addresses they don't own.

### 6. Two-device overwrite ⬜ NOT DONE
Before writing, read the row's `updated_at`. If the cloud copy is newer than what
this device loaded, ask instead of overwriting. Only affects one person on two
devices — it can't leak between accounts.

---

## Also found while checking

**Node.js updated ✅** v24.14.0 → **v24.22.1**, the release that fixed the 10 CVEs
published 21 Oct 2026 — including the Brotli decoder flaw that can allow remote code
execution and is easy to trigger because `fetch()` auto-decompresses Brotli.
`engines.node: "24.x"` is now in `package.json`, which Vercel reads when picking the
build and function runtime.

⬜ **Still yours to do:** Vercel dashboard → Settings → General → Node.js Version →
set **24.x**. The CLI token here is expired and the API connection can't authorize
itself, so this one can't be done from code. The dashboard only offers major
versions (24.x), not exact patches — Vercel keeps the latest patch within the major,
so 24.x gets you 24.22.1 or newer.

**`npm audit`: 28 issues → 11 ✅** `npm audit fix` cleared 17, including both that
could run server-side: **`undici` and `ws` are clear.**

The 11 left are all build tools — `vite`, `tailwindcss`, `esbuild`, `postcss-*`,
`braces`, `chokidar`, `fast-glob`, `micromatch`, `sharp`. They run on your machine
while building; they are not in the app strangers load. Fixing them needs
`--force`, which installs breaking major versions and would likely break the build.
Not worth it.

`uuid` is the only one of the 11 that ships in the app, and **it does not apply
here**: the advisory is about `v3/v5/v6` being called with a `buf` argument, and
every call in this codebase is `v4()` with no arguments. Skipping its major bump.

**The Supabase "breach" was not Supabase being hacked.** In September 2026 UpGuard
found 16,326 Supabase databases exposed — almost all because developers never turned
on row-level security. That is exactly the mistake you *didn't* make: your RLS is on
with correct policies, and the `ensure_rls` event trigger turns it on automatically
for any new table. You're on the right side of that story.

**Two extra bits of hardening applied:** `anon` (the pre-login role) no longer has any
privilege on `user_data`, so the table isn't even discoverable with just the public
key; and `rls_auto_enable()` is no longer callable over the REST API.

**Cosmetic, left alone on purpose:** `user_data` has 6 RLS policies where 4 would do
(`owner_select`/`select_own` are duplicates). All six are identical
`auth.uid() = user_id` checks, so they're safe — just untidy. Not worth touching
working security rules.

---

## Launch order

1. **Sync the hard drive from GitHub and work there.** Still not done — the command
   is in the previous section. Google Drive is currently the only up-to-date copy.
2. Turn on leaked-password protection + email confirmation (5 minutes, dashboard).
3. Update Node to 24.22.1, run `npm audit fix`, pin the Node version in Vercel.
4. Set a spend limit in the Vercel dashboard.
5. Look at the new privacy modal and delete-account button in a browser — they
   typecheck, test and build clean, but have not been seen rendered yet.
6. Deploy. Invite ~10 people first, watch Vercel + Supabase usage for a week.
7. Only then share it widely.
