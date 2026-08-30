/**
 * Resolves a bundled asset against the optional static asset CDN.
 * Absolute, data and blob URLs are returned unchanged so user media never
 * gets routed through the CDN.
 */
const ASSET_CDN_URL =
  (import.meta.env.VITE_ASSET_CDN_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export function assetUrl(path: string): string {
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return ASSET_CDN_URL ? `${ASSET_CDN_URL}${normalizedPath}` : normalizedPath
}
