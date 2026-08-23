
import { useMemo, useState } from 'react'
import manLogo from './assets/ChatGPT_Image_Aug_22__2026__02_50_39_PM-removebg-preview.png'
import './App.css'

const products = [
  { id: 1, name: 'Crimson signet bangle', category: 'Bangles', price: 89, color: 'Steel red', image: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=900&q=85' },
  { id: 2, name: 'Bloodline cuff', category: 'Bangles', price: 129, color: 'Black chrome', image: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&q=85' },
  { id: 3, name: 'Legacy portrait frame', category: 'Photo Frames', price: 64, color: 'Matte black', image: 'https://images.unsplash.com/photo-1580130544703-9b4e9c7f4f4d?auto=format&fit=crop&w=900&q=85' },
  { id: 4, name: 'Iron memory frame', category: 'Photo Frames', price: 78, color: 'Brushed silver', image: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=900&q=85' },
  { id: 5, name: 'Crown mark bangle', category: 'Bangles', price: 149, color: 'Oxidized silver', image: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=900&q=85' },
  { id: 6, name: 'Royal family frame', category: 'Photo Frames', price: 96, color: 'Gunmetal', image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=900&q=85' },
]
const categories = ['All pieces', 'Bangles', 'Photo Frames']

function App() {
  const [category, setCategory] = useState('All pieces')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const productFromUrl = products.find((product) => product.id === Number(new URLSearchParams(window.location.search).get('product')))
  const [selectedProduct, setSelectedProduct] = useState(productFromUrl || null)
  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === 'All pieces' || product.category === category
    return matchesCategory && product.name.toLowerCase().includes(query.toLowerCase())
  }), [category, query])
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const productLink = (product) => `${window.location.origin}${window.location.pathname}?product=${product.id}`
  const buyNow = (product) => {
    const message = `Hello MAN, I would like to buy this product:\n\nProduct: ${product.name}\nCategory: ${product.category}\nColor: ${product.color}\nPrice: $${product.price}\nQuantity: 1\n\nProduct link:\n${productLink(product)}`
    window.open(`https://wa.me/918688125850?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }
  const whatsappOrder = () => {
    const items = cart.map((item) => `${item.name}\nCategory: ${item.category}\nColor: ${item.color}\nPrice: $${item.price}\nQuantity: ${item.quantity}\nProduct link: ${productLink(item)}`).join('\n\n')
    const message = `Hello MAN, I would like to place an order:\n\n${items}\n\nSubtotal: $${cartTotal}`
    window.open(`https://wa.me/918688125850?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }
  const addToCart = (product) => setCart((currentCart) => {
    const existing = currentCart.find((item) => item.id === product.id)
    if (existing) return currentCart.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
    return [...currentCart, { ...product, quantity: 1 }]
  })
  const updateQuantity = (id, change) => setCart((currentCart) => currentCart.map((item) => item.id === id ? { ...item, quantity: item.quantity + change } : item).filter((item) => item.quantity > 0))

  const relatedProducts = selectedProduct
    ? products.filter((product) => product.category === selectedProduct.category && product.id !== selectedProduct.id)
    : []

  return (
    <div className="storefront">
      <div className="snowfall" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <span key={index} style={{ '--snow-left': `${(index * 17) % 100}%`, '--snow-delay': `${(index % 7) * -1.4}s`, '--snow-size': `${4 + (index % 4)}px` }} />)}
      </div>
      <div className="announcement">Free shipping on orders over $100 <span>•</span> Built for the bloodline</div>
      <header className="site-header">
        <a className="brand" href="/" aria-label="MAN home"><img className="wordmark" src={manLogo} alt="MAN logo" /><span>MAN</span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#shop">Shop</a>
          <a href="#story">Our story</a>
          <a href="#journal">Journal</a>
        </nav>
        <button className="cart-trigger" type="button" onClick={() => setCartOpen(true)}>
          Bag <span>{cartCount}</span>
        </button>
      </header>
        <main>
          {selectedProduct ? (
            <section className="product-detail">
              <button className="back-link" type="button" onClick={() => setSelectedProduct(null)}>← Back to collection</button>
              <div className="detail-layout">
                <div className="detail-image"><img src={selectedProduct.image} alt={selectedProduct.name} /></div>
                <div className="detail-copy">
                  <p className="kicker">{selectedProduct.category} / {selectedProduct.color}</p>
                  <h1>{selectedProduct.name}</h1>
                  <p className="detail-price">${selectedProduct.price}</p>
                  <p className="detail-description">A statement piece with a strong silhouette, made to become part of your everyday story. Designed with character and finished for lasting wear.</p>
                  <div className="detail-actions"><button className="detail-add" type="button" onClick={() => addToCart(selectedProduct)}>Add to bag <span>↗</span></button><button className="detail-buy" type="button" onClick={() => buyNow(selectedProduct)}>Buy now on WhatsApp <span>↗</span></button></div>
                  <div className="detail-notes"><p><b>Materials</b><span>Premium crafted finish</span></p><p><b>Delivery</b><span>Ships within 3–5 days</span></p><p><b>Returns</b><span>30-day easy returns</span></p></div>
                </div>
              </div>
              <div className="related-heading"><p className="kicker">Complete the collection</p><h2>More from <em>{selectedProduct.category}.</em></h2></div>
              <div className="product-grid related-grid">{relatedProducts.map((product) => <article className="product" key={product.id} onClick={() => setSelectedProduct(product)}><div className="product-image"><img src={product.image} alt={product.name} /><button type="button" aria-label={`Add ${product.name} to bag`} onClick={(event) => { event.stopPropagation(); addToCart(product) }}>+</button></div><div className="product-info"><div><h3>{product.name}</h3><p>{product.category} / {product.color}</p></div><strong>${product.price}</strong></div><button className="buy-now small-buy" type="button" onClick={(event) => { event.stopPropagation(); buyNow(product) }}>Buy now</button></article>)}</div>
            </section>
          ) : (
            <>
          <section className="hero" id="story">
            <div className="hero-copy"><p className="kicker">Men's accessories and keepsakes</p><h1>Wear your<br /><em>legacy.</em></h1><p className="hero-text">Blood-themed bangles and bold photo frames made for the men, memories, and stories that matter.</p><a className="text-link" href="#shop">Shop the collection <span>↘</span></a></div>
            <div className="hero-art" role="img" aria-label="A dark metallic bangle and photo frame"><div className="fog-layer" aria-hidden="true" /><div className="hero-caption">MAN / Collection 01</div></div>
          </section>

          <section className="shop-section" id="shop">
            <div className="section-heading"><div><p className="kicker">The collection</p><h2>Made for the<br /><em>bloodline.</em></h2></div><p className="section-note">Statement bangles and photo frames<br />that carry your story forward.</p></div>
            <div className="shop-tools"><div className="category-list" aria-label="Product categories">{categories.map((item) => <button className={category === item ? 'active' : ''} key={item} type="button" onClick={() => setCategory(item)}>{item}</button>)}</div><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pieces" aria-label="Search pieces" /></label></div>
            <div className="product-grid">{visibleProducts.map((product) => <article className="product" key={product.id} onClick={() => setSelectedProduct(product)}><div className="product-image"><img src={product.image} alt={product.name} /><button type="button" aria-label={`Add ${product.name} to bag`} onClick={(event) => { event.stopPropagation(); addToCart(product) }}>+</button></div><div className="product-info"><div><h3>{product.name}</h3><p>{product.category} / {product.color}</p></div><strong>${product.price}</strong></div><button className="buy-now small-buy" type="button" onClick={(event) => { event.stopPropagation(); buyNow(product) }}>Buy now</button></article>)}</div>
            {visibleProducts.length === 0 && <p className="no-results">No pieces match that search.</p>}
          </section>

          <section className="values" id="journal"><p className="kicker">Why MAN</p><h2>Wear it with <em>pride.</em></h2><div className="value-row"><p><b>01</b> Bold design</p><p><b>02</b> Strong materials</p><p><b>03</b> Built to last</p></div></section>
            </>
          )}
        </main>

        {cartOpen && <div className="cart-overlay" onClick={() => setCartOpen(false)}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-heading"><h2>Your bag <em>({cartCount})</em></h2><button type="button" onClick={() => setCartOpen(false)} aria-label="Close bag">×</button></div>{cart.length === 0 ? <p className="empty-cart">Your bag is waiting for something good.</p> : <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}><img src={item.image} alt="" /><div><h3>{item.name}</h3><p>${item.price}</p><div className="quantity"><button type="button" onClick={() => updateQuantity(item.id, -1)}>-</button><span>{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, 1)}>+</button></div></div></div>)}</div><div className="cart-total"><span>Subtotal</span><strong>${cartTotal}</strong></div><button className="checkout" type="button" onClick={whatsappOrder}>Order on WhatsApp <span>↗</span></button></>}</aside></div>}
    </div>
  )
}

export default App
