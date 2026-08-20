import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Clipboard,
  Clock3,
  Flag,
  FolderPlus,
  GitBranch,
  LoaderCircle,
  MessageCircle,
  MessagesSquare,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Target,
  WandSparkles,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '../components/PageHeader'
import { AiWorkspaceTabs } from '../components/ai-workspace/AiWorkspaceTabs'
import {
  AgentToolbox,
  type AgentCapability,
  type AgentResourceDraft,
} from '../components/ai-workspace/AgentToolbox'
import {
  AgentRuntimeConfigPanel,
  DEFAULT_AGENT_RUNTIME,
} from '../components/ai-workspace/AgentRuntimeConfig'
import { PresetIcon } from '../components/PresetIcon'
import type {
  AgentDiscoveryResponse,
  AgentRuntimeConfig,
  AiPlanResponse,
  FocusPreset,
} from '../domain/models'
import { usePreferencesStore } from '../features/preferences/preferences-store'
import { useWorkspaceStore } from '../features/workspace/workspace-store'
import {
  checkAiService,
  createAgentRun,
  createAiTaskPlan,
  sendAgentMessage,
  uploadAgentResources,
} from '../infrastructure/http/ai-api'
import { ApiError } from '../infrastructure/http/http-client'
import styles from './AiStudioPage.module.css'

type ServiceState = 'checking' | 'online' | 'offline'
type PlannerMode = 'direct' | 'agent'
type AgentMessage = { id: string; role: 'assistant' | 'user'; content: string }
type AgentTraceEvent = {
  id: string
  type: 'run' | 'message' | 'resource' | 'agent' | 'plan' | 'error'
  timestamp: string
  title: string
  detail: string
}

const INITIAL_AGENT_MESSAGE: AgentMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '我们先不急着拆任务。请告诉我：你想完成什么，以及为什么现在想推进这件事？',
}

const collectedFields = [
  { key: 'goal', label: '目标', icon: Target },
  { key: 'currentState', label: '当前进度', icon: Clock3 },
  { key: 'deadline', label: '期限', icon: CalendarDays },
  { key: 'availableTime', label: '可用时间', icon: Clock3 },
  { key: 'constraints', label: '约束', icon: Flag },
  { key: 'completionCriteria', label: '完成标准', icon: CheckCircle2 },
] as const

const INITIAL_AGENT_CAPABILITIES: AgentCapability[] = [
  {
    id: 'skill-requirement-interview',
    kind: 'skill',
    name: '需求访谈',
    description: '通过追问澄清目标、约束和完成标准',
    source: 'preset',
    enabled: true,
  },
  {
    id: 'skill-document-reading',
    kind: 'skill',
    name: '文档研读',
    description: '阅读用户提供的文档、图片与文件夹资料',
    source: 'preset',
    enabled: true,
  },
  {
    id: 'skill-task-decomposition',
    kind: 'skill',
    name: '任务拆解',
    description: '把明确需求转换为番茄任务计划',
    source: 'preset',
    enabled: true,
  },
  {
    id: 'mcp-study-workspace',
    kind: 'mcp',
    name: '学习数据',
    description: '读取项目、任务和专注记录，后端 MCP 服务待实现',
    source: 'preset',
    enabled: false,
  },
]

const CAPABILITY_STORAGE_KEY = 'studyflow.agent-custom-capabilities'

