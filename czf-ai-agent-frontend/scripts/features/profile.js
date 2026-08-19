(function (global) {
  'use strict';

  const root = global.StudyFlow = global.StudyFlow || {};
  const U = root.utils || {};

  function dayKey(date) {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  function startOfDay(date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  function trim(value) { return String(value == null ? '' : value).trim(); }
  function escape(value) { return typeof U.escapeHTML === 'function' ? U.escapeHTML(value) : trim(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
  function itemId(item, index, prefix) { return String(item && item.id != null ? item.id : `${prefix || 'item'}-${index}`); }
  function itemName(item, fallback) { return trim(item && (item.name || item.title)) || fallback || ''; }
  function videoName(item, fallback) { return trim(item && (item.title || item.name)) || fallback || ''; }

  function findIn(list, ref, name, prefix) {
    const items = Array.isArray(list) ? list : [];
    const raw = ref == null ? '' : String(ref);
    if (raw) {
      const byId = items.findIndex((item, index) => itemId(item, index, prefix) === raw);
      if (byId >= 0) return { item: items[byId], index: byId };
      if (/^\d+$/.test(raw)) {
        const index = Number(raw);
        if (index >= 0 && index < items.length) return { item: items[index], index };
      }
    }
    const target = trim(name);
    if (target) {
      const byName = items.findIndex((item) => itemName(item) === target || videoName(item) === target);
      if (byName >= 0) return { item: items[byName], index: byName };
    }
    return null;
  }

  function dispatchDataChanged() {
    try { global.dispatchEvent(new Event('studyflow:data-changed')); } catch (_) { /* embedded browsers may lack Event */ }
    try { global.document.dispatchEvent(new Event('studyflow:data-changed')); } catch (_) { /* no-op */ }
  }

  const Profile = {
    editingRecordId: null,
    activeTab: 'overview',
    reportPeriod: 'day',
    initialized: false,

    init() {
      if (this.initialized) return this;
      this.initialized = true;
      global.addEventListener('studyflow:data-changed', () => this.render());
      document.addEventListener('studyflow:focus-record-create', () => this.render());
      this.bindRecordEditor();
      this.bindProfileTabs();
      this.bindReportControls();
      return this;
    },

    records() {
      return (root.storage?.getFocusRecords?.() || [])
        .filter((item) => (item.phase === 'focus' || item.sessionType === 'work') && Number(item.durationSeconds || 0) > 0)
        .sort((a, b) => new Date(b.completedAt || b.startedAt || b.timestamp) - new Date(a.completedAt || a.startedAt || a.timestamp));
    },

    projects() { return root.storage?.getProjects?.() || []; },

    render() {
      this.renderMetrics();
      this.renderChart();
      this.renderRecords();
      this.renderReminder();
      this.renderReportFilters();
      this.renderReport();
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    bindProfileTabs() {
      document.querySelectorAll('[data-profile-tab]').forEach((button) => {
        button.addEventListener('click', () => this.setProfileTab(button.dataset.profileTab));
      });
    },

    setProfileTab(tab) {
      this.activeTab = ['overview', 'planner', 'report'].includes(tab) ? tab : 'overview';
      document.querySelectorAll('[data-profile-tab]').forEach((button) => {
        const active = button.dataset.profileTab === this.activeTab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('[data-profile-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.profilePanel !== this.activeTab));
      if (this.activeTab === 'planner') root.aiPlanner?.render();
      if (this.activeTab === 'report') this.renderReport();
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    bindReportControls() {
      const dateInput = document.getElementById('report-date');
      if (dateInput && !dateInput.value) dateInput.value = dayKey(new Date());
      dateInput?.addEventListener('change', () => this.renderReport());
      document.getElementById('report-project-filter')?.addEventListener('change', () => this.renderReport());
      document.getElementById('report-task-scope')?.addEventListener('change', () => this.renderReport());
      document.getElementById('report-refresh')?.addEventListener('click', () => this.renderReport(true));
      document.querySelectorAll('[data-report-period]').forEach((button) => button.addEventListener('click', () => {
        this.reportPeriod = button.dataset.reportPeriod === 'week' ? 'week' : 'day';
        document.querySelectorAll('[data-report-period]').forEach((item) => item.classList.toggle('active', item === button));
        this.renderReport();
      }));
      document.getElementById('report-copy')?.addEventListener('click', () => this.copyReport());
    },

    renderReportFilters() {
      const select = document.getElementById('report-project-filter');
      if (!select) return;
      const current = select.value;
      select.replaceChildren(new Option('全部项目', ''));
      this.projects().forEach((project, index) => {
        if (project.archived) return;
        select.appendChild(new Option(itemName(project, '未命名项目'), itemId(project, index, 'project')));
      });
      select.value = [...select.options].some((option) => option.value === current) ? current : '';
    },

    reportWindow() {
      const raw = document.getElementById('report-date')?.value;
      const anchor = raw ? new Date(`${raw}T12:00:00`) : new Date();
      const start = startOfDay(anchor);
      if (this.reportPeriod === 'week') {
        const day = start.getDay() || 7;
        start.setDate(start.getDate() - day + 1);
      }
      const end = new Date(start);
      end.setDate(end.getDate() + (this.reportPeriod === 'week' ? 7 : 1));
      return { start, end };
    },

    reportProjects() {
      const selected = document.getElementById('report-project-filter')?.value || '';
      return this.projects().filter((project, index) => !selected || itemId(project, index, 'project') === selected);
    },

    taskStatus(course) {
      const videos = Array.isArray(course?.videos) ? course.videos : [];
      const estimate = Math.max(1, Number(course?.estimatedPomodoros) || 1);
      const completed = Math.max(0, Number(course?.completedPomodoros) || 0);
      const allSubtasksDone = videos.length > 0 && videos.every((video) => Boolean(video.completed));
      if (course?.archived) return '已归档';
      if (completed >= estimate || allSubtasksDone) return '已完成';
      return '进行中';
    },

    recordAssignment(record) {
      const assignment = record?.assignment || {};
      return {
        projectId: String(record?.projectId ?? assignment.projectId ?? ''),
        courseId: String(record?.courseId ?? record?.taskId ?? assignment.courseId ?? assignment.taskId ?? ''),
        videoId: String(record?.videoId ?? record?.subtaskId ?? assignment.videoId ?? assignment.subtaskId ?? ''),
        projectName: trim(record?.projectName || assignment.projectName),
        courseName: trim(record?.courseName || assignment.courseName),
        videoName: trim(record?.videoName || assignment.videoName)
      };
    },

    recordMatches(record, project, projectIndex, course, courseIndex, video, videoIndex) {
      const assignment = this.recordAssignment(record);
      const sameProject = assignment.projectId
        ? assignment.projectId === itemId(project, projectIndex, 'project')
        : Boolean(assignment.projectName && assignment.projectName === itemName(project));
      if (!sameProject || !course) return sameProject;
      const sameCourse = assignment.courseId
        ? assignment.courseId === itemId(course, courseIndex, 'course')
        : Boolean(assignment.courseName && assignment.courseName === itemName(course));
      if (!sameCourse || !video) return sameCourse;
      return assignment.videoId
        ? assignment.videoId === itemId(video, videoIndex, 'video')
        : Boolean(assignment.videoName && assignment.videoName === videoName(video));
    },

    buildReport() {
      const { start, end } = this.reportWindow();
      const projects = this.reportProjects();
      const includeAllActive = document.getElementById('report-task-scope')?.value === 'all';
      const records = this.records().filter((record) => {
        const time = new Date(record.completedAt || record.startedAt || record.timestamp);
        const inWindow = time >= start && time < end;
        if (!inWindow) return false;
        const selectedProject = document.getElementById('report-project-filter')?.value || '';
        if (!selectedProject) return true;
        const sourceProjects = this.projects();
        return projects.some((project) => this.recordMatches(record, project, sourceProjects.indexOf(project)));
      });
      const finished = [];
      const active = [];
      const planned = [];
      const periodProgress = [];
      const allProjects = this.projects();
      projects.forEach((project) => {
        const projectIndex = allProjects.indexOf(project);
        (project.courses || []).forEach((course, courseIndex) => {
          const status = this.taskStatus(course);
          const label = `${itemName(project, '未命名项目')} / ${itemName(course, '未命名任务')}`;
          const progress = `${Math.max(0, Number(course.completedPomodoros) || 0)}/${Math.max(1, Number(course.estimatedPomodoros) || 1)} 番茄`;
          const taskRecords = records.filter((record) => this.recordMatches(record, project, projectIndex, course, courseIndex));
          const completedAt = course.completedAt ? new Date(course.completedAt) : null;
          const archivedAt = course.archivedAt ? new Date(course.archivedAt) : null;
          const completedInWindow = Boolean((completedAt && completedAt >= start && completedAt < end) || (archivedAt && archivedAt >= start && archivedAt < end));
          if (completedInWindow) finished.push(`${label}（${progress}${status === '已归档' ? '，已归档' : ''}）`);
          if (taskRecords.length) {
            const taskMinutes = Math.round(taskRecords.reduce((sum, record) => sum + Number(record.durationSeconds || 0), 0) / 60);
            const subtaskNames = (course.videos || []).filter((video, videoIndex) => taskRecords.some((record) => this.recordMatches(record, project, projectIndex, course, courseIndex, video, videoIndex))).map((video) => videoName(video, '未命名子任务'));
            periodProgress.push(`${label}（本期 ${taskRecords.length} 枚 / ${taskMinutes} 分钟${subtaskNames.length ? `；${[...new Set(subtaskNames)].slice(0, 3).join('、')}` : ''}）`);
          }
          if (status === '进行中') {
            if (taskRecords.length || includeAllActive) active.push(`${label}（${progress}${taskRecords.length ? `，本期 +${taskRecords.length} 枚` : '，本期暂无记录'}）`);
            if (includeAllActive) {
              const pending = (course.videos || []).filter((video) => !video.completed).slice(0, 3);
              pending.forEach((video) => planned.push(`${label} - ${videoName(video, '未命名子任务')}`));
            }
          }
        });
      });
      const periodName = this.reportPeriod === 'week' ? '周报' : '日报';
      const dateLabel = this.reportPeriod === 'week'
        ? `${dayKey(start)} 至 ${dayKey(new Date(end.getTime() - 1))}`
        : dayKey(start);
      const focusMinutes = Math.round(records.reduce((sum, record) => sum + Number(record.durationSeconds || 0), 0) / 60);
      const uniqueFocus = records.map((record) => trim(record.label || record.taskName || record.assignment?.label)).filter(Boolean);
      const lines = [`【${periodName}】${dateLabel}`, '', `🍅 专注：${records.length} 枚，共 ${focusMinutes} 分钟`];
      if (uniqueFocus.length) lines.push(...[...new Set(uniqueFocus)].slice(0, 8).map((label) => `- ${label}`));
      lines.push('', '📈 本期进展：');
      lines.push(...(periodProgress.length ? periodProgress.map((item) => `- ${item}`) : ['（无关联任务的专注进展）']));
      lines.push('', '✅ 本期完成：');
      lines.push(...(finished.length ? finished.map((item) => `- ${item}`) : ['（无）']));
      lines.push('', '🚧 本期推进中：');
      lines.push(...(active.length ? active.map((item) => `- ${item}`) : ['（无）']));
      if (includeAllActive) {
        lines.push('', '🗓 待办 / 计划：');
        lines.push(...(planned.length ? planned.map((item) => `- ${item}`) : ['（无）']));
      }
      return { text: lines.join('\n'), records, focusMinutes, finished, active, planned, periodProgress, periodName, dateLabel };
    },

    renderReport(notify) {
      const preview = document.getElementById('report-preview');
      const summary = document.getElementById('report-summary-strip');
      if (!preview || !summary) return;
      const report = this.buildReport();
      preview.textContent = report.text;
      summary.innerHTML = [
        ['timer', `${report.records.length}`, '完成番茄'],
        ['clock-3', `${report.focusMinutes}`, '专注分钟'],
        ['circle-check-big', `${report.finished.length}`, '本期完成'],
        ['list-todo', `${report.periodProgress.length}`, '本期有进展']
      ].map(([iconName, value, label]) => `<span><i data-lucide="${iconName}"></i><strong>${escape(value)}</strong><small>${escape(label)}</small></span>`).join('');
      if (notify) root.ui?.toast?.('汇报已根据最新数据重新生成', 'success');
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    async copyReport() {
      const report = this.buildReport();
      try {
        if (global.navigator?.clipboard?.writeText) await global.navigator.clipboard.writeText(report.text);
        else {
          const area = document.createElement('textarea');
          area.value = report.text; area.style.position = 'fixed'; area.style.opacity = '0';
          document.body.appendChild(area); area.select();
          if (!document.execCommand('copy')) throw new Error('copy failed');
          area.remove();
        }
        root.ui?.toast?.('汇报内容已复制', 'success');
      } catch (_) {
        root.ui?.toast?.('浏览器未允许自动复制，请在预览区手动选择内容', 'error');
      }
    },

    renderMetrics() {
      const records = this.records();
      const today = startOfDay(new Date());
      const week = new Date(today); week.setDate(week.getDate() - 6);
      const todaySeconds = records.filter((record) => new Date(record.completedAt || record.startedAt || record.timestamp) >= today).reduce((sum, record) => sum + Number(record.durationSeconds || 0), 0);
      const weekRecords = records.filter((record) => new Date(record.completedAt || record.startedAt || record.timestamp) >= week);
      const streakDays = new Set(records.map((record) => dayKey(record.completedAt || record.startedAt || record.timestamp))).size;
      const courses = this.projects().reduce((sum, project) => sum + (Array.isArray(project.courses) ? project.courses.filter((course) => !course.archived).length : 0), 0);
      const element = document.getElementById('profile-metrics');
      if (!element) return;
      const cards = [
        { icon: 'sun', value: `${Math.round(todaySeconds / 60)}`, label: '今日专注 / 分钟', color: 'var(--tomato)' },
        { icon: 'flame', value: `${streakDays}`, label: '累计专注天数', color: 'var(--gold)' },
        { icon: 'target', value: `${weekRecords.length}`, label: '本周完成番茄', color: 'var(--mint)' },
        { icon: 'list-checks', value: `${courses}`, label: '正在进行的任务', color: 'var(--ink-600)' }
      ];
      element.innerHTML = cards.map((card) => `<article class="metric-card" style="--metric-color:${card.color}"><i class="metric-icon" data-lucide="${card.icon}"></i><strong>${escape(card.value)}</strong><span>${escape(card.label)}</span></article>`).join('');
    },

    renderChart() {
      const element = document.getElementById('week-chart');
      const badge = document.getElementById('week-total-badge');
      if (!element) return;
      const records = this.records();
      const today = startOfDay(new Date());
      const values = [];
      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date(today); date.setDate(date.getDate() - offset);
        const key = dayKey(date);
        const minutes = Math.round(records.filter((record) => dayKey(record.completedAt || record.startedAt || record.timestamp) === key).reduce((sum, record) => sum + Number(record.durationSeconds || 0), 0) / 60);
        values.push({ label: offset === 0 ? '今天' : `${date.getMonth() + 1}/${date.getDate()}`, minutes, today: offset === 0 });
      }
      const max = Math.max(1, ...values.map((value) => value.minutes));
      const total = values.reduce((sum, value) => sum + value.minutes, 0);
      if (badge) badge.textContent = `本周 ${total} 分钟`;
      element.innerHTML = values.map((value) => `<div class="chart-day ${value.today ? 'today' : ''}"><div class="chart-bar-wrap"><span class="chart-bar" style="height:${Math.max(4, Math.round(value.minutes / max * 100))}%" title="${value.minutes} 分钟"></span></div><small>${escape(value.label)}</small><em>${value.minutes ? value.minutes + 'm' : ''}</em></div>`).join('');
    },

    renderRecords() {
      const element = document.getElementById('focus-record-list');
      if (!element) return;
      const records = this.records().slice(0, 12);
      if (!records.length) {
        element.innerHTML = '<div class="empty-inline"><i data-lucide="coffee"></i><span>完成第一枚番茄后，记录会出现在这里。</span></div>';
        return;
      }
      element.innerHTML = records.map((record) => {
        const assignment = trim(record.label || record.taskName || record.assignment?.label) || '未命名专注';
        const group = [record.projectName || record.assignment?.projectName, record.courseName || record.assignment?.courseName, record.videoName || record.assignment?.videoName].filter(Boolean).join(' · ') || '未归类';
        const id = escape(record.id);
        return `<div class="record-row" data-record-id="${id}"><span class="record-phase"><i data-lucide="check"></i></span><div class="record-copy"><strong>${escape(assignment)}</strong><small>${escape(group)}</small></div><span class="record-duration">${escape(U.formatDuration ? U.formatDuration(record.durationSeconds) : '00:00')}</span><small class="record-date">${escape(U.dateLabel ? U.dateLabel(record.completedAt || record.startedAt || record.timestamp) : '')}</small><div class="record-actions"><button class="record-action" data-record-edit="${id}" title="编辑记录" aria-label="编辑记录"><i data-lucide="pencil"></i></button><button class="record-action danger" data-record-delete="${id}" title="删除记录" aria-label="删除记录"><i data-lucide="trash-2"></i></button></div></div>`;
      }).join('');
      element.querySelectorAll('[data-record-edit]').forEach((button) => button.addEventListener('click', () => this.openRecordDialog(button.dataset.recordEdit)));
      element.querySelectorAll('[data-record-delete]').forEach((button) => button.addEventListener('click', async () => {
        const confirmed = root.ui && typeof root.ui.confirm === 'function' ? await root.ui.confirm('删除这条专注记录？') : global.confirm('删除这条专注记录？');
        if (confirmed) {
          root.storage.deleteFocusRecord(button.dataset.recordDelete);
          this.render();
          dispatchDataChanged();
          root.ui?.toast?.('记录已删除', 'success');
        }
      }));
    },

    renderReminder() {
      const element = document.getElementById('daily-reminder');
      if (!element) return;
      const todayCount = this.records().filter((record) => new Date(record.completedAt || record.startedAt || record.timestamp) >= startOfDay(new Date())).length;
      element.innerHTML = todayCount
        ? `<div class="reminder-item"><i data-lucide="sparkles"></i><p><strong>节奏不错</strong>今天已经完成 ${todayCount} 枚番茄，休息一下再继续。</p></div>`
        : '<div class="reminder-item"><i data-lucide="leaf"></i><p><strong>给今天一个轻巧的开始</strong>一枚 5 分钟的测试番茄，也算正式出发。</p></div>';
    },

    bindRecordEditor() {
      const form = document.getElementById('record-form');
      const project = document.getElementById('record-project');
      const course = document.getElementById('record-course');
      const dialog = document.getElementById('record-dialog');
      if (form) form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (event.submitter && event.submitter.value !== 'default') { this.closeRecordDialog(); return; }
        this.saveRecordForm();
      });
      project?.addEventListener('change', () => this.populateRecordCourses(project.value));
      course?.addEventListener('change', () => this.populateRecordVideos(project?.value, course.value));
      dialog?.addEventListener('close', () => { this.editingRecordId = null; });
    },

    findRecord(ref) {
      return this.records().find((record) => String(record.id) === String(ref)) || null;
    },

    openRecordDialog(ref) {
      const record = this.findRecord(ref);
      const dialog = document.getElementById('record-dialog');
      if (!record || !dialog) return false;
      this.editingRecordId = record.id;
      const label = document.getElementById('record-label');
      const duration = document.getElementById('record-edit-duration');
      const date = document.getElementById('record-edit-date');
      if (label) label.value = trim(record.label || record.taskName || record.assignment?.label) || '自由专注';
      if (duration) duration.textContent = U.formatDuration ? U.formatDuration(record.durationSeconds) : '00:00';
      if (date) date.textContent = U.dateLabel ? U.dateLabel(record.completedAt || record.startedAt || record.timestamp) : '未记录时间';
      const projectRef = record.projectId ?? record.assignment?.projectId;
      const projectName = record.projectName || record.assignment?.projectName;
      const project = findIn(this.projects(), projectRef, projectName, 'project');
      const courseRef = record.courseId ?? record.taskId ?? record.assignment?.courseId ?? record.assignment?.taskId;
      const courseName = record.courseName || record.assignment?.courseName;
      const course = project ? findIn(project.item.courses, courseRef, courseName, 'course') : null;
      const videoRef = record.videoId ?? record.subtaskId ?? record.assignment?.videoId ?? record.assignment?.subtaskId;
      const videoNameValue = record.videoName || record.assignment?.videoName;
      const video = course ? findIn(course.item.videos, videoRef, videoNameValue, 'video') : null;
      this.populateRecordProjects(project ? itemId(project.item, project.index, 'project') : '');
      this.populateRecordCourses(project ? itemId(project.item, project.index, 'project') : '', course ? itemId(course.item, course.index, 'course') : '');
      this.populateRecordVideos(project ? itemId(project.item, project.index, 'project') : '', course ? itemId(course.item, course.index, 'course') : '', video ? itemId(video.item, video.index, 'video') : '');
      if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute('open', '');
      global.setTimeout(() => label?.focus(), 30);
      if (global.lucide?.createIcons) global.lucide.createIcons();
      return true;
    },

    closeRecordDialog() {
      const dialog = document.getElementById('record-dialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close(); else dialog.removeAttribute('open');
      this.editingRecordId = null;
    },

    populateRecordProjects(selected) {
      const element = document.getElementById('record-project');
      if (!element) return;
      element.replaceChildren();
      const none = new Option('不归属项目', ''); element.appendChild(none);
      this.projects().forEach((project, index) => {
        if (project.archived) return;
        element.appendChild(new Option(itemName(project, '未命名项目'), itemId(project, index, 'project')));
      });
      element.value = [...element.options].some((option) => option.value === String(selected || '')) ? String(selected || '') : '';
    },

    populateRecordCourses(projectRef, selected) {
      const element = document.getElementById('record-course');
      const project = findIn(this.projects(), projectRef, '', 'project');
      if (!element) return;
      element.replaceChildren();
      element.appendChild(new Option('不归属任务', ''));
      (project?.item.courses || []).forEach((course, index) => {
        if (course.archived) return;
        element.appendChild(new Option(itemName(course, '未命名任务'), itemId(course, index, 'course')));
      });
      element.disabled = !project;
      element.value = [...element.options].some((option) => option.value === String(selected || '')) ? String(selected || '') : '';
      this.populateRecordVideos(projectRef, element.value);
    },

    populateRecordVideos(projectRef, courseRef, selected) {
      const element = document.getElementById('record-video');
      const project = findIn(this.projects(), projectRef, '', 'project');
      const course = project ? findIn(project.item.courses, courseRef, '', 'course') : null;
      if (!element) return;
      element.replaceChildren();
      element.appendChild(new Option('不归属子任务', ''));
      (course?.item.videos || []).forEach((video, index) => element.appendChild(new Option(videoName(video, `子任务 ${index + 1}`), itemId(video, index, 'video'))));
      element.disabled = !course;
      element.value = [...element.options].some((option) => option.value === String(selected || '')) ? String(selected || '') : '';
    },

    saveRecordForm() {
      const record = this.findRecord(this.editingRecordId);
      if (!record || !root.storage?.updateFocusRecord) return false;
      const label = trim(document.getElementById('record-label')?.value);
      if (!label) { root.ui?.toast?.('请写下这枚番茄做了什么', 'error'); document.getElementById('record-label')?.focus(); return false; }
      const projectSelect = document.getElementById('record-project');
      const courseSelect = document.getElementById('record-course');
      const videoSelect = document.getElementById('record-video');
      const project = findIn(this.projects(), projectSelect?.value, '', 'project');
      const course = project ? findIn(project.item.courses, courseSelect?.value, '', 'course') : null;
      const video = course ? findIn(course.item.videos, videoSelect?.value, '', 'video') : null;
      const projectId = project ? itemId(project.item, project.index, 'project') : null;
      const courseId = course ? itemId(course.item, course.index, 'course') : null;
      const videoId = video ? itemId(video.item, video.index, 'video') : null;
      const projectName = project ? itemName(project.item, '未命名项目') : '';
      const courseName = course ? itemName(course.item, '未命名任务') : '';
      const videoNameValue = video ? videoName(video.item, '未命名子任务') : '';
      const assignment = Object.assign({}, record.assignment || {}, {
        label, projectId, courseId, videoId,
        taskId: courseId, subtaskId: videoId,
        projectIndex: project ? project.index : null, courseIndex: course ? course.index : null, videoIndex: video ? video.index : null,
        projectName, courseName, videoName: videoNameValue
      });
      const updated = root.storage.updateFocusRecord(record.id, { label, taskName: label, projectId, courseId, videoId, taskId: courseId, subtaskId: videoId, projectName, courseName, videoName: videoNameValue, assignment });
      if (!updated) { root.ui?.toast?.('记录未找到，可能已被删除', 'error'); return false; }
      this.closeRecordDialog();
      this.render();
      dispatchDataChanged();
      root.ui?.toast?.('专注记录已更新', 'success');
      return true;
    }
  };

  root.profile = Profile;
  global.profileManager = Profile;
})(window);
