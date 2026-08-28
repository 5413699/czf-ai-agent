export interface CustomerSupportRequest {
  conversationId: string
  messageId: string
  question: string
}

export interface PublicSupportSource {
  name: string
  url: string
  public: true
}

export type CustomerSupportEvent =
  | {
      type: 'start'
      requestId: string
      conversationId: string
      messageId: string
    }
  | { type: 'delta'; text: string }
  | {
      type: 'complete'
      outcome: 'answered' | 'empty'
      sources: PublicSupportSource[]
    }
  | { type: 'refusal'; reason: 'safety' }
  | {
      type: 'error'
      code: 'unavailable' | 'timeout' | 'internal'
      message?: string | undefined
    }

export type SupportMessageStatus =
  'complete' | 'streaming' | 'stopped' | 'empty' | 'refused' | 'error'

export interface SupportMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  status: SupportMessageStatus
  sources: PublicSupportSource[]
  question?: string
  errorCode?: 'unavailable' | 'timeout' | 'internal'
}
