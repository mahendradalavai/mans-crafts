// Fallback catalogue. The storefront prefers live rows from Supabase's `products`
// table and only serves these bundled pieces when the database is unreachable.
// Keep ids, slugs and prices in step with supabase/migrations/0003_seed.sql.

export const categories = ['All pieces', 'Bangles', 'Photo Frames']

export const products = [
  {
    id: 1,
    slug: 'crimson-signet-bangle',
    sku: 'MC-BG-001',
    name: 'Crimson signet bangle',
    category: 'Bangles',
    color: 'Steel red',
    price: 2499,
    image: '/images/crimson-signet-bangle.jpg',
    description:
      'A heavyweight signet silhouette finished in steel red. The flat inner face sits steady through the day, and a deep oxidised line keeps the edge dark long after the shine wears in.',
    stock: 12,
    active: true,
  },
  {
    id: 2,
    slug: 'bloodline-cuff',
    sku: 'MC-BG-002',
    name: 'Bloodline cuff',
    category: 'Bangles',
    color: 'Black chrome',
    price: 3999,
    image: '/images/bloodline-cuff.jpg',
    description:
      'Black chrome with a raw, brushed grain. The open cuff profile flexes once to your wrist and then holds its shape — no clasps, nothing to catch on a sleeve.',
    stock: 8,
    active: true,
  },
  {
    id: 3,
    slug: 'legacy-portrait-frame',
    sku: 'MC-PF-001',
    name: 'Legacy portrait frame',
    category: 'Photo Frames',
    color: 'Matte black',
    price: 1899,
    image: '/images/legacy-portrait-frame.jpg',
    description:
      'A matte black frame with a wide, quiet border that lets the photograph do the talking. Hangs on a wall or stands on a shelf, and takes a 6×8 print.',
    stock: 15,
    active: true,
  },
  {
    id: 4,
    slug: 'iron-memory-frame',
    sku: 'MC-PF-002',
    name: 'Iron memory frame',
    category: 'Photo Frames',
    color: 'Brushed silver',
    price: 2499,
    image: '/images/iron-memory-frame.jpg',
    description:
      'Brushed silver aluminium with a hand-polished bevel. Slim enough for a shelf, solid enough to feel like something you would pass down.',
    stock: 9,
    active: true,
  },
  {
    id: 5,
    slug: 'crown-mark-bangle',
    sku: 'MC-BG-003',
    name: 'Crown mark bangle',
    category: 'Bangles',
    color: 'Oxidized silver',
    price: 4499,
    image: '/images/crown-mark-bangle.jpg',
    description:
      'Oxidised silver with an engraved crown mark at the crest. The most detailed piece in the collection, with every edge finished by hand.',
    stock: 6,
    active: true,
  },
  {
    id: 6,
    slug: 'royal-family-frame',
    sku: 'MC-PF-003',
    name: 'Royal family frame',
    category: 'Photo Frames',
    color: 'Gunmetal',
    price: 2999,
    image: '/images/royal-family-frame.jpg',
    description:
      'Gunmetal finish with a recessed inner lip that holds three prints in a single run. Made to carry a whole generation in one look.',
    stock: 11,
    active: true,
  },
]