function loadCustomCapabilities(): AgentCapability[] {
  try {
    const stored = JSON.parse(localStorage.getItem(CAPABILITY_STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(stored)) return []
    return stored.filter((item): item is AgentCapability => {
      if (!item || typeof item !== 'object') return false
      const capability = item as Partial<AgentCapability>
      return (
        typeof capability.id === 'string' &&
        typeof capability.name === 'string' &&
        typeof capability.description === 'string' &&
        ['skill', 'mcp', 'tool'].includes(capability.kind ?? '') &&
        capability.source === 'custom' &&
        typeof capability.enabled === 'boolean'
      )
    })
  } catch {
    return []
  }
}

function isPresetAvailable(preset: FocusPreset): boolean {
  return (
    Number.isInteger(preset.focusMinutes) && preset.focusMinutes >= 5 && preset.focusMinutes <= 120
  )
}

function planText(response: AiPlanResponse): string {
  const { plan } = response
  const tasks = plan.tasks.map(
    (task, index) =>
      `${index + 1}. ${task.title}\n行动：${task.action}\n产出：${task.output}\n完成标准：${task.completionCriteria}\n预计：${task.pomodoroCount} 颗 / ${task.estimatedMinutes} 分钟`,
  )
  return [
    `【${plan.goal}】`,
    plan.assumptions.length ? `拆解前提：${plan.assumptions.join('；')}` : '',
    `完成标志：${plan.completionSign}`,
    '',
    ...tasks,
    '',
    `立即开始：${plan.firstAction}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return '后端响应结构与约定不一致，请检查结构化输出字段。'
  if (error instanceof ApiError) {
    if (error.details.status === 400 || error.details.status === 422)
      return '目标或番茄时长未通过后端校验，请调整后重试。'
    if (error.details.status >= 500) return 'AI 服务暂时不可用，请稍后重试。'
    return `请求失败（HTTP ${error.details.status}）。`
  }
  if (error instanceof DOMException && error.name === 'AbortError')
    return 'AI 服务响应超时，请稍后重试。'
  if (error instanceof TypeError) return '无法连接 AI 服务，请确认 Spring Boot 后端已经启动。'
  return error instanceof Error ? error.message : '生成计划时发生未知错误。'
}

function PresetChooser({
  presets,
  selectedPresetId,
  expanded,
  onSelect,
  onToggle,
}: {
  presets: FocusPreset[]
  selectedPresetId: string
  expanded: boolean
  onSelect: (presetId: string) => void
  onToggle: () => void
}) {
  const visiblePresets = expanded ? presets : presets.slice(0, 4)
  return (
    <fieldset>
      <legend>选择拆解节奏</legend>
      <div className={styles.presetGrid}>
        {visiblePresets.map((preset) => {
          const unavailable = !isPresetAvailable(preset)
          return (
            <button
              key={preset.id}
              type="button"
              className={preset.id === selectedPresetId ? styles.selectedPreset : styles.preset}
              onClick={() => onSelect(preset.id)}
              disabled={unavailable}
              title={unavailable ? 'AI 拆解仅支持 5 至 120 分钟的整数专注时长' : preset.description}
            >
              <span>
                <PresetIcon name={preset.icon} />
              </span>
              <div>
                <strong>{preset.name}</strong>
                <small>
                  {unavailable
                    ? '不适用于 AI 拆解'
                    : `${preset.focusMinutes} 分钟专注 · ${preset.shortBreakMinutes} 分钟休息`}
                </small>
              </div>
              {preset.id === selectedPresetId ? <Check /> : null}
            </button>
          )
        })}
      </div>
      {presets.length > 4 ? (
        <button className={styles.expandButton} type="button" onClick={onToggle}>
          {expanded ? <ChevronUp /> : <ChevronDown />}
          {expanded ? '收起方案' : `查看全部 ${presets.length} 个方案`}
        </button>
      ) : null}
    </fieldset>
  )
}

function AgentTrace({
  runId,
  runtime,
  events,
}: {
  runId: string | null
  runtime: AgentRuntimeConfig
  events: AgentTraceEvent[]
}) {
  return (
    <div className={styles.tracePanel}>
      <header className={styles.discoveryHeader}>
        <div>
          <span>RUN TRAJECTORY</span>
          <h2>{runId ? '本次运行的追加式轨迹' : '运行后在这里查看完整轨迹'}</h2>
        </div>
        <GitBranch />
      </header>
      <div className={styles.traceSnapshot}>
        <div>
          <small>Agent Loop</small>
          <strong>{runtime.loop.name}</strong>
        </div>
        <div>
          <small>模型</small>
          <strong>{runtime.model.name}</strong>
        </div>
        <div>
          <small>调度</small>
          <strong>{runtime.scheduler.name}</strong>
        </div>
      </div>
      {runId ? <code className={styles.runId}>Run ID · {runId}</code> : null}
      {events.length ? (
        <ol className={styles.traceTimeline}>
          {events.map((event) => (
            <li key={event.id} data-type={event.type}>
              <i />
              <div>
                <span>
                  <strong>{event.title}</strong>
                  <time>{new Date(event.timestamp).toLocaleTimeString('zh-CN')}</time>
                </span>
                <p>{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.traceEmpty}>
          <GitBranch />
          <strong>尚未开始运行</strong>
          <p>首次发送消息时创建 Run，并锁定模型、Loop、调度与能力配置快照。</p>
        </div>
      )}
    </div>
  )
}

export default function AiStudioPage() {
  const presets = usePreferencesStore((state) => state.presets)
  const order = usePreferencesStore((state) => state.presetOrder)
  const activePresetId = usePreferencesStore((state) => state.activePresetId)
  const projects = useWorkspaceStore((state) => state.projects)
  const addProject = useWorkspaceStore((state) => state.addProject)
  const updateProject = useWorkspaceStore((state) => state.updateProject)
  const addTask = useWorkspaceStore((state) => state.addTask)
  const [mode, setMode] = useState<PlannerMode>('direct')
  const [presetId, setPresetId] = useState(activePresetId)
  const [expanded, setExpanded] = useState(false)
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [agentChatId, setAgentChatId] = useState<string>(() => crypto.randomUUID())
  const [agentRunId, setAgentRunId] = useState<string | null>(null)
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([INITIAL_AGENT_MESSAGE])
  const [agentInput, setAgentInput] = useState('')
  const [agentSending, setAgentSending] = useState(false)
  const [discovery, setDiscovery] = useState<AgentDiscoveryResponse | null>(null)
  const [agentResources, setAgentResources] = useState<AgentResourceDraft[]>([])
  const [agentCapabilities, setAgentCapabilities] = useState<AgentCapability[]>(() => [
    ...INITIAL_AGENT_CAPABILITIES,
    ...loadCustomCapabilities(),
  ])
  const [agentRuntime, setAgentRuntime] = useState(DEFAULT_AGENT_RUNTIME)
  const [traceEvents, setTraceEvents] = useState<AgentTraceEvent[]>([])
  const [agentPanelView, setAgentPanelView] = useState<'profile' | 'plan' | 'trace' | null>(null)
  const [serviceState, setServiceState] = useState<ServiceState>('checking')
  const [generating, setGenerating] = useState(false)
  const [response, setResponse] = useState<AiPlanResponse | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showSave, setShowSave] = useState(false)
  const [saveMode, setSaveMode] = useState<'existing' | 'new'>('new')
  const [targetProjectId, setTargetProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [preferredPresetId, setPreferredPresetId] = useState<string>(presetId)

  const ordered = useMemo(() => {
    const positions = new Map(order.map((id, index) => [id, index]))
    return [...presets].sort(
      (left, right) =>
        (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }, [order, presets])
  const fallbackPreset =
    ordered.find((preset) => preset.id === activePresetId) ??
    ordered.find((preset) => preset.id === 'classic') ??
    ordered[0] ??
    null
  const selected = ordered.find((preset) => preset.id === presetId) ?? fallbackPreset
  const selectedPresetId = selected?.id ?? ''
  const activeProjects = projects.filter((project) => !project.archived)

  useEffect(() => {
    const controller = new AbortController()
    void checkAiService(controller.signal)
      .then((online) => setServiceState(online ? 'online' : 'offline'))
      .catch(() => setServiceState('offline'))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    localStorage.setItem(
      CAPABILITY_STORAGE_KEY,
      JSON.stringify(agentCapabilities.filter((capability) => capability.source === 'custom')),
    )
  }, [agentCapabilities])

  async function refreshHealth() {
    setServiceState('checking')
    try {
      setServiceState((await checkAiService()) ? 'online' : 'offline')
    } catch {
      setServiceState('offline')
    }
  }

  function switchMode(nextMode: PlannerMode) {
    setMode(nextMode)
    setResponse(null)
    setError('')
    setNotice('')
    setShowSave(false)
  }

  function appendTrace(event: Omit<AgentTraceEvent, 'id' | 'timestamp'>) {
    setTraceEvents((items) => [
      ...items,
      { ...event, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
    ])
  }

  function resetAgentRun() {
    setAgentRunId(null)
    setAgentChatId(crypto.randomUUID())
    setAgentMessages([INITIAL_AGENT_MESSAGE])
    setAgentInput('')
    setAgentResources([])
    setDiscovery(null)
    setTraceEvents([])
    setResponse(null)
    setError('')
    setNotice('')
    setAgentPanelView(null)
  }

  async function generatePlan(planGoal: string, planContext: string, chatId: string) {
    if (!selected || !isPresetAvailable(selected)) return
    setGenerating(true)
    setError('')
    setNotice('')
    setResponse(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 90_000)
    try {
      const result = await createAiTaskPlan(
        {
          goal: planGoal,
          context: planContext,
          pomodoroMinutes: selected.focusMinutes,
          chatId,
        },
        controller.signal,
      )
      setResponse(result)
      setProjectName(result.plan.goal)
      setProjectDescription(result.plan.completionSign)
      setPreferredPresetId(selected.id)
      setServiceState('online')
      return result
    } catch (requestError) {
      setError(errorMessage(requestError))
      if (requestError instanceof TypeError) setServiceState('offline')
    } finally {
      window.clearTimeout(timeout)
      setGenerating(false)
    }
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!goal.trim()) return
    await generatePlan(goal.trim(), context.trim(), crypto.randomUUID())
  }

  async function submitAgentMessage(event: FormEvent) {
    event.preventDefault()
    const typedMessage = agentInput.trim()
    const message =
      typedMessage || (agentResources.length ? '请阅读这些资料，并继续梳理我的任务需求。' : '')
    if (!message || !selected || !isPresetAvailable(selected) || agentSending) return
    const turnResources = [...agentResources]
    const attachmentLabel = turnResources.length
      ? `\n\n已附加：${turnResources.map((item) => item.name).join('、')}`
      : ''
    setAgentMessages((items) => [
      ...items,
      { id: crypto.randomUUID(), role: 'user', content: `${message}${attachmentLabel}` },
    ])
    setAgentInput('')
    setAgentSending(true)
    setError('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 90_000)
    try {
      const enabledCapabilities = agentCapabilities
        .filter((capability) => capability.enabled)
        .map(({ id, kind, name, source }) => ({ id, kind, name, source }))
      let runId = agentRunId
      let chatId = agentChatId
      if (!runId) {
        const run = await createAgentRun(
          {
            clientRunId: crypto.randomUUID(),
            runtime: agentRuntime,
            capabilities: enabledCapabilities,
          },
          controller.signal,
        )
        runId = run.runId
        chatId = run.chatId
        setAgentRunId(run.runId)
        setAgentChatId(run.chatId)
        appendTrace({
          type: 'run',
          title: '运行已创建',
          detail: `${agentRuntime.loop.name} · ${agentRuntime.model.name} · ${agentRuntime.scheduler.name}`,
        })
      }
      const files = turnResources.flatMap((resource) => resource.files)
      const upload = files.length
        ? await uploadAgentResources(runId, chatId, files, controller.signal)
        : null
      if (turnResources.length)
        appendTrace({
          type: 'resource',
          title: '上下文资源已挂载',
          detail: turnResources.map((resource) => resource.name).join('、'),
        })
      appendTrace({ type: 'message', title: '用户输入', detail: message })
      const result = await sendAgentMessage(
        {
          runId,
          chatId,
          message,
          pomodoroMinutes: selected.focusMinutes,
          resourceIds: upload?.resources.map((resource) => resource.id) ?? [],
          links: turnResources.flatMap((resource) => (resource.url ? [resource.url] : [])),
          capabilities: enabledCapabilities,
        },
        controller.signal,
      )
      setAgentChatId(result.chatId)
      setDiscovery(result)
      setAgentMessages((items) => [
        ...items,
        { id: result.requestId, role: 'assistant', content: result.assistantMessage },
      ])
      setAgentResources([])
      setServiceState('online')
      appendTrace({
        type: 'agent',
        title: result.readiness === 'ready' ? '信息收集完成' : 'Agent 继续梳理',
        detail: result.assistantMessage,
      })
      if (result.readiness === 'ready') setAgentPanelView('profile')
    } catch (requestError) {
      setError(errorMessage(requestError))
      appendTrace({ type: 'error', title: '运行发生错误', detail: errorMessage(requestError) })
      if (requestError instanceof TypeError) setServiceState('offline')
    } finally {
      window.clearTimeout(timeout)
      setAgentSending(false)
    }
  }

  async function generateAgentPlan() {
    if (discovery?.readiness !== 'ready' || !discovery.planRequest) return
    setGoal(discovery.planRequest.goal)
    setContext(discovery.planRequest.context)
    appendTrace({
      type: 'plan',
      title: '请求结构化拆解',
      detail: discovery.planRequest.goal,
    })
    const result = await generatePlan(
      discovery.planRequest.goal,
      discovery.planRequest.context,
      discovery.chatId,
    )
    if (result) {
      appendTrace({
        type: 'plan',
        title: '结构化计划已生成',
        detail: `${result.plan.tasks.length} 个任务 · ${result.pomodoroMinutes} 分钟节奏`,
      })
      setAgentPanelView('plan')
    }
  }

  async function copyPlan() {
    if (!response) return
    await navigator.clipboard.writeText(planText(response))
    setNotice('计划已复制到剪贴板。')
  }

  function savePlan(event: FormEvent) {
    event.preventDefault()
    if (!response) return
    let projectId = targetProjectId
    if (saveMode === 'new') {
      if (!projectName.trim()) return
      projectId = addProject({
        name: projectName,
        description: projectDescription,
        preferredFocusPresetId: preferredPresetId || null,
      }).id
    } else {
      const project = projects.find((item) => item.id === projectId)
      if (!project) return
      updateProject(project.id, {
        name: project.name,
        description: project.description,
        preferredFocusPresetId: preferredPresetId || null,
      })
    }
    for (const task of response.plan.tasks)
      addTask(projectId, {
        name: task.title,
        description: `${task.action}\n\n产出：${task.output}\n完成标准：${task.completionCriteria}`,
        url: '',
        estimatedMinutes: task.estimatedMinutes,
      })
    setShowSave(false)
    setNotice(`已保存 ${response.plan.tasks.length} 个任务。`)
  }

  const presetUnavailable = !selected || !isPresetAvailable(selected)
  return (
    <>
      <PageHeader
        eyebrow="AI STUDIO"
        title="番茄智库"
        description="把目标交给 AI，按你熟悉的番茄节奏拆成今天就能开始的动作。"
        actions={
          <button
            className={styles.serviceStatus}
            type="button"
            onClick={() => void refreshHealth()}
          >
            {serviceState === 'checking' ? (
              <LoaderCircle className={styles.spin} />
            ) : serviceState === 'online' ? (
              <Wifi />
            ) : (
              <WifiOff />
            )}
            {serviceState === 'checking'
              ? '正在检测'
              : serviceState === 'online'
                ? 'AI 服务在线'
                : 'AI 服务离线'}
            <RefreshCw />
          </button>
        }
      />
      <AiWorkspaceTabs active="planner" />
      <div className={`${styles.layout} ${mode === 'agent' ? styles.agentLayout : ''}`}>
        <section className={styles.composer}>
          <div className={styles.assistant}>
            <span>
              <Bot />
            </span>
            <div>
              <strong>目标拆解助手</strong>
              <small>{mode === 'direct' ? '输入清楚，立即生成计划' : '先聊清楚，再开始拆解'}</small>
            </div>
          </div>
          <div className={styles.modeSwitch} role="tablist" aria-label="拆解方式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'direct'}
              className={mode === 'direct' ? styles.modeActive : ''}
              onClick={() => switchMode('direct')}
            >
              <Zap />
              <span>
                <strong>直接拆解</strong>
                <small>目标已经比较清楚</small>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'agent'}
              className={mode === 'agent' ? styles.modeActive : ''}
              onClick={() => switchMode('agent')}
            >
              <MessagesSquare />
              <span>
                <strong>Agent 梳理</strong>
                <small>通过对话理清需求</small>
              </span>
            </button>
          </div>
          {mode === 'direct' ? (
            <form onSubmit={(event) => void submit(event)}>
              <label className={styles.field}>
                <span>这次想完成什么？</span>
                <textarea
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="例如：两周内完成 Spring AI 的 RAG 功能并准备面试演示"
                  rows={4}
                  maxLength={800}
                />
              </label>
              <label className={styles.field}>
                <span>
                  背景与约束 <small>可选</small>
                </span>
                <textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder="已有进度、每天可用时间、截止日期、最担心的难点……"
                  rows={3}
                  maxLength={1600}
                />
              </label>
              <PresetChooser
                presets={ordered}
                selectedPresetId={selectedPresetId}
                expanded={expanded}
                onSelect={setPresetId}
                onToggle={() => setExpanded((value) => !value)}
              />
              <div className={presetUnavailable ? styles.currentError : styles.current}>
                {presetUnavailable ? <AlertCircle /> : <Sparkles />}
                <span>本次拆解</span>
                <strong>
                  {selected ? `${selected.name} · ${selected.focusMinutes} 分钟` : '暂无可用方案'}
                </strong>
              </div>
              {error ? (
                <div className={styles.error} role="alert">
                  <AlertCircle />
                  <span>{error}</span>
                </div>
              ) : null}
              <button
                className={styles.submit}
                type="submit"
                disabled={!goal.trim() || presetUnavailable || generating}
              >
                {generating ? <LoaderCircle className={styles.spin} /> : <WandSparkles />}
                {generating ? '正在生成计划' : '开始拆解'}
                <ArrowRight />
              </button>
            </form>
          ) : (
            <div className={styles.agentWorkspace}>
              <div className={styles.agentControlColumn}>
                <PresetChooser
                  presets={ordered}
                  selectedPresetId={selectedPresetId}
                  expanded={expanded}
                  onSelect={setPresetId}
                  onToggle={() => setExpanded((value) => !value)}
                />
                <AgentRuntimeConfigPanel
                  value={agentRuntime}
                  onChange={setAgentRuntime}
                  disabled={agentRunId !== null}
                />
                <AgentToolbox
                  capabilities={agentCapabilities}
                  resources={agentResources}
                  onToggleCapability={(id) =>
                    setAgentCapabilities((items) =>
                      items.map((item) =>
                        item.id === id ? { ...item, enabled: !item.enabled } : item,
                      ),
                    )
                  }
                  onAddCapability={(capability) =>
                    setAgentCapabilities((items) => [...items, capability])
                  }
                  onRemoveCapability={(id) =>
                    setAgentCapabilities((items) =>
                      items.filter((item) => item.id !== id || item.source === 'preset'),
                    )
                  }
                  onAddResources={(resources) =>
                    setAgentResources((items) => [...items, ...resources])
                  }
                  onRemoveResource={(id) =>
                    setAgentResources((items) => items.filter((item) => item.id !== id))
                  }
                />
              </div>
              <section className={styles.agentChatColumn}>
                <header className={styles.agentChatHeader}>
                  <div>
                    <MessagesSquare />
                    <span>
                      <strong>对话与上下文</strong>
                      <small>
                        {agentMessages.length - 1} 轮对话 · {agentResources.length} 项待发送资料
                      </small>
                    </span>
                  </div>
                  <code>{agentRunId ? `RUN ${agentRunId.slice(0, 8)}` : '尚未创建 Run'}</code>
                </header>
                <div className={styles.agentThread} aria-live="polite">
                  {agentMessages.map((message) => (
                    <article
                      key={message.id}
                      className={
                        message.role === 'assistant' ? styles.agentReply : styles.userReply
                      }
                    >
                      <span>{message.role === 'assistant' ? <Bot /> : '你'}</span>
                      <p>{message.content}</p>
                    </article>
                  ))}
                  {agentSending ? (
                    <div className={styles.agentThinking}>
                      <LoaderCircle className={styles.spin} />
                      正在整理你刚才提供的信息…
                    </div>
                  ) : null}
                </div>
                {error ? (
                  <div className={styles.error} role="alert">
                    <AlertCircle />
                    <span>{error}</span>
                  </div>
                ) : null}
                <form
                  className={styles.agentComposer}
                  onSubmit={(event) => void submitAgentMessage(event)}
                >
                  <textarea
                    value={agentInput}
                    onChange={(event) => setAgentInput(event.target.value)}
                    placeholder="把目标、限制、已有资料或刚想到的细节告诉 Agent…"
                    rows={4}
                    maxLength={4000}
                    aria-label="回复拆解助手"
                  />
                  <button
                    type="submit"
                    disabled={
                      (!agentInput.trim() && !agentResources.length) ||
                      agentSending ||
                      presetUnavailable
                    }
                    aria-label="发送消息"
                  >
                    <Send />
                  </button>
                </form>
                <small className={styles.agentHint}>
                  Agent 会持续保留本次 Run 的上下文，并在信息充分后邀请你生成计划。
                </small>
              </section>
            </div>
          )}
        </section>
        <section className={styles.result} aria-live="polite">
          {mode === 'agent' ? (
            <div className={styles.agentSidePanel}>
              <div className={styles.agentPanelToolbar}>
                <div role="tablist" aria-label="Agent 运行信息">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={agentPanelView === 'profile'}
                    className={agentPanelView === 'profile' ? styles.panelTabActive : ''}
                    onClick={() =>
                      setAgentPanelView(agentPanelView === 'profile' ? null : 'profile')
                    }
                  >
                    <Target />
                    需求画像
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={agentPanelView === 'plan'}
                    className={agentPanelView === 'plan' ? styles.panelTabActive : ''}
                    onClick={() => setAgentPanelView(agentPanelView === 'plan' ? null : 'plan')}
                    disabled={!response}
                  >
                    <Clipboard />
                    最终计划
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={agentPanelView === 'trace'}
                    className={agentPanelView === 'trace' ? styles.panelTabActive : ''}
                    onClick={() => setAgentPanelView(agentPanelView === 'trace' ? null : 'trace')}
                  >
                    <GitBranch />
                    运行轨迹
                  </button>
                </div>
                <div className={styles.agentPanelActions}>
                  {agentPanelView ? (
                    <button
                      type="button"
                      onClick={() => setAgentPanelView(null)}
                      aria-label="收起辅助视图"
                      title="收起"
                    >
                      <X />
                    </button>
                  ) : null}
                  <button type="button" onClick={resetAgentRun}>
                    <Plus />
                    新建运行
                  </button>
                </div>
              </div>
              {agentPanelView === 'trace' ? (
                <AgentTrace runId={agentRunId} runtime={agentRuntime} events={traceEvents} />
              ) : agentPanelView === 'plan' && response ? (
                <div className={styles.compactPlan}>
                  <header className={styles.resultHeader}>
                    <div>
                      <span>最终计划</span>
                      <h2>{response.plan.goal}</h2>
                    </div>
                    <button
                      className={styles.iconButton}
                      type="button"
                      onClick={() => void copyPlan()}
                      title="复制计划"
                      aria-label="复制计划"
                    >
                      <Clipboard />
                    </button>
                  </header>
                  <ol className={styles.taskList}>
                    {response.plan.tasks.map((task, index) => (
                      <li key={`${task.title}-${index}`}>
                        <span>{index + 1}</span>
                        <div>
                          <h3>{task.title}</h3>
                          <p>{task.action}</p>
                          <small>
                            {task.pomodoroCount} 颗番茄 · 约 {task.estimatedMinutes} 分钟
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className={styles.finish}>
                    <CircleCheck />
                    <div>
                      <small>完成标志</small>
                      <strong>{response.plan.completionSign}</strong>
                      <p>立即开始：{response.plan.firstAction}</p>
                    </div>
                  </div>
                  <div className={styles.resultActions}>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => void copyPlan()}
                    >
                      <Clipboard />
                      复制
                    </button>
                    <button type="button" onClick={() => setShowSave((value) => !value)}>
                      <Save />
                      保存到项目
                    </button>
                  </div>
                  {showSave ? (
                    <form className={styles.savePanel} onSubmit={savePlan}>
                      <div className={styles.segmented}>
                        <button
                          type="button"
                          className={saveMode === 'new' ? styles.segmentActive : ''}
                          onClick={() => setSaveMode('new')}
                        >
                          <FolderPlus />
                          新项目
                        </button>
                        <button
                          type="button"
                          className={saveMode === 'existing' ? styles.segmentActive : ''}
                          onClick={() => setSaveMode('existing')}
                        >
                          <Save />
                          已有项目
                        </button>
                      </div>
                      {saveMode === 'new' ? (
                        <>
                          <label>
                            项目名称
                            <input
                              value={projectName}
                              onChange={(event) => setProjectName(event.target.value)}
                              required
                            />
                          </label>
                          <label>
                            项目描述
                            <textarea
                              value={projectDescription}
                              onChange={(event) => setProjectDescription(event.target.value)}
                              rows={2}
                            />
                          </label>
                        </>
                      ) : (
                        <label>
                          选择项目
                          <select
                            value={targetProjectId}
                            onChange={(event) => setTargetProjectId(event.target.value)}
                            required
                          >
                            <option value="">请选择</option>
                            {activeProjects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        偏好节奏
                        <select
                          value={preferredPresetId}
                          onChange={(event) => setPreferredPresetId(event.target.value)}
                        >
                          <option value="">跟随当前方案</option>
                          {ordered.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name} · {preset.focusMinutes} 分钟
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        disabled={saveMode === 'existing' ? !targetProjectId : !projectName.trim()}
                      >
                        <Check />
                        确认保存
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : agentPanelView === 'profile' ? (
                <div className={styles.discoveryPanel}>
                  <header className={styles.discoveryHeader}>
                    <div>
                      <span>需求画像</span>
                      <h2>把模糊想法整理成可拆解输入</h2>
                    </div>
                    <MessagesSquare />
                  </header>
                  <div className={styles.discoveryProgress}>
                    <div>
                      <strong>
                        {discovery
                          ? collectedFields.filter((field) => {
                              const value = discovery.collected[field.key]
                              return Array.isArray(value) ? value.length > 0 : Boolean(value)
                            }).length
                          : 0}
                        /{collectedFields.length}
                      </strong>
                      <span>项关键信息已明确</span>
                    </div>
                    <div>
                      <i
                        style={{
                          width: `${
                            discovery
                              ? (collectedFields.filter((field) => {
                                  const value = discovery.collected[field.key]
                                  return Array.isArray(value) ? value.length > 0 : Boolean(value)
                                }).length /
                                  collectedFields.length) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className={styles.collectedList}>
                    {collectedFields.map((field) => {
                      const Icon = field.icon
                      const rawValue = discovery?.collected[field.key]
                      const value = Array.isArray(rawValue) ? rawValue.join('；') : rawValue
                      return (
                        <div key={field.key} className={value ? styles.collected : ''}>
                          <span>
                            <Icon />
                          </span>
                          <div>
                            <small>{field.label}</small>
                            <strong>{value || '等待对话补充'}</strong>
                          </div>
                          {value ? <CheckCircle2 /> : null}
                        </div>
                      )
                    })}
                  </div>
                  {discovery?.readiness === 'ready' && discovery.planRequest ? (
                    <section className={styles.readyCard}>
                      <div>
                        <CircleCheck />
                        <span>
                          <small>信息收集完成</small>
                          <strong>我已收集到足够的信息</strong>
                        </span>
                      </div>
                      <p>目标、约束和完成标准已经能够支持一次可靠的结构化拆解。</p>
                      <button
                        type="button"
                        onClick={() => void generateAgentPlan()}
                        disabled={generating || presetUnavailable}
                      >
                        {generating ? <LoaderCircle className={styles.spin} /> : <WandSparkles />}
                        {generating ? '正在进行拆解' : '现在进行拆解'}
                        <ArrowRight />
                      </button>
                    </section>
                  ) : (
                    <section className={styles.missingCard}>
                      <Sparkles />
                      <div>
                        <strong>仍在梳理中</strong>
                        <p>
                          {discovery?.missingFields.length
                            ? `接下来需要确认：${discovery.missingFields.join('、')}`
                            : '继续在上方聊天区补充信息，Agent 会逐步更新画像。'}
                        </p>
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className={styles.agentPanelSummary}>
                  <span>
                    <MessagesSquare />
                    <strong>聊天是当前主工作区</strong>
                  </span>
                  <p>需求画像、最终计划和每次运行的追加式轨迹会保留在这里，按需展开即可。</p>
                  <code>
                    {agentRunId ? `Run ID · ${agentRunId}` : '发送第一条消息后创建可追溯 Run'}
                  </code>
                </div>
              )}
            </div>
          ) : response ? (
            <>
              <header className={styles.resultHeader}>
                <div>
                  <span>可执行计划</span>
                  <h2>{response.plan.goal}</h2>
                </div>
                <button
                  className={styles.iconButton}
                  type="button"
                  onClick={() => void copyPlan()}
                  title="复制计划"
                  aria-label="复制计划"
                >
                  <Clipboard />
                </button>
              </header>
              {response.plan.assumptions.length ? (
                <div className={styles.assumptions}>
                  <Sparkles />
                  <p>{response.plan.assumptions.join('；')}</p>
                </div>
              ) : null}
              <ol className={styles.taskList}>
                {response.plan.tasks.map((task, index) => (
                  <li key={`${task.title}-${index}`}>
                    <span>{index + 1}</span>
                    <div>
                      <h3>{task.title}</h3>
                      <p>{task.action}</p>
                      <dl>
                        <div>
                          <dt>产出</dt>
                          <dd>{task.output}</dd>
                        </div>
                        <div>
                          <dt>完成标准</dt>
                          <dd>{task.completionCriteria}</dd>
                        </div>
                      </dl>
                      <small>
                        {task.pomodoroCount} 颗番茄 · 约 {task.estimatedMinutes} 分钟
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
              <div className={styles.finish}>
                <CircleCheck />
                <div>
                  <small>完成标志</small>
                  <strong>{response.plan.completionSign}</strong>
                  <p>立即开始：{response.plan.firstAction}</p>
                </div>
              </div>
              {notice ? <p className={styles.notice}>{notice}</p> : null}
              <div className={styles.resultActions}>
                <button type="button" className={styles.secondary} onClick={() => void copyPlan()}>
                  <Clipboard />
                  复制
                </button>
                <button type="button" onClick={() => setShowSave((value) => !value)}>
                  <Save />
                  保存到项目
                </button>
              </div>
              {showSave ? (
                <form className={styles.savePanel} onSubmit={savePlan}>
                  <div className={styles.segmented}>
                    <button
                      type="button"
                      className={saveMode === 'new' ? styles.segmentActive : ''}
                      onClick={() => setSaveMode('new')}
                    >
                      <FolderPlus />
                      新项目
                    </button>
                    <button
                      type="button"
                      className={saveMode === 'existing' ? styles.segmentActive : ''}
                      onClick={() => setSaveMode('existing')}
                    >
                      <Save />
                      已有项目
                    </button>
                  </div>
                  {saveMode === 'new' ? (
                    <>
                      <label>
                        项目名称
                        <input
                          value={projectName}
                          onChange={(event) => setProjectName(event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        项目描述
                        <textarea
                          value={projectDescription}
                          onChange={(event) => setProjectDescription(event.target.value)}
                          rows={2}
                        />
                      </label>
                    </>
                  ) : (
                    <label>
                      选择项目
                      <select
                        value={targetProjectId}
                        onChange={(event) => setTargetProjectId(event.target.value)}
                        required
                      >
                        <option value="">请选择</option>
                        {activeProjects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    偏好节奏
                    <select
                      value={preferredPresetId}
                      onChange={(event) => setPreferredPresetId(event.target.value)}
                    >
                      <option value="">跟随当前方案</option>
                      {ordered.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name} · {preset.focusMinutes} 分钟
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={saveMode === 'existing' ? !targetProjectId : !projectName.trim()}
                  >
                    <Check />
                    确认保存
                  </button>
                </form>
              ) : null}
              <small className={styles.requestId}>请求 ID：{response.requestId}</small>
            </>
          ) : (
            <div className={styles.empty}>
              <div>
                <Bot />
              </div>
              <h2>{generating ? '正在整理你的下一步' : '从一句目标开始'}</h2>
              <p>
                {generating
                  ? '正在把目标、约束与番茄节奏组织成可验证的小任务。'
                  : '清晰目标会直接拆解；信息不足时，结果会明确列出拆解前提。'}
              </p>
              <span>
                <MessageCircle />
                计划可复制，也可直接保存到任务空间
              </span>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
