import { useState, type ChangeEvent } from 'react'
import {
  FileText,
  FolderOpen,
  Image,
  Link2,
  Plus,
  Puzzle,
  ServerCog,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react'
import type { AgentCapabilityKind, AgentCapabilitySelection } from '../../domain/models'
import styles from './AgentToolbox.module.css'

export interface AgentCapability extends AgentCapabilitySelection {
  description: string
  enabled: boolean
}

export interface AgentResourceDraft {
  id: string
  kind: 'document' | 'image' | 'file' | 'folder' | 'link'
  name: string
  detail: string
  files: File[]
  url: string | null
}

interface Props {
  capabilities: AgentCapability[]
  resources: AgentResourceDraft[]
  onToggleCapability: (id: string) => void
  onAddCapability: (capability: AgentCapability) => void
  onRemoveCapability: (id: string) => void
  onAddResources: (resources: AgentResourceDraft[]) => void
  onRemoveResource: (id: string) => void
}

function fileDraft(file: File, kind: AgentResourceDraft['kind']): AgentResourceDraft {
  return {
    id: crypto.randomUUID(),
    kind,
    name: file.name,
    detail: `${Math.max(1, Math.round(file.size / 1024))} KB`,
    files: [file],
    url: null,
  }
}

export function AgentToolbox({
  capabilities,
  resources,
  onToggleCapability,
  onAddCapability,
  onRemoveCapability,
  onAddResources,
  onRemoveResource,
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [link, setLink] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [customKind, setCustomKind] = useState<AgentCapabilityKind>('skill')
  const [customName, setCustomName] = useState('')
  const [customDescription, setCustomDescription] = useState('')

  function addFiles(event: ChangeEvent<HTMLInputElement>, kind: 'document' | 'image' | 'file') {
    const files = Array.from(event.target.files ?? [])
    if (files.length) onAddResources(files.map((file) => fileDraft(file, kind)))
    event.target.value = ''
  }

  function addFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    const rootName = files[0]?.webkitRelativePath.split('/')[0] || '所选文件夹'
    onAddResources([
      {
        id: crypto.randomUUID(),
        kind: 'folder',
        name: rootName,
        detail: `${files.length} 个文件`,
        files,
        url: null,
      },
    ])
    event.target.value = ''
  }

  function addLink() {
    const value = link.trim()
    if (!value) return
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol)) return
      onAddResources([
        {
          id: crypto.randomUUID(),
          kind: 'link',
          name: url.hostname,
          detail: value,
          files: [],
          url: value,
        },
      ])
      setLink('')
      setLinkOpen(false)
    } catch {
      // Keep the input visible so the user can correct an invalid URL.
    }
  }

  function addCustomCapability() {
    if (!customName.trim()) return
    onAddCapability({
      id: `custom-${crypto.randomUUID()}`,
      kind: customKind,
      name: customName.trim(),
      description: customDescription.trim() || '用户自定义能力，等待后端配置实现',
      source: 'custom',
      enabled: true,
    })
    setCustomName('')
    setCustomDescription('')
    setCustomOpen(false)
  }

  async function importCapability(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const manifest = JSON.parse(await file.text()) as {
        id?: string
        kind?: AgentCapabilityKind
        name?: string
        description?: string
      }
      if (!manifest.name || !['skill', 'mcp', 'tool'].includes(manifest.kind ?? '')) return
      onAddCapability({
        id: manifest.id?.trim() || `custom-${crypto.randomUUID()}`,
        kind: manifest.kind!,
        name: manifest.name.trim(),
        description: manifest.description?.trim() || '从本地清单导入的自定义能力',
        source: 'custom',
        enabled: true,
      })
    } catch {
      // Keep malformed manifests out of the runtime snapshot.
    }
  }

  return (
    <details className={styles.toolbox}>
      <summary>
        <span>
          <SlidersHorizontal />
          记忆、资源与能力
        </span>
        <small>
          {resources.length} 项资料 · {capabilities.filter((item) => item.enabled).length} 项能力
        </small>
      </summary>
      <section className={styles.resources}>
        <header>
          <div>
            <strong>记忆与上下文</strong>
            <small>资料进入本次 Run；长期记忆由后端策略决定</small>
          </div>
          <div className={styles.resourceActions}>
            <label title="添加文档或文件">
              <FileText />
              <span className="sr-only">添加文档或文件</span>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.pptx,application/pdf,text/*"
                onChange={(event) => addFiles(event, 'document')}
              />
            </label>
            <label title="添加图片">
              <Image />
              <span className="sr-only">添加图片</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(event) => addFiles(event, 'image')}
              />
            </label>
            <button type="button" title="添加链接" onClick={() => setLinkOpen((value) => !value)}>
              <Link2 />
              <span className="sr-only">添加链接</span>
            </button>
            <label title="添加文件夹">
              <FolderOpen />
              <span className="sr-only">添加文件夹</span>
              <input
                ref={(node) => {
                  node?.setAttribute('webkitdirectory', '')
                  node?.setAttribute('directory', '')
                }}
                type="file"
                multiple
                onChange={addFolder}
              />
            </label>
          </div>
        </header>
        {linkOpen ? (
          <div className={styles.linkComposer}>
            <input
              type="url"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://example.com/task-context"
              aria-label="任务相关链接"
            />
            <button type="button" onClick={addLink} disabled={!link.trim()}>
              添加
            </button>
          </div>
        ) : null}
        {resources.length ? (
          <div className={styles.resourceList}>
            {resources.map((resource) => (
              <div key={resource.id}>
                <span>
                  {resource.kind === 'folder' ? (
                    <FolderOpen />
                  ) : resource.kind === 'image' ? (
                    <Image />
                  ) : resource.kind === 'link' ? (
                    <Link2 />
                  ) : (
                    <FileText />
                  )}
                </span>
                <div>
                  <strong>{resource.name}</strong>
                  <small title={resource.detail}>{resource.detail}</small>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveResource(resource.id)}
                  aria-label={`移除${resource.name}`}
                >
                  <X />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      <section className={styles.capabilities}>
        <header>
          <div>
            <strong>选择 Agent 能力</strong>
            <small>当前仅配置前端选择，实际执行由后端插件系统负责</small>
          </div>
          <div className={styles.capabilityActions}>
            <label title="导入能力清单">
              <Upload />
              <span>导入</span>
              <input type="file" accept="application/json,.json" onChange={importCapability} />
            </label>
            <button type="button" onClick={() => setCustomOpen((value) => !value)}>
              <Plus />
              自定义
            </button>
          </div>
        </header>
        <div className={styles.capabilityList}>
          {capabilities.map((capability) => (
            <div
              key={capability.id}
              className={`${styles.capabilityItem} ${capability.enabled ? styles.capabilityActive : ''}`}
            >
              <button
                type="button"
                onClick={() => onToggleCapability(capability.id)}
                aria-pressed={capability.enabled}
                title={capability.description}
              >
                {capability.kind === 'skill' ? (
                  <Puzzle />
                ) : capability.kind === 'mcp' ? (
                  <ServerCog />
                ) : (
                  <Wrench />
                )}
                <span>
                  <strong>{capability.name}</strong>
                  <small>
                    {capability.kind.toUpperCase()} ·{' '}
                    {capability.source === 'preset' ? '平台预设' : '自定义'}
                  </small>
                </span>
              </button>
              {capability.source === 'custom' ? (
                <button
                  type="button"
                  className={styles.deleteCapability}
                  onClick={() => onRemoveCapability(capability.id)}
                  aria-label={`删除自定义能力${capability.name}`}
                  title="删除自定义能力"
                >
                  <Trash2 />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {customOpen ? (
          <div className={styles.customForm}>
            <select
              value={customKind}
              onChange={(event) => setCustomKind(event.target.value as AgentCapabilityKind)}
              aria-label="能力类型"
            >
              <option value="skill">Skill</option>
              <option value="mcp">MCP</option>
              <option value="tool">Tool</option>
            </select>
            <input
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="能力名称"
              aria-label="自定义能力名称"
            />
            <input
              value={customDescription}
              onChange={(event) => setCustomDescription(event.target.value)}
              placeholder="用途说明或服务地址"
              aria-label="自定义能力说明"
            />
            <button type="button" onClick={addCustomCapability} disabled={!customName.trim()}>
              添加能力
            </button>
          </div>
        ) : null}
      </section>
    </details>
  )
}
