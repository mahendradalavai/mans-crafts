import { useState } from 'react'

// A product photograph that degrades to a titled tile instead of the browser's
// broken-image icon. The shop should never look broken just because one file is
// missing, so a failure falls back to the product's own name.
//
// It remembers *which* source failed rather than a plain boolean, so reusing this
// slot for a different product retries the new image automatically.
export default function ProductImage({ product, loading = 'lazy', alt }) {
  const [failedSrc, setFailedSrc] = useState(null)

  if (!product.image || failedSrc === product.image) {
    // A decorative image is announced by the text beside it, so the tile stays
    // silent there rather than duplicating the product name.
    const decorative = alt === ''
    return (
      <span className="image-fallback" aria-hidden={decorative ? 'true' : undefined}>
        <span aria-hidden="true">{decorative ? '' : product.name}</span>
      </span>
    )
  }

  return (
    <img
      src={product.image}
      alt={alt ?? product.name}
      loading={loading}
      onError={() => setFailedSrc(product.image)}
    />
  )
}
