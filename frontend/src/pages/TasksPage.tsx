/* oxlint-disable react/react-in-jsx-scope, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  ExternalLink,
  FileText,
  FolderHeart,
  FolderPlus,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  Timer,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import type { Project, ResourceLink, Subtask, Task } from '../domain/models'
import {
  findPresetById,
  selectOrderedPresets,
  usePreferencesStore,
} from '../features/preferences/preferences-store'
import {
  useWorkspaceStore,
  type ProjectInput,
  type SubtaskInput,
  type TaskInput,
} from '../features/workspace/workspace-store'
import styles from './TasksPage.module.css'

type ProjectFilter = 'active' | 'archived' | 'all'
type TaskFilter = 'active' | 'archived' | 'all'
type WorkspaceTab = 'tasks' | 'resources'
type TaskCreationMode = 'manual' | 'bilibili'
interface DurationValue {
  hours: number
  minutes: number
}
interface ProjectDraft extends ProjectInput {
  id: string | null
}
interface TaskDraft extends TaskInput, DurationValue {
  id: string | null
  mode: TaskCreationMode
  playlistText: string
}
interface SubtaskDraft extends SubtaskInput, DurationValue {
  id: string | null
  taskId: string
}
interface ResourceDraft extends Omit<ResourceLink, 'id'> {
  id: string | null
}
interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

const EMPTY_PROJECT: ProjectDraft = {
  id: null,
  name: '',
  description: '',
  preferredFocusPresetId: null,
}
const EMPTY_TASK: TaskDraft = {
  id: null,
  name: '',
  description: '',
  url: '',
  estimatedMinutes: 25,
  hours: 0,
  minutes: 25,
  mode: 'manual',
  playlistText: '',
}
const EMPTY_RESOURCE: ResourceDraft = { id: null, title: '', url: '', description: '' }
const BILIBILI_SCRIPT_URL = new URL('../../tools/bilibili-playlist-copy.user.js', import.meta.url)
  .href
const DURATION_PATTERN = /(?:^|\s)((?:\d{1,2}:)?\d{1,3}:[0-5]\d)(?=\s|$)/

function asDuration(totalMinutes: number): DurationValue {
  const safe = Math.max(1, Math.round(totalMinutes || 1))
  return { hours: Math.floor(safe / 60), minutes: safe % 60 }
}
function durationMinutes(value: DurationValue): number {
  return Math.max(1, Math.round(value.hours) * 60 + Math.round(value.minutes))
}
function formatDuration(totalMinutes: number): string {
  const { hours, minutes } = asDuration(totalMinutes)
  if (hours === 0) return `${minutes} 分钟`
  return minutes === 0 ? `${hours} 小时` : `${hours} 小时 ${minutes} 分钟`
}
function expectedPomodoros(minutes: number, focusMinutes: number): number {
  return Math.max(1, Math.ceil(minutes / Math.max(1, focusMinutes)))
}
function isSafeUrl(value: string): boolean {
  if (!value.trim()) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
function parseDurationSeconds(value: string): number {
  const parts = value.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return 0
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
  return 0
}
function bilibiliPartUrl(baseUrl: string, index: number): string {
  if (!baseUrl.trim()) return ''
  try {
    const url = new URL(baseUrl)
    if (url.hostname === 'bilibili.com' || url.hostname.endsWith('.bilibili.com'))
      url.searchParams.set('p', String(index))
    return url.href
  } catch {
    return ''
  }
}
function parseBilibiliPlaylist(content: string, baseUrl: string): SubtaskInput[] {
  const subtasks: SubtaskInput[] = []
  for (const line of content.split(/\r?\n/)) {
    const raw = line.trim()
    const match = raw.match(DURATION_PATTERN)
    if (!raw || !match?.[1]) continue
    const duration = match[1]
    const title = raw
      .replace(/^\s*(?:\d+[.、)）]\s*)?/, '')
      .replace(DURATION_PATTERN, '')
      .replace(/^[-|｜:：]+\s*/, '')
      .trim()
    const index = subtasks.length + 1
    subtasks.push({
      name: title || `第 ${index} 节`,
      description: `来自 B 站选集 · ${duration}`,
      url: bilibiliPartUrl(baseUrl, index),
      estimatedMinutes: Math.max(1, Math.ceil(parseDurationSeconds(duration) / 60)),
    })
  }
  return subtasks
}

