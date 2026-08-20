import { createId } from '../../shared/lib/id'

const DATABASE_NAME = 'tomato-study-room-media'
const DATABASE_VERSION = 1
const MEDIA_STORE = 'media'
const MAX_AUDIO_BYTES = 100 * 1024 * 1024
const MAX_ICON_BYTES = 5 * 1024 * 1024

export type CustomMediaKind = 'music' | 'ambient' | 'cue' | 'icon'
export const CUSTOM_MEDIA_CHANGED_EVENT = 'tomato:custom-media-changed'

export interface CustomMediaChangedDetail {
  action: 'saved' | 'deleted' | 'replaced' | 'cleared'
  id: string | null
  kind: CustomMediaKind | null
}

export interface CustomMediaRecord {
  id: string
  kind: CustomMediaKind
  name: string
  description: string
  iconMediaId: string | null
  mimeType: string
  size: number
  createdAt: string
  updatedAt: string
  blob: Blob
}

export interface SaveCustomMediaInput {
  id?: string
  kind: CustomMediaKind
  name: string
  description?: string
  iconMediaId?: string | null
  file: Blob
}

export interface CustomMediaMetadata extends Omit<CustomMediaRecord, 'blob'> {}

function ensureIndexedDb(): IDBFactory {
  if (typeof indexedDB === 'undefined') throw new Error('This browser does not support IndexedDB.')
  return indexedDB
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('IndexedDB request failed.')),
      {
        once: true,
      },
    )
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener(
      'abort',
      () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.')),
      {
        once: true,
      },
    )
    transaction.addEventListener(
      'error',
      () => reject(transaction.error ?? new Error('IndexedDB transaction failed.')),
      {
        once: true,
      },
    )
  })
}

let databasePromise: Promise<IDBDatabase> | null = null

function notifyMediaChanged(detail: CustomMediaChangedDetail): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<CustomMediaChangedDetail>(CUSTOM_MEDIA_CHANGED_EVENT, { detail }),
    )
  }
}

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = ensureIndexedDb().open(DATABASE_NAME, DATABASE_VERSION)
    request.addEventListener(
      'upgradeneeded',
      () => {
        const database = request.result
        if (!database.objectStoreNames.contains(MEDIA_STORE)) {
          const store = database.createObjectStore(MEDIA_STORE, { keyPath: 'id' })
          store.createIndex('kind', 'kind')
          store.createIndex('updatedAt', 'updatedAt')
        }
      },
      { once: true },
    )
    request.addEventListener(
      'success',
      () => {
        request.result.addEventListener('versionchange', () => request.result.close())
        resolve(request.result)
      },
      { once: true },
    )
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('Unable to open media database.')),
      {
        once: true,
      },
    )
    request.addEventListener(
      'blocked',
      () => reject(new Error('Media database upgrade is blocked by another tab.')),
      {
        once: true,
      },
    )
  }).catch((error: unknown) => {
    databasePromise = null
    throw error
  })
  return databasePromise
}

function assertMediaFile(kind: CustomMediaKind, file: Blob): void {
  const isIcon = kind === 'icon'
  const expectedPrefix = isIcon ? 'image/' : 'audio/'
  const maximumSize = isIcon ? MAX_ICON_BYTES : MAX_AUDIO_BYTES
  if (!file.type.startsWith(expectedPrefix))
    throw new Error(`Expected a ${expectedPrefix.slice(0, -1)} file.`)
  if (file.size === 0) throw new Error('The selected file is empty.')
  if (file.size > maximumSize)
    throw new Error(`The selected file exceeds the ${maximumSize / 1024 / 1024} MB limit.`)
}

function toMetadata({ blob: _blob, ...metadata }: CustomMediaRecord): CustomMediaMetadata {
  return metadata
}

export async function saveCustomMedia(input: SaveCustomMediaInput): Promise<CustomMediaMetadata> {
  assertMediaFile(input.kind, input.file)
  const name = input.name.trim()
  if (!name) throw new Error('A media name is required.')

  const database = await openDatabase()
  const transaction = database.transaction(MEDIA_STORE, 'readwrite')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(MEDIA_STORE)
  const existing = input.id
    ? await requestResult(store.get(input.id) as IDBRequest<CustomMediaRecord | undefined>)
    : undefined
  const timestamp = new Date().toISOString()
  const record: CustomMediaRecord = {
    id: input.id ?? createId(input.kind),
    kind: input.kind,
    name,
    description: input.description?.trim() ?? '',
    iconMediaId: input.iconMediaId ?? null,
    mimeType: input.file.type,
    size: input.file.size,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    blob: input.file,
  }
  store.put(record)
  await done
  notifyMediaChanged({ action: 'saved', id: record.id, kind: record.kind })
  return toMetadata(record)
}

export async function getCustomMedia(id: string): Promise<CustomMediaRecord | null> {
  const database = await openDatabase()
  const transaction = database.transaction(MEDIA_STORE, 'readonly')
  const done = transactionDone(transaction)
  const result = await requestResult(
    transaction.objectStore(MEDIA_STORE).get(id) as IDBRequest<CustomMediaRecord | undefined>,
  )
  await done
  return result ?? null
}

export async function listCustomMedia(kind?: CustomMediaKind): Promise<CustomMediaMetadata[]> {
  const database = await openDatabase()
  const transaction = database.transaction(MEDIA_STORE, 'readonly')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(MEDIA_STORE)
  const request = kind ? store.index('kind').getAll(kind) : store.getAll()
  const records = await requestResult(request as IDBRequest<CustomMediaRecord[]>)
  await done
  return [...records]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((record) => toMetadata(record))
}

export async function listCustomMediaRecords(): Promise<CustomMediaRecord[]> {
  const database = await openDatabase()
  const transaction = database.transaction(MEDIA_STORE, 'readonly')
  const done = transactionDone(transaction)
  const records = await requestResult(
    transaction.objectStore(MEDIA_STORE).getAll() as IDBRequest<CustomMediaRecord[]>,
  )
  await done
  return records
}

export async function deleteCustomMedia(id: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(MEDIA_STORE, 'readwrite')
  const done = transactionDone(transaction)
  transaction.objectStore(MEDIA_STORE).delete(id)
  await done
  notifyMediaChanged({ action: 'deleted', id, kind: null })
}

export async function replaceCustomMedia(records: CustomMediaRecord[]): Promise<void> {
  for (const record of records) assertMediaFile(record.kind, record.blob)
  const database = await openDatabase()
  const transaction = database.transaction(MEDIA_STORE, 'readwrite')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(MEDIA_STORE)
  store.clear()
  for (const record of records) store.put(record)
  await done
  notifyMediaChanged({ action: 'replaced', id: null, kind: null })
}

export async function clearCustomMedia(): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(MEDIA_STORE, 'readwrite')
  const done = transactionDone(transaction)
  transaction.objectStore(MEDIA_STORE).clear()
  await done
  notifyMediaChanged({ action: 'cleared', id: null, kind: null })
}

export async function createCustomMediaUrl(id: string): Promise<string | null> {
  const record = await getCustomMedia(id)
  return record ? URL.createObjectURL(record.blob) : null
}

export function revokeCustomMediaUrl(url: string): void {
  URL.revokeObjectURL(url)
}
