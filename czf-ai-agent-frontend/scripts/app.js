(function (global) {
  'use strict';
  const root = global.StudyFlow = global.StudyFlow || {};
  const U = root.utils;
  const byId = (id) => document.getElementById(id);

  const App = {
    init() {
      if (root.ui) root.ui.init();
      if (root.tasks) root.tasks.init();
      if (root.aiPlanner) root.aiPlanner.init();
      if (root.profile) root.profile.init();
      if (root.timerView) root.timerView.init();
      this.bindSettings();
      this.bindStream();
      this.applyQueryMode();
      if (root.ui) root.ui.go(root.ui.currentView || 'focus', false);
      if (global.lucide && global.lucide.createIcons) global.lucide.createIcons();
    },
    bindSettings() {
      const open = document.getElementById('open-settings');
      const close = document.getElementById('close-settings');
      const panel = document.getElementById('timer-settings');
      const backdrop = document.getElementById('drawer-backdrop');
      const dataDrawer = document.getElementById('data-drawer');
      const closeSettings = () => {
        panel?.classList.remove('open');
        if (!dataDrawer?.classList.contains('open')) backdrop?.classList.add('hidden');
      };
      open?.addEventListener('click', () => { panel?.classList.add('open'); backdrop?.classList.remove('hidden'); });
      close?.addEventListener('click', closeSettings);
      backdrop?.addEventListener('click', closeSettings);
    },
    bindStream() {
      byId('open-stream-view')?.addEventListener('click', () => this.openStream());
      byId('exit-stream')?.addEventListener('click', () => this.closeStream());
      byId('stream-fullscreen')?.addEventListener('click', () => this.toggleStreamFullscreen());
      byId('stream-soundscape-toggle')?.addEventListener('click', () => this.toggleStreamSoundscape());
      byId('open-stream-settings')?.addEventListener('click', () => this.toggleStreamPanel(true));
      byId('close-stream-settings')?.addEventListener('click', () => this.toggleStreamPanel(false));
      byId('stream-open-workbench')?.addEventListener('click', () => this.openStreamWorkbench());
      byId('stream-start-timer')?.addEventListener('click', () => {
        const snapshot = root.timer?.getSnapshot?.();
        if (snapshot?.status === 'waiting' && typeof root.timer?.startPendingPhase === 'function') root.timer.startPendingPhase();
        else root.timer?.start?.();
      });
      byId('stream-pause-timer')?.addEventListener('click', () => root.timer?.pause?.());
      byId('stream-resume-timer')?.addEventListener('click', () => root.timer?.resume?.());
      byId('stream-stop-timer')?.addEventListener('click', () => root.timer?.stop?.());
      byId('stream-skip-timer')?.addEventListener('click', () => root.timer?.skipPhase?.());
      document.querySelectorAll('[data-stream-theme-option]').forEach((button) => button.addEventListener('click', () => this.setStreamTheme(button.dataset.streamThemeOption)));
      document.querySelectorAll('[data-stream-clock-style-option]').forEach((button) => button.addEventListener('click', () => this.setStreamClockStyle(button.dataset.streamClockStyleOption)));
      document.querySelectorAll('[data-stream-background-option]').forEach((button) => button.addEventListener('click', () => this.setStreamBackground(button.dataset.streamBackgroundOption)));
      document.addEventListener('fullscreenchange', () => this.syncStreamFullscreenControl());
      document.addEventListener('fullscreenerror', () => this.syncStreamFullscreenControl(true));
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !document.body.classList.contains('obs-mode')) return;
        if (byId('stream-display-panel')?.classList.contains('open')) {
          this.toggleStreamPanel(false);
          return;
        }
        if (!document.fullscreenElement) this.closeStream();
      });
      const settings = root.storage?.getSettings?.() || {};
      this.setStreamBackground(settings.streamBackground || 'solid', false);
      this.setStreamTheme(settings.streamTheme || 'night', false);
      this.setStreamClockStyle(settings.streamClockStyle || 'orbit', false);
      this.syncStreamFullscreenControl();
      this.syncStreamSoundscape();
      root.soundscape?.on?.('statechange', (snapshot) => this.syncStreamSoundscape(snapshot));
    },
    setStreamBackground(value, persist) {
      const normalized = value === 'transparent' ? 'transparent' : 'solid';
      const stream = byId('stream-view');
      if (stream) {
        stream.dataset.streamBackground = normalized;
        stream.classList.toggle('transparent', normalized === 'transparent');
      }
      document.body?.classList.toggle('obs-transparent', normalized === 'transparent');
      document.querySelectorAll('[data-stream-background-option]').forEach((button) => {
        const active = button.dataset.streamBackgroundOption === normalized;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      if (persist !== false) root.storage?.updateSettings?.({ streamBackground: normalized });
      return normalized;
    },
    setStreamTheme(value, persist) {
      const normalized = ['night', 'day', 'eye'].includes(value) ? value : 'night';
      const stream = byId('stream-view');
      if (stream) stream.dataset.streamTheme = normalized;
      document.querySelectorAll('[data-stream-theme-option]').forEach((button) => {
        const active = button.dataset.streamThemeOption === normalized;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      if (persist !== false) root.storage?.updateSettings?.({ streamTheme: normalized });
      return normalized;
    },
    setStreamClockStyle(value, persist) {
      const normalized = ['orbit', 'tomato-fill', 'desk-card'].includes(value) ? value : 'orbit';
      const stream = byId('stream-view');
      if (stream) stream.dataset.streamClockStyle = normalized;
      document.querySelectorAll('[data-stream-clock-style-option]').forEach((button) => {
        const active = button.dataset.streamClockStyleOption === normalized;
        button.classList.toggle('active', active);
        button.setAttribute('aria-checked', String(active));
      });
      if (persist !== false) root.storage?.updateSettings?.({ streamClockStyle: normalized });
      return normalized;
    },
    openStream(options) {
      const stream = byId('stream-view');
      if (!stream || document.body.classList.contains('obs-mode')) return false;
      const opts = options || {};
      this.streamReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.streamReturnScrollY = global.scrollY || 0;
      this.streamDirect = opts.direct === true;
      root.ui?.closeDataDrawer?.();
      byId('data-drawer')?.classList.remove('open');
      byId('data-drawer')?.setAttribute('aria-hidden', 'true');
      byId('timer-settings')?.classList.remove('open');
      byId('drawer-backdrop')?.classList.add('hidden');
      this.toggleStreamPanel(false);
      const settings = root.storage?.getSettings?.() || {};
      stream.classList.remove('hidden');
      stream.setAttribute('aria-hidden', 'false');
      if (opts.appearanceApplied !== true) {
        this.setStreamBackground(settings.streamBackground || 'solid', false);
        this.setStreamTheme(settings.streamTheme || 'night', false);
        this.setStreamClockStyle(settings.streamClockStyle || 'orbit', false);
      }
      const shell = byId('app-shell');
      if (shell) {
        shell.setAttribute('aria-hidden', 'true');
        shell.inert = true;
      }
      document.body.classList.add('obs-mode');
      root.timerView?.renderStream?.(root.timer?.getSnapshot?.());
      this.syncStreamSoundscape();
      document.title = '番茄自习室 · 沉浸模式';
      global.requestAnimationFrame(() => stream.focus({ preventScroll: true }));
      return true;
    },
    async closeStream() {
      const stream = byId('stream-view');
      if (document.fullscreenElement === stream) {
        try { await document.exitFullscreen?.(); } catch (_) { /* no-op */ }
      }
      this.toggleStreamPanel(false);
      stream?.classList.add('hidden');
      stream?.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('obs-mode');
      const shell = byId('app-shell');
      if (shell) {
        shell.removeAttribute('aria-hidden');
        shell.inert = false;
      }
      if (this.streamDirect) {
        const url = new URL(global.location.href);
        url.searchParams.delete('view');
        url.hash = '#focus';
        global.history.replaceState(null, '', url.href);
      }
      this.streamDirect = false;
      root.timerView?.render?.(root.timer?.getSnapshot?.());
      global.scrollTo({ top: this.streamReturnScrollY || 0, behavior: 'auto' });
      const focusTarget = this.streamReturnFocus?.isConnected ? this.streamReturnFocus : byId('open-stream-view');
      global.requestAnimationFrame(() => focusTarget?.focus?.({ preventScroll: true }));
      return true;
    },
    toggleStreamPanel(open) {
      const panel = byId('stream-display-panel');
      const trigger = byId('open-stream-settings');
      const active = open == null ? !panel?.classList.contains('open') : Boolean(open);
      panel?.classList.toggle('open', active);
      panel?.setAttribute('aria-hidden', String(!active));
      trigger?.setAttribute('aria-expanded', String(active));
      if (active) global.requestAnimationFrame(() => byId('close-stream-settings')?.focus?.({ preventScroll: true }));
      return active;
    },
    async openStreamWorkbench() {
      await this.closeStream();
      root.ui?.go?.('focus');
      root.presets?.setMode?.('presets');
      global.requestAnimationFrame(() => {
        const opener = byId('open-settings');
        if (opener && global.getComputedStyle(opener).display !== 'none') opener.click();
        byId('timer-settings')?.scrollTo?.({ top: 0, behavior: 'smooth' });
      });
    },
    async toggleStreamSoundscape() {
      const button = byId('stream-soundscape-toggle');
      if (!root.soundscape?.toggle) {
        root.ui?.toast?.('当前浏览器无法播放专注声景', 'error');
        return false;
      }
      if (button) button.disabled = true;
      try {
        const snapshot = await root.soundscape.toggle();
        root.storage?.updateSettings?.({ soundscapePaused: !snapshot.playing });
        this.syncStreamSoundscape(snapshot);
        if (snapshot.blocked) root.ui?.toast?.('浏览器阻止了播放，请再次点击声音按钮', 'error');
        return snapshot.playing;
      } catch (error) {
        root.ui?.toast?.(`声景播放失败：${error.message || '请检查浏览器音频权限'}`, 'error');
        return false;
      } finally {
        if (button) button.disabled = false;
      }
    },
    syncStreamSoundscape(snapshot) {
      const button = byId('stream-soundscape-toggle');
      if (!button) return;
      const state = snapshot || root.soundscape?.getSnapshot?.() || { playing: false };
      const playing = Boolean(state.playing);
      const icon = playing ? 'volume-2' : 'volume-x';
      if (button.dataset.soundscapeIcon !== icon) {
        button.dataset.soundscapeIcon = icon;
        button.innerHTML = `<i data-lucide="${icon}"></i>`;
        global.lucide?.createIcons?.();
      }
      button.classList.toggle('playing', playing);
      button.setAttribute('aria-pressed', String(playing));
      button.title = playing ? '暂停专注声景' : '播放专注声景';
      button.setAttribute('aria-label', button.title);
    },
    async toggleStreamFullscreen() {
      const stream = byId('stream-view');
      if (!stream || typeof stream.requestFullscreen !== 'function' || document.fullscreenEnabled === false) return;
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await stream.requestFullscreen();
      } catch (_) {
        this.syncStreamFullscreenControl(true);
      }
    },
    syncStreamFullscreenControl(failed) {
      const button = byId('stream-fullscreen');
      const stream = byId('stream-view');
      if (!button || !stream) return;
      const supported = typeof stream.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
      const active = document.fullscreenElement === stream;
      const label = failed ? '当前环境无法进入全屏' : active ? '退出全屏' : supported ? '进入全屏' : '当前浏览器不支持全屏';
      button.disabled = !supported;
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', label);
      button.title = label;
    },
    applyQueryMode() {
      const params = new URLSearchParams(global.location.search);
      if (params.get('view') === 'immersive') {
        if (params.get('theme')) root.ui?.applyTheme(params.get('theme'), false);
        const settings = root.storage?.getSettings?.() || {};
        this.setStreamBackground(params.get('background') || settings.streamBackground || 'solid', false);
        this.setStreamTheme(params.get('streamTheme') || params.get('theme') || settings.streamTheme || 'night', false);
        this.setStreamClockStyle(params.get('clockStyle') || settings.streamClockStyle || 'orbit', false);
        this.openStream({ direct: true, appearanceApplied: true });
      }
    }
  };
  root.app = App; global.app = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
