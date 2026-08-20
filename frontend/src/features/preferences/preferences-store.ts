import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_PREFERENCES, SCHEMA_VERSION } from '../../domain/defaults'
import type { ClockStyle, FocusPreset, PreferencesState, Theme } from '../../domain/models'

export const PRESETS_CHANGED_EVENT = 'studyflow:presets-changed'

export interface PresetsChangedDetail {
  action: 'save' | 'delete' | 'reorder'
  presetId?: string
}

function announcePresetsChanged(detail: PresetsChangedDetail): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<PresetsChangedDetail>(PRESETS_CHANGED_EVENT, { detail }))
  }
}

interface PreferencesActions {
  setTheme: (theme: Theme) => void
  setStreamTheme: (theme: Theme) => void
  setStreamClockStyle: (style: ClockStyle) => void
  setStreamBackground: (background: 'solid' | 'transparent') => void
  setActivePreset: (presetId: string) => void
  savePreset: (preset: FocusPreset) => void
  deletePreset: (presetId: string) => void
  reorderPresets: (order: string[]) => void
  replacePreferences: (preferences: PreferencesState) => void
  resetPreferences: () => void
}

export type PreferencesStore = PreferencesState & PreferencesActions

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PREFERENCES,
      setTheme: (theme) => set({ theme }),
      setStreamTheme: (streamTheme) => set({ streamTheme }),
      setStreamClockStyle: (streamClockStyle) => set({ streamClockStyle }),
      setStreamBackground: (streamBackground) => set({ streamBackground }),
      setActivePreset: (presetId) => {
        if (get().presets.some((preset) => preset.id === presetId))
          set({ activePresetId: presetId })
      },
      savePreset: (preset) => {
        set((state) => {
          const exists = state.presets.some((item) => item.id === preset.id)
          return {
            presets: exists
              ? state.presets.map((item) => (item.id === preset.id ? preset : item))
              : [...state.presets, preset],
            presetOrder: exists ? state.presetOrder : [...state.presetOrder, preset.id],
          }
        })
        announcePresetsChanged({ action: 'save', presetId: preset.id })
      },
      deletePreset: (presetId) => {
        const preset = get().presets.find((item) => item.id === presetId)
        if (!preset || preset.builtIn) return
        set((state) => {
          return {
            presets: state.presets.filter((item) => item.id !== presetId),
            presetOrder: state.presetOrder.filter((id) => id !== presetId),
            activePresetId: state.activePresetId === presetId ? 'classic' : state.activePresetId,
          }
        })
        announcePresetsChanged({ action: 'delete', presetId })
      },
      reorderPresets: (order) => {
        set((state) => {
          const available = new Set(state.presets.map((preset) => preset.id))
          const unique = order.filter(
            (id, index) => available.has(id) && order.indexOf(id) === index,
          )
          for (const preset of state.presets)
            if (!unique.includes(preset.id)) unique.push(preset.id)
          return { presetOrder: unique }
        })
        announcePresetsChanged({ action: 'reorder' })
      },
      replacePreferences: (preferences) => set({ ...preferences }),
      resetPreferences: () => set({ ...DEFAULT_PREFERENCES }),
    }),
    {
      name: 'studyflow:preferences',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        activePresetId: state.activePresetId,
        presets: state.presets,
        presetOrder: state.presetOrder,
        ambientOrder: state.ambientOrder,
        musicOrder: state.musicOrder,
        streamTheme: state.streamTheme,
        streamClockStyle: state.streamClockStyle,
        streamBackground: state.streamBackground,
      }),
    },
  ),
)

export function selectOrderedPresets(state: PreferencesStore): FocusPreset[] {
  const positions = new Map(state.presetOrder.map((id, index) => [id, index]))
  return [...state.presets].sort(
    (a, b) =>
      (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  )
}

export function findPresetById(
  state: PreferencesStore,
  presetId: string | null,
): FocusPreset | null {
  if (!presetId) return null
  return state.presets.find((preset) => preset.id === presetId) ?? null
}
