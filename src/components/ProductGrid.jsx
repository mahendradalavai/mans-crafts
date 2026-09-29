import ProductCard from './ProductCard.jsx'

function SkeletonCard() {
  return (
    <div className="product-skeleton" aria-hidden="true">
      <div className="skeleton-media" />
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </div>
  )
}

export default function ProductGrid({ products, status, onAdd, onBuy, emptyMessage }) {
  if (status === 'loading') {
    return (
      <div className="product-grid" aria-busy="true">
        <span className="sr-only" role="status">
          Loading the collection…
        </span>
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return <p className="no-results">{emptyMessage}</p>
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAdd={onAdd} onBuy={onBuy} />
      ))}
    </div>
  )
}
