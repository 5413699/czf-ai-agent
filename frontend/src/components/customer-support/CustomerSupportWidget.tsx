import {
  Bot,
  CircleAlert,
  ExternalLink,
  MessageCircleQuestion,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type {
  CustomerSupportEvent,
  CustomerSupportRequest,
  SupportMessage,
} from '../../domain/customer-support'
import { useCustomerSupportStore } from '../../features/customer-support/customer-support-store'
import {
  CustomerSupportStreamError,
  streamCustomerSupport,
} from '../../infrastructure/http/customer-support-api'
import { streamMockCustomerSupport } from '../../infrastructure/http/customer-support-mock'
import styles from './CustomerSupportWidget.module.css'

export type CustomerSupportStream = (
  request: CustomerSupportRequest,
  signal: AbortSignal,
) => AsyncGenerator<CustomerSupportEvent>

interface CustomerSupportWidgetProps {
  streamOverride?: CustomerSupportStream
}

const recommendedQuestions = [
  '如何开始一枚番茄？',
  '如何创建项目和任务？',
  '如何使用时栈台？',
  '数据保存在哪里？',
  '如何联系项目作者？',
  '项目的 GitHub 地址是什么？',
]

const errorCopy: Record<NonNullable<SupportMessage['errorCode']>, string> = {
  unavailable: '暂时无法连接时栈小助手，请检查网络后重试。',
  timeout: '等待回答超时了。问题已保留，你可以重新发送。',
  internal: '回答生成时出现了问题，请稍后重试。',
}

function selectStream(): CustomerSupportStream {
  return import.meta.env.VITE_CUSTOMER_SUPPORT_MODE === 'api'
    ? streamCustomerSupport
    : streamMockCustomerSupport
}

function AssistantMessage({
  message,
  onRetry,
}: {
  message: SupportMessage
  onRetry: (question: string) => void
}) {
  const retryable = message.status === 'error' && Boolean(message.question)
  return (
    <article className={styles.assistantRow} aria-live="polite">
      <span className={styles.avatar} aria-hidden="true">
        <Bot size={17} />
      </span>
      <div className={styles.assistantContent}>
        {message.content ? <p>{message.content}</p> : null}
        {message.status === 'streaming' && !message.content ? (
          <div className={styles.thinking} aria-label="正在思考">
            <i />
            <i />
            <i />
          </div>
        ) : null}
        {message.status === 'empty' ? (
          <div className={styles.stateMessage}>
            <CircleAlert size={17} />
            <span>当前资料中没有找到可靠答案。</span>
          </div>
        ) : null}
        {message.status === 'refused' ? (
          <div className={styles.stateMessage}>
            <CircleAlert size={17} />
            <span>这个问题暂时无法回答，你可以换一种方式提问。</span>
          </div>
        ) : null}
        {message.status === 'error' && message.errorCode ? (
          <div className={styles.errorMessage}>
            <CircleAlert size={17} />
            <span>{errorCopy[message.errorCode]}</span>
          </div>
        ) : null}
        {message.status === 'stopped' ? <small className={styles.stopped}>已停止生成</small> : null}
        {message.sources.length ? (
          <div className={styles.sources} aria-label="公开来源">
            <strong>参考来源</strong>
            {message.sources.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                {source.name}
                <ExternalLink size={13} />
              </a>
            ))}
          </div>
        ) : null}
        {retryable && message.question ? (
          <button
            className={styles.retryButton}
            type="button"
            onClick={() => onRetry(message.question!)}
          >
            <RotateCcw size={15} />
            重试原问题
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default function CustomerSupportWidget({ streamOverride }: CustomerSupportWidgetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const activeMessageRef = useRef<string | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const conversationId = useCustomerSupportStore((state) => state.conversationId)
  const messages = useCustomerSupportStore((state) => state.messages)
  const beginExchange = useCustomerSupportStore((state) => state.beginExchange)
  const appendDelta = useCustomerSupportStore((state) => state.appendDelta)
  const finishMessage = useCustomerSupportStore((state) => state.finishMessage)
  const failMessage = useCustomerSupportStore((state) => state.failMessage)
  const stopMessage = useCustomerSupportStore((state) => state.stopMessage)
  const clearConversation = useCustomerSupportStore((state) => state.clearConversation)
  const generating = messages.some((message) => message.status === 'streaming')
  const askedQuestions = new Set(
    messages.filter((message) => message.role === 'user').map((message) => message.content),
  )
  const unansweredRecommendations = recommendedQuestions.filter(
    (question) => !askedQuestions.has(question),
  )
  const followUpQuestions = (
    unansweredRecommendations.length >= 2 ? unansweredRecommendations : recommendedQuestions
  ).slice(0, 2)
  const latestMessage = messages.at(-1)
  const showFollowUps = latestMessage?.role === 'assistant' && latestMessage.status !== 'streaming'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.scrollTop = 0
      window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0)
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    if (!open || !messages.at(-1)) return
    const scroller = scrollRef.current
    if (!scroller) return
    if (typeof scroller.scrollTo === 'function')
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
    else scroller.scrollTop = scroller.scrollHeight
  }, [messages, open])

  useEffect(
    () => () => {
      abortRef.current?.abort('unmount')
    },
    [],
  )

  function resizeTextarea(value: string) {
    setDraft(value)
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`
  }

  async function sendQuestion(rawQuestion: string) {
    const question = rawQuestion.trim()
    if (!question || abortRef.current) return
    const { userMessageId, assistantMessageId } = beginExchange(question)
    const controller = new AbortController()
    abortRef.current = controller
    activeMessageRef.current = assistantMessageId
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const timeout = window.setTimeout(() => controller.abort('timeout'), 30_000)
    let terminalEventReceived = false
    try {
      const stream = streamOverride ?? selectStream()
      for await (const event of stream(
        { conversationId, messageId: userMessageId, question },
        controller.signal,
      )) {
        if (event.type === 'delta') appendDelta(assistantMessageId, event.text)
        else if (event.type === 'complete') {
          terminalEventReceived = true
          finishMessage(
            assistantMessageId,
            event.outcome === 'empty' ? 'empty' : 'complete',
            event.sources,
          )
        } else if (event.type === 'refusal') {
          terminalEventReceived = true
          finishMessage(assistantMessageId, 'refused')
        }
      }
      if (!terminalEventReceived && !controller.signal.aborted)
        failMessage(assistantMessageId, 'internal')
    } catch (error) {
      if (controller.signal.aborted) {
        if (controller.signal.reason === 'timeout') failMessage(assistantMessageId, 'timeout')
        else if (controller.signal.reason === 'stopped') stopMessage(assistantMessageId)
      } else {
        failMessage(
          assistantMessageId,
          error instanceof CustomerSupportStreamError ? error.code : 'internal',
        )
      }
    } finally {
      window.clearTimeout(timeout)
      if (activeMessageRef.current === assistantMessageId) {
        abortRef.current = null
        activeMessageRef.current = null
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void sendQuestion(draft)
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendQuestion(draft)
    }
  }

  function stopGeneration() {
    abortRef.current?.abort('stopped')
  }

  function confirmAndClear() {
    abortRef.current?.abort('stopped')
    clearConversation()
    setConfirmClear(false)
    textareaRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className={styles.supportRoot}>
      <button
        type="button"
        className={styles.launcher}
        aria-label="打开时栈小助手"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <MessageCircleQuestion size={22} />
        <span>问小助手</span>
      </button>
      <dialog
        ref={dialogRef}
        className={styles.drawer}
        aria-labelledby="support-title"
        onClose={() => {
          setOpen(false)
          setConfirmClear(false)
        }}
        onCancel={() => setOpen(false)}
      >
        <div className={styles.panel}>
          <header className={styles.header}>
            <div className={styles.titleMark} aria-hidden="true">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 id="support-title">时栈小助手</h2>
              <p>功能与使用问题，随时问我</p>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="清空当前会话"
                title="清空当前会话"
                disabled={messages.length === 0}
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 size={18} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="关闭时栈小助手"
                title="关闭"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
          </header>

          {confirmClear ? (
            <div className={styles.clearConfirm} role="alertdialog" aria-label="确认清空会话">
              <p>清空后，本浏览器中的这段客服会话将无法恢复。</p>
              <div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setConfirmClear(false)}
                >
                  取消
                </button>
                <button type="button" className={styles.dangerButton} onClick={confirmAndClear}>
                  确认清空
                </button>
              </div>
            </div>
          ) : null}

          <div ref={scrollRef} className={styles.conversation} data-testid="support-conversation">
            <section className={styles.welcome}>
              <span className={styles.welcomeIcon} aria-hidden="true">
                <Bot size={25} />
              </span>
              <h3>你好，我是时栈小助手</h3>
              <p>我可以回答时栈的功能、数据保存和操作问题。</p>
            </section>

            {messages.length === 0 ? (
              <section className={styles.suggestions} aria-label="推荐问题">
                <span>你可以这样问</span>
                <div>
                  {recommendedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => void sendQuestion(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {messages.map((message) =>
              message.role === 'user' ? (
                <article key={message.id} className={styles.userRow}>
                  <p>{message.content}</p>
                </article>
              ) : (
                <AssistantMessage key={message.id} message={message} onRetry={sendQuestion} />
              ),
            )}

            {showFollowUps ? (
              <section
                className={`${styles.suggestions} ${styles.followupSuggestions}`}
                aria-label="继续提问"
              >
                <span>还可以继续问</span>
                <div>
                  {followUpQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      disabled={generating}
                      onClick={() => void sendQuestion(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <footer className={styles.composerArea}>
            <form className={styles.composer} onSubmit={submit}>
              <label className="sr-only" htmlFor="support-question">
                向时栈小助手提问
              </label>
              <textarea
                ref={textareaRef}
                id="support-question"
                value={draft}
                rows={1}
                maxLength={2000}
                placeholder="输入功能或操作问题…"
                onChange={(event) => resizeTextarea(event.target.value)}
                onKeyDown={handleComposerKeyDown}
              />
              {generating ? (
                <button
                  type="button"
                  className={styles.stopButton}
                  aria-label="停止生成"
                  onClick={stopGeneration}
                >
                  <Square size={16} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  className={styles.sendButton}
                  aria-label="发送问题"
                  disabled={!draft.trim()}
                >
                  <Send size={18} />
                </button>
              )}
            </form>
            <small>回答由 AI 生成，请结合网站实际功能核对。</small>
          </footer>
        </div>
      </dialog>
    </div>
  )
}
