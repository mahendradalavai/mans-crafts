import { useCallback, useEffect, useState } from 'react'

const PRODUCT_HASH = /^#\/product\/([\w-]+)$/
const ADMIN_HASH = /^#\/admin\/?$/
const SECTION_HASH = /^#(shop|story|journal)$/

function slugFromLocation() {
  const match = window.location.hash.match(PRODUCT_HASH)
  return match ? match[1] : null
}

// Product pages live behind #/product/<slug> so deep links work on any static
// host, and the browser back button closes the detail view for free.
export function useProductRouting() {
  const [selectedSlug, setSelectedSlug] = useState(slugFromLocation)
  const [isAdminRoute, setIsAdminRoute] = useState(() => ADMIN_HASH.test(window.location.hash))
  const [scrollRequest, setScrollRequest] = useState(null)

  useEffect(() => {
    const syncFromLocation = () => {
      const admin = ADMIN_HASH.test(window.location.hash)
      const slug = admin ? null : slugFromLocation()
      setIsAdminRoute(admin)
      setSelectedSlug(slug)
      if (admin || slug) {
        setScrollRequest({ target: 'top' })
        return
      }
      const section = window.location.hash.match(SECTION_HASH)
      if (section) setScrollRequest({ target: section[1] })
    }
    window.addEventListener('hashchange', syncFromLocation)
    window.addEventListener('popstate', syncFromLocation)
    return () => {
      window.removeEventListener('hashchange', syncFromLocation)
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [])

  // Runs after the new view has been committed, so section anchors that only exist
  // on the home page are present by the time we scroll to them. Each request is a
  // fresh object, so asking for the same target twice still scrolls again.
  useEffect(() => {
    if (!scrollRequest) return
    if (scrollRequest.target === 'top') window.scrollTo({ top: 0, left: 0 })
    else document.getElementById(scrollRequest.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollRequest])

  const closeProduct = useCallback(() => {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`)
    setSelectedSlug(null)
    setScrollRequest({ target: 'shop' })
  }, [])

  return { selectedSlug, isAdminRoute, closeProduct }
}
