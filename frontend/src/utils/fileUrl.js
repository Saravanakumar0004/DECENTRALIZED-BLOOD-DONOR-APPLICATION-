const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
  .replace(/\/api\/?$/, '')

/**
 * Resolves a stored file path to a full URL.
 * Guards against non-string values (numbers, objects) the backend may send.
 */
export function fileUrl(path) {
  if (!path) return null
  if (typeof path !== 'string') return null          // ← fixes "startsWith is not a function"
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${BASE}${clean}`
}

export const isPdf = (path) =>
  typeof path === 'string' && path.toLowerCase().endsWith('.pdf')