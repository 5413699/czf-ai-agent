import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  BarChart3,
  BellRing,
  CalendarDays,
  Check,
  Clipboard,
  Clock3,
  Database,
  Download,
  FileUp,
  Flame,
  Pencil,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { AiWorkspaceTabs } from '../components/ai-workspace/AiWorkspaceTabs'
import type { FocusRecord } from '../domain/models'
import { useWorkspaceStore } from '../features/workspace/workspace-store'
import {
  clearAllLocalData,
  downloadBackup,
  importBackupFile,
} from '../infrastructure/backup/backup-service'
import {
  buildOfflineReport,
  filterRecordsForPeriod,
  localDateKey,
  reportPeriod,
  summarizeLastSevenDays,
} from '../services/insights-service'
import styles from './InsightsPage.module.css'
import { useSearchParams } from 'react-router-dom'

function recordTitle(record: FocusRecord): string {
  return record.label.trim() || '未命名专注'
}

export default function InsightsPage() {
  const [searchParams] = useSearchParams()
  const reportView = searchParams.get('view') === 'reports'
  const records = useWorkspaceStore((state) => state.focusRecords)
  const projects = useWorkspaceStore((state) => state.projects)
  const updateFocusRecord = useWorkspaceStore((state) => state.updateFocusRecord)
  const deleteFocusRecord = useWorkspaceStore((state) => state.deleteFocusRecord)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [reportMode, setReportMode] = useState<'daily' | 'weekly'>('weekly')
  const [reportDate, setReportDate] = useState(() => localDateKey(new Date()))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editTaskId, setEditTaskId] = useState('')
  const [editSubtaskId, setEditSubtaskId] = useState('')

  const totalMinutes = Math.round(
    records.reduce((sum, record) => sum + record.durationSeconds, 0) / 60,
  )
  const focusDays = new Set(records.map((record) => localDateKey(new Date(record.completedAt))))
    .size
  const sevenDays = useMemo(() => summarizeLastSevenDays(records), [records])
  const maxDayMinutes = Math.max(1, ...sevenDays.map((day) => day.minutes))
  const today = sevenDays.at(-1) ?? { count: 0, minutes: 0, key: '', label: '' }
  const recentRecords = useMemo(
    () =>
      [...records]
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
        .slice(0, 12),
    [records],
  )
  const period = useMemo(() => reportPeriod(reportMode, reportDate), [reportDate, reportMode])
  const periodRecords = useMemo(() => filterRecordsForPeriod(records, period), [period, records])
  const report = useMemo(
    () => buildOfflineReport(reportMode, period, periodRecords, projects),
    [period, periodRecords, projects, reportMode],
  )
  const selectedProject = projects.find((project) => project.id === editProjectId)
  const selectedTask = selectedProject?.tasks.find((task) => task.id === editTaskId)

  function projectLabel(record: FocusRecord): string {
    if (!record.projectId) return '自由专注'
    const project = projects.find((item) => item.id === record.projectId)
    const task = project?.tasks.find((item) => item.id === record.taskId)
    const subtask = task?.subtasks.find((item) => item.id === record.subtaskId)
    return [project?.name ?? '已删除项目', task?.name, subtask?.name].filter(Boolean).join(' / ')
  }

  function startEditing(record: FocusRecord) {
    setEditingId(record.id)
    setEditLabel(record.label)
    setEditProjectId(record.projectId ?? '')
    setEditTaskId(record.taskId ?? '')
    setEditSubtaskId(record.subtaskId ?? '')
  }

  function saveRecord(event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    updateFocusRecord(editingId, {
      label: editLabel.trim(),
      projectId: editProjectId || null,
      taskId: editTaskId || null,
      subtaskId: editSubtaskId || null,
    })
    setEditingId(null)
    setStatus('专注记录已更新。')
  }

  async function exportData() {
    setBusy(true)
    setStatus('')
    try {
      await downloadBackup()
      setStatus('新版备份包已导出。')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '导出失败。')
    } finally {
      setBusy(false)
    }
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setStatus('')
    try {
      await importBackupFile(file)
      setStatus('备份已恢复，项目、偏好和自定义媒体均已更新。')
    } catch {
      setStatus('导入失败：请选择由当前版本导出的完整备份包。')
    } finally {
      setBusy(false)
    }
  }

  async function clearData() {
    if (
      !window.confirm(
        '确定清空项目、任务、专注记录、偏好、自定义音频和离线缓存吗？此操作不可撤销。',
      )
    )
      return
    setBusy(true)
    try {
      await clearAllLocalData()
      setEditingId(null)
      setStatus('本地数据已全部清空。')
    } finally {
      setBusy(false)
    }
  }

  async function copyReport() {
    await navigator.clipboard.writeText(report)
    setStatus(`${reportMode === 'daily' ? '日报' : '周报'}已复制。`)
  }

  return (
    <>
      <PageHeader
        eyebrow="INSIGHTS"
        title="你的专注，正在留下形状"
        description="查看真实节奏，修正记录，并把本地数据完整掌握在自己手中。"
        actions={
          <div className={styles.headerActions}>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importData(event)}
              className="sr-only"
            />
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => importInputRef.current?.click()}
              disabled={busy}
              title="导入新版备份"
              aria-label="导入新版备份"
            >
              <FileUp />
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void exportData()}
              disabled={busy}
            >
              <Download />
              导出备份
            </button>
          </div>
        }
      />

      <AiWorkspaceTabs active={reportView ? 'reports' : 'overview'} />

      {status ? (
        <output className={styles.status}>
          <Check />
          {status}
        </output>
      ) : null}
      {!reportView ? (
        <>
          <section className={styles.metrics}>
            <article>
              <span>
                <Flame />
                累计番茄
              </span>
              <strong>{records.length}</strong>
              <small>每一颗都算数</small>
            </article>
            <article>
              <span>
                <Clock3 />
                专注时长
              </span>
              <strong>
                {totalMinutes}
                <em> min</em>
              </strong>
              <small>
                {Math.floor(totalMinutes / 60)} 小时 {totalMinutes % 60} 分钟
              </small>
            </article>
            <article>
              <span>
                <CalendarDays />
                专注天数
              </span>
              <strong>{focusDays}</strong>
              <small>有记录的不同日期</small>
            </article>
            <article>
              <span>
                <TrendingUp />
                进行中项目
              </span>
              <strong>{projects.filter((project) => !project.archived).length}</strong>
              <small>聚焦比堆积更重要</small>
            </article>
          </section>

          <section className={styles.overview}>
            <div className={styles.chart}>
              <header>
                <div>
                  <span>近 7 天节奏</span>
                  <h2>专注趋势</h2>
                </div>
                <BarChart3 />
              </header>
              <div className={styles.bars}>
                {sevenDays.map((day) => (
                  <div key={day.key} title={`${day.key} · ${day.count} 颗 · ${day.minutes} 分钟`}>
                    <strong>{day.minutes ? day.minutes : ''}</strong>
                    <span
                      style={{ height: `${Math.max(4, (day.minutes / maxDayMinutes) * 100)}%` }}
                    />
                    <small>{day.label}</small>
                  </div>
                ))}
              </div>
            </div>
            <aside className={styles.reminder}>
              <BellRing />
              <div>
                <small>今日提醒</small>
                <h2>{today.count ? `已完成 ${today.count} 颗` : '今天还没有开始'}</h2>
                <p>
                  {today.count
                    ? `累计专注 ${today.minutes} 分钟。下一颗可以继续当前任务，也可以留给最难的一步。`
                    : '选定一个能在本轮完成的动作，先开始第一颗番茄。'}
                </p>
              </div>
            </aside>
          </section>

          <section className={styles.recordsSection}>
            <header>
              <div>
                <span>最近 12 条</span>
                <h2>专注记录</h2>
              </div>
              <small>完成记录可重新归属到项目、任务或子任务</small>
            </header>
            {recentRecords.length ? (
              <div className={styles.records}>
                {recentRecords.map((record) => (
                  <article key={record.id}>
                    <span className={styles.recordMark}>
                      <Check />
                    </span>
                    <div className={styles.recordCopy}>
                      <strong>{recordTitle(record)}</strong>
                      <small>{projectLabel(record)}</small>
                    </div>
                    <div className={styles.recordMeta}>
                      <strong>{Math.round(record.durationSeconds / 60)} 分钟</strong>
                      <small>
                        {new Intl.DateTimeFormat('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(record.completedAt))}
                      </small>
                    </div>
                    <div className={styles.recordActions}>
                      <button
                        type="button"
                        onClick={() => startEditing(record)}
                        title="编辑记录"
                        aria-label="编辑记录"
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('删除这条专注记录？相关任务进度会同步重算。'))
                            deleteFocusRecord(record.id)
                        }}
                        title="删除记录"
                        aria-label="删除记录"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyRecords}>完成第一颗番茄后，记录会出现在这里。</div>
            )}
          </section>

          {editingId ? (
            <section className={styles.editor}>
              <header>
                <h2>编辑专注记录</h2>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  title="关闭"
                  aria-label="关闭"
                >
                  <X />
                </button>
              </header>
              <form onSubmit={saveRecord}>
                <label>
                  一句话目标
                  <input value={editLabel} onChange={(event) => setEditLabel(event.target.value)} />
                </label>
                <label>
                  项目
                  <select
                    value={editProjectId}
                    onChange={(event) => {
                      setEditProjectId(event.target.value)
                      setEditTaskId('')
                      setEditSubtaskId('')
                    }}
                  >
                    <option value="">自由专注</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                        {project.archived ? '（已归档）' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  任务
                  <select
                    value={editTaskId}
                    onChange={(event) => {
                      setEditTaskId(event.target.value)
                      setEditSubtaskId('')
                    }}
                    disabled={!selectedProject}
                  >
                    <option value="">不指定任务</option>
                    {selectedProject?.tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  子任务
                  <select
                    value={editSubtaskId}
                    onChange={(event) => setEditSubtaskId(event.target.value)}
                    disabled={!selectedTask}
                  >
                    <option value="">不指定子任务</option>
                    {selectedTask?.subtasks.map((subtask) => (
                      <option key={subtask.id} value={subtask.id}>
                        {subtask.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">
                  <Check />
                  保存修改
                </button>
              </form>
            </section>
          ) : null}
        </>
      ) : null}

      {reportView ? (
        <section className={styles.reportSection}>
          <header>
            <div>
              <span>本地生成</span>
              <h2>学习报告</h2>
            </div>
            <div className={styles.reportControls}>
              <div className={styles.segmented}>
                <button
                  type="button"
                  className={reportMode === 'daily' ? styles.segmentActive : ''}
                  onClick={() => setReportMode('daily')}
                >
                  日报
                </button>
                <button
                  type="button"
                  className={reportMode === 'weekly' ? styles.segmentActive : ''}
                  onClick={() => setReportMode('weekly')}
                >
                  周报
                </button>
              </div>
              <input
                type="date"
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
              />
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => void copyReport()}
                title="复制报告"
                aria-label="复制报告"
              >
                <Clipboard />
              </button>
            </div>
          </header>
          <pre>{report}</pre>
        </section>
      ) : null}

      <section className={styles.storage}>
        <Database />
        <div>
          <h2>数据保存在此设备</h2>
          <p>备份包包含项目、记录、三种主题偏好、番茄方案和自定义媒体。导入仅接受当前新版备份。</p>
        </div>
        <button
          type="button"
          className={styles.danger}
          onClick={() => void clearData()}
          disabled={busy}
        >
          <Trash2 />
          清空全部数据
        </button>
      </section>
    </>
  )
}
