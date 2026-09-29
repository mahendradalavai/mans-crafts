import { formatPrice, productPath } from '../config.js'
import ProductImage from './ProductImage.jsx'

export default function ProductCard({ product, onAdd, onBuy }) {
  const soldOut = (product.stock ?? 0) <= 0

  return (
    <article className={`product${soldOut ? ' is-sold-out' : ''}`}>
      <div className="product-image">
        <a className="product-link" href={productPath(product)} aria-label={`View ${product.name}`}>
          <ProductImage product={product} />
        </a>
        {soldOut ? (
          <span className="stock-badge">Sold out</span>
        ) : (
          <button
            className="quick-add"
            type="button"
            aria-label={`Add ${product.name} to bag`}
            onClick={() => onAdd(product)}
          >
            +
          </button>
        )}
      </div>
      <div className="product-info">
        <div>
          <h3>
            <a href={productPath(product)}>{product.name}</a>
          </h3>
          <p>
            {product.category} / {product.color}
          </p>
        </div>
        <strong>{formatPrice(product.price)}</strong>
      </div>
      <button className="buy-now small-buy" type="button" disabled={soldOut} onClick={() => onBuy(product)}>
        Buy now
      </button>
    </article>
  )
}
