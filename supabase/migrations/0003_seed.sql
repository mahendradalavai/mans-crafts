-- Seed the six launch pieces. Idempotent: re-running refreshes price, stock and
-- copy without creating duplicates. Keep in step with src/data/products.js.

insert into public.products (id, slug, sku, name, category, color, description, price, image_url, stock, active)
values
  (1, 'crimson-signet-bangle', 'MC-BG-001', 'Crimson signet bangle', 'Bangles', 'Steel red',
   'A heavyweight signet silhouette finished in steel red. The flat inner face sits steady through the day, and a deep oxidised line keeps the edge dark long after the shine wears in.',
   2499.00, '/images/crimson-signet-bangle.jpg', 12, true),
  (2, 'bloodline-cuff', 'MC-BG-002', 'Bloodline cuff', 'Bangles', 'Black chrome',
   'Black chrome with a raw, brushed grain. The open cuff profile flexes once to your wrist and then holds its shape — no clasps, nothing to catch on a sleeve.',
   3999.00, '/images/bloodline-cuff.jpg', 8, true),
  (3, 'legacy-portrait-frame', 'MC-PF-001', 'Legacy portrait frame', 'Photo Frames', 'Matte black',
   'A matte black frame with a wide, quiet border that lets the photograph do the talking. Hangs on a wall or stands on a shelf, and takes a 6×8 print.',
   1899.00, '/images/legacy-portrait-frame.jpg', 15, true),
  (4, 'iron-memory-frame', 'MC-PF-002', 'Iron memory frame', 'Photo Frames', 'Brushed silver',
   'Brushed silver aluminium with a hand-polished bevel. Slim enough for a shelf, solid enough to feel like something you would pass down.',
   2499.00, '/images/iron-memory-frame.jpg', 9, true),
  (5, 'crown-mark-bangle', 'MC-BG-003', 'Crown mark bangle', 'Bangles', 'Oxidized silver',
   'Oxidised silver with an engraved crown mark at the crest. The most detailed piece in the collection, with every edge finished by hand.',
   4499.00, '/images/crown-mark-bangle.jpg', 6, true),
  (6, 'royal-family-frame', 'MC-PF-003', 'Royal family frame', 'Photo Frames', 'Gunmetal',
   'Gunmetal finish with a recessed inner lip that holds three prints in a single run. Made to carry a whole generation in one look.',
   2999.00, '/images/royal-family-frame.jpg', 11, true)
on conflict (id) do update set
  slug = excluded.slug,
  sku = excluded.sku,
  name = excluded.name,
  category = excluded.category,
  color = excluded.color,
  description = excluded.description,
  price = excluded.price,
  image_url = excluded.image_url,
  stock = excluded.stock,
  active = excluded.active;

-- Explicit ids do not advance the identity sequence; keep future inserts safe.
select setval(
  pg_get_serial_sequence('public.products', 'id'),
  coalesce((select max(id) from public.products), 1)
);
