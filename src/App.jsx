import { useCallback, useMemo, useState } from 'react'
import './App.css'
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
import { supabase, supabaseConfigured } from './lib/supabase.js'

const ALL_CATEGORIES = 'All pieces'

export default function App() {
  const { products, status, reload } = useCatalogue()
  const { cart, cartCount, cartTotal, addToCart, updateQuantity, clearCart } = useCart(products)
  const { selectedSlug, closeProduct } = useProductRouting()
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [query, setQuery] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutStatus, setCheckoutStatus] = useState('idle')
  const [checkoutError, setCheckoutError] = useState(null)

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

  const buyNow = useCallback((product) => openWhatsApp(buyNowMessage(product)), [])

  const checkout = useCallback(async () => {
    if (cart.length === 0 || checkoutStatus === 'pending') return
    setCheckoutError(null)

    // Without Supabase we keep the original WhatsApp-only flow.
    if (!supabaseConfigured || !supabase) {
      openWhatsApp(orderMessage(cart, cartTotal))
      return
    }

    setCheckoutStatus('pending')
    try {
      const lineItems = cart.map((item) => ({ product_id: item.id, quantity: item.quantity }))
      const { data, error } = await supabase.rpc('create_order', { p_items: lineItems })
      if (error) throw error
      const orderNumber = typeof data === 'string' ? data : data?.order_number
      openWhatsApp(orderMessage(cart, cartTotal, orderNumber))
      clearCart()
      setCartOpen(false)
    } catch (error) {
      // Never lose a sale to a backend hiccup: hand the order to WhatsApp anyway.
      console.error('[mans-crafts] Could not record the order, sending it to WhatsApp instead.', error)
      setCheckoutError(
        'We could not record this order in our system, so we are sending it straight to WhatsApp.',
      )
      openWhatsApp(orderMessage(cart, cartTotal))
    } finally {
      setCheckoutStatus('idle')
    }
  }, [cart, cartTotal, checkoutStatus, clearCart])

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
