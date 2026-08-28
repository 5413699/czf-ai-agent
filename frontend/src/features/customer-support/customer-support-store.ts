import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  PublicSupportSource,
  SupportMessage,
  SupportMessageStatus,
} from '../../domain/customer-support'
import { createId } from '../../shared/lib/id'

interface CustomerSupportState {
  conversationId: string
  messages: SupportMessage[]
  beginExchange: (question: string) => { userMessageId: string; assistantMessageId: string }
  appendDelta: (messageId: string, text: string) => void
  finishMessage: (
    messageId: string,
    status: Extract<SupportMessageStatus, 'complete' | 'empty' | 'refused'>,
    sources?: PublicSupportSource[],
  ) => void
  failMessage: (messageId: string, code: NonNullable<SupportMessage['errorCode']>) => void
  stopMessage: (messageId: string) => void
  clearConversation: () => void
}

function updateMessage(
  messages: SupportMessage[],
  messageId: string,
  updater: (message: SupportMessage) => SupportMessage,
): SupportMessage[] {
  return messages.map((message) => (message.id === messageId ? updater(message) : message))
}

function safePersistedMessages(messages: SupportMessage[]): SupportMessage[] {
  return messages.map((message) =>
    message.status === 'streaming' ? { ...message, status: 'stopped' } : message,
  )
}

export const useCustomerSupportStore = create<CustomerSupportState>()(
  persist(
    (set) => ({
      conversationId: createId('support-conversation'),
      messages: [],
      beginExchange: (question) => {
        const createdAt = new Date().toISOString()
        const userMessageId = createId('support-user')
        const assistantMessageId = createId('support-assistant')
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: userMessageId,
              role: 'user',
              content: question,
              createdAt,
              status: 'complete',
              sources: [],
            },
            {
              id: assistantMessageId,
              role: 'assistant',
              content: '',
              createdAt,
              status: 'streaming',
              sources: [],
              question,
            },
          ],
        }))
        return { userMessageId, assistantMessageId }
      },
      appendDelta: (messageId, text) =>
        set((state) => ({
          messages: updateMessage(state.messages, messageId, (message) => ({
            ...message,
            content: message.content + text,
          })),
        })),
      finishMessage: (messageId, status, sources = []) =>
        set((state) => ({
          messages: updateMessage(state.messages, messageId, (message) => ({
            ...message,
            status,
            sources,
          })),
        })),
      failMessage: (messageId, errorCode) =>
        set((state) => ({
          messages: updateMessage(state.messages, messageId, (message) => ({
            ...message,
            status: 'error',
            errorCode,
          })),
        })),
      stopMessage: (messageId) =>
        set((state) => ({
          messages: updateMessage(state.messages, messageId, (message) => ({
            ...message,
            status: 'stopped',
          })),
        })),
      clearConversation: () =>
        set({ conversationId: createId('support-conversation'), messages: [] }),
    }),
    {
      name: 'studyflow:customer-support',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ conversationId, messages }) => ({ conversationId, messages }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<CustomerSupportState>
        return {
          ...current,
          conversationId: saved.conversationId ?? current.conversationId,
          messages: safePersistedMessages(saved.messages ?? []),
        }
      },
    },
  ),
)
