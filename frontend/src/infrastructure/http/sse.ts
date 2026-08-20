import { ApiError, resolveApiUrl } from './http-client'

export interface SseMessage<T> {
  data: T
  event: string
  id: string | null
  retry: number | null
}

export interface SseRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown
  headers?: HeadersInit
}

interface SseFrame {
  dataLines: string[]
  event: string
  id: string | null
  retry: number | null
}

function createFrame(): SseFrame {
  return { dataLines: [], event: 'message', id: null, retry: null }
}

function appendLine(frame: SseFrame, line: string): void {
  if (!line || line.startsWith(':')) return
  const separator = line.indexOf(':')
  const field = separator === -1 ? line : line.slice(0, separator)
  const rawValue = separator === -1 ? '' : line.slice(separator + 1)
  const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue
  if (field === 'data') frame.dataLines.push(value)
  else if (field === 'event') frame.event = value || 'message'
  else if (field === 'id' && !value.includes('\0')) frame.id = value
  else if (field === 'retry' && /^\d+$/.test(value)) frame.retry = Number(value)
}

function emitFrame<T>(
  frame: SseFrame,
  decode: (data: string, event: string) => T,
): SseMessage<T> | null {
  if (frame.dataLines.length === 0) return null
  return {
    data: decode(frame.dataLines.join('\n'), frame.event),
    event: frame.event,
    id: frame.id,
    retry: frame.retry,
  }
}

export async function* parseSseStream<T>(
  stream: ReadableStream<Uint8Array>,
  decode: (data: string, event: string) => T,
): AsyncGenerator<SseMessage<T>> {
  const reader = stream.getReader()
  const textDecoder = new TextDecoder()
  let buffer = ''
  let frame = createFrame()
  try {
    while (true) {
      // Stream chunks are inherently sequential and must be decoded in arrival order.
      // oxlint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read()
      if (done) break
      buffer += textDecoder.decode(value, { stream: true })
      let lineEnd = buffer.search(/\r?\n/)
      while (lineEnd !== -1) {
        const line = buffer.slice(0, lineEnd)
        const newlineLength = buffer.startsWith('\r\n', lineEnd) ? 2 : 1
        buffer = buffer.slice(lineEnd + newlineLength)
        if (line === '') {
          const message = emitFrame(frame, decode)
          if (message) yield message
          frame = createFrame()
        } else {
          appendLine(frame, line)
        }
        lineEnd = buffer.search(/\r?\n/)
      }
    }
  } finally {
    reader.releaseLock()
  }

  buffer += textDecoder.decode()
  if (buffer) appendLine(frame, buffer)
  const finalMessage = emitFrame(frame, decode)
  if (finalMessage !== null) yield finalMessage
}

export async function openSseStream<T>(
  path: string,
  decode: (data: string, event: string) => T,
  options: SseRequestOptions = {},
): Promise<AsyncGenerator<SseMessage<T>>> {
  const { body: requestBody, ...requestOptions } = options
  const headers = new Headers(options.headers)
  headers.set('accept', 'text/event-stream')
  let body: BodyInit | undefined
  if (requestBody !== undefined) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(requestBody)
  }
  const response = await fetch(resolveApiUrl(path), {
    ...requestOptions,
    headers,
    ...(body === undefined ? {} : { body }),
  })
  if (!response.ok || !response.body) {
    const responseBody = await response.text()
    throw new ApiError(`SSE request failed with HTTP ${response.status}.`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      body: responseBody,
    })
  }
  return parseSseStream(response.body, decode)
}

export function decodeJsonSse<T>(data: string): T {
  return JSON.parse(data) as T
}
