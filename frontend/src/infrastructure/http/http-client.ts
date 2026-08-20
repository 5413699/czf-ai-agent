export interface ApiErrorDetails {
  status: number
  statusText: string
  url: string
  body: unknown
}

export class ApiError extends Error {
  readonly details: ApiErrorDetails

  constructor(message: string, details: ApiErrorDetails) {
    super(message)
    this.name = 'ApiError'
    this.details = details
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json') || contentType.includes('+json'))
    return response.json()
  const text = await response.text()
  return text || null
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body: requestBody, ...requestOptions } = options
  const headers = new Headers(options.headers)
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
  const responseBody = await parseResponseBody(response)
  if (!response.ok) {
    throw new ApiError(`Request failed with HTTP ${response.status}.`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      body: responseBody,
    })
  }
  return responseBody as T
}
