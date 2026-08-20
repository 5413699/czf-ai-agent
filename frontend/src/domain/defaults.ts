import type { FocusAssignment, FocusPreset, PreferencesState, WorkspaceState } from './models'

export const SCHEMA_VERSION = 2

export const EMPTY_ASSIGNMENT: FocusAssignment = {
  label: '',
  projectId: null,
  taskId: null,
  subtaskId: null,
}

const createDefaultSoundscape = () => ({
  masterVolume: 0.5,
  musicId: null,
  musicVolume: 0.45,
  ambient: [{ id: 'spring-rain', volume: 0.35 }],
})

const createDefaultPromptSounds = () => ({
  startSoundId: 'default-start',
  completeSoundId: 'default-complete',
  volume: 0.72,
})

export const BUILT_IN_PRESETS: FocusPreset[] = [
  {
    id: 'classic',
    name: '经典番茄',
    description: '适合日常学习与建立稳定专注习惯',
    icon: 'timer',
    builtIn: true,
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakInterval: 4,
    autoStartFocus: true,
    autoStartBreak: true,
    soundscape: createDefaultSoundscape(),
    promptSounds: createDefaultPromptSounds(),
  },
  {
    id: 'student',
    name: '学生自习',
    description: '适合听课、阅读、背诵和连续刷题',
    icon: 'book-open',
    builtIn: true,
    focusMinutes: 45,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
    longBreakInterval: 3,
    autoStartFocus: true,
    autoStartBreak: true,
    soundscape: createDefaultSoundscape(),
    promptSounds: createDefaultPromptSounds(),
  },
  {
    id: 'deep',
    name: '深度工作',
    description: '适合编程、写作和需要持续推理的难题',
    icon: 'brain',
    builtIn: true,
    focusMinutes: 52,
    shortBreakMinutes: 17,
    longBreakMinutes: 25,
    longBreakInterval: 2,
    autoStartFocus: true,
    autoStartBreak: true,
    soundscape: createDefaultSoundscape(),
    promptSounds: createDefaultPromptSounds(),
  },
  {
    id: 'light',
    name: '轻量协作',
    description: '适合会议准备、资料整理和碎片任务',
    icon: 'messages-square',
    builtIn: true,
    focusMinutes: 15,
    shortBreakMinutes: 3,
    longBreakMinutes: 10,
    longBreakInterval: 6,
    autoStartFocus: true,
    autoStartBreak: true,
    soundscape: createDefaultSoundscape(),
    promptSounds: createDefaultPromptSounds(),
  },
  {
    id: 'immersive',
    name: '长程沉浸',
    description: '适合论文、项目开发和长篇内容创作',
    icon: 'waves',
    builtIn: true,
    focusMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 30,
    longBreakInterval: 3,
    autoStartFocus: true,
    autoStartBreak: true,
    soundscape: createDefaultSoundscape(),
    promptSounds: createDefaultPromptSounds(),
  },
]

export const DEFAULT_WORKSPACE: WorkspaceState = {
  projects: [],
  focusRecords: [],
}

export const DEFAULT_PREFERENCES: PreferencesState = {
  theme: 'day',
  activePresetId: 'classic',
  presets: BUILT_IN_PRESETS,
  presetOrder: BUILT_IN_PRESETS.map((preset) => preset.id),
  ambientOrder: ['spring-rain', 'meadow-crickets', 'fireplace', 'meadow-wind'],
  musicOrder: ['none', 'chill', 'space', 'slow'],
  streamTheme: 'night',
  streamClockStyle: 'orbit',
  streamBackground: 'solid',
}
