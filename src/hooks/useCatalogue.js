import { useCallback, useEffect, useState } from 'react'
import { products as bundledProducts } from '../data/products.js'
import { supabase, supabaseConfigured } from '../lib/supabase.js'

function fromRow(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    sku: row.sku ?? '',
    name: row.name,
    category: row.category,
    color: row.color ?? '',
    price: Number(row.price),
    image: row.image_url ?? row.image ?? '',
    description: row.description ?? '',
    stock: Number(row.stock ?? 0),
    active: row.active !== false,
  }
}

// Lives outside the component so the mount effect and the retry button run the
// exact same query. Always resolves with { data, error } and never rejects.
function fetchActiveProducts() {
  try {
    return Promise.resolve(
      supabase.from('products').select('*').eq('active', true).order('id', { ascending: true }),
    ).catch((error) => ({ data: null, error }))
  } catch (error) {
    return Promise.resolve({ data: null, error })
  }
}

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState(() => ({
    status: supabaseConfigured ? 'loading' : 'ready',
    products: supabaseConfigured ? [] : bundledProducts,
  }))

  const applyResult = useCallback(({ data, error }) => {
    if (error) {
      console.error('[mans-crafts] Live catalogue unavailable, using bundled products.', error.message)
      setCatalogue({ status: 'error', products: bundledProducts })
      return
    }

    const live = (data ?? [])
      .map(fromRow)
      .filter((product) => product.slug && product.name && Number.isFinite(product.price))

    if (live.length === 0) {
      console.warn('[mans-crafts] Live catalogue is empty, using bundled products.')
      setCatalogue({ status: 'empty', products: bundledProducts })
      return
    }

    setCatalogue({ status: 'ready', products: live })
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) return undefined
    let cancelled = false
    // State is only touched inside the promise callback, never synchronously here.
    fetchActiveProducts().then((result) => {
      if (!cancelled) applyResult(result)
    })
    return () => {
      cancelled = true
    }
  }, [applyResult])

  const reload = useCallback(() => {
    if (!supabaseConfigured) return
    setCatalogue({ status: 'loading', products: [] })
    fetchActiveProducts().then(applyResult)
  }, [applyResult])

  return { ...catalogue, reload }
}
