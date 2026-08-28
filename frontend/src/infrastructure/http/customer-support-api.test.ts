import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomerSupportEvent } from '../../domain/customer-support'
import { streamCustomerSupport } from './customer-support-api'

function sseResponse(events: unknown[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

describe('customer support API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends only the public request contract and keeps explicitly public sources', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      sseResponse([
        {
          type: 'start',
          requestId: 'request-1',
          conversationId: 'conversation-1',
          messageId: 'message-1',
        },
        { type: 'delta', text: '公开回答' },
        {
          type: 'complete',
          outcome: 'answered',
          sources: [
            {
              name: '使用指南',
              url: 'https://example.com/guide',
              public: true,
              internalChunkId: 'must-not-reach-ui',
            },
            {
              name: '内部文档',
              url: 'https://internal.example.com/secret',
              public: false,
            },
          ],
          retrievalStrategy: 'must-not-reach-ui',
        },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const events: CustomerSupportEvent[] = []
    for await (const event of streamCustomerSupport(
      {
        conversationId: 'conversation-1',
        messageId: 'message-1',
        question: '如何使用？',
      },
      new AbortController().signal,
    ))
      events.push(event)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/customer-support/conversations/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conversation-1',
          messageId: 'message-1',
          question: '如何使用？',
        }),
      }),
    )
    expect(events.at(-1)).toEqual({
      type: 'complete',
      outcome: 'answered',
      sources: [{ name: '使用指南', url: 'https://example.com/guide', public: true }],
    })
  })
})
