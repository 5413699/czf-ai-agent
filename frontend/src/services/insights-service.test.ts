import { describe, expect, it } from 'vitest'
import type { FocusRecord } from '../domain/models'
import {
  filterRecordsForPeriod,
  localDateKey,
  reportPeriod,
  summarizeLastSevenDays,
} from './insights-service'

function record(completedAt: string, durationSeconds = 1500): FocusRecord {
  return {
    id: completedAt,
    phase: 'focus',
    durationSeconds,
    startedAt: completedAt,
    completedAt,
    round: 1,
    presetId: 'classic',
    label: '测试',
    projectId: null,
    taskId: null,
    subtaskId: null,
  }
}

describe('insights service', () => {
  it('summarizes a rolling seven-day window using local dates', () => {
    const today = new Date('2026-08-20T12:00:00')
    const result = summarizeLastSevenDays([record('2026-08-20T09:00:00')], today)
    expect(result).toHaveLength(7)
    expect(result.at(-1)).toMatchObject({ key: '2026-08-20', count: 1, minutes: 25 })
  })

  it('builds a Monday-to-Sunday weekly period', () => {
    const period = reportPeriod('weekly', '2026-08-20')
    expect(localDateKey(period.start)).toBe('2026-08-17')
    expect(localDateKey(new Date(period.end.getTime() - 1))).toBe('2026-08-23')
    expect(filterRecordsForPeriod([record('2026-08-17T08:00:00')], period)).toHaveLength(1)
  })
})
