import { useEffect, useRef } from 'react'
import { formatPrice } from '../config.js'

const FOCUSABLE = 'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])'

export default function CartDrawer({
  open,
  items,
  cartCount,
  cartTotal,
  freeShippingThreshold,
  checkoutStatus,
  checkoutError,
  onClose,
  onUpdateQuantity,
  onCheckout,
}) {
  const drawerRef = useRef(null)
  const restoreFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    restoreFocusRef.current = document.activeElement
    const drawer = drawerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawer?.querySelector(FOCUSABLE)?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !drawer) return
      const focusable = Array.from(drawer.querySelectorAll(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (restoreFocusRef.current instanceof HTMLElement) restoreFocusRef.current.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const shippingGap = freeShippingThreshold - cartTotal

  return (
    <div className="cart-overlay" onClick={onClose}>
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        ref={drawerRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-heading">
          <h2 id="cart-title">
            Your bag <em>({cartCount})</em>
          </h2>
          <button type="button" onClick={onClose} aria-label="Close bag">
            ×
          </button>
        </div>
        {items.length === 0 ? (
          <p className="empty-cart">Your bag is waiting for something good.</p>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => (
                <div className="cart-item" key={item.id}>
                  <img src={item.image} alt="" />
                  <div>
                    <h3>{item.name}</h3>
                    <p>{formatPrice(item.price)}</p>
                    <div className="quantity">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        aria-label={
                          item.quantity === 1
                            ? `Remove ${item.name} from bag`
                            : `Remove one ${item.name}`
                        }
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        aria-label={`Add one ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="shipping-note">
              {shippingGap > 0
                ? `${formatPrice(shippingGap)} away from free shipping`
                : 'Free shipping unlocked'}
            </p>
            <div className="cart-total">
              <span>Subtotal</span>
              <strong>{formatPrice(cartTotal)}</strong>
            </div>
            {checkoutError ? (
              <p className="checkout-error" role="alert">
                {checkoutError}
              </p>
            ) : null}
            <button
              className="checkout"
              type="button"
              onClick={onCheckout}
              disabled={checkoutStatus === 'pending'}
            >
              {checkoutStatus === 'pending' ? 'Placing order…' : 'Order on WhatsApp'} <span>↗</span>
            </button>
          </>
        )}
      </aside>
    </div>
  )
}
