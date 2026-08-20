export type Theme = 'day' | 'night' | 'eye'
export type TimerPhase = 'focus' | 'shortBreak' | 'longBreak'
export type TimerStatus = 'idle' | 'running' | 'paused' | 'waiting'
export type ClockStyle = 'orbit' | 'tomato-fill' | 'desk-card'

export interface ResourceLink {
  id: string
  title: string
  url: string
  description: string
}

export interface Subtask {
  id: string
  name: string
  description: string
  url: string
  estimatedMinutes: number
  completedPomodoros: number
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  name: string
  description: string
  url: string
  estimatedMinutes: number
  completedPomodoros: number
  archived: boolean
  createdAt: string
  updatedAt: string
  subtasks: Subtask[]
}

export interface Project {
  id: string
  name: string
  description: string
  preferredFocusPresetId: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
  tasks: Task[]
  resources: ResourceLink[]
}

export interface FocusAssignment {
  label: string
  projectId: string | null
  taskId: string | null
  subtaskId: string | null
}

export interface FocusRecord extends FocusAssignment {
  id: string
  phase: 'focus'
  durationSeconds: number
  startedAt: string
  completedAt: string
  round: number
  presetId: string | null
}

export interface PromptSoundSelection {
  startSoundId: string
  completeSoundId: string
  volume: number
}

export interface AmbientMixItem {
  id: string
  volume: number
}

export interface SoundscapeConfig {
  masterVolume: number
  musicId: string | null
  musicVolume: number
  ambient: AmbientMixItem[]
}

export interface FocusPreset {
  id: string
  name: string
  description: string
  icon: string
  builtIn: boolean
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakInterval: number
  autoStartFocus: boolean
  autoStartBreak: boolean
  soundscape: SoundscapeConfig
  promptSounds: PromptSoundSelection
}

export interface TimerSettings {
  presetId: string | null
  focusMs: number
  shortBreakMs: number
  longBreakMs: number
  longBreakInterval: number
  autoStartFocus: boolean
  autoStartBreak: boolean
}

export interface TimerSnapshot {
  phase: TimerPhase
  status: TimerStatus
  round: number
  completedFocuses: number
  phaseStartedAt: number | null
  phaseEndsAt: number | null
  phaseDurationMs: number
  remainingMs: number
  progress: number
  assignment: FocusAssignment
  settings: TimerSettings
}

export interface WorkspaceState {
  projects: Project[]
  focusRecords: FocusRecord[]
}

export interface PreferencesState {
  theme: Theme
  activePresetId: string
  presets: FocusPreset[]
  presetOrder: string[]
  ambientOrder: string[]
  musicOrder: string[]
  streamTheme: Theme
  streamClockStyle: ClockStyle
  streamBackground: 'solid' | 'transparent'
}

export interface AiPlanRequest {
  goal: string
  context: string
  pomodoroMinutes: number
  chatId: string
}

export interface AiPlanStep {
  title: string
  action: string
  output: string
  completionCriteria: string
  estimatedMinutes: number
  pomodoroCount: number
}

export interface AiTaskPlan {
  goal: string
  assumptions: string[]
  tasks: AiPlanStep[]
  completionSign: string
  firstAction: string
}

export interface AiPlanResponse {
  requestId: string
  chatId: string
  pomodoroMinutes: number
  plan: AiTaskPlan
}

export type AgentCapabilityKind = 'skill' | 'mcp' | 'tool'

export interface AgentCapabilitySelection {
  id: string
  kind: AgentCapabilityKind
  name: string
  source: 'preset' | 'custom'
}

export interface AgentPluginSelection {
  id: string
  name: string
  source: 'preset' | 'custom'
  configuration: Record<string, string>
}

export interface AgentRuntimeConfig {
  loop: AgentPluginSelection
  model: AgentPluginSelection
  scheduler: AgentPluginSelection
}

export interface AgentRunCreateRequest {
  clientRunId: string
  runtime: AgentRuntimeConfig
  capabilities: AgentCapabilitySelection[]
}

export interface AgentRunCreateResponse {
  runId: string
  chatId: string
  status: 'created' | 'running'
  createdAt: string
}

export interface AgentMessageRequest {
  runId: string
  chatId: string
  message: string
  pomodoroMinutes: number
  resourceIds: string[]
  links: string[]
  capabilities: AgentCapabilitySelection[]
}

export interface AgentResourceReference {
  id: string
  kind: 'document' | 'image' | 'file' | 'folder'
  name: string
}

export interface AgentResourceUploadResponse {
  requestId: string
  chatId: string
  resources: AgentResourceReference[]
}

export interface AgentDiscoveryCollected {
  goal: string | null
  currentState: string | null
  deadline: string | null
  availableTime: string | null
  constraints: string[]
  completionCriteria: string | null
}

export interface AgentDiscoveryResponse {
  requestId: string
  runId: string
  chatId: string
  assistantMessage: string
  readiness: 'collecting' | 'ready'
  collected: AgentDiscoveryCollected
  missingFields: string[]
  planRequest: Pick<AiPlanRequest, 'goal' | 'context'> | null
}

export type AssistantStreamEvent =
  | { type: 'meta'; requestId: string; conversationId: string }
  | { type: 'token'; content: string }
  | { type: 'tool-call'; callId: string; name: string; arguments: unknown }
  | { type: 'tool-result'; callId: string; result: unknown }
  | { type: 'artifact'; artifactType: string; title: string; url: string }
  | { type: 'done'; finishReason: string }
  | { type: 'error'; code: string; message: string }

export interface BackupPayload {
  schemaVersion: number
  exportedAt: string
  workspace: WorkspaceState
  preferences: PreferencesState
}
