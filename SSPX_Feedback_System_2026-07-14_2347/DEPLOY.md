# Feedback System — Deployment Guide

Architecture: static form on GitHub Pages → Cloudflare Worker on `caniattendsspx.com/api/*`
→ Turnstile verification → per-IP rate limit (3/day, KV) → Claude Haiku classification
→ D1 storage → private admin digest pages.

Because Cloudflare already proxies the GitHub Pages site, the Worker runs on the same
domain. The form posts to a relative URL (`/api/feedback`); no CORS configuration exists
or is needed.

## Anonymity compartment — do this first

Everything below happens **inside the clean compartment**: the fresh Cloudflare account,
logged in from the same browser profile you use for the anonymous GitHub account.

1. Wrangler CLI authenticates to Cloudflare, not GitHub, but run it in a terminal/profile
   where no personal credentials are cached. Before anything: `wrangler whoami` and
   confirm it shows the fresh Cloudflare account.
2. The `ANTHROPIC_API_KEY` is a server-side secret. It is never visible to visitors, but
   it bills to your real Anthropic account. This is an acceptable, invisible linkage —
   but create a **new key named for this project** so it can be revoked independently,
   and never paste it into the repo, the form page, or any client-side file.
3. Do not commit `wrangler.toml` with real IDs to any repo linked to `horacanonica`.
   The Worker code itself contains nothing identifying and may live in the anonymous repo.

## One-time setup

```bash
# 1. Install wrangler (inside the clean environment)
npm install -g wrangler
wrangler login          # authenticates the FRESH Cloudflare account
wrangler whoami         # verify before proceeding

# 2. Create D1 database and KV namespace
wrangler d1 create sspx-feedback          # copy database_id into wrangler.toml
wrangler kv namespace create RATE_KV      # copy id into wrangler.toml

# 3. Apply schema
wrangler d1 execute sspx-feedback --remote --file=schema.sql

# 4. Secrets
wrangler secret put ANTHROPIC_API_KEY     # new project-specific key
wrangler secret put TURNSTILE_SECRET      # from Turnstile widget setup (below)
openssl rand -hex 24                      # generate admin key, save in password manager
wrangler secret put ADMIN_KEY

# 5. Deploy
wrangler deploy
```

## Turnstile setup

1. Cloudflare dashboard → Turnstile → Add widget.
2. Hostname: `caniattendsspx.com`. Mode: **Managed** (invisible for most humans,
   challenge for suspicious traffic).
3. Copy the **site key** into `feedback.html` (`data-sitekey`).
4. Copy the **secret key** into the Worker secret `TURNSTILE_SECRET`.

## Form page

1. Adapt the CSS tokens at the top of `feedback.html` to match the site stylesheet
   (fonts, ink/paper colors, rule color) so it reads as part of the quaestio site.
2. Replace `YOUR_TURNSTILE_SITE_KEY`.
3. Commit `feedback.html` to the anonymous GitHub Pages repo (repo-local git identity,
   per the pre-push checklist) and link it from the site — suggested link text:
   "Submit a correction or objection."

## Reading submissions

- `https://caniattendsspx.com/api/admin?key=ADMIN_KEY` — surfaced comments only
  (substantive critique + encouragement), Claude's summary first, full text collapsed.
- `.../api/admin/contacts?key=...` — surfaced comments **with** contact info
  (your follow-up queue; contact stays attached to the summary).
- `.../api/admin/threats?key=...` — any threats of violence, retained in full and
  flagged with a red border. **Never delete these**; they are preserved for possible
  reporting to authorities.
- `.../api/admin/all?key=...` — everything, for the periodic spot-check of the
  hostile-noise bucket (no classifier is perfect). Explicit/abusive content is
  discarded at storage time — only a placeholder row remains for counts. Amber
  borders mark classifier failures (stored unclassified, nothing lost).

Bookmark these only in the clean browser profile. The pages send `noindex,nofollow`
and `no-store`, but the ADMIN_KEY in the URL is the real protection — treat it
like a password and rotate it (`wrangler secret put ADMIN_KEY`) if ever exposed.

## Reply email (Option B — no new infrastructure)

1. Cloudflare dashboard → Email → Email Routing → enable on the zone.
   Create **no route** for `noreply@caniattendsspx.com` and set the catch-all
   action to **Drop** (or leave unrouted so it bounces — bounce is preferable:
   the sender learns immediately that replies do not work).
2. Reply to correspondents from the compartment Gmail. In Gmail settings, set
   **Reply-To** to `noreply@caniattendsspx.com` for that account (Settings →
   Accounts → edit send-as → Reply-to address).
3. Standard signature line:
   > Replies to this address are not delivered. Further comments must be
   > submitted through the form at caniattendsspx.com.

Correspondents who reply anyway get a hard bounce and must return to the form —
which re-runs Turnstile, the rate limit, and the classifier. That is the
"irritating by design" loop.

**Escalating a correspondent to direct correspondence is a deanonymization act.**
The parish email links the pseudonym to your real identity irreversibly. Default:
keep even good-faith correspondents on the compartment Gmail. Reserve the parish
email for people vouched for offline.

## Costs

- Workers, KV, D1, Turnstile, Email Routing: free tier covers this traffic easily.
- Claude Haiku classification: well under a cent per submission; even hundreds of
  submissions cost pennies.

## Tuning

- Rate limit: `DAILY_LIMIT_PER_IP` in `worker.js` (currently 3/day).
- Classifier strictness: edit the five category definitions in the `classify()`
  system prompt. The prompt already delimits submission text as untrusted data and
  instructs the model to ignore embedded instructions (prompt-injection defense);
  all text is HTML-escaped before rendering on the admin pages (stored-XSS defense);
  the hidden "website" honeypot field silently swallows bot submissions.
- Message length: `MAX_MESSAGE_LEN` (4000 chars ≈ 600 words).
