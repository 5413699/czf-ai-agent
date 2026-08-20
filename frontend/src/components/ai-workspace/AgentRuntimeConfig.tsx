import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Gauge, GitBranch, Plus, SlidersHorizontal, Trash2, Upload } from 'lucide-react'
import type { AgentPluginSelection, AgentRuntimeConfig } from '../../domain/models'
import styles from './AgentRuntimeConfig.module.css'

type RuntimeKey = keyof AgentRuntimeConfig

interface RuntimeOption extends AgentPluginSelection {
  kind: RuntimeKey
  description: string
  access?: string
}

const STORAGE_KEY = 'studyflow.agent-runtime-options'

const presetOptions: Record<RuntimeKey, RuntimeOption[]> = {
  loop: [
    {
      kind: 'loop',
      id: 'guided-discovery',
      name: '引导式梳理',
      description: '逐项澄清目标、约束和完成标准',
      source: 'preset',
      configuration: {},
    },
    {
      kind: 'loop',
      id: 'plan-execute-review',
      name: '规划·执行·复盘',
      description: '适合需要多轮工具协作的复杂任务',
      source: 'preset',
      configuration: {},
    },
    {
      kind: 'loop',
      id: 'research-synthesis',
      name: '检索与归纳',
      description: '围绕资料检索、证据整理和结论收敛',
      source: 'preset',
      configuration: {},
    },
  ],
  model: [
    {
      kind: 'model',
      id: 'platform-balanced',
      name: '平台均衡模型',
      description: '兼顾速度与复杂任务处理能力',
      access: '后续需权限',
      source: 'preset',
      configuration: {},
    },
    {
      kind: 'model',
      id: 'platform-reasoning',
      name: '平台推理模型',
      description: '适合长链路规划和高难度分析',
      access: '后续需权限',
      source: 'preset',
      configuration: {},
    },
  ],
  scheduler: [
    {
      kind: 'scheduler',
      id: 'sequential',
      name: '顺序调度',
      description: '一次推进一个步骤，过程最容易追踪',
      source: 'preset',
      configuration: {},
    },
    {
      kind: 'scheduler',
      id: 'parallel-safe',
      name: '安全并行',
      description: '仅并行处理互不依赖的只读子任务',
      source: 'preset',
      configuration: {},
    },
    {
      kind: 'scheduler',
      id: 'budget-aware',
      name: '预算优先',
      description: '按调用预算和时限动态控制步骤',
      source: 'preset',
      configuration: {},
    },
  ],
}

export const DEFAULT_AGENT_RUNTIME: AgentRuntimeConfig = {
  loop: presetOptions.loop[0]!,
  model: presetOptions.model[0]!,
  scheduler: presetOptions.scheduler[0]!,
}

const runtimeMeta = {
  loop: { label: 'Agent Loop', icon: GitBranch },
  model: { label: '模型', icon: Gauge },
  scheduler: { label: '调度', icon: SlidersHorizontal },
} satisfies Record<RuntimeKey, { label: string; icon: typeof GitBranch }>

function isRuntimeKey(value: unknown): value is RuntimeKey {
  return value === 'loop' || value === 'model' || value === 'scheduler'
}

function normalizeOption(value: unknown): RuntimeOption | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<RuntimeOption>
  if (!isRuntimeKey(candidate.kind) || typeof candidate.name !== 'string') return null
  return {
    kind: candidate.kind,
    id:
      typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : `custom-${crypto.randomUUID()}`,
    name: candidate.name.trim(),
    description:
      typeof candidate.description === 'string' && candidate.description.trim()
        ? candidate.description.trim()
        : '用户自定义运行插件',
    source: 'custom',
    configuration:
      candidate.configuration && typeof candidate.configuration === 'object'
        ? Object.fromEntries(
            Object.entries(candidate.configuration).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          )
        : {},
  }
}

function loadCustomOptions(): RuntimeOption[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const values = JSON.parse(stored) as unknown
    return Array.isArray(values)
      ? values.map(normalizeOption).filter((item): item is RuntimeOption => Boolean(item?.name))
      : []
  } catch {
    return []
  }
}

