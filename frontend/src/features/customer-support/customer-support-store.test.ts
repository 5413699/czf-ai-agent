// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { useCustomerSupportStore } from './customer-support-store'

describe('customer support store', () => {
  beforeEach(() => {
    localStorage.clear()
    useCustomerSupportStore.setState({ conversationId: 'conversation-test', messages: [] })
  })

  it('builds and completes a streaming exchange', () => {
    const { assistantMessageId } = useCustomerSupportStore
      .getState()
      .beginExchange('如何开始一枚番茄？')
    useCustomerSupportStore.getState().appendDelta(assistantMessageId, '进入专注页面。')
    useCustomerSupportStore
      .getState()
      .finishMessage(assistantMessageId, 'complete', [
        { name: '公开帮助', url: 'https://example.com/help', public: true },
      ])

    const messages = useCustomerSupportStore.getState().messages
    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: '进入专注页面。',
      status: 'complete',
      sources: [{ name: '公开帮助' }],
    })
  })

  it('creates a fresh conversation when the current conversation is cleared', () => {
    useCustomerSupportStore.getState().beginExchange('测试问题')
    useCustomerSupportStore.getState().clearConversation()

    expect(useCustomerSupportStore.getState().messages).toEqual([])
    expect(useCustomerSupportStore.getState().conversationId).not.toBe('conversation-test')
  })
})
