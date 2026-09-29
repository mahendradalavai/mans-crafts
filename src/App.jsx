import { useCallback, useMemo, useRef, useState } from 'react'
import './App.css'
import AdminPage from './components/AdminPage.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import ProductDetail from './components/ProductDetail.jsx'
import ProductGrid from './components/ProductGrid.jsx'
import ValuesSection from './components/ValuesSection.jsx'
import { STORE, buyNowMessage, formatPrice, openWhatsApp, orderMessage } from './config.js'
import { useCart } from './hooks/useCart.js'
import { useCatalogue } from './hooks/useCatalogue.js'
import { useProductRouting } from './hooks/useProductRouting.js'
import { createId, readSessionId } from './lib/ids.js'
import { supabase, supabaseConfigured } from './lib/supabase.js'

const ALL_CATEGORIES = 'All pieces'

export default function App() {
  const { products, status, reload } = useCatalogue()
  const { cart, cartCount, cartTotal, addToCart, updateQuantity, clearCart } = useCart(products)
  const { selectedSlug, isAdminRoute, closeProduct } = useProductRouting()
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [query, setQuery] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutStatus, setCheckoutStatus] = useState('idle')
  const [checkoutError, setCheckoutError] = useState(null)
  const [sessionId] = useState(readSessionId)
  // Holds the idempotency key for the current bag, plus the bag it belongs to.
  const clientOrderRef = useRef({ signature: null, id: null })

  const categories = useMemo(
    () => [ALL_CATEGORIES, ...new Set(products.map((product) => product.category))],
    [products],
  )
  // A category can disappear when the live catalogue reloads — fall back to everything.
  const activeCategory = categories.includes(category) ? category : ALL_CATEGORIES

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return products.filter((product) => {
      const matchesCategory = activeCategory === ALL_CATEGORIES || product.category === activeCategory
      return matchesCategory && (!needle || product.name.toLowerCase().includes(needle))
    })
  }, [products, activeCategory, query])

  const selectedProduct = useMemo(
    () => products.find((product) => product.slug === selectedSlug) ?? null,
    [products, selectedSlug],
  )

  const relatedProducts = useMemo(
    () =>
      selectedProduct
        ? products
            .filter(
              (product) =>
                product.category === selectedProduct.category && product.slug !== selectedProduct.slug,
            )
            .slice(0, 3)
        : [],
    [products, selectedProduct],
  )

  const cartSignature = useMemo(
    () =>
      cart
        .map((item) => `${item.id}x${item.quantity}`)
        .sort()
        .join(','),
    [cart],
  )

  const buyNow = useCallback((product) => openWhatsApp(buyNowMessage(product)), [])

  const checkout = useCallback(async () => {
    if (cart.length === 0 || checkoutStatus === 'pending') return
    setCheckoutError(null)

    // Without Supabase we keep the original WhatsApp-only flow.
    if (!supabaseConfigured || !supabase) {
      openWhatsApp(orderMessage(cart, cartTotal))
      return
    }

    // One key per bag, re-used if the customer retries, so a double click or a
    // dropped connection can never produce a second order.
    if (clientOrderRef.current.signature !== cartSignature) {
      clientOrderRef.current = { signature: cartSignature, id: createId() }
    }
    const clientOrderId = clientOrderRef.current.id

    setCheckoutStatus('pending')
    const lineItemsForLog = cart.map((item) => ({ product_id: item.id, quantity: item.quantity }))
    try {
      const lineItems = lineItemsForLog
      const { data, error } = await supabase.rpc('create_order', {
        p_items: lineItems,
        p_client_order_id: clientOrderId,
        p_client_session_id: sessionId,
      })
      if (error) throw error
      const orderNumber = typeof data === 'string' ? data : data?.order_number
      openWhatsApp(orderMessage(cart, cartTotal, orderNumber))
      clientOrderRef.current = { signature: null, id: null }
      clearCart()
      setCartOpen(false)
    } catch (error) {
      // Never lose a sale to a backend hiccup: hand the order to WhatsApp anyway.
      console.error('[mans-crafts] Could not record the order, sending it to WhatsApp instead.', error)
      // Record it too, so a run of failures is visible in the admin page instead
      // of only in a console nobody is watching. Best-effort: fire and forget.
      supabase
        .rpc('log_order_failure', {
          p_error_code: error?.code ?? 'unknown',
          p_error_message: error?.message ?? 'Unknown error',
          p_items: lineItemsForLog,
          p_client_order_id: clientOrderId,
          p_client_session_id: sessionId,
        })
        .then(
          ({ error: logError }) => {
            if (logError) console.warn('[mans-crafts] Could not log the failed order.', logError)
          },
          () => {},
        )
      // Validation and rate-limit messages are written for customers; anything
      // else (a dead network, for example) gets the plain fallback wording.
      const expected = ['P0001', 'P0002', '22023'].includes(error?.code)
      setCheckoutError(
        expected
          ? `${error.message} We are sending this order to WhatsApp instead.`
          : 'We could not record this order in our system, so we are sending it straight to WhatsApp.',
      )
      openWhatsApp(orderMessage(cart, cartTotal))
    } finally {
      setCheckoutStatus('idle')
    }
  }, [cart, cartTotal, cartSignature, checkoutStatus, clearCart, sessionId])

  if (isAdminRoute) return <AdminPage />

  return (
    <div className="storefront">
      <div className="snowfall" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            style={{
              '--snow-left': `${(index * 17) % 100}%`,
              '--snow-delay': `${(index % 7) * -1.4}s`,
              '--snow-size': `${4 + (index % 4)}px`,
            }}
          />
        ))}
      </div>
      <div className="announcement">
        Free shipping on orders over {formatPrice(STORE.freeShippingThreshold)} <span>•</span> Built for
        the bloodline
      </div>
      <Header cartCount={cartCount} onOpenCart={() => setCartOpen(true)} />
      <main>
        {selectedProduct ? (
          <ProductDetail
            product={selectedProduct}
            related={relatedProducts}
            onBack={closeProduct}
            onAdd={addToCart}
            onBuy={buyNow}
          />
        ) : (
          <>
            <Hero />
            <section className="shop-section" id="shop">
              <div className="section-heading">
                <div>
                  <p className="kicker">The collection</p>
                  <h2>
                    Made for the
                    <br />
                    <em>bloodline.</em>
                  </h2>
                </div>
                <p className="section-note">
                  Statement bangles and photo frames
                  <br />
                  that carry your story forward.
                </p>
              </div>
              <div className="shop-tools">
                <div className="category-list" aria-label="Product categories">
                  {categories.map((item) => (
                    <button
                      className={activeCategory === item ? 'active' : ''}
                      key={item}
                      type="button"
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <label className="search-box">
                  <span aria-hidden="true">⌕</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search pieces"
                    aria-label="Search pieces"
                  />
                </label>
              </div>
              {status === 'error' || status === 'empty' ? (
                <div className="catalogue-notice" role="status">
                  <span>
                    {status === 'error'
                      ? 'Live catalogue unavailable — showing the offline collection.'
                      : 'The live catalogue is empty — showing the offline collection.'}
                  </span>
                  <button type="button" onClick={reload}>
                    Retry
                  </button>
                </div>
              ) : null}
              <ProductGrid
                products={visibleProducts}
                status={status}
                onAdd={addToCart}
                onBuy={buyNow}
                emptyMessage="No pieces match that search."
              />
            </section>
            <ValuesSection />
          </>
        )}
      </main>
      <CartDrawer
        open={cartOpen}
        items={cart}
        cartCount={cartCount}
        cartTotal={cartTotal}
        freeShippingThreshold={STORE.freeShippingThreshold}
        checkoutStatus={checkoutStatus}
        checkoutError={checkoutError}
        onClose={() => setCartOpen(false)}
        onUpdateQuantity={updateQuantity}
        onCheckout={checkout}
      />
    </div>
  )
}
