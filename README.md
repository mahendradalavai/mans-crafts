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

3. Apply the migrations in `supabase/migrations/` in order:
   `0001_schema.sql`, `0002_rls.sql`, `0003_seed.sql`, `0004_create_order.sql`.
4. Restart the dev server. The grid now reads live products; if the database is unreachable the app
   falls back to the bundled catalogue and shows a retry notice instead of breaking.

### Schema

| Table | Purpose |
| --- | --- |
| `products` | Catalogue, pricing and stock |
| `orders` | Order header: number, status, currency, subtotal |
| `order_items` | Line items with the order-time `unit_price` snapshot |

Money is `numeric(10,2)` — never floating point — and every row has checks (`price >= 0`,
`stock >= 0`, `quantity > 0`). `order_items` cascades from `orders`; `unit_price` preserves what
the customer actually paid even after a price change.

### Security model

- RLS is enabled on all three tables.
- The anon key can read **active** products only.
- The browser can never insert into `orders` or `order_items` directly.
- Orders are written by `public.create_order(items jsonb)`, a `SECURITY DEFINER` function that
  re-reads authoritative prices, checks stock under a row lock, and returns an order number.

## Order flow

```
Bag → create_order(items)  →  orders + order_items written, stock decremented
                           →  WhatsApp opens with the order number and the ₹ totals
```

If the RPC fails (offline, RLS change, quota), the app logs the failure, tells the customer, and
still sends the order to WhatsApp so no sale is lost.

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
├── lib/supabase.js        client that stays inert without env vars
├── hooks/
│   ├── useCart.js         persistent bag, stock-aware quantities
│   ├── useCatalogue.js    live products with offline fallback
│   └── useProductRouting.js  #/product/<slug> routing and history
└── components/            Header, Hero, ProductGrid, ProductCard, ProductDetail,
                           CartDrawer, ValuesSection
supabase/migrations/       schema, RLS, seed, create_order
```

## Known gaps

Payments, authentication, an admin order view and customer accounts are not built yet; stock is
decremented but not reserved, and the product photography is still sourced from Unsplash.
