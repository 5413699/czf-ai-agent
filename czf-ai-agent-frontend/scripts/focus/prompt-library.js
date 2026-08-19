(function (global, document) {
  'use strict';

  const root = global.StudyFlow = global.StudyFlow || {};
  const byId = (id) => document && document.getElementById(id);
  const DEFAULT_CONFIG = Object.freeze({
    volume: 0.55,
    startCueId: 'builtin-cue:start',
    completeCueId: 'builtin-cue:complete'
  });
  const BUILT_IN_CUES = Object.freeze([
    Object.freeze({
      id: 'builtin-cue:start',
      name: '弹性轻启',
      description: '柔和弹响轻轻落下，提醒你进入专注',
      icon: 'sparkles',
      source: 'assets/audio/focus-start.mp3',
      kind: 'builtin'
    }),
    Object.freeze({
      id: 'builtin-cue:complete',
      name: '玻璃轻铃',
      description: '清亮而克制的收束声，适合提示阶段完成',
      icon: 'bell-ring',
      source: 'assets/audio/focus-complete.mp3',
      kind: 'builtin'
    })
  ]);

  function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function volume(value, fallback) {
    const number = Number(value);
    return Math.min(1, Math.max(0, Number.isFinite(number) ? number : fallback));
  }

  function safeText(value, fallback, maximum) {
    const text = String(value == null ? '' : value).trim().replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ');
    return (text || fallback || '').slice(0, maximum || 120);
  }

  function displayName(value, fallback) {
    return safeText(value, fallback || '自定义提示音', 80)
      .replace(/\.(?:aac|flac|m4a|mp3|ogg|opus|wav|webm)$/i, '') || fallback || '自定义提示音';
  }

  function cueId(value, fallback) {
    const id = String(value == null ? '' : value).trim();
    return /^(?:builtin-cue:(?:start|complete)|user-cue:[a-z0-9-]{1,80})$/i.test(id) ? id : fallback;
  }

  function normalizeConfig(value) {
    const source = object(value) ? value : {};
    return {
      volume: volume(source.volume, DEFAULT_CONFIG.volume),
      startCueId: cueId(source.startCueId, DEFAULT_CONFIG.startCueId),
      completeCueId: cueId(source.completeCueId, DEFAULT_CONFIG.completeCueId)
    };
  }

  function cloneConfig(value) {
    return Object.assign({}, normalizeConfig(value));
  }

  function cueField(kind) {
    return kind === 'complete' ? 'completeCueId' : 'startCueId';
  }

  function notify(message, type) {
    if (root.ui && typeof root.ui.toast === 'function') root.ui.toast(message, type || 'info');
    else if (global.uiManager && typeof global.uiManager.showNotification === 'function') global.uiManager.showNotification(message, type || 'info');
  }

  async function confirmAction(message, title) {
    if (root.ui && typeof root.ui.confirm === 'function') return root.ui.confirm(message, title);
    return global.confirm(message);
  }

  class FocusPromptLibrary {
    constructor(options) {
      const opts = options || {};
      this.audio = opts.audio || root.audio || null;
      this.userCues = new Map();
      this.iconUrls = [];
      this.renderToken = 0;
      this.catalogReady = false;
      this.editingKind = 'start';
      this.activeConfig = cloneConfig(opts.config || DEFAULT_CONFIG);
      this.editorConfig = cloneConfig(this.activeConfig);
      this.previewTimer = null;
      this.previewPendingCueId = null;
      this.initialized = false;
      this.unsubscribeMedia = null;
      if (this.audio && typeof this.audio.setSourceResolver === 'function') {
        this.audio.setSourceResolver((id, kind) => this.resolveSource(id, kind));
      }
    }

    normalizeConfig(value) { return normalizeConfig(value); }
    get builtIns() { return BUILT_IN_CUES.slice(); }
    get catalog() { return BUILT_IN_CUES.concat(Array.from(this.userCues.values())); }
    getActiveConfig() { return cloneConfig(this.activeConfig); }
    getEditorConfig() { return cloneConfig(this.editorConfig); }

    _store() { return root.mediaStore || null; }

    _cue(id) {
      return BUILT_IN_CUES.find((item) => item.id === id) || this.userCues.get(id) || null;
    }

    _validated(value) {
      const config = normalizeConfig(value);
      if (this.catalogReady && /^user-cue:/i.test(config.startCueId) && !this.userCues.has(config.startCueId)) config.startCueId = DEFAULT_CONFIG.startCueId;
      if (this.catalogReady && /^user-cue:/i.test(config.completeCueId) && !this.userCues.has(config.completeCueId)) config.completeCueId = DEFAULT_CONFIG.completeCueId;
      return config;
    }

    setEditorConfig(value) {
      this.editorConfig = this._validated(value);
      this.render();
      return this.getEditorConfig();
    }

    applyConfig(value, options) {
      const opts = options || {};
      this.activeConfig = this._validated(value);
      this.editorConfig = cloneConfig(this.activeConfig);
      if (this.audio && typeof this.audio.configure === 'function') this.audio.configure(this.activeConfig);
      if (opts.persist === true && root.storage && typeof root.storage.updateSettings === 'function') {
        root.storage.updateSettings({ promptAudio: this.activeConfig, volume: this.activeConfig.volume });
      }
      this.render();
      return this.getActiveConfig();
    }

    async resolveSource(id, kind) {
      const selected = this._cue(id);
      if (selected && selected.kind === 'builtin') {
        return { id: selected.id, source: selected.source, name: selected.name, release: null };
      }
      if (selected && selected.kind === 'user') {
        const store = this._store();
        if (!store || typeof store.getAudioUrl !== 'function') throw new Error('当前浏览器无法读取自定义提示音');
        const url = await store.getAudioUrl(selected.id);
        if (!url) throw new Error('找不到所选的自定义提示音');
        return {
          id: selected.id,
          source: url,
          name: selected.name,
          release: () => { if (typeof store.revokeObjectUrl === 'function') store.revokeObjectUrl(url); }
        };
      }
      const fallback = kind === 'start' ? BUILT_IN_CUES[0] : BUILT_IN_CUES[1];
      return { id: fallback.id, source: fallback.source, name: fallback.name, release: null };
    }

    _revokeIconUrls(urls) {
      const store = this._store();
      (urls || this.iconUrls).forEach((url) => {
        if (store && typeof store.revokeObjectUrl === 'function') store.revokeObjectUrl(url);
        else if (global.URL && typeof global.URL.revokeObjectURL === 'function') global.URL.revokeObjectURL(url);
      });
      if (!urls) this.iconUrls = [];
    }

    async refresh(options) {
      const opts = options || {};
      const store = this._store();
      if (!store || typeof store.listCues !== 'function') return [];
      const token = ++this.renderToken;
      try {
        const records = await store.listCues();
        const urls = [];
        const cues = await Promise.all((records || []).map(async (record) => {
          let iconUrl = null;
          if (record.hasIcon && typeof store.getIconUrl === 'function') {
            try {
              iconUrl = await store.getIconUrl(record.id);
              if (iconUrl) urls.push(iconUrl);
            } catch (_) { iconUrl = null; }
          }
          return Object.assign({}, record, {
            kind: 'user',
            name: displayName(record.name, '自定义提示音'),
            description: safeText(record.description, '保存在当前浏览器的个人提示音', 120),
            iconUrl
          });
        }));
        if (token !== this.renderToken) {
          this._revokeIconUrls(urls);
          return Array.from(this.userCues.values());
        }
        this._revokeIconUrls();
        this.iconUrls = urls;
        this.userCues = new Map(cues.map((item) => [item.id, item]));
        this.catalogReady = true;
        const nextActive = this._validated(this.activeConfig);
        const selectionChanged = JSON.stringify(nextActive) !== JSON.stringify(this.activeConfig);
        this.activeConfig = nextActive;
        this.editorConfig = this._validated(this.editorConfig);
        if (selectionChanged) {
          if (this.audio && typeof this.audio.configure === 'function') this.audio.configure(this.activeConfig);
          root.storage && root.storage.updateSettings && root.storage.updateSettings({ promptAudio: this.activeConfig, volume: this.activeConfig.volume });
        }
        if (opts.render !== false) this.render();
        return cues;
      } catch (error) {
        if (!opts.silent) notify(`提示音库读取失败：${error.message || '浏览器存储不可用'}`, 'error');
        return [];
      }
    }

    _renderCueIcon(container, cue) {
      if (!container) return;
      container.replaceChildren();
      if (cue && cue.iconUrl) {
        const image = document.createElement('img');
        image.src = cue.iconUrl;
        image.alt = '';
        container.appendChild(image);
      } else {
        container.innerHTML = `<i data-lucide="${cue && cue.icon || 'bell-ring'}"></i>`;
      }
    }

    _renderSelector(kind) {
      const field = cueField(kind);
      const cue = this._cue(this.editorConfig[field]) || BUILT_IN_CUES[kind === 'start' ? 0 : 1];
      const isDefault = cue.id === DEFAULT_CONFIG[field];
      const name = byId(kind === 'start' ? 'timer-start-sound-name' : 'timer-end-sound-name');
      const description = byId(kind === 'start' ? 'timer-start-sound-description' : 'timer-end-sound-description');
      const icon = byId(kind === 'start' ? 'timer-start-sound-icon' : 'timer-end-sound-icon');
      const selector = byId(kind === 'start' ? 'prompt-start-selector' : 'prompt-complete-selector');
      if (name) name.textContent = isDefault ? '默认番茄音效' : cue.name;
      if (description) description.textContent = cue.description;
      if (selector) selector.setAttribute('aria-label', `${kind === 'start' ? '开始' : '结束'}提示音：${isDefault ? '默认番茄音效' : cue.name}`);
      this._renderCueIcon(icon, cue);
    }

    _renderSummary() {
      const summary = byId('prompt-sound-summary');
      if (!summary) return;
      if (this.editorConfig.startCueId === DEFAULT_CONFIG.startCueId && this.editorConfig.completeCueId === DEFAULT_CONFIG.completeCueId) {
        summary.textContent = '默认番茄音效';
        return;
      }
      const start = this._cue(this.editorConfig.startCueId) || BUILT_IN_CUES[0];
      const complete = this._cue(this.editorConfig.completeCueId) || BUILT_IN_CUES[1];
      summary.textContent = `${start.name} · ${complete.name}`;
    }

    _createCueCard(cue) {
      const selected = this.editorConfig[cueField(this.editingKind)] === cue.id;
      const card = document.createElement('article');
      card.className = `prompt-sound-card${selected ? ' active' : ''}${cue.kind === 'user' ? ' user' : ''}`;
      card.dataset.cueId = cue.id;

      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'prompt-sound-main';
      select.setAttribute('role', 'radio');
      select.setAttribute('aria-checked', String(selected));
      select.setAttribute('aria-label', `选择${cue.name}`);
      const art = document.createElement('span');
      art.className = 'prompt-sound-card-art';
      this._renderCueIcon(art, cue);
      const copy = document.createElement('span');
      copy.className = 'prompt-sound-card-copy';
      const title = document.createElement('strong');
      title.textContent = cue.name;
      const description = document.createElement('small');
      description.textContent = cue.description;
      const badge = document.createElement('em');
      badge.textContent = cue.kind === 'user' ? '我的音效' : '系统预设';
      copy.append(title, description, badge);
      const state = document.createElement('span');
      state.className = 'prompt-sound-card-state';
      state.innerHTML = '<i data-lucide="check"></i>';
      select.append(art, copy, state);
      select.addEventListener('click', () => this.selectCue(this.editingKind, cue.id, { close: true, preview: true }));

      const actions = document.createElement('span');
      actions.className = 'prompt-sound-card-actions';
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'icon-button prompt-sound-preview';
      preview.title = `试听${cue.name}`;
      preview.setAttribute('aria-label', preview.title);
      preview.innerHTML = '<i data-lucide="play"></i>';
      preview.addEventListener('click', () => this.previewCue(cue.id));
      actions.appendChild(preview);
      if (cue.kind === 'user') {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'icon-button prompt-sound-delete';
        remove.title = `删除${cue.name}`;
        remove.setAttribute('aria-label', remove.title);
        remove.innerHTML = '<i data-lucide="trash-2"></i>';
        remove.addEventListener('click', () => this.deleteCue(cue));
        actions.appendChild(remove);
      }
      card.append(select, actions);
      return card;
    }

    renderCatalog() {
      const list = byId('prompt-library-list');
      if (!list) return;
      list.replaceChildren(...this.catalog.map((cue) => this._createCueCard(cue)));
      const title = byId('prompt-library-title');
      const description = byId('prompt-library-description');
      if (title) title.textContent = `选择${this.editingKind === 'start' ? '开始' : '结束'}提示音`;
      if (description) description.textContent = '系统预设与个人音效都可用于任一阶段，选择后会随当前方案保存。';
      global.lucide && global.lucide.createIcons && global.lucide.createIcons();
    }

    _renderVolume() {
      const input = byId('volume-control');
      const output = byId('volume-display');
      const percent = Math.round(this.editorConfig.volume * 100);
      if (input) {
        input.value = String(this.editorConfig.volume);
        input.setAttribute('aria-valuetext', `${percent}%`);
      }
      if (output) output.textContent = `${percent}%`;
    }

    render() {
      this._renderSelector('start');
      this._renderSelector('complete');
      this._renderSummary();
      this._renderVolume();
      if (byId('prompt-library-dialog') && byId('prompt-library-dialog').open) this.renderCatalog();
      global.lucide && global.lucide.createIcons && global.lucide.createIcons();
    }

    openLibrary(kind) {
      this.editingKind = kind === 'complete' ? 'complete' : 'start';
      this.stopPreview();
      this.renderCatalog();
      const dialog = byId('prompt-library-dialog');
      if (!dialog) return;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    closeLibrary() {
      this.stopPreview();
      const dialog = byId('prompt-library-dialog');
      if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
      else if (dialog) dialog.removeAttribute('open');
    }

    selectCue(kind, id, options) {
      const opts = options || {};
      const cue = this._cue(id);
      if (!cue) return this.getEditorConfig();
      this.editingKind = kind === 'complete' ? 'complete' : 'start';
      this.editorConfig[cueField(this.editingKind)] = cue.id;
      this.render();
      if (opts.close) this.closeLibrary();
      if (opts.preview !== false) this.previewCue(cue.id);
      return this.getEditorConfig();
    }

    previewCue(id) {
      const cue = this._cue(id);
      if (!cue || !this.audio || typeof this.audio.previewCue !== 'function') return Promise.resolve(false);
      this.stopPreviewTimer();
      this.previewPendingCueId = cue.id;
      return Promise.resolve(this.audio.previewCue(cue.id, { kind: this.editingKind, volume: this.editorConfig.volume })).then((result) => {
        if (this.previewPendingCueId === cue.id) {
          this.previewPendingCueId = null;
          if (typeof this.audio.isPreviewing === 'function' && this.audio.isPreviewing(cue.id)) {
            this.audio.setPreviewVolume(this.editorConfig.volume);
          }
        }
        return result;
      }).catch((error) => {
        if (this.previewPendingCueId === cue.id) this.previewPendingCueId = null;
        throw error;
      });
    }

    previewVolume(value) {
      this.editorConfig.volume = volume(value, this.editorConfig.volume);
      this._renderVolume();
      const id = this.editorConfig[cueField(this.editingKind)];
      if (this.audio) {
        if (typeof this.audio.isPreviewing === 'function' && this.audio.isPreviewing(id)) this.audio.setPreviewVolume(this.editorConfig.volume);
        else if (this.previewPendingCueId !== id) this.previewCue(id);
      }
      this.stopPreviewTimer();
      this.previewTimer = global.setTimeout(() => this.stopPreview(), 1200);
    }

    stopPreviewTimer() {
      if (this.previewTimer != null) global.clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }

    stopPreview() {
      this.stopPreviewTimer();
      this.previewPendingCueId = null;
      if (this.audio && typeof this.audio.stopPreview === 'function') this.audio.stopPreview();
    }

    _resetUpload() {
      const form = byId('prompt-upload-form');
      if (form) form.reset();
      const audioLabel = byId('custom-prompt-file-name');
      const iconLabel = byId('custom-prompt-icon-name');
      if (audioLabel) audioLabel.textContent = 'MP3、WAV、M4A、OGG，建议 5 秒以内';
      if (iconLabel) iconLabel.textContent = 'PNG、JPG 或 WebP，最大 2 MB';
    }

    openUpload() {
      this.stopPreview();
      const library = byId('prompt-library-dialog');
      if (library && library.open && typeof library.close === 'function') library.close();
      this._resetUpload();
      const dialog = byId('prompt-upload-dialog');
      if (!dialog) return;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    async saveUpload(event) {
      event.preventDefault();
      const store = this._store();
      const audioFile = byId('custom-prompt-file') && byId('custom-prompt-file').files && byId('custom-prompt-file').files[0];
      const iconFile = byId('custom-prompt-icon') && byId('custom-prompt-icon').files && byId('custom-prompt-icon').files[0];
      const name = displayName(byId('custom-prompt-name') && byId('custom-prompt-name').value, audioFile && audioFile.name || '自定义提示音');
      const description = safeText(byId('custom-prompt-description') && byId('custom-prompt-description').value, '', 120);
      if (!audioFile) return notify('请先选择一段提示音频', 'error');
      if (!store || typeof store.saveCue !== 'function') return notify('当前浏览器无法使用本地提示音库', 'error');
      const submit = byId('prompt-upload-save');
      if (submit) submit.disabled = true;
      try {
        const cue = await store.saveCue({ name, description, audioFile, iconFile: iconFile || null });
        await this.refresh({ render: false, silent: true });
        this.selectCue(this.editingKind, cue.id, { preview: true });
        const dialog = byId('prompt-upload-dialog');
        if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
        const state = typeof store.getSnapshot === 'function' ? store.getSnapshot() : { persistent: true };
        notify(state.persistent ? `“${displayName(cue.name)}”已加入提示音库` : `“${displayName(cue.name)}”仅在本次打开期间可用`, state.persistent ? 'success' : 'info');
      } catch (error) {
        notify(`添加提示音失败：${error.message || '文件无法读取'}`, 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    }

    _replaceCue(config, id) {
      const value = normalizeConfig(config);
      if (value.startCueId === id) value.startCueId = DEFAULT_CONFIG.startCueId;
      if (value.completeCueId === id) value.completeCueId = DEFAULT_CONFIG.completeCueId;
      return value;
    }

    async deleteCue(cue) {
      if (!cue || cue.kind !== 'user') return false;
      if (!await confirmAction(`从本地提示音库删除“${cue.name}”？使用它的方案会自动恢复默认音效。`, '删除自定义提示音？')) return false;
      const store = this._store();
      if (!store || typeof store.deleteCue !== 'function') throw new Error('提示音媒体库不可用');
      this.stopPreview();
      await store.deleteCue(cue.id);
      const current = root.storage && root.storage.getSettings ? root.storage.getSettings() : {};
      const custom = (Array.isArray(current.customFocusPresets) ? current.customFocusPresets : []).map((preset) => Object.assign({}, preset, {
        promptAudio: this._replaceCue(preset.promptAudio, cue.id)
      }));
      const overrides = {};
      Object.keys(object(current.focusPresetOverrides) ? current.focusPresetOverrides : {}).forEach((id) => {
        const preset = current.focusPresetOverrides[id];
        overrides[id] = Object.assign({}, preset, { promptAudio: this._replaceCue(preset.promptAudio, cue.id) });
      });
      this.activeConfig = this._replaceCue(current.promptAudio || this.activeConfig, cue.id);
      this.editorConfig = this._replaceCue(this.editorConfig, cue.id);
      root.storage && root.storage.updateSettings && root.storage.updateSettings({
        promptAudio: this.activeConfig,
        volume: this.activeConfig.volume,
        customFocusPresets: custom,
        focusPresetOverrides: overrides
      });
      if (this.audio && typeof this.audio.configure === 'function') this.audio.configure(this.activeConfig);
      await this.refresh({ silent: true });
      notify(`“${cue.name}”已从提示音库删除`, 'success');
      return true;
    }

    bind() {
      byId('prompt-start-selector') && byId('prompt-start-selector').addEventListener('click', () => this.openLibrary('start'));
      byId('prompt-complete-selector') && byId('prompt-complete-selector').addEventListener('click', () => this.openLibrary('complete'));
      byId('close-prompt-library') && byId('close-prompt-library').addEventListener('click', (event) => {
        event.preventDefault();
        this.closeLibrary();
      });
      document.querySelectorAll('[data-open-prompt-upload], #open-prompt-upload').forEach((button) => button.addEventListener('click', () => this.openUpload()));
      byId('cancel-prompt-upload') && byId('cancel-prompt-upload').addEventListener('click', () => this.stopPreview());
      byId('prompt-upload-form') && byId('prompt-upload-form').addEventListener('submit', (event) => this.saveUpload(event));
      byId('custom-prompt-file') && byId('custom-prompt-file').addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        const label = byId('custom-prompt-file-name');
        if (label) label.textContent = file ? '已选择音频文件' : 'MP3、WAV、M4A、OGG，建议 5 秒以内';
        const name = byId('custom-prompt-name');
        if (file && name && !name.value.trim()) name.value = displayName(file.name, '').slice(0, 40);
      });
      byId('custom-prompt-icon') && byId('custom-prompt-icon').addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        const label = byId('custom-prompt-icon-name');
        if (label) label.textContent = file ? '已选择图标图片' : 'PNG、JPG 或 WebP，最大 2 MB';
      });
      const range = byId('volume-control');
      range && range.addEventListener('input', () => this.previewVolume(range.value));
      range && range.addEventListener('change', () => this.stopPreview());
      byId('reset-timer-sounds') && byId('reset-timer-sounds').addEventListener('click', () => {
        this.editorConfig.startCueId = DEFAULT_CONFIG.startCueId;
        this.editorConfig.completeCueId = DEFAULT_CONFIG.completeCueId;
        this.render();
        notify('已恢复默认提示音', 'success');
      });
      byId('close-settings') && byId('close-settings').addEventListener('click', () => this.stopPreview());
      byId('drawer-backdrop') && byId('drawer-backdrop').addEventListener('click', () => this.stopPreview());
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.stopPreview(); });
      global.addEventListener('beforeunload', () => this.destroy(), { once: true });
    }

    async init() {
      if (this.initialized || !document) return this;
      this.initialized = true;
      const settings = root.storage && root.storage.getSettings ? root.storage.getSettings() : {};
      this.activeConfig = normalizeConfig(settings.promptAudio || DEFAULT_CONFIG);
      this.editorConfig = cloneConfig(this.activeConfig);
      if (this.audio && typeof this.audio.configure === 'function') this.audio.configure(this.activeConfig);
      this.bind();
      const store = this._store();
      if (store && typeof store.on === 'function') {
        this.unsubscribeMedia = store.on('change', (payload) => {
          if (!payload || !payload.kind || payload.kind === 'cue') this.refresh({ silent: true });
        });
      }
      await this.refresh({ render: false, silent: true });
      this.render();
      return this;
    }

    destroy() {
      this.stopPreview();
      this._revokeIconUrls();
      if (typeof this.unsubscribeMedia === 'function') this.unsubscribeMedia();
      this.unsubscribeMedia = null;
    }
  }

  root.FocusPromptLibrary = FocusPromptLibrary;
  root.promptLibrary = root.promptLibrary || new FocusPromptLibrary();
  if (document) {
    const init = () => root.promptLibrary.init();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, typeof document !== 'undefined' ? document : null);
