import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'mans-crafts-cart-v1'
const MAX_QUANTITY = 20

function isUsableEntry(entry) {
  return (
    entry &&
    Number.isFinite(Number(entry.id)) &&
    Number(entry.id) > 0 &&
    Number.isFinite(Number(entry.quantity)) &&
    Number(entry.quantity) > 0
  )
}

// Only ids and quantities are stored, so a price change never leaves a stale
// figure in someone's bag. Anything malformed is discarded instead of throwing.
function readStoredCart() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const merged = new Map()
    for (const entry of parsed) {
      if (!isUsableEntry(entry)) continue
      const id = Math.trunc(Number(entry.id))
      const quantity = Math.min(Math.max(1, Math.trunc(Number(entry.quantity))), MAX_QUANTITY)
      merged.set(id, Math.min((merged.get(id) ?? 0) + quantity, MAX_QUANTITY))
    }
    return Array.from(merged, ([id, quantity]) => ({ id, quantity }))
  } catch (error) {
    console.warn('[mans-crafts] Could not read the saved bag.', error)
    return []
  }
}

export function useCart(catalogue) {
  const [entries, setEntries] = useState(readStoredCart)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // Private mode or a full quota — the bag simply stays in memory.
    }
  }, [entries])

  // Drop ids that no longer exist in the catalogue. Guarded against an empty list so
  // a saved bag survives the moment before the catalogue finishes loading.
  const prune = useCallback(
    (entries) =>
      catalogue.length === 0
        ? entries
        : entries.filter((entry) => catalogue.some((product) => product.id === entry.id)),
    [catalogue],
  )

  const stockFor = useCallback(
    (id) => {
      const product = catalogue.find((candidate) => candidate.id === id)
      return Math.max(0, product?.stock ?? 0)
    },
    [catalogue],
  )

  const addToCart = useCallback(
    (product) => {
      const available = Math.min(Math.max(0, Number(product.stock ?? 0)), MAX_QUANTITY)
      if (available <= 0) return

      setEntries((current) => {
        const entries = prune(current)
        const existing = entries.find((entry) => entry.id === product.id)
        if (existing) {
          return entries.map((entry) =>
            entry.id === product.id
              ? { ...entry, quantity: Math.min(entry.quantity + 1, available, MAX_QUANTITY) }
              : entry,
          )
        }
        return [...entries, { id: product.id, quantity: Math.min(1, available) }]
      })
    },
    [prune],
  )

  const updateQuantity = useCallback(
    (id, delta) => {
      setEntries((current) =>
        prune(current)
          .map((entry) => {
            if (entry.id !== id) return entry
            const ceiling = Math.min(Math.max(0, stockFor(id)), MAX_QUANTITY)
            return { ...entry, quantity: Math.min(entry.quantity + delta, ceiling) }
          })
          .filter((entry) => entry.quantity > 0),
      )
    },
    [prune, stockFor],
  )

  const clearCart = useCallback(() => setEntries([]), [])

  // Sold-out pieces stay in storage but are hidden, so they reappear if restocked.
  const cart = useMemo(
    () =>
      entries.flatMap((entry) => {
        const product = catalogue.find((candidate) => candidate.id === entry.id)
        if (!product || (product.stock ?? 0) <= 0) return []
        return [{ ...product, quantity: Math.min(entry.quantity, Math.max(1, product.stock)) }]
      }),
    [entries, catalogue],
  )

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)

  return { cart, cartCount, cartTotal, addToCart, updateQuantity, clearCart }
}
