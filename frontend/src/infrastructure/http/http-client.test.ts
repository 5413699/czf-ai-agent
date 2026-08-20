import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './http-client'

afterEach(() => vi.unstubAllGlobals())

describe('apiRequest', () => {
  it('serializes JSON requests and returns decoded JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/api/test', { method: 'POST', body: { value: 1 } })).resolves.toEqual({
      ok: true,
    })
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.body).toBe('{"value":1}')
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  })

  it('preserves structured error responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ code: 'INVALID_GOAL' }), {
          status: 422,
          statusText: 'Unprocessable Content',
          headers: { 'content-type': 'application/problem+json' },
        }),
      ),
    )

    const request = apiRequest('/api/test')
    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
      details: { status: 422, body: { code: 'INVALID_GOAL' } },
    })
  })
})
