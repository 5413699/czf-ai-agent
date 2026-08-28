import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Expand,
  Leaf,
  Maximize,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SkipForward,
  Square,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react'
import { SmoothTimerDial } from '../components/focus/SmoothTimerDial'
import { AudioIcon } from '../components/AudioIcon'
import { PageHeader } from '../components/PageHeader'
import { PresetIcon } from '../components/PresetIcon'
import { BUILT_IN_PRESETS } from '../domain/defaults'
import type { ClockStyle, FocusPreset, Theme } from '../domain/models'
import { usePreferencesStore } from '../features/preferences/preferences-store'
import { AMBIENT_SOUNDS, MUSIC_TRACKS } from '../features/soundscape/catalog'
import { cueService } from '../features/soundscape/cue-service'
import { soundscapeService } from '../features/soundscape/soundscape-service'
import { useSoundscape } from '../features/soundscape/use-soundscape'
import { settingsFromPreset, timerEngine } from '../features/timer/timer-engine'
import { useTimer } from '../features/timer/use-timer'
import { useWorkspaceStore } from '../features/workspace/workspace-store'
import {
  createCustomMediaUrl,
  listCustomMedia,
  saveCustomMedia,
  type CustomMediaKind,
} from '../infrastructure/media/media-repository'
import styles from './FocusPage.module.css'

const phaseNames = { focus: '专注蓄能', shortBreak: '短暂休息', longBreak: '长休息' }
const themeOptions: Array<{ id: Theme; name: string }> = [
  { id: 'night', name: '极夜' },
  { id: 'day', name: '永昼' },
  { id: 'eye', name: '护眼' },
]
const clockOptions: Array<{ id: ClockStyle; name: string }> = [
  { id: 'tomato-fill', name: '番茄蓄能' },
  { id: 'orbit', name: '经典大环' },
  { id: 'desk-card', name: '桌面时牌' },
]

const clockOptionIcons = {
  'tomato-fill': Leaf,
  orbit: Circle,
  'desk-card': Square,
} satisfies Record<ClockStyle, typeof Circle>

function makeCustomPreset(base: FocusPreset): FocusPreset {
  return {
    ...base,
    id: `custom-${crypto.randomUUID()}`,
    name: '我的专注方案',
    description: '为自己的工作节奏量身定制',
    builtIn: false,
    soundscape: {
      ...base.soundscape,
      ambient: base.soundscape.ambient.map((item) => ({ ...item })),
    },
    promptSounds: { ...base.promptSounds },
  }
}

