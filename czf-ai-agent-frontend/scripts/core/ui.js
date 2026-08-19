(function (global) {
  'use strict';
  const root = global.StudyFlow = global.StudyFlow || {};
  const U = root.utils;
  const UI = {
    currentView: 'focus',
    init() {
      this.bindRouting(); this.bindTheme(); this.bindDrawer(); this.bindDataActions(); this.initializeTheme(); this.setRouteFromLocation();
      if (global.lucide && global.lucide.createIcons) global.lucide.createIcons();
    },
    bindRouting() {
      document.addEventListener('click', (event) => { const target = event.target.closest('[data-route]'); if (!target) return; event.preventDefault(); this.go(target.dataset.route); });
      global.addEventListener('hashchange', () => this.setRouteFromLocation());
    },
    setRouteFromLocation() { const route = (global.location.hash || '#focus').slice(1).split('?')[0]; this.go(['focus', 'tasks', 'profile', 'tutorial'].includes(route) ? route : 'focus', false); },
    go(view, updateHash) {
      this.currentView = view || 'focus'; if (updateHash !== false && global.location.hash !== `#${this.currentView}`) global.location.hash = this.currentView;
      document.querySelectorAll('.page[data-view]').forEach((page) => page.classList.toggle('active', page.dataset.view === this.currentView));
      document.querySelectorAll('[data-route]').forEach((item) => item.classList.toggle('active', item.dataset.route === this.currentView));
      if (this.currentView === 'tasks' && root.tasks) root.tasks.render();
      if (this.currentView === 'profile' && root.profile) root.profile.render();
      if (global.lucide && global.lucide.createIcons) global.lucide.createIcons();
      U.dispatch('studyflow:route', { view: this.currentView });
    },
    bindTheme() {
      const control = document.getElementById('theme-control');
      const trigger = document.getElementById('theme-trigger');
      const menu = document.getElementById('theme-menu');
      if (!control || !trigger || !menu) return;
      const close = (restoreFocus) => {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (restoreFocus) trigger.focus();
      };
      trigger.addEventListener('click', () => {
        const opening = menu.hidden;
        menu.hidden = !opening;
        trigger.setAttribute('aria-expanded', String(opening));
        if (opening) menu.querySelector('[aria-checked="true"]')?.focus();
      });
      menu.addEventListener('click', (event) => {
        const option = event.target.closest('[data-theme-option]');
        if (!option) return;
        this.applyTheme(option.dataset.themeOption);
        close(true);
      });
      document.addEventListener('click', (event) => {
        if (!menu.hidden && !control.contains(event.target)) close(false);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !menu.hidden) close(true);
      });
    },
    initializeTheme() { const queryTheme = new URLSearchParams(global.location.search).get('theme'); const saved = queryTheme || root.storage?.getSettings()?.theme || global.localStorage.getItem('selected-theme') || 'day'; this.applyTheme(['day', 'night', 'eye'].includes(saved) ? saved : 'day', false); },
    applyTheme(theme, notify) {
      const value = ['day', 'night', 'eye'].includes(theme) ? theme : 'day';
      const names = { day: '永昼', night: '极夜', eye: '护眼' };
      const page = document.documentElement;
      page.classList.add('theme-updating');
      document.body.dataset.theme = value;
      const label = document.getElementById('theme-label');
      if (label) label.textContent = names[value];
      document.querySelectorAll('[data-theme-option]').forEach((option) => {
        const active = option.dataset.themeOption === value;
        option.classList.toggle('active', active);
        option.setAttribute('aria-checked', String(active));
      });
      global.localStorage.setItem('selected-theme', value);
      root.storage?.updateSettings({ theme: value });
      global.requestAnimationFrame(() => global.requestAnimationFrame(() => page.classList.remove('theme-updating')));
      if (notify !== false) this.toast(`已切换到${names[value]}主题`, 'success');
    },
    bindDrawer() { const drawer = document.getElementById('data-drawer'); const backdrop = document.getElementById('drawer-backdrop'); const open = () => { drawer?.classList.add('open'); drawer?.setAttribute('aria-hidden', 'false'); backdrop?.classList.remove('hidden'); }; const close = () => { drawer?.classList.remove('open'); drawer?.setAttribute('aria-hidden', 'true'); backdrop?.classList.add('hidden'); }; this.openDataDrawer = open; this.closeDataDrawer = close; document.getElementById('open-data-menu')?.addEventListener('click', open); document.getElementById('close-data-menu')?.addEventListener('click', close); backdrop?.addEventListener('click', close); },
    bindDataActions() {
      const exportData = async () => {
        try {
          if (!root.storage || typeof root.storage.downloadExport !== 'function') throw new Error('数据服务不可用');
          const downloaded = await root.storage.downloadExport();
          if (downloaded !== true) throw new Error('备份文件未能下载');
          this.toast('完整数据备份已下载', 'success');
        } catch (error) {
          this.toast(`导出失败：${error.message || '无法打包本地媒体'}`, 'error');
        }
      };
      document.getElementById('export-data')?.addEventListener('click', exportData);
      document.getElementById('profile-export')?.addEventListener('click', exportData);
      document.getElementById('manage-data')?.addEventListener('click', () => this.openDataDrawer?.());
      const clearButton = document.getElementById('clear-all-data') || document.getElementById('reset-local-data');
      if (clearButton) clearButton.addEventListener('click', () => this.clearAllData());
      else document.addEventListener('click', (event) => {
        const action = event.target.closest('[data-action="clear-all-data"]');
        if (action) { event.preventDefault(); this.clearAllData(); }
      });
      document.getElementById('import-file')?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          if (!root.storage || typeof root.storage.importData !== 'function') throw new Error('数据服务不可用');
          await root.storage.importData(file);
          this.toast('数据导入成功，正在重新载入', 'success');
          global.setTimeout(() => global.location.reload(), 180);
        } catch (error) {
          this.toast(`导入失败：${error.message || '无法读取备份文件'}`, 'error');
        } finally {
          event.target.value = '';
        }
      });
    },
    async clearAllData() {
      const first = await this.confirm('这会删除所有项目、任务、子任务、专注记录和显示设置。此操作无法撤销。', '清空本地数据？');
      if (!first) return false;
      const second = await this.confirm('最后确认：确定要永久清空当前浏览器里的全部学习数据吗？', '再确认一次');
      if (!second) return false;
      try {
        if (root.timer) {
          if (typeof root.timer.stop === 'function') root.timer.stop();
          if (typeof root.timer.clearPersistence === 'function') root.timer.clearPersistence();
        }
        if (root.audio) {
          if (typeof root.audio.stop === 'function') root.audio.stop();
          if (typeof root.audio.reset === 'function') root.audio.reset();
        }
        const cleared = root.storage && typeof root.storage.resetAllData === 'function'
          ? await root.storage.resetAllData()
          : root.storage && typeof root.storage.clearAllData === 'function' ? await root.storage.clearAllData() : false;
        if (!cleared) throw new Error('浏览器存储不可用');
        this.closeDataDrawer?.();
        try { global.dispatchEvent(new Event('studyflow:data-changed')); } catch (_) { /* reload below rehydrates the UI */ }
        this.toast('本地数据已清空，正在重新开始', 'success');
        global.setTimeout(() => global.location.reload(), 220);
        return true;
      } catch (error) {
        this.toast(`清空失败：${error.message || '无法访问浏览器存储'}`, 'error');
        return false;
      }
    },
    toast(message, type) { const region = document.getElementById('toast-region'); if (!region) return; const item = document.createElement('div'); item.className = `toast ${type || ''}`; item.innerHTML = `<span>${U.escapeHTML(message)}</span>`; region.appendChild(item); global.setTimeout(() => item.remove(), 3600); },
    confirm(message, title) { return new Promise((resolve) => { const dialog = document.getElementById('confirm-dialog'); if (!dialog) return resolve(global.confirm(message)); document.getElementById('confirm-title').textContent = title || '确认操作'; document.getElementById('confirm-message').textContent = message; const cancel = document.getElementById('confirm-cancel'); const ok = document.getElementById('confirm-ok'); const finish = (value) => { dialog.close(); cancel.onclick = null; ok.onclick = null; resolve(value); }; cancel.onclick = () => finish(false); ok.onclick = () => finish(true); dialog.showModal(); }); }
  };
  root.ui = UI; global.uiManager = UI;
})(window);
