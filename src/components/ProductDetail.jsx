import { useEffect } from 'react'
import ProductCard from './ProductCard.jsx'
import { STORE, formatPrice } from '../config.js'

export default function ProductDetail({ product, related, onBack, onAdd, onBuy }) {
  const soldOut = (product.stock ?? 0) <= 0

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${product.name} — ${STORE.name}`
    return () => {
      document.title = previousTitle
    }
  }, [product.name])

  return (
    <section className="product-detail">
      <button className="back-link" type="button" onClick={onBack}>
        ← Back to collection
      </button>
      <div className="detail-layout">
        <div className="detail-image">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="detail-copy">
          <p className="kicker">
            {product.category} / {product.color}
          </p>
          <h1>{product.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>
          {product.sku ? <p className="detail-sku">SKU {product.sku}</p> : null}
          <p className="detail-description">{product.description}</p>
          {soldOut ? (
            <p className="stock-note">
              This piece is sold out. Message us on WhatsApp and we&apos;ll make the next batch for you.
            </p>
          ) : (
            <div className="detail-actions">
              <button className="detail-add" type="button" onClick={() => onAdd(product)}>
                Add to bag <span>↗</span>
              </button>
              <button className="detail-buy" type="button" onClick={() => onBuy(product)}>
                Buy now on WhatsApp <span>↗</span>
              </button>
            </div>
          )}
          <div className="detail-notes">
            <p>
              <b>Materials</b>
              <span>Premium crafted finish</span>
            </p>
            <p>
              <b>Delivery</b>
              <span>Ships within 3–5 days</span>
            </p>
            <p>
              <b>Returns</b>
              <span>30-day easy returns</span>
            </p>
          </div>
        </div>
      </div>
      {related.length > 0 ? (
        <>
          <div className="related-heading">
            <p className="kicker">Complete the collection</p>
            <h2>
              More from <em>{product.category}.</em>
            </h2>
          </div>
          <div className="product-grid related-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} onAdd={onAdd} onBuy={onBuy} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
