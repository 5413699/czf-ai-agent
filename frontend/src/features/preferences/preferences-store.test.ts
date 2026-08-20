// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { BUILT_IN_PRESETS } from '../../domain/defaults'
import { useWorkspaceStore } from '../workspace/workspace-store'
import { usePreferencesStore } from './preferences-store'

describe('preferences store', () => {
  beforeEach(() => {
    localStorage.clear()
    usePreferencesStore.getState().resetPreferences()
    useWorkspaceStore.getState().resetWorkspace()
  })

  it('deletes a custom preset and clears project references', () => {
    const customPreset = {
      ...structuredClone(BUILT_IN_PRESETS[0]!),
      id: 'custom-writing',
      name: '写作冲刺',
      builtIn: false,
    }
    usePreferencesStore.getState().savePreset(customPreset)
    usePreferencesStore.getState().setActivePreset(customPreset.id)
    useWorkspaceStore.getState().addProject({
      name: '论文',
      description: '',
      preferredFocusPresetId: customPreset.id,
    })

    usePreferencesStore.getState().deletePreset(customPreset.id)

    expect(usePreferencesStore.getState().activePresetId).toBe('classic')
    expect(
      usePreferencesStore.getState().presets.some((preset) => preset.id === customPreset.id),
    ).toBe(false)
    expect(useWorkspaceStore.getState().projects[0]!.preferredFocusPresetId).toBeNull()
  })

  it('does not delete a built-in preset', () => {
    usePreferencesStore.getState().deletePreset('classic')
    expect(usePreferencesStore.getState().presets.some((preset) => preset.id === 'classic')).toBe(
      true,
    )
  })
})