function Modal({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string
  eyebrow: string
  children: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <dialog
        open
        className={styles.modal}
        aria-modal="true"
        aria-labelledby="workspace-dialog-title"
      >
        <header className={styles.modalHeader}>
          <div>
            <span>{eyebrow}</span>
            <h2 id="workspace-dialog-title">{title}</h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        {children}
      </dialog>
    </div>
  )
}
function DurationFields({
  value,
  onChange,
  focusMinutes,
}: {
  value: DurationValue
  onChange: (value: DurationValue) => void
  focusMinutes: number
}) {
  const total = durationMinutes(value)
  return (
    <fieldset className={styles.durationField}>
      <legend>预计用时</legend>
      <div className={styles.durationInputs}>
        <label>
          <input
            type="number"
            min="0"
            max="999"
            value={value.hours}
            onChange={(event) => onChange({ ...value, hours: Number(event.target.value) })}
          />
          <span>小时</span>
        </label>
        <label>
          <input
            type="number"
            min="0"
            max="59"
            value={value.minutes}
            onChange={(event) => onChange({ ...value, minutes: Number(event.target.value) })}
          />
          <span>分钟</span>
        </label>
      </div>
      <small>当前节奏下，预计需要 {expectedPomodoros(total, focusMinutes)} 颗番茄</small>
    </fieldset>
  )
}
function FilterButtons<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <fieldset className={styles.segmented}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? styles.segmentActive : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  )
}

