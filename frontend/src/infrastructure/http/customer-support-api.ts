import { z } from 'zod'
import type {
  CustomerSupportEvent,
  CustomerSupportRequest,
  PublicSupportSource,
} from '../../domain/customer-support'
import { ApiError } from './http-client'
import { openSseStream } from './sse'

export const CUSTOMER_SUPPORT_ENDPOINT = '/api/customer-support/conversations/messages'

const sourceSchema = z.object({
  name: z.string().min(1),
  url: z
    .string()
    .url()
    .refine((url) => /^https?:\/\//.test(url)),
  public: z.literal(true),
})

const eventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    requestId: z.string(),
    conversationId: z.string(),
    messageId: z.string(),
  }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('complete'),
    outcome: z.enum(['answered', 'empty']),
    sources: z.array(z.unknown()),
  }),
  z.object({ type: z.literal('refusal'), reason: z.literal('safety') }),
  z.object({
    type: z.literal('error'),
    code: z.enum(['unavailable', 'timeout', 'internal']),
    message: z.string().optional(),
  }),
])

export class CustomerSupportStreamError extends Error {
  readonly code: 'unavailable' | 'timeout' | 'internal'

  constructor(code: 'unavailable' | 'timeout' | 'internal', message?: string) {
    super(message || code)
    this.name = 'CustomerSupportStreamError'
    this.code = code
  }
}

function decodeEvent(data: string): CustomerSupportEvent {
  const event = eventSchema.parse(JSON.parse(data))
  if (event.type !== 'complete') return event
  return { ...event, sources: publicSources(event.sources) }
}

function publicSources(sources: unknown[]): PublicSupportSource[] {
  return sources.flatMap((source) => {
    const parsed = sourceSchema.safeParse(source)
    return parsed.success ? [parsed.data] : []
  })
}

export async function* streamCustomerSupport(
  request: CustomerSupportRequest,
  signal: AbortSignal,
): AsyncGenerator<CustomerSupportEvent> {
  try {
    const stream = await openSseStream(CUSTOMER_SUPPORT_ENDPOINT, decodeEvent, {
      method: 'POST',
      body: request,
      signal,
    })
    for await (const message of stream) {
      const event = message.data
      if (event.type === 'error') throw new CustomerSupportStreamError(event.code, event.message)
      yield event
    }
  } catch (error) {
    if (error instanceof CustomerSupportStreamError || error instanceof DOMException) throw error
    if (error instanceof ApiError) {
      throw new CustomerSupportStreamError(
        error.details.status === 408 || error.details.status === 504 ? 'timeout' : 'unavailable',
      )
    }
    if (error instanceof TypeError) throw new CustomerSupportStreamError('unavailable')
    throw new CustomerSupportStreamError('internal')
  }
}
