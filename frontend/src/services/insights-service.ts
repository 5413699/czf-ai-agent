import type { FocusRecord, Project } from '../domain/models'

export interface DailyFocusSummary {
  key: string
  label: string
  count: number
  minutes: number
}

export interface ReportPeriod {
  start: Date
  end: Date
  label: string
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function summarizeLastSevenDays(
  records: FocusRecord[],
  today = new Date(),
): DailyFocusSummary[] {
  const firstDay = addDays(startOfDay(today), -6)
  const summaries = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(firstDay, index)
    return {
      key: localDateKey(date),
      label: new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date).replace('周', ''),
      count: 0,
      minutes: 0,
    }
  })
  const byDate = new Map(summaries.map((summary) => [summary.key, summary]))
  for (const record of records) {
    const summary = byDate.get(localDateKey(new Date(record.completedAt)))
    if (!summary) continue
    summary.count += 1
    summary.minutes += Math.round(record.durationSeconds / 60)
  }
  return summaries
}

export function reportPeriod(mode: 'daily' | 'weekly', selectedDate: string): ReportPeriod {
  const selected = startOfDay(new Date(`${selectedDate}T00:00:00`))
  if (mode === 'daily') {
    return { start: selected, end: addDays(selected, 1), label: selectedDate }
  }
  const mondayOffset = (selected.getDay() + 6) % 7
  const start = addDays(selected, -mondayOffset)
  const end = addDays(start, 7)
  return {
    start,
    end,
    label: `${localDateKey(start)} 至 ${localDateKey(addDays(end, -1))}`,
  }
}

export function filterRecordsForPeriod(
  records: FocusRecord[],
  period: ReportPeriod,
): FocusRecord[] {
  return records.filter((record) => {
    const completedAt = new Date(record.completedAt)
    return completedAt >= period.start && completedAt < period.end
  })
}

function projectName(projects: Project[], projectId: string | null): string {
  if (!projectId) return '自由专注'
  return projects.find((project) => project.id === projectId)?.name ?? '已删除项目'
}

export function buildOfflineReport(
  mode: 'daily' | 'weekly',
  period: ReportPeriod,
  records: FocusRecord[],
  projects: Project[],
): string {
  const totalMinutes = Math.round(
    records.reduce((sum, record) => sum + record.durationSeconds, 0) / 60,
  )
  const projectCounts = new Map<string, number>()
  for (const record of records) {
    const name = projectName(projects, record.projectId)
    projectCounts.set(name, (projectCounts.get(name) ?? 0) + 1)
  }
  const distribution = [...projectCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([name, count]) => `- ${name}：${count} 颗`)
    .join('\n')
  const latestGoals = records
    .filter((record) => record.label.trim())
    .slice(-5)
    .reverse()
    .map((record) => `- ${record.label}`)
    .join('\n')

  return [
    `# 番茄自习室${mode === 'daily' ? '日报' : '周报'}`,
    `统计周期：${period.label}`,
    '',
    `完成番茄：${records.length} 颗`,
    `专注时长：${Math.floor(totalMinutes / 60)} 小时 ${totalMinutes % 60} 分钟`,
    '',
    '## 项目分布',
    distribution || '- 暂无专注记录',
    '',
    '## 最近完成',
    latestGoals || '- 暂无目标记录',
  ].join('\n')
}
