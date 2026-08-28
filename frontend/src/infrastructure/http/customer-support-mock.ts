import type { CustomerSupportEvent, CustomerSupportRequest } from '../../domain/customer-support'
import { CustomerSupportStreamError } from './customer-support-api'

const answers: Array<[RegExp, string]> = [
  [
    /开始.*番茄|番茄.*开始/,
    '进入“专注”页面，先选择一个节奏方案，也可以关联项目或任务。确认本轮目标后点击“开始专注”，计时器会按方案自动衔接专注与休息。',
  ],
  [
    /创建.*项目|项目.*任务|创建.*任务/,
    '进入“任务”页面，先创建项目，再在项目中添加任务和子任务。你可以填写描述、预计用时、链接和偏好节奏；完成的任务和项目都可以归档。',
  ],
  [
    /番茄智库/,
    '“番茄智库”提供直接拆解和 Agent 梳理两种方式。目标明确时可直接生成结构化计划；想法还模糊时，可通过多轮对话补充资料，再让 Agent 生成计划。',
  ],
  [
    /数据.*哪里|保存.*哪里/,
    '第一阶段的数据保存在当前浏览器的本地存储中，包括项目、任务、偏好和当前客服会话。清除浏览器网站数据后可能无法恢复，建议定期在用户中心导出备份。',
  ],
  [
    /联系.*作者|作者.*联系/,
    '当前公开资料中还没有可确认的作者联系方式。请以项目 GitHub 仓库或网站后续公布的联系入口为准。',
  ],
  [
    /github|仓库.*地址|项目.*地址/i,
    '当前资料中没有找到可靠答案。项目公开仓库地址需要由作者在后端知识库中明确确认后才能展示。',
  ],
]

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

function chunks(text: string): string[] {
  const parts = text.match(/.{1,9}[，。；！？]?/gu)
  return parts?.length ? parts : [text]
}

export async function* streamMockCustomerSupport(
  request: CustomerSupportRequest,
  signal: AbortSignal,
): AsyncGenerator<CustomerSupportEvent> {
  yield {
    type: 'start',
    requestId: `mock-${crypto.randomUUID()}`,
    conversationId: request.conversationId,
    messageId: request.messageId,
  }
  await delay(260, signal)

  if (request.question.includes('[模拟断网]')) throw new CustomerSupportStreamError('unavailable')
  if (request.question.includes('[模拟超时]')) {
    await delay(60_000, signal)
    return
  }
  if (request.question.includes('[模拟拒绝]')) {
    yield { type: 'refusal', reason: 'safety' }
    return
  }

  const match = answers.find(([pattern]) => pattern.test(request.question))
  const answer = match?.[1]
  if (!answer || answer.startsWith('当前资料中没有找到可靠答案')) {
    yield { type: 'complete', outcome: 'empty', sources: [] }
    return
  }
  for (const text of chunks(answer)) {
    await delay(55, signal)
    yield { type: 'delta', text }
  }
  yield { type: 'complete', outcome: 'answered', sources: [] }
}
