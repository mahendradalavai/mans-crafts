// Every business value that used to be hard-coded in the UI lives here.
export const STORE = {
  name: "MAN's Crafts",
  whatsappNumber: '918688125850',
  currency: 'INR',
  locale: 'en-IN',
  freeShippingThreshold: 2999,
}

const priceFormatter = new Intl.NumberFormat(STORE.locale, {
  style: 'currency',
  currency: STORE.currency,
  maximumFractionDigits: 0,
})

export function formatPrice(amount) {
  return priceFormatter.format(Number(amount) || 0)
}

export function productPath(product) {
  return product?.slug ? `#/product/${product.slug}` : '#/'
}

export function productLink(product) {
  return `${window.location.origin}${window.location.pathname}${productPath(product)}`
}

export function whatsappLink(message) {
  return `https://wa.me/${STORE.whatsappNumber}?text=${encodeURIComponent(message)}`
}

export function openWhatsApp(message) {
  window.open(whatsappLink(message), '_blank', 'noopener,noreferrer')
}

export function buyNowMessage(product, quantity = 1) {
  return [
    'Hello MAN, I would like to buy this product:',
    '',
    `Product: ${product.name}`,
    `Category: ${product.category}`,
    `Color: ${product.color}`,
    `Price: ${formatPrice(product.price)}`,
    `Quantity: ${quantity}`,
    '',
    'Product link:',
    productLink(product),
  ].join('\n')
}

export function orderMessage(items, subtotal, orderNumber) {
  const lines = items.map((item) =>
    [
      item.name,
      `Category: ${item.category}`,
      `Color: ${item.color}`,
      `Price: ${formatPrice(item.price)}`,
      `Quantity: ${item.quantity}`,
      `Product link: ${productLink(item)}`,
    ].join('\n'),
  )
  const parts = [
    'Hello MAN, I would like to place an order:',
    '',
    lines.join('\n\n'),
    '',
    `Subtotal: ${formatPrice(subtotal)}`,
  ]
  if (orderNumber) parts.push(`Order number: ${orderNumber}`)
  return parts.join('\n')
}