export default function FocusPage() {
  const timer = useTimer()
  const soundscape = useSoundscape()
  const presets = usePreferencesStore((state) => state.presets)
  const presetOrder = usePreferencesStore((state) => state.presetOrder)
  const musicOrder = usePreferencesStore((state) => state.musicOrder)
  const ambientOrder = usePreferencesStore((state) => state.ambientOrder)
  const activePresetId = usePreferencesStore((state) => state.activePresetId)
  const setActivePreset = usePreferencesStore((state) => state.setActivePreset)
  const savePreset = usePreferencesStore((state) => state.savePreset)
  const deletePreset = usePreferencesStore((state) => state.deletePreset)
  const reorderPresets = usePreferencesStore((state) => state.reorderPresets)
  const theme = usePreferencesStore((state) => state.theme)
  const streamTheme = usePreferencesStore((state) => state.streamTheme)
  const streamClockStyle = usePreferencesStore((state) => state.streamClockStyle)
  const streamBackground = usePreferencesStore((state) => state.streamBackground)
  const setStreamTheme = usePreferencesStore((state) => state.setStreamTheme)
  const setStreamClockStyle = usePreferencesStore((state) => state.setStreamClockStyle)
  const setStreamBackground = usePreferencesStore((state) => state.setStreamBackground)
  const projects = useWorkspaceStore((state) => state.projects)
  const updateProject = useWorkspaceStore((state) => state.updateProject)
  const [immersive, setImmersive] = useState(false)
  const [presetsExpanded, setPresetsExpanded] = useState(false)
  const [musicExpanded, setMusicExpanded] = useState(false)
  const [ambientExpanded, setAmbientExpanded] = useState(false)
  const [goalExpanded, setGoalExpanded] = useState(false)
  const [editingPreset, setEditingPreset] = useState<FocusPreset | null>(null)
  const [, setCatalogRevision] = useState(0)
  const cuePreviewRef = useRef<number | null>(null)

  useEffect(() => {
    let disposed = false
    async function restoreCustomMedia() {
      let musicRecords
      let ambientRecords
      try {
        ;[musicRecords, ambientRecords] = await Promise.all([
          listCustomMedia('music'),
          listCustomMedia('ambient'),
        ])
      } catch {
        return
      }
      for (const record of [...musicRecords, ...ambientRecords]) {
        const src = await createCustomMediaUrl(record.id)
        if (disposed || !src) continue
        const item = {
          id: record.id,
          name: record.name,
          description: record.description,
          icon: record.kind === 'music' ? 'music' : 'waves',
          src,
        }
        const catalog = record.kind === 'music' ? MUSIC_TRACKS : AMBIENT_SOUNDS
        if (!catalog.some((candidate) => candidate.id === item.id)) catalog.push(item)
      }
      if (!disposed) setCatalogRevision((value) => value + 1)
    }
    void restoreCustomMedia()
    return () => {
      disposed = true
    }
  }, [])

  const orderedPresets = useMemo(() => {
    const position = new Map(presetOrder.map((id, index) => [id, index]))
    return [...presets].sort((a, b) => (position.get(a.id) ?? 999) - (position.get(b.id) ?? 999))
  }, [presetOrder, presets])
  const musicPositions = new Map(musicOrder.map((id, index) => [id, index]))
  const music = [...MUSIC_TRACKS].sort(
    (a, b) => (musicPositions.get(a.id) ?? 999) - (musicPositions.get(b.id) ?? 999),
  )
  const ambientPositions = new Map(ambientOrder.map((id, index) => [id, index]))
  const ambient = [...AMBIENT_SOUNDS].sort(
    (a, b) => (ambientPositions.get(a.id) ?? 999) - (ambientPositions.get(b.id) ?? 999),
  )
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0]

  useEffect(() => {
    if (!activePreset) return
    soundscapeService.configure(activePreset.soundscape)
  }, [activePreset])

  useEffect(
    () =>
      timerEngine.on('phasechange', (snapshot) => {
        const preset = usePreferencesStore
          .getState()
          .presets.find((item) => item.id === usePreferencesStore.getState().activePresetId)
        if (!preset) return
        void cueService.play(
          snapshot.phase === 'focus' ? 'default-start' : 'default-complete',
          preset.promptSounds.volume,
        )
      }),
    [],
  )

  useEffect(() => {
    if (timer.status === 'running') void soundscapeService.play()
    else if (timer.status === 'paused') soundscapeService.pause()
    else if (timer.status === 'idle') soundscapeService.stop()
  }, [timer.status])

  useEffect(() => {
    if (!immersive) return
    document.documentElement.dataset.theme = streamTheme
    return () => {
      document.documentElement.dataset.theme = theme
    }
  }, [immersive, streamTheme, theme])

  useEffect(() => {
    document.documentElement.dataset.immersive = immersive ? 'true' : 'false'
    return () => {
      delete document.documentElement.dataset.immersive
    }
  }, [immersive])

  function applyPreset(preset: FocusPreset) {
    setActivePreset(preset.id)
    timerEngine.queueSettings(settingsFromPreset(preset))
    soundscapeService.configure(preset.soundscape)
  }
  function selectAssignment(value: string) {
    if (!value) {
      timerEngine.setAssignment({ label: '', projectId: null, taskId: null, subtaskId: null })
      return
    }
    const [projectId = '', taskId = '', subtaskId = ''] = value.split(':')
    const project = projects.find((item) => item.id === projectId)
    const task = project?.tasks.find((item) => item.id === taskId)
    const subtask = task?.subtasks.find((item) => item.id === subtaskId)
    timerEngine.setAssignment({
      label: subtask?.name ?? task?.name ?? project?.name ?? '',
      projectId: projectId || null,
      taskId: taskId || null,
      subtaskId: subtaskId || null,
    })
    const preferred = presets.find((preset) => preset.id === project?.preferredFocusPresetId)
    if (preferred) applyPreset(preferred)
  }
  function changeGoal(value: string) {
    timerEngine.setAssignment({ ...timer.assignment, label: value })
  }
  function movePreset(index: number, direction: -1 | 1) {
    const next = [...orderedPresets]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    reorderPresets(next.map((item) => item.id))
  }
  function removePreset(preset: FocusPreset) {
    if (preset.builtIn) return
    const usedBy = projects.filter((project) => project.preferredFocusPresetId === preset.id)
    const detail = usedBy.length
      ? `\n${usedBy.length} 个项目正在使用它，删除后将改为“跟随当前方案”。`
      : ''
    if (!window.confirm(`删除方案“${preset.name}”？${detail}`)) return
    for (const project of usedBy)
      updateProject(project.id, {
        name: project.name,
        description: project.description,
        preferredFocusPresetId: null,
      })
    deletePreset(preset.id)
  }
  function submitPreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingPreset) return
    savePreset(editingPreset)
    applyPreset(editingPreset)
    setEditingPreset(null)
  }
  function patchSoundscape(patch: Partial<FocusPreset['soundscape']>) {
    if (!activePreset) return
    const next = { ...activePreset, soundscape: { ...activePreset.soundscape, ...patch } }
    savePreset(next)
    soundscapeService.configure(next.soundscape)
  }
  function setMusic(id: string | null) {
    patchSoundscape({ musicId: id })
  }
  function setAmbientEnabled(id: string, enabled: boolean) {
    const current = soundscape.ambient
    const next =
      enabled && !current.some((item) => item.id === id)
        ? [...current, { id, volume: 0.35 }]
        : enabled
          ? current
          : current.filter((item) => item.id !== id)
    patchSoundscape({ ambient: next })
  }
  function setAmbientMixVolume(volume: number) {
    patchSoundscape({ ambient: soundscape.ambient.map((item) => ({ ...item, volume })) })
  }
  function moveSound(kind: 'music' | 'ambient', id: string, direction: -1 | 1) {
    const source =
      kind === 'music' ? ['none', ...music.map((item) => item.id)] : ambient.map((item) => item.id)
    const unique = source.filter((item, index) => source.indexOf(item) === index)
    const index = unique.indexOf(id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= unique.length) return
    ;[unique[index], unique[target]] = [unique[target]!, unique[index]!]
    usePreferencesStore.setState(
      kind === 'music' ? { musicOrder: unique } : { ambientOrder: unique },
    )
  }
  function previewCue(volume: number) {
    if (cuePreviewRef.current) window.clearTimeout(cuePreviewRef.current)
    cuePreviewRef.current = window.setTimeout(
      () => void cueService.play('default-start', volume),
      120,
    )
  }
  function changeCueVolume(volume: number) {
    if (!activePreset) return
    savePreset({ ...activePreset, promptSounds: { ...activePreset.promptSounds, volume } })
    previewCue(volume)
  }
  async function uploadMedia(kind: CustomMediaKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const metadata = await saveCustomMedia({
      kind,
      name: file.name.replace(/\.[^.]+$/, ''),
      description: '我的自定义声音',
      file,
    })
    const src = await createCustomMediaUrl(metadata.id)
    if (!src) return
    const item = {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      icon: kind === 'music' ? 'music' : 'waves',
      src,
    }
    if (kind === 'music') {
      if (!MUSIC_TRACKS.some((candidate) => candidate.id === item.id)) MUSIC_TRACKS.push(item)
      setCatalogRevision((value) => value + 1)
      setMusic(item.id)
    } else {
      if (!AMBIENT_SOUNDS.some((candidate) => candidate.id === item.id)) AMBIENT_SOUNDS.push(item)
      setCatalogRevision((value) => value + 1)
      setAmbientEnabled(item.id, true)
    }
    event.target.value = ''
  }
  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      /* Fullscreen may be blocked by the host. */
    }
  }
  function toggleTimer() {
    if (timer.status === 'running') {
      timerEngine.pause()
      soundscapeService.pause()
      return
    }
    if (timer.status === 'idle' || timer.status === 'waiting')
      void cueService.play('default-start', activePreset?.promptSounds.volume ?? 0.72)
    timerEngine.start()
    void soundscapeService.play()
  }
  function exitImmersive() {
    setImmersive(false)
    if (document.fullscreenElement) void document.exitFullscreen()
  }

  const assignmentValue = [
    timer.assignment.projectId,
    timer.assignment.taskId,
    timer.assignment.subtaskId,
  ]
    .filter(Boolean)
    .join(':')
  const timerView = (
    <section className={styles.timerStage} aria-label="番茄计时器">
      <div className={styles.phasePill}>
        <span />
        {phaseNames[timer.phase]} · 第 {timer.round} 轮
      </div>
      <SmoothTimerDial
        timer={timer}
        style={streamClockStyle}
        label={timer.assignment.label || '自由专注'}
      />
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => timerEngine.stop()}
          aria-label="重置"
        >
          <RotateCcw size={19} />
        </button>
        <button type="button" className={styles.primaryButton} onClick={toggleTimer}>
          {timer.status === 'running' ? <Pause /> : <Play />}
          {timer.status === 'running'
            ? '暂停一下'
            : timer.status === 'paused'
              ? '继续专注'
              : '开始专注'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => timerEngine.skipPhase()}
          aria-label="跳过当前阶段"
        >
          <SkipForward size={19} />
        </button>
      </div>
    </section>
  )

  if (immersive)
    return (
      <div
        className={`${styles.immersive} ${streamBackground === 'transparent' ? styles.transparent : ''}`}
      >
        <div className={styles.immersiveTools}>
          <div>
            {themeOptions.map((item) => (
              <button
                type="button"
                key={item.id}
                className={streamTheme === item.id ? styles.toolActive : ''}
                onClick={() => setStreamTheme(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div>
            {clockOptions.map((item) => (
              <button
                type="button"
                key={item.id}
                className={streamClockStyle === item.id ? styles.toolActive : ''}
                onClick={() => setStreamClockStyle(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setStreamBackground(streamBackground === 'solid' ? 'transparent' : 'solid')
            }
          >
            {streamBackground === 'solid' ? '透明背景' : '实体背景'}
          </button>
          <button type="button" onClick={() => void enterFullscreen()}>
            <Maximize size={16} />
            全屏
          </button>
          <button type="button" onClick={exitImmersive}>
            <X size={17} />
            退出
          </button>
        </div>
        {timerView}
      </div>
    )

  return (
    <>
      <PageHeader
        eyebrow="FOCUS ROOM"
        title="今天，种下一颗专注"
        description="选择手头的任务，按一次开始。专注与休息自然循环，完成记录自动回到任务进度。"
        actions={
          <button type="button" className={styles.ghostButton} onClick={() => setImmersive(true)}>
            <Expand size={17} />
            进入沉浸
          </button>
        }
      />
      <div className={styles.layout}>
        <div className={styles.timerColumn}>
          <div className={styles.clockStylePicker} aria-label="计时器样式">
            {clockOptions.map((item) => {
              const Icon = clockOptionIcons[item.id]
              return (
                <button
                  type="button"
                  key={item.id}
                  className={streamClockStyle === item.id ? styles.clockStyleActive : ''}
                  onClick={() => setStreamClockStyle(item.id)}
                  aria-label={`切换为${item.name}`}
                  aria-pressed={streamClockStyle === item.id}
                  title={item.name}
                >
                  <Icon />
                  <span>{item.name}</span>
                </button>
              )
            })}
          </div>
          {timerView}
        </div>
        <aside className={styles.sidePanel}>
          <div className={styles.sideHeading}>
            <div>
              <span>本次节奏</span>
              <h2>{activePreset?.name ?? '经典番茄'}</h2>
            </div>
            <Sparkles size={20} />
          </div>
          <div className={styles.presets}>
            {orderedPresets.slice(0, presetsExpanded ? undefined : 4).map((preset, index) => (
              <div
                className={preset.id === activePresetId ? styles.selectedPreset : styles.preset}
                key={preset.id}
              >
                <button type="button" onClick={() => applyPreset(preset)}>
                  <span>
                    <PresetIcon name={preset.icon} />
                  </span>
                  <div>
                    <strong>{preset.name}</strong>
                    <small>
                      {preset.focusMinutes} 分钟 · 休息 {preset.shortBreakMinutes} 分钟
                    </small>
                  </div>
                  {preset.id === activePresetId ? <Check size={16} /> : null}
                </button>
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    onClick={() => movePreset(index, -1)}
                    disabled={index === 0}
                    aria-label="上移"
                  >
                    <ArrowUp />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePreset(index, 1)}
                    disabled={index === orderedPresets.length - 1}
                    aria-label="下移"
                  >
                    <ArrowDown />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingPreset({
                        ...preset,
                        soundscape: {
                          ...preset.soundscape,
                          ambient: preset.soundscape.ambient.map((item) => ({ ...item })),
                        },
                      })
                    }
                    aria-label="编辑"
                  >
                    <Settings2 />
                  </button>
                  {preset.builtIn ? (
                    <button
                      type="button"
                      onClick={() => {
                        const original = BUILT_IN_PRESETS.find((item) => item.id === preset.id)
                        if (original) savePreset(original)
                      }}
                      aria-label="恢复默认"
                    >
                      <RotateCcw />
                    </button>
                  ) : (
                    <button type="button" onClick={() => removePreset(preset)} aria-label="删除">
                      <Trash2 />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.listFooter}>
            <button type="button" onClick={() => setPresetsExpanded((value) => !value)}>
              {presetsExpanded ? <ChevronUp /> : <ChevronDown />}
              {presetsExpanded ? '收起方案' : '查看全部方案'}
            </button>
            <button
              type="button"
              onClick={() => activePreset && setEditingPreset(makeCustomPreset(activePreset))}
            >
              <Plus />
              自定义
            </button>
          </div>
          <section className={styles.assignment}>
            <div className={styles.sectionTitle}>
              <Target size={16} />
              这颗番茄做什么
            </div>
            <select
              value={assignmentValue}
              onChange={(event) => selectAssignment(event.target.value)}
            >
              <option value="">自由专注</option>
              {projects
                .filter((project) => !project.archived)
                .map((project) => (
                  <optgroup key={project.id} label={project.name}>
                    <option value={project.id}>{project.name}（项目）</option>
                    {project.tasks
                      .filter((task) => !task.archived)
                      .map((task) => (
                        <option key={task.id} value={`${project.id}:${task.id}`}>
                          {task.name}
                        </option>
                      ))}
                    {project.tasks.flatMap((task) =>
                      task.subtasks.map((subtask) => (
                        <option key={subtask.id} value={`${project.id}:${task.id}:${subtask.id}`}>
                          　{subtask.name}
                        </option>
                      )),
                    )}
                  </optgroup>
                ))}
            </select>
            <div className={`${styles.goalBox} ${goalExpanded ? styles.goalExpanded : ''}`}>
              <textarea
                rows={goalExpanded ? 4 : 1}
                value={timer.assignment.label}
                placeholder="写下一句话目标..."
                onChange={(event) => changeGoal(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setGoalExpanded((value) => !value)}
                aria-label={goalExpanded ? '收起目标' : '展开目标'}
              >
                {goalExpanded ? <ChevronUp /> : <ChevronDown />}
              </button>
            </div>
          </section>
          <details className={styles.soundscape}>
            <summary>
              <span>
                <Music2 />
                专注声景
              </span>
              <small>{soundscape.playing ? '正在播放' : '随计时器启停'}</small>
            </summary>
            <VolumeControl
              label="声景总音量"
              value={soundscape.masterVolume}
              onChange={(value) => patchSoundscape({ masterVolume: value })}
            />
            <SoundList
              title="背景音乐"
              expanded={musicExpanded}
              onToggle={() => setMusicExpanded((value) => !value)}
              uploadLabel="添加背景音乐"
              onUpload={(event) => uploadMedia('music', event)}
            >
              {[
                {
                  id: 'none',
                  name: '无音乐',
                  description: '只保留环境音',
                  icon: 'none',
                  src: '',
                },
                ...music,
              ]
                .slice(0, musicExpanded ? undefined : 4)
                .map((item) => (
                  <div className={styles.soundRow} key={item.id}>
                    <button
                      type="button"
                      className={
                        (soundscape.musicId ?? 'none') === item.id
                          ? styles.soundSelected
                          : styles.soundItem
                      }
                      onClick={() => setMusic(item.id === 'none' ? null : item.id)}
                    >
                      <span>
                        <AudioIcon name={item.icon} />
                      </span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.description}</small>
                      </div>
                    </button>
                    <div>
                      <button
                        type="button"
                        onClick={() => moveSound('music', item.id, -1)}
                        aria-label="上移"
                      >
                        <ArrowUp />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSound('music', item.id, 1)}
                        aria-label="下移"
                      >
                        <ArrowDown />
                      </button>
                    </div>
                  </div>
                ))}
            </SoundList>
            <VolumeControl
              label="背景音乐音量"
              value={soundscape.musicVolume}
              onChange={(value) => patchSoundscape({ musicVolume: value })}
            />
            <SoundList
              title="环境音"
              expanded={ambientExpanded}
              onToggle={() => setAmbientExpanded((value) => !value)}
              uploadLabel="添加环境音"
              onUpload={(event) => uploadMedia('ambient', event)}
            >
              {ambient.slice(0, ambientExpanded ? undefined : 4).map((item) => {
                const enabled = soundscape.ambient.some((active) => active.id === item.id)
                return (
                  <div className={styles.soundRow} key={item.id}>
                    <button
                      type="button"
                      className={enabled ? styles.soundSelected : styles.soundItem}
                      onClick={() => setAmbientEnabled(item.id, !enabled)}
                    >
                      <span>
                        <AudioIcon name={item.icon} />
                      </span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.description}</small>
                      </div>
                    </button>
                    <div>
                      <button
                        type="button"
                        onClick={() => moveSound('ambient', item.id, -1)}
                        aria-label="上移"
                      >
                        <ArrowUp />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSound('ambient', item.id, 1)}
                        aria-label="下移"
                      >
                        <ArrowDown />
                      </button>
                    </div>
                  </div>
                )
              })}
            </SoundList>
            <VolumeControl
              label="环境音音量"
              value={soundscape.ambient[0]?.volume ?? 0.35}
              onChange={setAmbientMixVolume}
            />
            <VolumeControl
              label="提示音量"
              value={activePreset?.promptSounds.volume ?? 0.72}
              onChange={changeCueVolume}
            />
          </details>
          <div className={styles.sessionStats}>
            <div>
              <strong>{timer.completedFocuses}</strong>
              <span>今日番茄</span>
            </div>
            <div>
              <strong>
                {activePreset?.focusMinutes ?? 25}
                <small> min</small>
              </strong>
              <span>本轮专注</span>
            </div>
            <div>
              <strong>{timer.round}</strong>
              <span>当前轮次</span>
            </div>
          </div>
        </aside>
      </div>
      {editingPreset ? (
        <div className={styles.dialogBackdrop} role="presentation">
          <form className={styles.presetEditor} onSubmit={submitPreset}>
            <header>
              <div>
                <span>节奏方案</span>
                <h2>{editingPreset.builtIn ? '调整方案' : '自定义方案'}</h2>
              </div>
              <button type="button" onClick={() => setEditingPreset(null)} aria-label="关闭">
                <X />
              </button>
            </header>
            <label>
              方案名称
              <input
                value={editingPreset.name}
                onChange={(event) =>
                  setEditingPreset({ ...editingPreset, name: event.target.value })
                }
              />
            </label>
            <label>
              简介
              <textarea
                rows={2}
                value={editingPreset.description}
                onChange={(event) =>
                  setEditingPreset({ ...editingPreset, description: event.target.value })
                }
              />
            </label>
            <div className={styles.timeGrid}>
              <label>
                专注
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={editingPreset.focusMinutes}
                  onChange={(event) =>
                    setEditingPreset({ ...editingPreset, focusMinutes: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                短休息
                <input
                  type="number"
                  min="1"
                  value={editingPreset.shortBreakMinutes}
                  onChange={(event) =>
                    setEditingPreset({
                      ...editingPreset,
                      shortBreakMinutes: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                长休息
                <input
                  type="number"
                  min="1"
                  value={editingPreset.longBreakMinutes}
                  onChange={(event) =>
                    setEditingPreset({
                      ...editingPreset,
                      longBreakMinutes: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <button type="submit">保存并使用</button>
          </form>
        </div>
      ) : null}
    </>
  )
}

function VolumeControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className={styles.volume}>
      <span>
        <Volume2 />
        {label}
      </span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{Math.round(value * 100)}%</output>
    </label>
  )
}
function SoundList({
  title,
  expanded,
  onToggle,
  uploadLabel,
  onUpload,
  children,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  uploadLabel: string
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  children: ReactNode
}) {
  return (
    <section className={styles.soundGroup}>
      <header>
        <strong>{title}</strong>
        <div>
          <label title={uploadLabel}>
            <Upload />
            <span className="sr-only">{uploadLabel}</span>
            <input type="file" accept="audio/*" onChange={onUpload} />
          </label>
          <button type="button" onClick={onToggle}>
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
      </header>
      <div className={styles.soundGrid}>{children}</div>
    </section>
  )
}
