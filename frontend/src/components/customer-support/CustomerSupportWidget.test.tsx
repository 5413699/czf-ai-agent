// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useCustomerSupportStore } from '../../features/customer-support/customer-support-store'
import { CustomerSupportStreamError } from '../../infrastructure/http/customer-support-api'
import CustomerSupportWidget, { type CustomerSupportStream } from './CustomerSupportWidget'

function installDialogPolyfill() {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    },
  })
}

describe('CustomerSupportWidget', () => {
  afterEach(cleanup)

  beforeEach(() => {
    installDialogPolyfill()
    localStorage.clear()
    useCustomerSupportStore.setState({ conversationId: 'conversation-test', messages: [] })
  })

  it('streams a recommended answer and clears it only after confirmation', async () => {
    const stream: CustomerSupportStream = async function* (request) {
      yield {
        type: 'start',
        requestId: 'request-1',
        conversationId: request.conversationId,
        messageId: request.messageId,
      }
      yield { type: 'delta', text: '进入专注页面，' }
      yield { type: 'delta', text: '点击开始专注。' }
      yield { type: 'complete', outcome: 'answered', sources: [] }
    }
    const user = userEvent.setup()
    render(<CustomerSupportWidget streamOverride={stream} />)

    await user.click(screen.getByRole('button', { name: '打开番茄小助手' }))
    await user.click(screen.getByRole('button', { name: '如何开始一枚番茄？' }))
    expect(await screen.findByText('进入专注页面，点击开始专注。')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: '继续提问' }).querySelectorAll('button'),
    ).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '清空当前会话' }))
    expect(screen.getByRole('alertdialog', { name: '确认清空会话' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认清空' }))
    expect(screen.queryByText('进入专注页面，点击开始专注。')).not.toBeInTheDocument()
  })

  it('stops an in-flight answer', async () => {
    const stream: CustomerSupportStream = async function* (request, signal) {
      yield {
        type: 'start',
        requestId: 'request-1',
        conversationId: request.conversationId,
        messageId: request.messageId,
      }
      await new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    }
    const user = userEvent.setup()
    render(<CustomerSupportWidget streamOverride={stream} />)
    await user.click(screen.getByRole('button', { name: '打开番茄小助手' }))
    await user.click(screen.getByRole('button', { name: '如何开始一枚番茄？' }))
    await user.click(await screen.findByRole('button', { name: '停止生成' }))

    expect(await screen.findByText('已停止生成')).toBeInTheDocument()
  })

  it('retries the original question after a connection failure', async () => {
    let attempts = 0
    const stream: CustomerSupportStream = async function* () {
      attempts += 1
      if (attempts === 1) throw new CustomerSupportStreamError('unavailable')
      yield { type: 'delta', text: '连接恢复。' }
      yield { type: 'complete', outcome: 'answered', sources: [] }
    }
    render(<CustomerSupportWidget streamOverride={stream} />)
    fireEvent.click(screen.getByRole('button', { name: '打开番茄小助手' }))
    fireEvent.click(screen.getByRole('button', { name: '如何开始一枚番茄？' }))
    await screen.findByText('暂时无法连接番茄小助手，请检查网络后重试。')
    fireEvent.click(screen.getByRole('button', { name: '重试原问题' }))

    await waitFor(() => expect(screen.getByText('连接恢复。')).toBeInTheDocument())
    expect(attempts).toBe(2)
  })
})
