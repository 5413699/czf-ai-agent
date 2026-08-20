import { z } from 'zod'
import { SCHEMA_VERSION } from '../../domain/defaults'
import type { BackupPayload, PreferencesState, WorkspaceState } from '../../domain/models'
import { usePreferencesStore } from '../../features/preferences/preferences-store'
import { useWorkspaceStore } from '../../features/workspace/workspace-store'
import { soundscapeService } from '../../features/soundscape/soundscape-service'
import { timerEngine } from '../../features/timer/timer-engine'
import {
  clearCustomMedia,
  listCustomMediaRecords,
  replaceCustomMedia,
  type CustomMediaRecord,
} from '../media/media-repository'

const focusAssignmentSchema = z.object({
  label: z.string(),
  projectId: z.string().nullable(),
  taskId: z.string().nullable(),
  subtaskId: z.string().nullable(),
})

const subtaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string(),
  estimatedMinutes: z.number().nonnegative(),
  completedPomodoros: z.number().int().nonnegative(),
  completed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const taskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string(),
  estimatedMinutes: z.number().nonnegative(),
  completedPomodoros: z.number().int().nonnegative(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  subtasks: z.array(subtaskSchema),
})

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  preferredFocusPresetId: z.string().nullable(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tasks: z.array(taskSchema),
  resources: z.array(
    z.object({ id: z.string(), title: z.string(), url: z.string(), description: z.string() }),
  ),
})

const focusRecordSchema = focusAssignmentSchema.extend({
  id: z.string(),
  phase: z.literal('focus'),
  durationSeconds: z.number().nonnegative(),
  startedAt: z.string(),
  completedAt: z.string(),
  round: z.number().int().positive(),
  presetId: z.string().nullable(),
})

const workspaceSchema = z.object({
  projects: z.array(projectSchema),
  focusRecords: z.array(focusRecordSchema),
})

const focusPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  builtIn: z.boolean(),
  focusMinutes: z.number().positive(),
  shortBreakMinutes: z.number().positive(),
  longBreakMinutes: z.number().positive(),
  longBreakInterval: z.number().int().positive(),
  autoStartFocus: z.boolean(),
  autoStartBreak: z.boolean(),
  soundscape: z.object({
    masterVolume: z.number().min(0).max(1),
    musicId: z.string().nullable(),
    musicVolume: z.number().min(0).max(1),
    ambient: z.array(z.object({ id: z.string(), volume: z.number().min(0).max(1) })),
  }),
  promptSounds: z.object({
    startSoundId: z.string(),
    completeSoundId: z.string(),
    volume: z.number().min(0).max(1),
  }),
})

const preferencesSchema = z.object({
  theme: z.enum(['day', 'night', 'eye']),
  activePresetId: z.string(),
  presets: z.array(focusPresetSchema),
  presetOrder: z.array(z.string()),
  ambientOrder: z.array(z.string()),
  musicOrder: z.array(z.string()),
  streamTheme: z.enum(['day', 'night', 'eye']),
  streamClockStyle: z.enum(['orbit', 'tomato-fill', 'desk-card']),
  streamBackground: z.enum(['solid', 'transparent']),
})

const portableMediaSchema = z.object({
  id: z.string(),
  kind: z.enum(['music', 'ambient', 'cue', 'icon']),
  name: z.string(),
  description: z.string(),
  iconMediaId: z.string().nullable(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dataUrl: z.string().startsWith('data:'),
})

const backupPackageSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: z.string(),
  workspace: workspaceSchema,
  preferences: preferencesSchema,
  media: z.array(portableMediaSchema),
})

type PortableMedia = z.infer<typeof portableMediaSchema>

export interface BackupPackage extends BackupPayload {
  media: PortableMedia[]
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)), { once: true })
    reader.addEventListener(
      'error',
      () => reject(reader.error ?? new Error('Unable to read media file.')),
      { once: true },
    )
    reader.readAsDataURL(blob)
  })
}

async function toPortableMedia(record: CustomMediaRecord): Promise<PortableMedia> {
  return {
    id: record.id,
    kind: record.kind,
    name: record.name,
    description: record.description,
    iconMediaId: record.iconMediaId,
    mimeType: record.mimeType,
    size: record.size,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    dataUrl: await blobToDataUrl(record.blob),
  }
}

async function fromPortableMedia(record: PortableMedia): Promise<CustomMediaRecord> {
  const response = await fetch(record.dataUrl)
  const blob = await response.blob()
  if (blob.size !== record.size || blob.type !== record.mimeType) {
    throw new Error(`Backup media checksum failed for ${record.name}.`)
  }
  return { ...record, blob }
}

function currentWorkspace(): WorkspaceState {
  const { projects, focusRecords } = useWorkspaceStore.getState()
  return { projects, focusRecords }
}

function currentPreferences(): PreferencesState {
  const state = usePreferencesStore.getState()
  return {
    theme: state.theme,
    activePresetId: state.activePresetId,
    presets: state.presets,
    presetOrder: state.presetOrder,
    ambientOrder: state.ambientOrder,
    musicOrder: state.musicOrder,
    streamTheme: state.streamTheme,
    streamClockStyle: state.streamClockStyle,
    streamBackground: state.streamBackground,
  }
}

export async function createBackupPackage(): Promise<BackupPackage> {
  const mediaRecords = await listCustomMediaRecords()
  const media = await Promise.all(mediaRecords.map((record) => toPortableMedia(record)))
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: currentWorkspace(),
    preferences: currentPreferences(),
    media,
  }
}

export async function createBackupFile(): Promise<Blob> {
  return new Blob([JSON.stringify(await createBackupPackage(), null, 2)], {
    type: 'application/json;charset=utf-8',
  })
}

export async function importBackupFile(file: Blob): Promise<BackupPackage> {
  const parsed: unknown = JSON.parse(await file.text())
  const backup = backupPackageSchema.parse(parsed) as BackupPackage
  const mediaRecords = await Promise.all(backup.media.map((record) => fromPortableMedia(record)))

  await replaceCustomMedia(mediaRecords)
  useWorkspaceStore.getState().replaceWorkspace(backup.workspace)
  usePreferencesStore.getState().replacePreferences(backup.preferences)
  return backup
}

export async function downloadBackup(
  filename = `tomato-study-room-${new Date().toISOString().slice(0, 10)}.json`,
): Promise<void> {
  const blob = await createBackupFile()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function clearAllLocalData(): Promise<void> {
  soundscapeService.stop()
  timerEngine.stop()
  useWorkspaceStore.getState().resetWorkspace()
  usePreferencesStore.getState().resetPreferences()
  await clearCustomMedia()
  if (typeof caches !== 'undefined') {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter(
          (name) => name.startsWith('tomato-study-room-') || name.includes('workbox-precache'),
        )
        .map((name) => caches.delete(name)),
    )
  }
}
