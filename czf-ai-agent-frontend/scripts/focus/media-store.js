(function (global) {
  'use strict';

  const StudyFlow = global.StudyFlow = global.StudyFlow || {};
  const DB_NAME = 'studyflow-media-v1';
  const STORE_NAME = 'tracks';
  const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
  const MAX_ICON_BYTES = 2 * 1024 * 1024;
  const MAX_BACKUP_MEDIA_BYTES = 150 * 1024 * 1024;
  const MAX_BACKUP_RECORDS = 120;
  const ICON_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
  const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i;

  function isBlob(value) {
    return Boolean(value && typeof value.size === 'number' && typeof value.slice === 'function');
  }

  function safeName(value, fallback) {
    const text = String(value == null ? '' : value).trim().replace(/[\u0000-\u001f]/g, '');
    return (text || fallback || '我的声音').slice(0, 80);
  }

  function safeDescription(value, fallback) {
    const text = String(value == null ? '' : value).trim().replace(/[\u0000-\u001f]/g, ' ');
    return (text || fallback || '').replace(/\s+/g, ' ').slice(0, 120);
  }

  function fileStem(file, fallback) {
    const name = String(file && file.name || '').replace(/\.[^.]+$/, '').trim();
    return name || fallback || '我的声音';
  }

  function createId(kind) {
    const prefixes = { ambient: 'user-ambient', music: 'user-music', cue: 'user-cue' };
    const prefix = prefixes[kind] || 'user-media';
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return `${prefix}:${global.crypto.randomUUID()}`;
    }
    return `${prefix}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function recordKind(record) {
    const kind = record && String(record.kind || '');
    return kind === 'ambient' || kind === 'music' || kind === 'cue' ? kind : null;
  }

  function metadata(record) {
    if (!record) return null;
    return {
      id: record.id,
      kind: 'user',
      mediaType: recordKind(record),
      name: record.name,
      description: safeDescription(record.description),
      fileName: record.fileName || record.name,
      mime: record.mime,
      size: record.size,
      hasIcon: Boolean(record.iconBlob),
      iconMime: record.iconMime || '',
      iconSize: record.iconSize || 0,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  function requestError(request, fallback) {
    return request && request.error || fallback || new Error('浏览器媒体库操作失败');
  }

  function blobToDataUrl(blob) {
    if (!isBlob(blob)) return Promise.resolve(null);
    if (typeof global.FileReader === 'function') {
      return new Promise((resolve, reject) => {
        const reader = new global.FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('媒体文件读取失败'));
        reader.readAsDataURL(blob);
      });
    }
    if (typeof blob.arrayBuffer === 'function' && typeof global.btoa === 'function') {
      return blob.arrayBuffer().then((buffer) => {
        const bytes = new Uint8Array(buffer);
        const chunks = [];
        const size = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += size) {
          chunks.push(String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(bytes.length, offset + size))));
        }
        return `data:${blob.type || 'application/octet-stream'};base64,${global.btoa(chunks.join(''))}`;
      });
    }
    return Promise.reject(new Error('当前浏览器无法打包媒体文件'));
  }

  function inspectBackupDataUrl(value, label, maximumBytes) {
    const source = typeof value === 'string' ? value : '';
    const comma = source.indexOf(',');
    const header = comma >= 0 ? source.slice(0, comma) : '';
    const encoded = comma >= 0 ? source.slice(comma + 1) : '';
    if (!/^data:[^,]*;base64$/i.test(header) || !encoded || encoded.length % 4 !== 0
      || !/^[a-z0-9+/]*={0,2}$/i.test(encoded)) {
      throw new Error(`备份中的${label || '媒体'}编码无效`);
    }
    const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
    const decodedBytes = encoded.length / 4 * 3 - padding;
    if (decodedBytes <= 0) throw new Error(`备份中的${label || '媒体'}内容为空`);
    if (decodedBytes > maximumBytes) throw new Error(`备份中的${label || '媒体'}文件过大`);
    return {
      mime: header.slice(5, header.length - 7).split(';')[0].toLowerCase(),
      decodedBytes
    };
  }

  async function dataUrlToBlob(value) {
    const source = String(value || '');
    if (!/^data:[^,]*,/i.test(source)) throw new Error('备份中的媒体数据无效');
    if (typeof global.fetch === 'function') {
      const response = await global.fetch(source);
      if (!response.ok) throw new Error('备份中的媒体数据无法读取');
      return response.blob();
    }
    const match = source.match(/^data:([^;,]*)(;base64)?,(.*)$/i);
    if (!match || typeof global.Blob !== 'function') throw new Error('当前浏览器无法恢复媒体文件');
    const mime = match[1] || 'application/octet-stream';
    const binary = match[2]
      ? (typeof global.atob === 'function' ? global.atob(match[3]) : '')
      : decodeURIComponent(match[3]);
    if (match[2] && !binary) throw new Error('备份中的媒体编码无效');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new global.Blob([bytes], { type: mime });
  }

  function validRecordId(kind, value) {
    const prefixes = { ambient: 'user-ambient', music: 'user-music', cue: 'user-cue' };
    const id = String(value || '');
    return new RegExp(`^${prefixes[kind]}:[a-z0-9-]{1,80}$`, 'i').test(id) ? id : null;
  }

  class FocusMediaStore {
    constructor(options) {
      const opts = options || {};
      this.dbName = opts.dbName || DB_NAME;
      this.storeName = opts.storeName || STORE_NAME;
      this.memory = new Map();
      this.objectUrls = new Map();
      this.listeners = Object.create(null);
      this.db = null;
      this.mode = 'pending';
      this.persistent = false;
      this.fallbackReason = null;
      this._readyPromise = this._open();
    }

    _open() {
      return new Promise((resolve) => {
        const indexedDB = global.indexedDB;
        if (!indexedDB || typeof indexedDB.open !== 'function') {
          resolve(this._useMemory(new Error('当前浏览器不支持 IndexedDB')));
          return;
        }

        let settled = false;
        let request;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        try {
          request = indexedDB.open(this.dbName, 1);
        } catch (error) {
          finish(this._useMemory(error));
          return;
        }

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          if (settled) {
            try { db.close(); } catch (_) { /* ignored */ }
            return;
          }
          this.db = db;
          this.mode = 'indexeddb';
          this.persistent = true;
          db.onversionchange = () => {
            try { db.close(); } catch (_) { /* ignored */ }
            this.db = null;
          };
          this._emit('ready', this.getSnapshot());
          finish(db);
        };
        request.onerror = () => finish(this._useMemory(requestError(request)));
        request.onblocked = () => finish(this._useMemory(new Error('媒体库被其他页面占用')));
      });
    }

    _useMemory(error) {
      if (this.db) {
        try { this.db.close(); } catch (_) { /* ignored */ }
      }
      this.db = null;
      this.mode = 'memory';
      this.persistent = false;
      this.fallbackReason = error || this.fallbackReason || new Error('媒体库无法持久化');
      this._emit('fallback', { error: this.fallbackReason, snapshot: this.getSnapshot() });
      return null;
    }

    ready() {
      return this._readyPromise.then(() => this.getSnapshot());
    }

    getSnapshot() {
      return {
        mode: this.mode,
        persistent: this.persistent,
        fallbackReason: this.fallbackReason ? String(this.fallbackReason.message || this.fallbackReason) : ''
      };
    }

    on(eventName, callback) {
      let name = eventName;
      let listener = callback;
      if (typeof eventName === 'function') {
        name = 'change';
        listener = eventName;
      }
      if (typeof listener !== 'function') return function () {};
      if (!this.listeners[name]) this.listeners[name] = [];
      this.listeners[name].push(listener);
      return () => {
        this.listeners[name] = (this.listeners[name] || []).filter((item) => item !== listener);
      };
    }

    _emit(eventName, payload) {
      (this.listeners[eventName] || []).slice().forEach((listener) => {
        try { listener(payload); } catch (error) {
          if (global.console) global.console.error('[FocusMediaStore]', error);
        }
      });
    }

    async _idbRequest(mode, operation) {
      await this._readyPromise;
      if (!this.db || this.mode !== 'indexeddb') throw this.fallbackReason || new Error('IndexedDB 不可用');
      return new Promise((resolve, reject) => {
        let transaction;
        let request;
        let result;
        let finished = false;
        const fail = (error) => {
          if (finished) return;
          finished = true;
          reject(error || new Error('浏览器媒体库操作失败'));
        };
        try {
          transaction = this.db.transaction(this.storeName, mode);
          request = operation(transaction.objectStore(this.storeName));
        } catch (error) {
          fail(error);
          return;
        }
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => fail(requestError(request));
        transaction.onabort = () => fail(transaction.error);
        transaction.onerror = () => fail(transaction.error);
        transaction.oncomplete = () => {
          if (finished) return;
          finished = true;
          resolve(result);
        };
      });
    }

    async _replaceIdbRecords(records) {
      await this._readyPromise;
      if (!this.db || this.mode !== 'indexeddb') throw this.fallbackReason || new Error('IndexedDB 不可用');
      return new Promise((resolve, reject) => {
        let transaction;
        try {
          transaction = this.db.transaction(this.storeName, 'readwrite');
          const store = transaction.objectStore(this.storeName);
          store.clear();
          records.forEach((record) => store.put(record));
        } catch (error) {
          reject(error);
          return;
        }
        transaction.onabort = () => reject(transaction.error || new Error('媒体库写入已取消'));
        transaction.onerror = () => reject(transaction.error || new Error('媒体库写入失败'));
        transaction.oncomplete = () => resolve(true);
      });
    }

    _validateAudio(file, label) {
      const name = label || '音频';
      if (!isBlob(file) || file.size <= 0) throw new Error(`请选择有效的${name}文件`);
      if (file.size > MAX_AUDIO_BYTES) throw new Error(`${name}文件不能超过 100MB`);
      const mime = String(file.type || '').toLowerCase();
      const fileName = String(file.name || '');
      if ((mime && !mime.startsWith('audio/')) || (!mime && !AUDIO_EXTENSIONS.test(fileName))) {
        throw new Error('请选择浏览器支持的音频文件');
      }
    }

    _validateIcon(file) {
      if (file == null) return;
      if (!isBlob(file) || file.size <= 0) throw new Error('请选择有效的封面图片');
      if (file.size > MAX_ICON_BYTES) throw new Error('封面图片不能超过 2MB');
      if (!ICON_TYPES.has(String(file.type || '').toLowerCase())) {
        throw new Error('封面仅支持 PNG、JPEG 或 WebP');
      }
    }

    async _saveMedia(kind, input) {
      const source = input || {};
      const audioFile = source.audioFile;
      const iconFile = source.iconFile || null;
      const labels = { ambient: '环境音', music: '音乐', cue: '提示音' };
      const fallbacks = { ambient: '我的环境音', music: '我的音乐', cue: '我的提示音' };
      const label = labels[kind];
      if (!label) throw new Error('不支持的媒体类型');
      this._validateAudio(audioFile, label);
      this._validateIcon(iconFile);
      const stamp = new Date().toISOString();
      const record = {
        id: createId(kind),
        kind,
        name: safeName(source.name, fileStem(audioFile, fallbacks[kind])),
        description: safeDescription(source.description),
        fileName: safeName(audioFile.name, fileStem(audioFile, fallbacks[kind])),
        audioBlob: audioFile,
        iconBlob: iconFile,
        mime: String(audioFile.type || 'audio/*').toLowerCase(),
        size: audioFile.size,
        iconMime: iconFile ? String(iconFile.type || '').toLowerCase() : '',
        iconSize: iconFile ? iconFile.size : 0,
        createdAt: stamp,
        updatedAt: stamp
      };

      await this._readyPromise;
      if (this.mode === 'indexeddb') {
        try {
          await this._idbRequest('readwrite', (store) => store.put(record));
        } catch (error) {
          this._useMemory(error);
          this.memory.set(record.id, record);
        }
      } else {
        this.memory.set(record.id, record);
      }
      const result = metadata(record);
      this._emit('save', result);
      const payload = { type: 'save', kind, media: result };
      if (kind === 'ambient') payload.ambient = result;
      else if (kind === 'music') payload.track = result;
      else payload.cue = result;
      this._emit('change', payload);
      return result;
    }

    async saveMusic(input) { return this._saveMedia('music', input); }

    async saveAmbient(input) { return this._saveMedia('ambient', input); }

    async saveCue(input) { return this._saveMedia('cue', input); }

    async _listRecords() {
      await this._readyPromise;
      if (this.mode === 'indexeddb') {
        try {
          return await this._idbRequest('readonly', (store) => store.getAll()) || [];
        } catch (error) {
          this._useMemory(error);
        }
      }
      return Array.from(this.memory.values());
    }

    async listMusic() {
      const records = await this._listRecords();
      return records.filter((record) => recordKind(record) === 'music').map(metadata)
        .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    }

    async listAmbient() {
      const records = await this._listRecords();
      return records.filter((record) => recordKind(record) === 'ambient').map(metadata)
        .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    }

    async listCues() {
      const records = await this._listRecords();
      return records.filter((record) => recordKind(record) === 'cue').map(metadata)
        .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    }

    async _getRecord(id) {
      const key = String(id || '');
      if (!key) return null;
      await this._readyPromise;
      if (this.mode === 'indexeddb') {
        try {
          return await this._idbRequest('readonly', (store) => store.get(key)) || null;
        } catch (error) {
          this._useMemory(error);
        }
      }
      return this.memory.get(key) || null;
    }

    async getMusic(id) {
      const record = await this._getRecord(id);
      return record && recordKind(record) === 'music' ? record : null;
    }

    async getAmbient(id) {
      const record = await this._getRecord(id);
      return record && recordKind(record) === 'ambient' ? record : null;
    }

    async getCue(id) {
      const record = await this._getRecord(id);
      return record && recordKind(record) === 'cue' ? record : null;
    }

    _createObjectUrl(id, blob) {
      if (!blob || !global.URL || typeof global.URL.createObjectURL !== 'function') return null;
      const url = global.URL.createObjectURL(blob);
      this.objectUrls.set(url, String(id));
      return url;
    }

    async getAudioUrl(id) {
      const record = await this._getRecord(id);
      return record ? this._createObjectUrl(record.id, record.audioBlob) : null;
    }

    async getIconUrl(id) {
      const record = await this._getRecord(id);
      return record && record.iconBlob ? this._createObjectUrl(record.id, record.iconBlob) : null;
    }

    revokeObjectUrl(url) {
      const value = String(url || '');
      if (!this.objectUrls.has(value)) return false;
      try { global.URL.revokeObjectURL(value); } catch (_) { /* ignored */ }
      this.objectUrls.delete(value);
      return true;
    }

    revokeUrls(id) {
      const key = id == null ? null : String(id);
      Array.from(this.objectUrls.entries()).forEach(([url, owner]) => {
        if (key == null || owner === key) this.revokeObjectUrl(url);
      });
    }

    async _deleteRecord(id, expectedKind) {
      const key = String(id || '');
      if (!key) return false;
      const record = await this._getRecord(key);
      if (!record || recordKind(record) !== expectedKind) return false;
      if (this.mode === 'indexeddb') {
        try {
          await this._idbRequest('readwrite', (store) => store.delete(key));
        } catch (error) {
          this._useMemory(error);
        }
      }
      this.memory.delete(key);
      this.revokeUrls(key);
      this._emit('delete', { id: key });
      const payload = { type: 'delete', kind: expectedKind, id: key };
      if (expectedKind === 'ambient') payload.ambient = metadata(record);
      else if (expectedKind === 'music') payload.track = metadata(record);
      else payload.cue = metadata(record);
      this._emit('change', payload);
      return true;
    }

    async deleteMusic(id) { return this._deleteRecord(id, 'music'); }

    async deleteAmbient(id) { return this._deleteRecord(id, 'ambient'); }

    async deleteCue(id) { return this._deleteRecord(id, 'cue'); }

    async exportRecords() {
      const records = await this._listRecords();
      const selected = records.filter((record) => recordKind(record));
      this._validatePreparedRecords(selected);
      const exported = [];
      for (const record of selected) {
        exported.push({
          id: record.id,
          kind: recordKind(record),
          name: safeName(record.name, '我的声音'),
          description: safeDescription(record.description),
          fileName: safeName(record.fileName, record.name || 'media'),
          mime: String(record.mime || record.audioBlob && record.audioBlob.type || 'audio/*').toLowerCase(),
          audioData: await blobToDataUrl(record.audioBlob),
          iconData: record.iconBlob ? await blobToDataUrl(record.iconBlob) : null,
          createdAt: record.createdAt || new Date().toISOString(),
          updatedAt: record.updatedAt || record.createdAt || new Date().toISOString()
        });
      }
      return exported;
    }

    _validatePreparedRecords(records) {
      if (!Array.isArray(records)) throw new Error('备份缺少媒体库数据');
      if (records.length > MAX_BACKUP_RECORDS) throw new Error('备份中的媒体条目过多');
      const ids = new Set();
      let totalBytes = 0;
      records.forEach((record) => {
        const kind = recordKind(record);
        const id = kind && validRecordId(kind, record && record.id);
        if (!kind || !id) throw new Error('备份中包含无效的媒体条目');
        if (ids.has(id)) throw new Error('备份中包含重复的媒体条目');
        ids.add(id);
        this._validateAudio(record.audioBlob, kind === 'ambient' ? '环境音' : kind === 'cue' ? '提示音' : '音乐');
        this._validateIcon(record.iconBlob || null);
        totalBytes += record.audioBlob.size + (record.iconBlob ? record.iconBlob.size : 0);
        if (totalBytes > MAX_BACKUP_MEDIA_BYTES) throw new Error('备份媒体总容量不能超过 150MB');
      });
      return totalBytes;
    }

    _preflightBackupRecords(values) {
      if (!Array.isArray(values)) throw new Error('备份缺少媒体库数据');
      if (values.length > MAX_BACKUP_RECORDS) throw new Error('备份中的媒体条目过多');
      const ids = new Set();
      let totalBytes = 0;
      return values.map((value) => {
        const source = value && typeof value === 'object' ? value : {};
        const kind = recordKind(source);
        const id = kind && validRecordId(kind, source.id);
        if (!kind || !id) throw new Error('备份中包含无效的媒体条目');
        if (ids.has(id)) throw new Error('备份中包含重复的媒体条目');
        ids.add(id);
        const label = kind === 'ambient' ? '环境音' : kind === 'cue' ? '提示音' : '音乐';
        const audio = inspectBackupDataUrl(source.audioData, label, MAX_AUDIO_BYTES);
        if (audio.mime && !audio.mime.startsWith('audio/')) throw new Error(`备份中的${label}格式无效`);
        const icon = source.iconData
          ? inspectBackupDataUrl(source.iconData, '封面图片', MAX_ICON_BYTES)
          : null;
        if (icon && icon.mime && !ICON_TYPES.has(icon.mime)) throw new Error('备份中的封面图片格式无效');
        totalBytes += audio.decodedBytes + (icon ? icon.decodedBytes : 0);
        if (totalBytes > MAX_BACKUP_MEDIA_BYTES) throw new Error('备份媒体总容量不能超过 150MB');
        return { source, kind, id };
      });
    }

    async _commitRecords(records, options) {
      const opts = options || {};
      this._validatePreparedRecords(records);
      await this._readyPromise;
      if (this.mode === 'indexeddb') {
        try {
          await this._replaceIdbRecords(records);
        } catch (error) {
          if (opts.strict) throw error;
          this._useMemory(error);
          this.memory.clear();
          records.forEach((record) => this.memory.set(record.id, record));
        }
      } else {
        if (opts.strict) throw this.fallbackReason || new Error('媒体库无法持久化');
        this.memory.clear();
        records.forEach((record) => this.memory.set(record.id, record));
      }
      this.revokeUrls();
      this._emit('change', { type: 'replace', count: records.length });
      return records.map(metadata);
    }

    async captureRecords() {
      const records = await this._listRecords();
      this._validatePreparedRecords(records);
      return records.map((record) => Object.assign({}, record));
    }

    async restoreRecords(records, options) {
      return this._commitRecords(Array.isArray(records) ? records.map((record) => Object.assign({}, record)) : records, options);
    }

    async replaceRecords(values, options) {
      const entries = this._preflightBackupRecords(values);
      const records = [];
      for (const entry of entries) {
        const source = entry.source;
        const kind = entry.kind;
        const id = entry.id;
        const audioBlob = await dataUrlToBlob(source.audioData);
        const iconBlob = source.iconData ? await dataUrlToBlob(source.iconData) : null;
        this._validateAudio(audioBlob, kind === 'ambient' ? '环境音' : kind === 'cue' ? '提示音' : '音乐');
        this._validateIcon(iconBlob);
        const stamp = new Date().toISOString();
        records.push({
          id,
          kind,
          name: safeName(source.name, '我的声音'),
          description: safeDescription(source.description),
          fileName: safeName(source.fileName, source.name || 'media'),
          audioBlob,
          iconBlob,
          mime: String(audioBlob.type || source.mime || 'audio/*').toLowerCase(),
          size: audioBlob.size,
          iconMime: iconBlob ? String(iconBlob.type || '').toLowerCase() : '',
          iconSize: iconBlob ? iconBlob.size : 0,
          createdAt: String(source.createdAt || stamp),
          updatedAt: String(source.updatedAt || source.createdAt || stamp)
        });
      }
      return this._commitRecords(records, options);
    }

    async clear() {
      await this._readyPromise;
      let failure = null;
      if (this.mode === 'indexeddb') {
        try {
          await this._idbRequest('readwrite', (store) => store.clear());
        } catch (error) {
          this._useMemory(error);
          failure = error;
        }
      }
      this.memory.clear();
      this.revokeUrls();
      this._emit('clear', null);
      this._emit('change', { type: 'clear' });
      if (failure) throw failure;
      return true;
    }

    destroy() {
      this.revokeUrls();
      if (this.db) {
        try { this.db.close(); } catch (_) { /* ignored */ }
      }
      this.db = null;
      this.listeners = Object.create(null);
    }
  }

  StudyFlow.FocusMediaStore = FocusMediaStore;
  StudyFlow.mediaStore = StudyFlow.mediaStore || new FocusMediaStore();
})(typeof globalThis !== 'undefined' ? globalThis : window);
