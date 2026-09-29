# MAN's Crafts

A storefront for men's bangles and photo frames, built with React and Vite. Customers browse the
collection, open a product, fill a bag and check out over WhatsApp — while Supabase keeps a real
record of every order.

## What it does

- Editorial hero, collection grid, category filters and instant search.
- Product pages behind `#/product/<slug>` deep links, with related pieces.
- A bag that survives a refresh (`localStorage`), with quantities and a subtotal.
- Free-shipping progress, sold-out badges and disabled buying states.
- WhatsApp checkout: the order is recorded first, then the message carries the order number.
- An owner console at `#/admin` with the order queue, stock warnings, expired-hold release and a log
  of checkouts that failed before an order existed.

## Stack

React 19 · Vite 8 · ESLint · Supabase (Postgres, Row Level Security, `create_order` RPC)

## Getting started

```bash
npm install
npm run dev
```

The storefront runs on the bundled catalogue in `src/data/products.js` until Supabase environment
variables are present, so `npm run dev` works with no setup at all.

## Configuration

Business values live in one place — `src/config.js`:

| Value | Purpose |
| --- | --- |
| `STORE.whatsappNumber` | Number that receives orders (international format, no `+`) |
| `STORE.currency` / `STORE.locale` | Price formatting (`INR` / `en-IN` → `₹2,499`) |
| `STORE.freeShippingThreshold` | Threshold used by the announcement bar and the bag |

Catalogue data lives in `src/data/products.js` as the offline fallback. Prices, slugs, SKUs and
stock must stay in step with `supabase/migrations/0003_seed.sql`.

## Supabase setup

1. Create a project, then copy the project URL and the **anon** key (never the service-role key —
   this code runs in the browser).
2. Create `.env` from `.env.example`:

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```

3. Apply the migrations in `supabase/migrations/` in order — `0001_schema.sql` through
   `0011_release_stock_on_cancel.sql`. Order matters: `0005` and `0007` correct bugs in the
   functions written by `0001`–`0004`, and `0011` adds the restock trigger that `0009`'s expiry job
   depends on.
4. Restart the dev server. The grid now reads live products; if the database is unreachable the app
   falls back to the bundled catalogue and shows a retry notice instead of breaking.
5. Create the owner account: open `#/admin` and set a password for `mahendradalavai7@gmail.com`,
   which `0008_admin_access.sql` already allowlists. Until that account exists the console shows the
   setup form instead of the order queue.

### Schema

| Table | Purpose |
| --- | --- |
| `products` | Catalogue, pricing and stock |
| `orders` | Order header: number, status, currency, subtotal |
| `order_items` | Line items with the order-time `unit_price` snapshot |
| `order_failures` | Checkouts that failed before an order existed, for follow-up |
| `admin_emails` | Allowlist of emails permitted to claim an admin account |

Money is `numeric(10,2)` — never floating point — and every row has checks (`price >= 0`,
`stock >= 0`, `quantity > 0`). `order_items` cascades from `orders`; `unit_price` preserves what
the customer actually paid even after a price change.

`orders.reserved_until` holds stock for 24 hours after checkout. An hourly `pg_cron` job set up in
`0009` expires stale holds, and `0011`'s trigger puts the stock back. `products.low_stock_threshold`
(default 3) drives the owner console's low-stock and sold-out panel.

### Security model

- RLS is enabled on every table.
- The anon key can read **active** products only.
- The browser can never insert into `orders` or `order_items` directly.
- Orders are written by `public.create_order(...)`, a `SECURITY DEFINER` function that re-reads
  authoritative prices, checks stock under a row lock, and returns an order number.
- `create_order` is idempotent on `client_order_id` and rate limited: 5 orders per 10 minutes per IP,
  5 per 10 minutes per session, 60 per hour across the whole store.
- Admin access is a JWT claim rather than a row lookup. `is_admin()` reads
  `app_metadata.role = 'admin'`, which a signed-in user cannot set on themselves, and
  `claim_admin_account(email, password)` creates the auth user only for an allowlisted email and only
  while no auth user exists yet.
- `admin_emails` has RLS enabled and deliberately no policies, so it is reachable only from those
  functions, never from the browser.

## Order flow

```
Bag → create_order(items, client_order_id, client_session_id)
        →  orders + order_items written, stock decremented and held for 24 hours
        →  WhatsApp opens with the order number and the ₹ totals
```

The bag sends a stable `client_order_id`, so a double tap or a retry after a dropped connection
returns the original order instead of taking the stock twice. If the RPC fails (offline, RLS change,
quota), the app writes the attempt to `order_failures` for follow-up, tells the customer, and still
sends the order to WhatsApp so no sale is lost.

Orders move `pending → confirmed → fulfilled`, or out to `cancelled` / `expired`. Cancelling or
expiring an order releases the stock it was holding.

## Deploying (Vercel)

The repository deploys as-is with the **Vite** preset — root directory `./`, build `npm run build`,
output `dist`. `package.json` pins `engines.node` to `>=22.12.0` because Vite 8 rejects older Node
releases.

1. Import the repository at `vercel.com/new` and keep the detected settings.
2. Add both variables under **Environment Variables**, for Production *and* Preview:

   | Key | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the **anon** key — never the service-role key |

3. Deploy, then open the production URL with the browser console open. If it shows
   `[mans-crafts] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set`, the variables never
   reached the build and the live site is quietly serving the bundled catalogue without recording
   orders.
4. Open `#/admin` on the production URL and create the owner account there, not on a preview URL.

Two traps worth remembering:

- Vite inlines environment variables **at build time**. Editing a value in the dashboard does nothing
  until you redeploy, so change a variable and redeploy together.
- Preview deployments read the same `VITE_SUPABASE_*` values as production, which means a preview URL
  writes real orders into the real database.

Routing is hash-based (`#/product/<slug>`, `#/admin`), so deep links need no server support. The
`vercel.json` rewrite exists only so that a hand-typed `/admin` serves the app shell instead of a
404; Vercel checks the filesystem before applying rewrites, so `/images/*` and `/assets/*` are
unaffected.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint over the project |

## Project structure

```
src/
├── App.jsx                composition: catalogue, routing, bag, checkout
├── config.js              store settings, price formatting, WhatsApp messages
├── data/products.js       offline catalogue fallback
├── lib/
│   ├── ids.js             idempotency key and checkout session id
│   └── supabase.js        client that stays inert without env vars
├── hooks/
│   ├── useAdminSession.js owner sign-in, account claim, sign-out
│   ├── useCart.js         persistent bag, stock-aware quantities
│   ├── useCatalogue.js    live products with offline fallback
│   └── useProductRouting.js  #/admin and #/product/<slug> routing and history
└── components/            Header, Hero, ProductGrid, ProductCard, ProductDetail,
                           CartDrawer, AdminPage, ProductImage, ValuesSection
supabase/migrations/       schema, RLS, seed, RPCs and hardening
.github/workflows/ci.yml   lint and build on every push
```

## Known gaps

There is no payment step and no customer accounts: checkout records the order and hands off to
WhatsApp, so the money is still collected off-platform. Guest checkout is protected by database-level
rate limits alone — no CAPTCHA is wired up. Product images in `public/images/` are placeholders, not
photographs of the real pieces. Stock is held for 24 hours from checkout, not until payment clears.
