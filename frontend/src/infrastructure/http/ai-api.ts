import { z } from 'zod'
import type {
  AgentDiscoveryResponse,
  AgentMessageRequest,
  AgentRunCreateRequest,
  AgentRunCreateResponse,
  AgentResourceUploadResponse,
  AiPlanRequest,
  AiPlanResponse,
} from '../../domain/models'
import { ApiError, apiRequest, resolveApiUrl } from './http-client'

const aiPlanStepSchema = z.object({
  title: z.string(),
  action: z.string(),
  output: z.string(),
  completionCriteria: z.string(),
  estimatedMinutes: z.number().nonnegative(),
  pomodoroCount: z.number().int().nonnegative(),
})

const aiPlanResponseSchema = z.object({
  requestId: z.string(),
  chatId: z.string(),
  pomodoroMinutes: z.number().min(5).max(120),
  plan: z.object({
    goal: z.string(),
    assumptions: z.array(z.string()),
    tasks: z.array(aiPlanStepSchema).min(1),
    completionSign: z.string(),
    firstAction: z.string(),
  }),
})

const agentDiscoveryResponseSchema = z.object({
  requestId: z.string(),
  runId: z.string(),
  chatId: z.string(),
  assistantMessage: z.string().min(1),
  readiness: z.enum(['collecting', 'ready']),
  collected: z.object({
    goal: z.string().nullable(),
    currentState: z.string().nullable(),
    deadline: z.string().nullable(),
    availableTime: z.string().nullable(),
    constraints: z.array(z.string()),
    completionCriteria: z.string().nullable(),
  }),
  missingFields: z.array(z.string()),
  planRequest: z
    .object({
      goal: z.string().min(1),
      context: z.string(),
    })
    .nullable(),
})

const agentResourceUploadResponseSchema = z.object({
  requestId: z.string(),
  chatId: z.string(),
  resources: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['document', 'image', 'file', 'folder']),
      name: z.string(),
    }),
  ),
})

const agentRunCreateResponseSchema = z.object({
  runId: z.string(),
  chatId: z.string(),
  status: z.enum(['created', 'running']),
  createdAt: z.string(),
})

export const AI_PLAN_ENDPOINT = '/api/tomato-assistant/plans'
export const AGENT_RUNS_ENDPOINT = '/api/tomato-assistant/agent/runs'

export function agentMessageEndpoint(runId: string): string {
  return `${AGENT_RUNS_ENDPOINT}/${encodeURIComponent(runId)}/messages`
}

export function agentResourceEndpoint(runId: string): string {
  return `${AGENT_RUNS_ENDPOINT}/${encodeURIComponent(runId)}/resources`
}

export async function checkAiService(signal?: AbortSignal): Promise<boolean> {
  const response = await apiRequest<unknown>('/api/health', {
    method: 'GET',
    ...(signal === undefined ? {} : { signal }),
  })
  return response === 'ok' || (typeof response === 'object' && response !== null)
}

export async function createAiTaskPlan(
  request: AiPlanRequest,
  signal?: AbortSignal,
): Promise<AiPlanResponse> {
  const response = await apiRequest<unknown>(AI_PLAN_ENDPOINT, {
    method: 'POST',
    body: request,
    ...(signal === undefined ? {} : { signal }),
  })
  return aiPlanResponseSchema.parse(response)
}

export async function sendAgentMessage(
  request: AgentMessageRequest,
  signal?: AbortSignal,
): Promise<AgentDiscoveryResponse> {
  const { runId, ...body } = request
  const response = await apiRequest<unknown>(agentMessageEndpoint(runId), {
    method: 'POST',
    body,
    ...(signal === undefined ? {} : { signal }),
  })
  return agentDiscoveryResponseSchema.parse(response)
}

export async function uploadAgentResources(
  runId: string,
  chatId: string,
  files: File[],
  signal?: AbortSignal,
): Promise<AgentResourceUploadResponse> {
  const body = new FormData()
  body.set('chatId', chatId)
  for (const file of files) {
    body.append('files', file)
    body.append('paths', file.webkitRelativePath || file.name)
  }
  const response = await fetch(resolveApiUrl(agentResourceEndpoint(runId)), {
    method: 'POST',
    body,
    ...(signal === undefined ? {} : { signal }),
  })
  const responseBody = (await response.json()) as unknown
  if (!response.ok) {
    throw new ApiError(`Resource upload failed with HTTP ${response.status}.`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      body: responseBody,
    })
  }
  return agentResourceUploadResponseSchema.parse(responseBody)
}

export async function createAgentRun(
  request: AgentRunCreateRequest,
  signal?: AbortSignal,
): Promise<AgentRunCreateResponse> {
  const response = await apiRequest<unknown>(AGENT_RUNS_ENDPOINT, {
    method: 'POST',
    body: request,
    ...(signal === undefined ? {} : { signal }),
  })
  return agentRunCreateResponseSchema.parse(response)
}
