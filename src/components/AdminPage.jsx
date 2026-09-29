import { useCallback, useEffect, useMemo, useState } from 'react'
import { STORE, formatPrice } from '../config.js'
import { useAdminSession } from '../hooks/useAdminSession.js'
import { supabase } from '../lib/supabase.js'

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  expired: 'Hold expired',
}

// pending → confirmed → fulfilled, with cancellation available until it ships.
const NEXT_STEPS = {
  pending: [
    { status: 'confirmed', label: 'Confirm' },
    { status: 'cancelled', label: 'Cancel' },
  ],
  confirmed: [
    { status: 'fulfilled', label: 'Mark fulfilled' },
    { status: 'cancelled', label: 'Cancel' },
  ],
}

function when(value) {
  if (!value) return ''
  return new Date(value).toLocaleString(STORE.locale, { dateStyle: 'medium', timeStyle: 'short' })
}

function SignIn({ configured, onSignIn, onClaim }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [setup, setSetup] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (setup) await onClaim(email, password)
      else await onSignIn(email, password)
    } catch (failure) {
      setError(failure.message ?? 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (!configured) {
    return (
      <section className="admin-card">
        <h1>Orders</h1>
        <p className="admin-note">
          This build has no Supabase configuration, so there are no orders to show. Set
          <code> VITE_SUPABASE_URL </code> and <code> VITE_SUPABASE_ANON_KEY </code> and reload.
        </p>
      </section>
    )
  }

  return (
    <section className="admin-card admin-card-narrow">
      <p className="kicker">{setup ? 'One-time setup' : 'Shop owner'}</p>
      <h1>{setup ? 'Create your account' : 'Sign in'}</h1>
      <p className="admin-note">
        {setup
          ? 'This creates the administrator account for the address configured in the database. Choose your own password — it is hashed and never stored in this app.'
          : 'Sign in with the administrator account you created for this shop.'}
      </p>
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            autoComplete="username"
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete={setup ? 'new-password' : 'current-password'}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? (
          <p className="admin-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="admin-primary" type="submit" disabled={busy}>
          {busy ? 'Working…' : setup ? 'Create account and sign in' : 'Sign in'}
        </button>
      </form>
      <button className="admin-link" type="button" onClick={() => { setSetup(!setup); setError(null) }}>
        {setup ? 'I already have an account' : 'First time here? Create the owner account'}
      </button>
    </section>
  )
}

export default function AdminPage() {
  const { status: sessionStatus, isAdmin, email, configured, signIn, signOut, claim } = useAdminSession()

  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [failures, setFailures] = useState([])
  const [loadStatus, setLoadStatus] = useState('idle')
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [releaseNote, setReleaseNote] = useState(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = `Orders — ${STORE.name}`
    return () => {
      document.title = previousTitle
    }
  }, [])

  const load = useCallback(() => {
    if (!isAdmin || !supabase) return

    Promise.all([
      supabase
        .from('orders')
        .select(
          'id, order_number, status, subtotal, created_at, reserved_until, client_ip, ' +
            'items:order_items(quantity, unit_price, product_id, products(name, slug))',
        )
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('products')
        .select('id, name, slug, stock, low_stock_threshold, active')
        .order('id'),
      supabase
        .from('order_failures')
        .select('id, created_at, error_code, error_message, item_count')
        .order('created_at', { ascending: false })
        .limit(20),
    ])
      .then(([ordersResult, productsResult, failuresResult]) => {
        const failure = ordersResult.error || productsResult.error || failuresResult.error
        if (failure) {
          setLoadError(failure.message)
          setLoadStatus('error')
          return
        }
        setOrders(ordersResult.data ?? [])
        setProducts(productsResult.data ?? [])
        setFailures(failuresResult.data ?? [])
        setLoadStatus('ready')
      })
      .catch((error) => {
        setLoadError(error?.message ?? 'Could not load the shop data.')
        setLoadStatus('error')
      })
  }, [isAdmin])

  useEffect(() => {
    load()
  }, [load])

  const summary = useMemo(() => {
    const counts = orders.reduce((totals, order) => {
      totals[order.status] = (totals[order.status] ?? 0) + 1
      return totals
    }, {})
    return {
      counts,
      pendingValue: orders
        .filter((order) => order.status === 'pending')
        .reduce((total, order) => total + Number(order.subtotal), 0),
      lowStock: products.filter(
        (product) => product.active && product.stock > 0 && product.stock <= product.low_stock_threshold,
      ),
      outOfStock: products.filter((product) => product.stock <= 0),
    }
  }, [orders, products])

  const updateStatus = useCallback(
    async (id, status) => {
      setActionError(null)
      setReleaseNote(null)
      const { data, error } = await supabase.from('orders').update({ status }).eq('id', id).select('id')
      if (error) {
        setActionError(error.message)
        return
      }
      // A blocked update returns no rows rather than an error, so check.
      if (!data?.length) {
        setActionError('That order could not be updated.')
        return
      }
      load()
    },
    [load],
  )

  const releaseExpired = useCallback(async () => {
    setActionError(null)
    const { data, error } = await supabase.rpc('expire_stale_reservations')
    if (error) {
      setActionError(error.message)
      return
    }
    const released = Number(data ?? 0)
    setReleaseNote(
      released === 0
        ? 'No holds had expired.'
        : `Released stock from ${released} unconfirmed ${released === 1 ? 'order' : 'orders'}.`,
    )
    load()
  }, [load])

  if (sessionStatus === 'loading') {
    return (
      <section className="admin-page">
        <p className="admin-note">Checking your session…</p>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <section className="admin-page">
        <header className="admin-bar">
          <a className="admin-brand" href="#/">
            ← {STORE.name}
          </a>
        </header>
        <SignIn configured={configured} onSignIn={signIn} onClaim={claim} />
        {email ? (
          <section className="admin-card admin-card-narrow">
            <p className="admin-error" role="alert">
              Signed in as {email}, but this account is not an administrator. Ask the shop owner to
              grant it, or sign in with the administrator account.
            </p>
            <button className="admin-link" type="button" onClick={signOut}>
              Sign out
            </button>
          </section>
        ) : null}
      </section>
    )
  }

  return (
    <section className="admin-page">
      <header className="admin-bar">
        <a className="admin-brand" href="#/">
          ← {STORE.name}
        </a>
        <div className="admin-who">
          <span>{email}</span>
          <button className="admin-link" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="admin-head">
        <div>
          <p className="kicker">Shop owner</p>
          <h1>Orders</h1>
        </div>
        <div className="admin-head-actions">
          <button
            className="admin-secondary"
            type="button"
            onClick={() => {
              setLoadStatus('idle')
              load()
            }}
          >
            Refresh
          </button>
          <button className="admin-secondary" type="button" onClick={releaseExpired}>
            Release expired holds
          </button>
        </div>
      </div>

      {loadError ? (
        <p className="admin-error" role="alert">
          {loadError}
        </p>
      ) : null}
      {actionError ? (
        <p className="admin-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {releaseNote ? <p className="admin-note">{releaseNote}</p> : null}

      {loadStatus === 'idle' ? (
        <p className="admin-note">Loading orders…</p>
      ) : (
        <>
          <div className="admin-stats">
            <p>
              <b>{summary.counts.pending ?? 0}</b>
              <span>Pending</span>
            </p>
            <p>
              <b>{summary.counts.confirmed ?? 0}</b>
              <span>Confirmed</span>
            </p>
            <p>
              <b>{summary.counts.fulfilled ?? 0}</b>
              <span>Fulfilled</span>
            </p>
            <p>
              <b>{formatPrice(summary.pendingValue)}</b>
              <span>Value awaiting confirmation</span>
            </p>
          </div>

          <section className="admin-card">
            <h2>Recent orders</h2>
            {orders.length === 0 ? (
              <p className="admin-note">No orders yet.</p>
            ) : (
              <div className="admin-orders">
                {orders.map((order) => (
                  <article className="admin-order" key={order.id}>
                    <div className="admin-order-head">
                      <div>
                        <strong>{order.order_number}</strong>
                        <span className={`admin-status admin-status-${order.status}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </div>
                      <div>
                        <span>{formatPrice(order.subtotal)}</span>
                        <span className="admin-when">{when(order.created_at)}</span>
                      </div>
                    </div>
                    <ul className="admin-items">
                      {(order.items ?? []).map((item, index) => (
                        <li key={`${order.id}-${item.product_id}-${index}`}>
                          <span>
                            {item.quantity} × {item.products?.name ?? `Product ${item.product_id}`}
                          </span>
                          <span>{formatPrice(item.unit_price)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="admin-order-foot">
                      <span className="admin-when">
                        {order.status === 'pending' && order.reserved_until
                          ? `Holds stock until ${when(order.reserved_until)}`
                          : order.client_ip
                            ? `Ordered from ${order.client_ip}`
                            : ''}
                      </span>
                      <div className="admin-actions">
                        {(NEXT_STEPS[order.status] ?? []).map((step) => (
                          <button
                            key={step.status}
                            className={step.status === 'cancelled' ? 'admin-link' : 'admin-primary'}
                            type="button"
                            onClick={() => updateStatus(order.id, step.status)}
                          >
                            {step.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-card">
            <h2>Stock</h2>
            {summary.outOfStock.length === 0 && summary.lowStock.length === 0 ? (
              <p className="admin-note">Everything is comfortably in stock.</p>
            ) : (
              <ul className="admin-items">
                {[...summary.outOfStock, ...summary.lowStock].map((product) => (
                  <li key={product.id}>
                    <span>
                      {product.name}
                      <span className={`admin-status ${product.stock <= 0 ? 'admin-status-cancelled' : 'admin-status-pending'}`}>
                        {product.stock <= 0 ? 'Sold out' : `${product.stock} left`}
                      </span>
                    </span>
                    <span>warns at {product.low_stock_threshold}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="admin-note">
              Unconfirmed orders hold their stock for 24 hours. Expired holds are released automatically
              every hour, or straight away with the button above.
            </p>
          </section>

          <section className="admin-card">
            <h2>Failed checkouts</h2>
            {failures.length === 0 ? (
              <p className="admin-note">
                No failed checkouts recorded. Failures still reach WhatsApp, but they show up here so a run
                of them does not go unnoticed.
              </p>
            ) : (
              <ul className="admin-items">
                {failures.map((failure) => (
                  <li key={failure.id}>
                    <span>
                      {failure.error_message}
                      <span className="admin-status admin-status-cancelled">{failure.error_code}</span>
                    </span>
                    <span>
                      {failure.item_count} {failure.item_count === 1 ? 'item' : 'items'} · {when(failure.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  )
}
