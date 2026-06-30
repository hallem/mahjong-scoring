# Cloudflare Setup — Research Notes

This is **not required** for the shared scorer to work — GitHub Pages (or
GoDaddy static hosting) is sufficient on its own, since Supabase is called
directly from client JS. These are notes for two optional ways Cloudflare
could fit in, for research/comparison purposes.

## Option A: Cloudflare Pages as the static host

An alternative to GitHub Pages or GoDaddy for serving the static HTML files.

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free).
2. **Workers & Pages → Create → Pages → Connect to Git**, pick this repo.
3. Build settings: no build command needed (this repo has no build step) —
   set the output directory to the repo root (`/`) so the `.html` files are
   served as-is.
4. Cloudflare auto-deploys on every push to the connected branch, and gives
   you a `*.pages.dev` URL plus the option to attach a custom domain (e.g.
   one already on GoDaddy, by changing nameservers or just adding a CNAME).
5. Free tier: unlimited requests/bandwidth for static assets, 500 builds/month.

Tradeoff vs GitHub Pages: similar simplicity, but adds a second account to
manage. Worth it mainly if you want faster global CDN edge caching or plan
to add Cloudflare Workers later (Option B) under the same account.

## Option B: Cloudflare Worker as a Supabase proxy (extra hardening)

Only relevant if, after using Supabase's Row Level Security (see
`SUPABASE_SETUP.md`), you decide you want an additional layer between the
browser and Supabase — e.g. to hide the project URL, add custom rate
limiting, or run logic that shouldn't live in client JS. This is **not
needed** for the current design; RLS already scopes access by room code and
device token.

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free).
2. Install the CLI: `npm install -g wrangler`, then `wrangler login`.
3. `wrangler init mahjong-proxy` to scaffold a Worker.
4. Store the Supabase **service_role** key as a Worker secret (never in
   client code): `wrangler secret put SUPABASE_SERVICE_KEY`.
5. Write the Worker to accept requests from the static site, validate/rate-
   limit them, then forward to Supabase using the service key server-side
   (this is the one place the service key is allowed to exist).
6. `wrangler deploy` publishes it to a `*.workers.dev` URL (or a custom
   route on a domain managed by Cloudflare).
7. Free tier: 100,000 requests/day — far more than this app would ever use
   (estimated a few hundred to low-thousands of messages per month for a
   casual friend-group game).

Tradeoff: adds a deployable component outside the static site (you now have
two things to maintain instead of one), and reintroduces a small bit of
"server" surface area. Only worth doing if RLS alone ever proves
insufficient in practice.

## Recommendation

Start with GitHub Pages + Supabase RLS only (per `SUPABASE_SETUP.md`). Treat
both Cloudflare options as optional follow-ups, not prerequisites.
