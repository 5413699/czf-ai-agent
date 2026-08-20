import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentMessageEndpoint, sendAgentMessage } from './ai-api'

describe('agent discovery API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends one conversation turn and validates the structured readiness response', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId: 'request-1',
          runId: 'run-1',
          chatId: 'chat-1',
          assistantMessage: '信息已经足够，可以开始拆解。',
          readiness: 'ready',
          collected: {
            goal: '完成 RAG 演示',
            currentState: '已经完成检索原型',
            deadline: '本周日',
            availableTime: '每天晚上两小时',
            constraints: ['需要准备面试讲解'],
            completionCriteria: '能够现场演示并解释检索链路',
          },
          missingFields: [],
          planRequest: {
            goal: '本周完成可演示的 RAG 功能',
            context: '已有检索原型；每天晚上两小时；需要准备面试讲解。',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await sendAgentMessage({
      runId: 'run-1',
      chatId: 'chat-1',
      message: '我希望本周完成 RAG 演示。',
      pomodoroMinutes: 25,
      resourceIds: ['resource-1'],
      links: ['https://example.com/context'],
      capabilities: [
        {
          id: 'skill-requirement-interview',
          kind: 'skill',
          name: '需求访谈',
          source: 'preset',
        },
      ],
    })

    expect(response.readiness).toBe('ready')
    expect(response.planRequest?.goal).toContain('RAG')
    expect(fetchMock).toHaveBeenCalledWith(
      agentMessageEndpoint('run-1'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          chatId: 'chat-1',
          message: '我希望本周完成 RAG 演示。',
          pomodoroMinutes: 25,
          resourceIds: ['resource-1'],
          links: ['https://example.com/context'],
          capabilities: [
            {
              id: 'skill-requirement-interview',
              kind: 'skill',
              name: '需求访谈',
              source: 'preset',
            },
          ],
        }),
      }),
    )
  })
})
