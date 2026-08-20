export function createId(prefix: string): string {
  const suffix =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${suffix}`
}