export function AgentRuntimeConfigPanel({
  value,
  onChange,
  disabled = false,
}: {
  value: AgentRuntimeConfig
  onChange: (value: AgentRuntimeConfig) => void
  disabled?: boolean
}) {
  const [customOptions, setCustomOptions] = useState<RuntimeOption[]>(loadCustomOptions)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [draftKind, setDraftKind] = useState<RuntimeKey>('loop')
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftReference, setDraftReference] = useState('')
  const allOptions = useMemo(
    () => ({
      loop: [...presetOptions.loop, ...customOptions.filter((item) => item.kind === 'loop')],
      model: [...presetOptions.model, ...customOptions.filter((item) => item.kind === 'model')],
      scheduler: [
        ...presetOptions.scheduler,
        ...customOptions.filter((item) => item.kind === 'scheduler'),
      ],
    }),
    [customOptions],
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOptions))
  }, [customOptions])

  function select(key: RuntimeKey, id: string) {
    const option = allOptions[key].find((item) => item.id === id)
    if (option) onChange({ ...value, [key]: option })
  }

  function addOption(option: RuntimeOption) {
    setCustomOptions((items) => [...items.filter((item) => item.id !== option.id), option])
    onChange({ ...value, [option.kind]: option })
  }

  function createOption() {
    if (!draftName.trim()) return
    const referenceKey = draftKind === 'model' ? 'modelId' : 'pluginId'
    addOption({
      kind: draftKind,
      id: `custom-${crypto.randomUUID()}`,
      name: draftName.trim(),
      description: draftDescription.trim() || '用户自定义运行插件',
      source: 'custom',
      configuration: draftReference.trim() ? { [referenceKey]: draftReference.trim() } : {},
    })
    setDraftName('')
    setDraftDescription('')
    setDraftReference('')
    setCreatorOpen(false)
  }

  async function importOption(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const option = normalizeOption(JSON.parse(await file.text()))
      if (option?.name) addOption(option)
    } catch {
      // Invalid manifests are ignored instead of entering a run snapshot.
    }
  }

  function removeOption(option: RuntimeOption) {
    setCustomOptions((items) => items.filter((item) => item.id !== option.id))
    if (value[option.kind].id === option.id)
      onChange({ ...value, [option.kind]: presetOptions[option.kind][0]! })
  }

  return (
    <details className={styles.runtime} open>
      <summary>
        <span>
          <GitBranch />
          运行配置
        </span>
        <small>
          {value.loop.name} · {value.model.name} · {value.scheduler.name}
        </small>
      </summary>
      <div className={styles.configToolbar}>
        <span>每次运行会锁定一份配置快照</span>
        <div>
          <label title="导入运行配置">
            <Upload />
            导入
            <input
              type="file"
              accept="application/json,.json"
              onChange={importOption}
              disabled={disabled}
            />
          </label>
          <button type="button" onClick={() => setCreatorOpen((open) => !open)} disabled={disabled}>
            <Plus />
            自定义
          </button>
        </div>
      </div>
      {creatorOpen ? (
        <div className={styles.creator}>
          <select
            value={draftKind}
            onChange={(event) => setDraftKind(event.target.value as RuntimeKey)}
            aria-label="自定义运行配置类型"
          >
            <option value="loop">Agent Loop</option>
            <option value="model">模型</option>
            <option value="scheduler">调度</option>
          </select>
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="配置名称"
            aria-label="自定义运行配置名称"
          />
          <input
            value={draftDescription}
            onChange={(event) => setDraftDescription(event.target.value)}
            placeholder="适用场景简介"
            aria-label="自定义运行配置简介"
          />
          <input
            value={draftReference}
            onChange={(event) => setDraftReference(event.target.value)}
            placeholder={draftKind === 'model' ? '模型标识' : '后端插件 ID'}
            aria-label="自定义运行配置引用"
          />
          <button type="button" onClick={createOption} disabled={!draftName.trim()}>
            保存配置
          </button>
        </div>
      ) : null}
      <div className={styles.grid}>
        {(Object.keys(runtimeMeta) as RuntimeKey[]).map((key) => {
          const meta = runtimeMeta[key]
          const Icon = meta.icon
          const selected = allOptions[key].find((item) => item.id === value[key].id)
          return (
            <section key={key}>
              <label>
                <span>
                  <Icon />
                  {meta.label}
                </span>
                <select
                  value={value[key].id}
                  onChange={(event) => select(key, event.target.value)}
                  disabled={disabled}
                >
                  {allOptions[key].map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>{selected?.description}</p>
              <div className={styles.optionMeta}>
                {selected?.access ? <small>{selected.access}</small> : <span />}
                {selected?.source === 'custom' ? (
                  <button
                    type="button"
                    onClick={() => removeOption(selected)}
                    disabled={disabled}
                    title="删除自定义配置"
                    aria-label={`删除自定义配置${selected.name}`}
                  >
                    <Trash2 />
                  </button>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>
      <p className={styles.securityNote}>
        {disabled
          ? '运行已经开始，配置快照已锁定。新建一次运行后可以重新选择。'
          : '这里只保存非敏感配置。模型密钥必须由后端密钥管理服务保存，不进入浏览器。'}
      </p>
    </details>
  )
}
