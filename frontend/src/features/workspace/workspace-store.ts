import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_WORKSPACE, SCHEMA_VERSION } from '../../domain/defaults'
import type {
  FocusRecord,
  Project,
  ResourceLink,
  Subtask,
  Task,
  WorkspaceState,
} from '../../domain/models'
import { nowIso } from '../../shared/lib/date'
import { createId } from '../../shared/lib/id'
import { PRESETS_CHANGED_EVENT, type PresetsChangedDetail } from '../preferences/preferences-store'

export interface ProjectInput {
  name: string
  description: string
  preferredFocusPresetId: string | null
}

export interface TaskInput {
  name: string
  description: string
  url: string
  estimatedMinutes: number
}

export interface SubtaskInput extends TaskInput {
  url: string
}

interface WorkspaceActions {
  addProject: (input: ProjectInput) => Project
  updateProject: (projectId: string, input: ProjectInput) => void
  toggleProjectArchive: (projectId: string) => void
  deleteProject: (projectId: string) => void
  addTask: (projectId: string, input: TaskInput) => Task | null
  updateTask: (projectId: string, taskId: string, input: TaskInput) => void
  toggleTaskArchive: (projectId: string, taskId: string) => void
  deleteTask: (projectId: string, taskId: string) => void
  addSubtask: (projectId: string, taskId: string, input: SubtaskInput) => Subtask | null
  updateSubtask: (projectId: string, taskId: string, subtaskId: string, input: SubtaskInput) => void
  toggleSubtaskComplete: (projectId: string, taskId: string, subtaskId: string) => void
  deleteSubtask: (projectId: string, taskId: string, subtaskId: string) => void
  addResource: (projectId: string, input: Omit<ResourceLink, 'id'>) => void
  updateResource: (projectId: string, resourceId: string, input: Omit<ResourceLink, 'id'>) => void
  deleteResource: (projectId: string, resourceId: string) => void
  addFocusRecord: (record: FocusRecord) => void
  updateFocusRecord: (recordId: string, patch: Partial<FocusRecord>) => void
  deleteFocusRecord: (recordId: string) => void
  replaceWorkspace: (workspace: WorkspaceState) => void
  resetWorkspace: () => void
  clearPreferredPreset: (presetId: string) => void
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions

function replaceProject(
  projects: Project[],
  projectId: string,
  updater: (project: Project) => Project,
): Project[] {
  return projects.map((project) => (project.id === projectId ? updater(project) : project))
}

function replaceTask(project: Project, taskId: string, updater: (task: Task) => Task): Project {
  return {
    ...project,
    updatedAt: nowIso(),
    tasks: project.tasks.map((task) => (task.id === taskId ? updater(task) : task)),
  }
}

function countCompletedPomodoros(
  records: FocusRecord[],
  projectId: string,
  taskId: string,
  subtaskId: string | null,
): number {
  return records.filter(
    (record) =>
      record.projectId === projectId &&
      record.taskId === taskId &&
      (subtaskId === null || record.subtaskId === subtaskId),
  ).length
}

function rebuildProgress(projects: Project[], records: FocusRecord[]): Project[] {
  return projects.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => ({
      ...task,
      completedPomodoros: countCompletedPomodoros(records, project.id, task.id, null),
      subtasks: task.subtasks.map((subtask) => ({
        ...subtask,
        completedPomodoros: countCompletedPomodoros(records, project.id, task.id, subtask.id),
      })),
    })),
  }))
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_WORKSPACE,
      addProject: (input) => {
        const timestamp = nowIso()
        const project: Project = {
          id: createId('project'),
          name: input.name.trim(),
          description: input.description.trim(),
          preferredFocusPresetId: input.preferredFocusPresetId,
          archived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
          tasks: [],
          resources: [],
        }
        set((state) => ({ projects: [...state.projects, project] }))
        return project
      },
      updateProject: (projectId, input) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) => ({
            ...project,
            ...input,
            name: input.name.trim(),
            description: input.description.trim(),
            updatedAt: nowIso(),
          })),
        })),
      toggleProjectArchive: (projectId) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) => ({
            ...project,
            archived: !project.archived,
            updatedAt: nowIso(),
          })),
        })),
      deleteProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== projectId),
          focusRecords: state.focusRecords.map((record) =>
            record.projectId === projectId
              ? { ...record, projectId: null, taskId: null, subtaskId: null }
              : record,
          ),
        })),
      addTask: (projectId, input) => {
        const timestamp = nowIso()
        const task: Task = {
          id: createId('task'),
          name: input.name.trim(),
          description: input.description.trim(),
          url: input.url.trim(),
          estimatedMinutes: Math.max(1, Math.round(input.estimatedMinutes)),
          completedPomodoros: 0,
          archived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
          subtasks: [],
        }
        if (!get().projects.some((project) => project.id === projectId)) return null
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) => ({
            ...project,
            updatedAt: timestamp,
            tasks: [...project.tasks, task],
          })),
        }))
        return task
      },
      updateTask: (projectId, taskId, input) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) =>
            replaceTask(project, taskId, (task) => ({
              ...task,
              ...input,
              name: input.name.trim(),
              description: input.description.trim(),
              url: input.url.trim(),
              estimatedMinutes: Math.max(1, Math.round(input.estimatedMinutes)),
              updatedAt: nowIso(),
            })),
          ),
        })),
      toggleTaskArchive: (projectId, taskId) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) =>
            replaceTask(project, taskId, (task) => ({
              ...task,
              archived: !task.archived,
              updatedAt: nowIso(),
            })),
          ),
        })),
      deleteTask: (projectId, taskId) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) => ({
            ...project,
            updatedAt: nowIso(),
            tasks: project.tasks.filter((task) => task.id !== taskId),
          })),
          focusRecords: state.focusRecords.map((record) =>
            record.taskId === taskId ? { ...record, taskId: null, subtaskId: null } : record,
          ),
        })),
      addSubtask: (projectId, taskId, input) => {
        const timestamp = nowIso()
        const subtask: Subtask = {
          id: createId('subtask'),
          name: input.name.trim(),
          description: input.description.trim(),
          url: input.url.trim(),
          estimatedMinutes: Math.max(1, Math.round(input.estimatedMinutes)),
          completedPomodoros: 0,
          completed: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        const target = get()
          .projects.find((project) => project.id === projectId)
          ?.tasks.find((task) => task.id === taskId)
        if (!target) return null
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) =>
            replaceTask(project, taskId, (task) => ({
              ...task,
              subtasks: [...task.subtasks, subtask],
            })),
          ),
        }))
        return subtask
      },
      updateSubtask: (projectId, taskId, subtaskId, input) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) =>
            replaceTask(project, taskId, (task) => ({
              ...task,
              subtasks: task.subtasks.map((subtask) =>
                subtask.id === subtaskId
                  ? {
                      ...subtask,
                      ...input,
                      name: input.name.trim(),
                      description: input.description.trim(),
                      url: input.url.trim(),
                      estimatedMinutes: Math.max(1, Math.round(input.estimatedMinutes)),
                      updatedAt: nowIso(),
                    }
                  : subtask,
              ),
            })),
          ),
        })),
      toggleSubtaskComplete: (projectId, taskId, subtaskId) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) =>
            replaceTask(project, taskId, (task) => ({
              ...task,
              subtasks: task.subtasks.map((subtask) =>
                subtask.id === subtaskId
                  ? { ...subtask, completed: !subtask.completed, updatedAt: nowIso() }
                  : subtask,
              ),
            })),
          ),
        })),
      deleteSubtask: (projectId, taskId, subtaskId) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) =>
            replaceTask(project, taskId, (task) => ({
              ...task,
              subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
            })),
          ),
          focusRecords: state.focusRecords.map((record) =>
            record.subtaskId === subtaskId ? { ...record, subtaskId: null } : record,
          ),
        })),
      addResource: (projectId, input) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) => ({
            ...project,
            updatedAt: nowIso(),
            resources: [...project.resources, { ...input, id: createId('resource') }],
          })),
        })),
      updateResource: (projectId, resourceId, input) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) => ({
            ...project,
            updatedAt: nowIso(),
            resources: project.resources.map((resource) =>
              resource.id === resourceId
                ? {
                    ...resource,
                    title: input.title.trim(),
                    url: input.url.trim(),
                    description: input.description.trim(),
                  }
                : resource,
            ),
          })),
        })),
      deleteResource: (projectId, resourceId) =>
        set((state) => ({
          projects: replaceProject(state.projects, projectId, (project) => ({
            ...project,
            updatedAt: nowIso(),
            resources: project.resources.filter((resource) => resource.id !== resourceId),
          })),
        })),
      addFocusRecord: (record) =>
        set((state) => {
          const records = [...state.focusRecords, record]
          return { focusRecords: records, projects: rebuildProgress(state.projects, records) }
        }),
      updateFocusRecord: (recordId, patch) =>
        set((state) => {
          const records = state.focusRecords.map((record) =>
            record.id === recordId ? { ...record, ...patch, id: record.id } : record,
          )
          return { focusRecords: records, projects: rebuildProgress(state.projects, records) }
        }),
      deleteFocusRecord: (recordId) =>
        set((state) => {
          const records = state.focusRecords.filter((record) => record.id !== recordId)
          return { focusRecords: records, projects: rebuildProgress(state.projects, records) }
        }),
      replaceWorkspace: (workspace) => set({ ...workspace }),
      resetWorkspace: () => set({ ...DEFAULT_WORKSPACE }),
      clearPreferredPreset: (presetId) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.preferredFocusPresetId === presetId
              ? { ...project, preferredFocusPresetId: null, updatedAt: nowIso() }
              : project,
          ),
        })),
    }),
    {
      name: 'studyflow:workspace',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ projects, focusRecords }) => ({ projects, focusRecords }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener(PRESETS_CHANGED_EVENT, (event) => {
    const detail = (event as CustomEvent<PresetsChangedDetail>).detail
    if (detail.action === 'delete' && detail.presetId) {
      useWorkspaceStore.getState().clearPreferredPreset(detail.presetId)
    }
  })
}
