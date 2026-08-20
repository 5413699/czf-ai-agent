import { describe, expect, it } from 'vitest'
import { decodeJsonSse, parseSseStream } from './sse'

function streamChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

describe('parseSseStream', () => {
  it('parses fragmented CRLF frames and multiline data', async () => {
    const stream = streamChunks([
      ': keepalive\r\nid: req-',
      '1\r\nevent: token\r\nretry: 1200\r\ndata: first\r\ndata: second\r\n\r\n',
    ])

    const messages = []
    for await (const message of parseSseStream(stream, (data) => data)) messages.push(message)

    expect(messages).toEqual([{ data: 'first\nsecond', event: 'token', id: 'req-1', retry: 1200 }])
  })

  it('flushes a final frame without a trailing newline', async () => {
    const stream = streamChunks(['data: {"type":"done"}'])
    const messages = []
    for await (const message of parseSseStream(stream, decodeJsonSse<{ type: string }>))
      messages.push(message)

    expect(messages[0]?.data).toEqual({ type: 'done' })
  })
})
