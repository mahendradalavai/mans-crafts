// Identifiers that make checkout safe to retry and let the database spot a flood
// of orders coming from one browser.

const SESSION_KEY = 'mans-crafts-session-v1'

export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // crypto.randomUUID only exists in a secure context, and a plain-http LAN
  // preview is not one, so fall back to a random value of the same shape.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

// Stable for the lifetime of a browser. Only ever used as a rate-limit key, so
// it is not a security boundary and holds nothing personal.
export function readSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const created = createId()
    window.localStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return null
  }
}