export default function TasksPage() {
  const projects = useWorkspaceStore((state) => state.projects)
  const addProject = useWorkspaceStore((state) => state.addProject)
  const updateProject = useWorkspaceStore((state) => state.updateProject)
  const toggleProjectArchive = useWorkspaceStore((state) => state.toggleProjectArchive)
  const deleteProject = useWorkspaceStore((state) => state.deleteProject)
  const addTask = useWorkspaceStore((state) => state.addTask)
  const updateTask = useWorkspaceStore((state) => state.updateTask)
  const toggleTaskArchive = useWorkspaceStore((state) => state.toggleTaskArchive)
  const deleteTask = useWorkspaceStore((state) => state.deleteTask)
  const addSubtask = useWorkspaceStore((state) => state.addSubtask)
  const updateSubtask = useWorkspaceStore((state) => state.updateSubtask)
  const toggleSubtaskComplete = useWorkspaceStore((state) => state.toggleSubtaskComplete)
  const deleteSubtask = useWorkspaceStore((state) => state.deleteSubtask)
  const addResource = useWorkspaceStore((state) => state.addResource)
  const updateResource = useWorkspaceStore((state) => state.updateResource)
  const deleteResource = useWorkspaceStore((state) => state.deleteResource)
  const preferences = usePreferencesStore()
  const presets = useMemo(() => selectOrderedPresets(preferences), [preferences])
  const activePreset = findPresetById(preferences, preferences.activePresetId) ?? presets[0]
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('active')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('active')
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('tasks')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => new Set())
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null)
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null)
  const [subtaskDraft, setSubtaskDraft] = useState<SubtaskDraft | null>(null)
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [formError, setFormError] = useState('')
  const visibleProjects = projects.filter(
    (project) =>
      projectFilter === 'all' ||
      (projectFilter === 'archived' ? project.archived : !project.archived),
  )
  const selectedProject =
    visibleProjects.find((project) => project.id === selectedProjectId) ??
    visibleProjects[0] ??
    null
  const selectedPreset = selectedProject
    ? (findPresetById(preferences, selectedProject.preferredFocusPresetId) ?? activePreset)
    : activePreset
  const focusMinutes = selectedPreset?.focusMinutes ?? 25
  const closeDialogs = () => {
    setProjectDraft(null)
    setTaskDraft(null)
    setSubtaskDraft(null)
    setResourceDraft(null)
    setFormError('')
  }
  const openProject = (project?: Project) => {
    setFormError('')
    setProjectDraft(
      project
        ? {
            id: project.id,
            name: project.name,
            description: project.description,
            preferredFocusPresetId: project.preferredFocusPresetId,
          }
        : { ...EMPTY_PROJECT },
    )
  }
  const openTask = (task?: Task, mode: TaskCreationMode = 'manual') => {
    const duration = asDuration(task?.estimatedMinutes ?? focusMinutes)
    setFormError('')
    setTaskDraft(
      task
        ? {
            id: task.id,
            name: task.name,
            description: task.description,
            url: task.url,
            estimatedMinutes: task.estimatedMinutes,
            ...duration,
            mode: 'manual',
            playlistText: '',
          }
        : { ...EMPTY_TASK, estimatedMinutes: focusMinutes, ...duration, mode },
    )
  }
  const openSubtask = (taskId: string, subtask?: Subtask) => {
    const duration = asDuration(subtask?.estimatedMinutes ?? focusMinutes)
    setFormError('')
    setSubtaskDraft({
      id: subtask?.id ?? null,
      taskId,
      name: subtask?.name ?? '',
      description: subtask?.description ?? '',
      url: subtask?.url ?? '',
      estimatedMinutes: subtask?.estimatedMinutes ?? focusMinutes,
      ...duration,
    })
  }
  const openResource = (resource?: ResourceLink) => {
    setFormError('')
    setResourceDraft(resource ? { ...resource } : { ...EMPTY_RESOURCE })
  }

  function saveProject(event: FormEvent) {
    event.preventDefault()
    if (!projectDraft) return
    if (!projectDraft.name.trim()) return setFormError('请填写项目名称。')
    if (
      projects.some(
        (project) =>
          project.id !== projectDraft.id && project.name.trim() === projectDraft.name.trim(),
      )
    )
      return setFormError('已经有同名项目，请换一个更具体的名称。')
    const input: ProjectInput = {
      name: projectDraft.name,
      description: projectDraft.description,
      preferredFocusPresetId: projectDraft.preferredFocusPresetId,
    }
    if (projectDraft.id) updateProject(projectDraft.id, input)
    else {
      const project = addProject(input)
      setSelectedProjectId(project.id)
      setProjectFilter('active')
    }
    closeDialogs()
  }
  function saveTask(event: FormEvent) {
    event.preventDefault()
    if (!taskDraft || !selectedProject) return
    if (!taskDraft.name.trim()) return setFormError('请填写任务名称。')
    if (!isSafeUrl(taskDraft.url)) return setFormError('任务链接需要以 http:// 或 https:// 开头。')
    const input: TaskInput = {
      name: taskDraft.name,
      description: taskDraft.description,
      url: taskDraft.url,
      estimatedMinutes: durationMinutes(taskDraft),
    }
    if (taskDraft.id) updateTask(selectedProject.id, taskDraft.id, input)
    else if (taskDraft.mode === 'bilibili') {
      const subtasks = parseBilibiliPlaylist(taskDraft.playlistText, taskDraft.url)
      if (!subtasks.length)
        return setFormError('没有识别出带时长的选集。请确认每行包含标题和 12:34 形式的时长。')
      input.estimatedMinutes = subtasks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
      const created = addTask(selectedProject.id, input)
      if (created) {
        for (const subtask of subtasks) addSubtask(selectedProject.id, created.id, subtask)
        setExpandedTasks((current) => new Set(current).add(created.id))
      }
    } else addTask(selectedProject.id, input)
    closeDialogs()
  }
  function saveSubtask(event: FormEvent) {
    event.preventDefault()
    if (!subtaskDraft || !selectedProject) return
    if (!subtaskDraft.name.trim()) return setFormError('请填写子任务名称。')
    if (!isSafeUrl(subtaskDraft.url))
      return setFormError('子任务链接需要以 http:// 或 https:// 开头。')
    const input: SubtaskInput = {
      name: subtaskDraft.name,
      description: subtaskDraft.description,
      url: subtaskDraft.url,
      estimatedMinutes: durationMinutes(subtaskDraft),
    }
    if (subtaskDraft.id)
      updateSubtask(selectedProject.id, subtaskDraft.taskId, subtaskDraft.id, input)
    else addSubtask(selectedProject.id, subtaskDraft.taskId, input)
    setExpandedTasks((current) => new Set(current).add(subtaskDraft.taskId))
    closeDialogs()
  }
  function saveResource(event: FormEvent) {
    event.preventDefault()
    if (!resourceDraft || !selectedProject) return
    if (!resourceDraft.title.trim()) return setFormError('请填写链接名称。')
    if (!isSafeUrl(resourceDraft.url) || !resourceDraft.url.trim())
      return setFormError('请输入有效的 http:// 或 https:// 链接。')
    const input = {
      title: resourceDraft.title,
      url: resourceDraft.url,
      description: resourceDraft.description,
    }
    if (resourceDraft.id) updateResource(selectedProject.id, resourceDraft.id, input)
    else addResource(selectedProject.id, input)
    closeDialogs()
  }
  const askConfirm = (state: ConfirmState) => setConfirmState(state)
  const confirmAction = () => {
    confirmState?.onConfirm()
    setConfirmState(null)
  }
  const toggleExpanded = (taskId: string) =>
    setExpandedTasks((current) => {
      const next = new Set(current)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })

  return (
    <>
      <PageHeader
        eyebrow="PLAN & BUILD"
        title="任务空间"
        description="项目收纳方向，任务记录进展。番茄钟始终可以自由开始，完成后再把成果归到这里。"
        actions={
          <button type="button" onClick={() => openProject()}>
            <FolderPlus size={17} />
            新建项目
          </button>
        }
      />
      <div className={styles.projectFilterBar}>
        <div>
          <FolderHeart size={17} />
          <strong>项目</strong>
          <span>{projects.filter((project) => !project.archived).length} 个进行中</span>
        </div>
        <FilterButtons
          value={projectFilter}
          onChange={setProjectFilter}
          label="项目状态筛选"
          options={[
            { value: 'active', label: '进行中' },
            { value: 'archived', label: '已归档' },
            { value: 'all', label: '全部' },
          ]}
        />
      </div>
      {projects.length === 0 ? (
        <section className={styles.emptyHero}>
          <img src="/assets/images/tomatoes/tomato-basket.svg" alt="一篮番茄" />
          <div>
            <span>从一个清楚的方向开始</span>
            <h2>建立你的第一个学习项目</h2>
            <p>
              按课程、求职准备或个人作品整理都可以。项目不会限制番茄钟，只会让每一次专注更容易被看见。
            </p>
            <button type="button" onClick={() => openProject()}>
              <Plus size={17} />
              新建项目
            </button>
          </div>
        </section>
      ) : visibleProjects.length === 0 ? (
        <section className={styles.emptyInline}>
          <Archive size={28} />
          <h2>这里还没有{projectFilter === 'archived' ? '归档' : '符合条件的'}项目</h2>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setProjectFilter('all')}
          >
            查看全部项目
          </button>
        </section>
      ) : (
        <div className={styles.workspaceLayout}>
          <aside className={styles.projectRail} aria-label="项目列表">
            {visibleProjects.map((project) => {
              const selected = project.id === selectedProject?.id
              const projectFocus =
                findPresetById(preferences, project.preferredFocusPresetId)?.focusMinutes ??
                activePreset?.focusMinutes ??
                25
              const done = project.tasks.filter(
                (task) =>
                  task.completedPomodoros >= expectedPomodoros(task.estimatedMinutes, projectFocus),
              ).length
              return (
                <button
                  key={project.id}
                  type="button"
                  className={selected ? styles.projectSelected : styles.projectItem}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <span className={styles.projectAvatar}>{project.name.slice(0, 1)}</span>
                  <span className={styles.projectCopy}>
                    <strong>{project.name}</strong>
                    <small>
                      {done}/{project.tasks.length} 个任务达标{project.archived ? ' · 已归档' : ''}
                    </small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              )
            })}
          </aside>
          {selectedProject ? (
            <section className={styles.workbench}>
              <header className={styles.workbenchHeader}>
                <div className={styles.workbenchTitle}>
                  <span>当前项目</span>
                  <h2>{selectedProject.name}</h2>
                  <p>
                    {selectedProject.description ||
                      '还没有项目描述，可以补充目标、范围或完成标准。'}
                  </p>
                  <small>
                    <Timer size={14} />
                    {selectedProject.preferredFocusPresetId && selectedPreset
                      ? `偏好 ${selectedPreset.name} · ${selectedPreset.focusMinutes} 分钟专注`
                      : `跟随当前方案 · ${focusMinutes} 分钟专注`}
                  </small>
                </div>
                <div className={styles.toolbarActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    title="编辑项目"
                    aria-label="编辑项目"
                    onClick={() => openProject(selectedProject)}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    title={selectedProject.archived ? '恢复项目' : '归档项目'}
                    aria-label={selectedProject.archived ? '恢复项目' : '归档项目'}
                    onClick={() => toggleProjectArchive(selectedProject.id)}
                  >
                    {selectedProject.archived ? (
                      <ArchiveRestore size={17} />
                    ) : (
                      <Archive size={17} />
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.dangerIcon}
                    title="删除项目"
                    aria-label="删除项目"
                    onClick={() =>
                      askConfirm({
                        title: '删除这个项目？',
                        message: `“${selectedProject.name}”及其中的任务、子任务和资料链接将被删除。已经完成的专注记录会保留，但会解除项目归属。`,
                        confirmLabel: '删除项目',
                        onConfirm: () => deleteProject(selectedProject.id),
                      })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </header>
              <div className={styles.tabBar} role="tablist" aria-label="项目内容">
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspaceTab === 'tasks'}
                  className={workspaceTab === 'tasks' ? styles.tabActive : ''}
                  onClick={() => setWorkspaceTab('tasks')}
                >
                  <ListChecks size={16} />
                  任务列表
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspaceTab === 'resources'}
                  className={workspaceTab === 'resources' ? styles.tabActive : ''}
                  onClick={() => setWorkspaceTab('resources')}
                >
                  <Link2 size={16} />
                  知识链接
                </button>
              </div>
              {workspaceTab === 'tasks' ? (
                <TaskPanel
                  project={selectedProject}
                  focusMinutes={focusMinutes}
                  filter={taskFilter}
                  setFilter={setTaskFilter}
                  expandedTasks={expandedTasks}
                  toggleExpanded={toggleExpanded}
                  openTask={openTask}
                  openSubtask={openSubtask}
                  toggleTaskArchive={toggleTaskArchive}
                  toggleSubtaskComplete={toggleSubtaskComplete}
                  askConfirm={askConfirm}
                  deleteTask={deleteTask}
                  deleteSubtask={deleteSubtask}
                />
              ) : (
                <ResourcePanel
                  project={selectedProject}
                  openResource={openResource}
                  askConfirm={askConfirm}
                  deleteResource={deleteResource}
                />
              )}
            </section>
          ) : null}
        </div>
      )}
      {projectDraft ? (
        <ProjectDialog
          draft={projectDraft}
          setDraft={setProjectDraft}
          presets={presets}
          error={formError}
          onSubmit={saveProject}
          onClose={closeDialogs}
        />
      ) : null}
      {taskDraft ? (
        <TaskDialog
          draft={taskDraft}
          setDraft={setTaskDraft}
          focusMinutes={focusMinutes}
          error={formError}
          onSubmit={saveTask}
          onClose={closeDialogs}
        />
      ) : null}
      {subtaskDraft ? (
        <SubtaskDialog
          draft={subtaskDraft}
          setDraft={setSubtaskDraft}
          focusMinutes={focusMinutes}
          error={formError}
          onSubmit={saveSubtask}
          onClose={closeDialogs}
        />
      ) : null}
      {resourceDraft ? (
        <ResourceDialog
          draft={resourceDraft}
          setDraft={setResourceDraft}
          error={formError}
          onSubmit={saveResource}
          onClose={closeDialogs}
        />
      ) : null}
      {confirmState ? (
        <Modal eyebrow="CONFIRM" title={confirmState.title} onClose={() => setConfirmState(null)}>
          <div className={styles.confirmBody}>
            <span>
              <Trash2 size={22} />
            </span>
            <p>{confirmState.message}</p>
          </div>
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setConfirmState(null)}
            >
              取消
            </button>
            <button type="button" className={styles.dangerButton} onClick={confirmAction}>
              {confirmState.confirmLabel}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

function TaskPanel({
  project,
  focusMinutes,
  filter,
  setFilter,
  expandedTasks,
  toggleExpanded,
  openTask,
  openSubtask,
  toggleTaskArchive,
  toggleSubtaskComplete,
  askConfirm,
  deleteTask,
  deleteSubtask,
}: {
  project: Project
  focusMinutes: number
  filter: TaskFilter
  setFilter: (filter: TaskFilter) => void
  expandedTasks: Set<string>
  toggleExpanded: (id: string) => void
  openTask: (task?: Task, mode?: TaskCreationMode) => void
  openSubtask: (taskId: string, subtask?: Subtask) => void
  toggleTaskArchive: (projectId: string, taskId: string) => void
  toggleSubtaskComplete: (projectId: string, taskId: string, subtaskId: string) => void
  askConfirm: (state: ConfirmState) => void
  deleteTask: (projectId: string, taskId: string) => void
  deleteSubtask: (projectId: string, taskId: string, subtaskId: string) => void
}) {
  const tasks = project.tasks.filter(
    (task) => filter === 'all' || (filter === 'archived' ? task.archived : !task.archived),
  )
  const completed = project.tasks.filter(
    (task) => task.completedPomodoros >= expectedPomodoros(task.estimatedMinutes, focusMinutes),
  ).length
  return (
    <div className={styles.panel}>
      <div className={styles.panelToolbar}>
        <FilterButtons
          value={filter}
          onChange={setFilter}
          label="任务状态筛选"
          options={[
            { value: 'active', label: '进行中' },
            { value: 'archived', label: '已归档' },
            { value: 'all', label: '全部' },
          ]}
        />
        <span>
          {completed}/{project.tasks.length} 个任务达标
        </span>
        <div>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => openTask(undefined, 'bilibili')}
          >
            <Upload size={16} />
            导入选集
          </button>
          <button type="button" onClick={() => openTask()}>
            <Plus size={16} />
            添加任务
          </button>
        </div>
      </div>
      {tasks.length === 0 ? (
        <section className={styles.emptyInline}>
          <ListChecks size={30} />
          <h3>{project.tasks.length ? '当前筛选下没有任务' : '把目标拆成第一项任务'}</h3>
          <p>填写预计时间后，会按项目节奏自动换算番茄数量。</p>
          <button type="button" onClick={() => openTask()}>
            <Plus size={16} />
            添加任务
          </button>
        </section>
      ) : (
        <div className={styles.taskList}>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              project={project}
              task={task}
              focusMinutes={focusMinutes}
              expanded={expandedTasks.has(task.id)}
              toggleExpanded={toggleExpanded}
              openTask={openTask}
              openSubtask={openSubtask}
              toggleTaskArchive={toggleTaskArchive}
              toggleSubtaskComplete={toggleSubtaskComplete}
              askConfirm={askConfirm}
              deleteTask={deleteTask}
              deleteSubtask={deleteSubtask}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({
  project,
  task,
  focusMinutes,
  expanded,
  toggleExpanded,
  openTask,
  openSubtask,
  toggleTaskArchive,
  toggleSubtaskComplete,
  askConfirm,
  deleteTask,
  deleteSubtask,
}: {
  project: Project
  task: Task
  focusMinutes: number
  expanded: boolean
  toggleExpanded: (id: string) => void
  openTask: (task?: Task) => void
  openSubtask: (taskId: string, subtask?: Subtask) => void
  toggleTaskArchive: (projectId: string, taskId: string) => void
  toggleSubtaskComplete: (projectId: string, taskId: string, subtaskId: string) => void
  askConfirm: (state: ConfirmState) => void
  deleteTask: (projectId: string, taskId: string) => void
  deleteSubtask: (projectId: string, taskId: string, subtaskId: string) => void
}) {
  const estimate = expectedPomodoros(task.estimatedMinutes, focusMinutes)
  const progress = Math.min(100, (task.completedPomodoros / estimate) * 100)
  return (
    <article className={`${styles.taskRow} ${task.archived ? styles.archived : ''}`}>
      <header>
        <button
          type="button"
          className={styles.expandButton}
          aria-expanded={expanded}
          onClick={() => toggleExpanded(task.id)}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <div className={styles.taskTitle}>
          <h3>{task.name}</h3>
          <p>{task.description || '暂无描述'}</p>
        </div>
        <div className={styles.taskProgress}>
          <strong>
            {task.completedPomodoros}/{estimate}
          </strong>
          <small>颗番茄</small>
          <span>
            <i style={{ width: `${progress}%` }} />
          </span>
        </div>
        <div className={styles.rowActions}>
          {task.url ? (
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              title="打开任务主页"
              aria-label="打开任务主页"
            >
              <ExternalLink size={16} />
            </a>
          ) : null}
          <button
            type="button"
            title="编辑任务"
            aria-label="编辑任务"
            onClick={() => openTask(task)}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            title={task.archived ? '恢复任务' : '归档任务'}
            aria-label={task.archived ? '恢复任务' : '归档任务'}
            onClick={() => toggleTaskArchive(project.id, task.id)}
          >
            {task.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </button>
          <button
            type="button"
            className={styles.dangerSmall}
            title="删除任务"
            aria-label="删除任务"
            onClick={() =>
              askConfirm({
                title: '删除这项任务？',
                message: `“${task.name}”及其中的 ${task.subtasks.length} 个子任务将被删除。历史专注记录会保留并解除任务归属。`,
                confirmLabel: '删除任务',
                onConfirm: () => deleteTask(project.id, task.id),
              })
            }
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>
      <div className={styles.taskMeta}>
        <span>
          <Clock3 size={14} />
          预计 {formatDuration(task.estimatedMinutes)}
        </span>
        <span>
          <CheckCircle2 size={14} />
          {task.subtasks.filter((item) => item.completed).length}/{task.subtasks.length}{' '}
          个子任务完成
        </span>
        {progress >= 100 ? (
          <span className={styles.completeBadge}>
            <Check size={14} />
            番茄目标达成
          </span>
        ) : null}
      </div>
      {expanded ? (
        <div className={styles.subtaskArea}>
          <div className={styles.subtaskHeading}>
            <div>
              <strong>子任务</strong>
              <small>关联专注时，会同时累计到主任务</small>
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => openSubtask(task.id)}
            >
              <Plus size={15} />
              添加子任务
            </button>
          </div>
          {task.subtasks.length ? (
            <div className={styles.subtaskList}>
              {task.subtasks.map((subtask) => (
                <SubtaskRow
                  key={subtask.id}
                  project={project}
                  task={task}
                  subtask={subtask}
                  focusMinutes={focusMinutes}
                  openSubtask={openSubtask}
                  toggleSubtaskComplete={toggleSubtaskComplete}
                  askConfirm={askConfirm}
                  deleteSubtask={deleteSubtask}
                />
              ))}
            </div>
          ) : (
            <div className={styles.subtaskEmpty}>
              还没有子任务。任务仍可直接关联番茄，也可以继续拆成更容易开始的小步。
            </div>
          )}
        </div>
      ) : null}
    </article>
  )
}

function SubtaskRow({
  project,
  task,
  subtask,
  focusMinutes,
  openSubtask,
  toggleSubtaskComplete,
  askConfirm,
  deleteSubtask,
}: {
  project: Project
  task: Task
  subtask: Subtask
  focusMinutes: number
  openSubtask: (taskId: string, subtask?: Subtask) => void
  toggleSubtaskComplete: (projectId: string, taskId: string, subtaskId: string) => void
  askConfirm: (state: ConfirmState) => void
  deleteSubtask: (projectId: string, taskId: string, subtaskId: string) => void
}) {
  const estimate = expectedPomodoros(subtask.estimatedMinutes, focusMinutes)
  return (
    <div className={`${styles.subtaskRow} ${subtask.completed ? styles.subtaskDone : ''}`}>
      <button
        type="button"
        className={styles.checkbox}
        aria-label={subtask.completed ? `取消完成 ${subtask.name}` : `完成 ${subtask.name}`}
        aria-pressed={subtask.completed}
        onClick={() => toggleSubtaskComplete(project.id, task.id, subtask.id)}
      >
        {subtask.completed ? <Check size={15} /> : null}
      </button>
      <div>
        <strong>{subtask.name}</strong>
        {subtask.description ? <p>{subtask.description}</p> : null}
        <small>
          {formatDuration(subtask.estimatedMinutes)} · {subtask.completedPomodoros}/{estimate}{' '}
          颗番茄
        </small>
      </div>
      <div className={styles.rowActions}>
        {subtask.url ? (
          <a
            href={subtask.url}
            target="_blank"
            rel="noreferrer"
            title="打开子任务链接"
            aria-label="打开子任务链接"
          >
            <ExternalLink size={15} />
          </a>
        ) : null}
        <button
          type="button"
          title="编辑子任务"
          aria-label="编辑子任务"
          onClick={() => openSubtask(task.id, subtask)}
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          className={styles.dangerSmall}
          title="删除子任务"
          aria-label="删除子任务"
          onClick={() =>
            askConfirm({
              title: '删除这个子任务？',
              message: `“${subtask.name}”将从任务中移除，历史专注记录会保留并解除子任务归属。`,
              confirmLabel: '删除子任务',
              onConfirm: () => deleteSubtask(project.id, task.id, subtask.id),
            })
          }
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function ResourcePanel({
  project,
  openResource,
  askConfirm,
  deleteResource,
}: {
  project: Project
  openResource: (resource?: ResourceLink) => void
  askConfirm: (state: ConfirmState) => void
  deleteResource: (projectId: string, resourceId: string) => void
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.resourceHeading}>
        <div>
          <span>项目资料夹</span>
          <h3>常用链接</h3>
          <p>集中保存文档、题单、课程和项目入口。</p>
        </div>
        <button type="button" onClick={() => openResource()}>
          <Plus size={16} />
          添加链接
        </button>
      </div>
      {project.resources.length ? (
        <div className={styles.resourceList}>
          {project.resources.map((resource) => (
            <article key={resource.id} className={styles.resourceRow}>
              <span>
                <FileText size={20} />
              </span>
              <div>
                <a href={resource.url} target="_blank" rel="noreferrer">
                  {resource.title}
                  <ExternalLink size={14} />
                </a>
                <p>{resource.description || resource.url}</p>
              </div>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  title="编辑链接"
                  aria-label="编辑链接"
                  onClick={() => openResource(resource)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className={styles.dangerSmall}
                  title="删除链接"
                  aria-label="删除链接"
                  onClick={() =>
                    askConfirm({
                      title: '删除这个知识链接？',
                      message: `“${resource.title}”将从项目资料夹中移除，原网页或文件不会受到影响。`,
                      confirmLabel: '删除链接',
                      onConfirm: () => deleteResource(project.id, resource.id),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.emptyInline}>
          <BookOpen size={30} />
          <h3>把常用资料放在手边</h3>
          <p>保存链接和简短说明，下一次开始时不用再四处寻找。</p>
          <button type="button" onClick={() => openResource()}>
            <Plus size={16} />
            添加链接
          </button>
        </section>
      )}
    </div>
  )
}

function ProjectDialog({
  draft,
  setDraft,
  presets,
  error,
  onSubmit,
  onClose,
}: {
  draft: ProjectDraft
  setDraft: (draft: ProjectDraft) => void
  presets: ReturnType<typeof selectOrderedPresets>
  error: string
  onSubmit: (event: FormEvent) => void
  onClose: () => void
}) {
  return (
    <Modal eyebrow="PROJECT" title={draft.id ? '编辑项目' : '新建项目'} onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <label>
          项目名称
          <input
            maxLength={60}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="例如：Spring AI 求职作品"
          />
        </label>
        <label>
          项目描述（可选）
          <textarea
            rows={3}
            maxLength={280}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="这个项目要解决什么问题，怎样算完成？"
          />
        </label>
        <label>
          偏好节奏方案
          <select
            value={draft.preferredFocusPresetId ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, preferredFocusPresetId: event.target.value || null })
            }
          >
            <option value="">跟随当前方案</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} · {preset.focusMinutes}/{preset.shortBreakMinutes} 分钟
              </option>
            ))}
          </select>
          <small>空闲时选择项目会应用此方案；计时中切换会在下一轮专注生效。</small>
        </label>
        <FormError message={error} />
        <FormActions submitLabel={draft.id ? '保存修改' : '创建项目'} onCancel={onClose} />
      </form>
    </Modal>
  )
}
function TaskDialog({
  draft,
  setDraft,
  focusMinutes,
  error,
  onSubmit,
  onClose,
}: {
  draft: TaskDraft
  setDraft: (draft: TaskDraft) => void
  focusMinutes: number
  error: string
  onSubmit: (event: FormEvent) => void
  onClose: () => void
}) {
  return (
    <Modal
      eyebrow={draft.mode === 'bilibili' ? 'BILIBILI PLAYLIST' : 'TASK'}
      title={draft.id ? '编辑任务' : draft.mode === 'bilibili' ? '导入 B 站选集' : '添加任务'}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={onSubmit}>
        {!draft.id ? (
          <FilterButtons
            value={draft.mode}
            onChange={(mode) => setDraft({ ...draft, mode })}
            label="任务创建方式"
            options={[
              { value: 'manual', label: '手动填写' },
              { value: 'bilibili', label: '粘贴 B 站选集' },
            ]}
          />
        ) : null}
        <label>
          任务名称
          <input
            maxLength={100}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder={
              draft.mode === 'bilibili' ? '例如：Spring AI 系列课程' : '例如：完成结构化输出模块'
            }
          />
        </label>
        <label>
          任务描述（可选）
          <textarea
            rows={3}
            maxLength={500}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="记录范围、交付物或完成标准"
          />
        </label>
        <label>
          任务主页（可选）
          <input
            type="url"
            value={draft.url}
            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            placeholder="https://..."
          />
        </label>
        {draft.mode === 'bilibili' && !draft.id ? (
          <>
            <label>
              选集文本
              <textarea
                rows={8}
                value={draft.playlistText}
                onChange={(event) => setDraft({ ...draft, playlistText: event.target.value })}
                placeholder={'1. 课程介绍 12:30\n2. 第一个案例 28:05'}
              />
            </label>
            <div className={styles.importHelp}>
              <CircleHelp size={18} />
              <div>
                <strong>怎样快速复制选集？</strong>
                <p>
                  安装随项目提供的辅助脚本，在 B 站视频页一键复制标题与时长。也可以直接按“标题 +
                  时长”逐行粘贴。
                </p>
                <a href={BILIBILI_SCRIPT_URL} download>
                  <Upload size={15} />
                  下载选集复制脚本
                </a>
              </div>
            </div>
          </>
        ) : (
          <DurationFields
            value={draft}
            onChange={(duration) => setDraft({ ...draft, ...duration })}
            focusMinutes={focusMinutes}
          />
        )}
        <FormError message={error} />
        <FormActions
          submitLabel={
            draft.id ? '保存修改' : draft.mode === 'bilibili' ? '解析并创建任务' : '添加任务'
          }
          onCancel={onClose}
        />
      </form>
    </Modal>
  )
}
function SubtaskDialog({
  draft,
  setDraft,
  focusMinutes,
  error,
  onSubmit,
  onClose,
}: {
  draft: SubtaskDraft
  setDraft: (draft: SubtaskDraft) => void
  focusMinutes: number
  error: string
  onSubmit: (event: FormEvent) => void
  onClose: () => void
}) {
  return (
    <Modal eyebrow="SUBTASK" title={draft.id ? '编辑子任务' : '添加子任务'} onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <label>
          子任务名称
          <input
            maxLength={160}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="例如：完成 Controller 与 DTO"
          />
        </label>
        <label>
          子任务描述（可选）
          <textarea
            rows={3}
            maxLength={500}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="写下这一小步的产出或完成标准"
          />
        </label>
        <label>
          链接（可选）
          <input
            type="url"
            value={draft.url}
            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            placeholder="https://..."
          />
        </label>
        <DurationFields
          value={draft}
          onChange={(duration) => setDraft({ ...draft, ...duration })}
          focusMinutes={focusMinutes}
        />
        <FormError message={error} />
        <FormActions submitLabel={draft.id ? '保存修改' : '添加子任务'} onCancel={onClose} />
      </form>
    </Modal>
  )
}
function ResourceDialog({
  draft,
  setDraft,
  error,
  onSubmit,
  onClose,
}: {
  draft: ResourceDraft
  setDraft: (draft: ResourceDraft) => void
  error: string
  onSubmit: (event: FormEvent) => void
  onClose: () => void
}) {
  return (
    <Modal eyebrow="RESOURCE" title={draft.id ? '编辑知识链接' : '添加知识链接'} onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <label>
          链接名称
          <input
            maxLength={100}
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="例如：Spring AI 官方文档"
          />
        </label>
        <label>
          网址
          <input
            type="url"
            value={draft.url}
            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            placeholder="https://..."
          />
        </label>
        <label>
          简介（可选）
          <textarea
            rows={3}
            maxLength={240}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="这份资料适合解决什么问题？"
          />
        </label>
        <FormError message={error} />
        <FormActions submitLabel={draft.id ? '保存修改' : '添加链接'} onCancel={onClose} />
      </form>
    </Modal>
  )
}
function FormError({ message }: { message: string }) {
  return message ? <p className={styles.formError}>{message}</p> : null
}
function FormActions({ submitLabel, onCancel }: { submitLabel: string; onCancel: () => void }) {
  return (
    <div className={styles.formActions}>
      <button type="button" className={styles.secondaryButton} onClick={onCancel}>
        取消
      </button>
      <button type="submit">{submitLabel}</button>
    </div>
  )
}
