/*
 * Tasks feature
 *
 * The task screen is deliberately self contained.  It talks to the storage
 * facade when one is available, but also understands the original
 * DataStorage shape ({ projects: [{ courses, videos, knowledge }] }).  This
 * keeps imported data and older local profiles usable during the migration.
 */
(function (window, document) {
  'use strict';

  const StudyFlow = window.StudyFlow = window.StudyFlow || {};

  const byId = (id) => document.getElementById(id);
  const trim = (value) => String(value == null ? '' : value).trim();
  const uid = (prefix) => `${prefix || 'item'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function notify(message, type) {
    if (window.uiManager && typeof window.uiManager.showNotification === 'function') {
      window.uiManager.showNotification(message, type || 'info');
      return;
    }
    const region = byId('toast-region');
    if (!region) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;
    toast.textContent = message;
    region.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  function safeUrl(value) {
    const candidate = trim(value);
    if (!candidate) return '';
    try {
      const parsed = new URL(candidate, window.location.href);
      if (!/^https?:$/.test(parsed.protocol)) return '';
      return parsed.href;
    } catch (_) {
      return '';
    }
  }

  function text(parent, value, className) {
    const node = document.createElement('span');
    if (className) node.className = className;
    node.textContent = value == null ? '' : String(value);
    parent.appendChild(node);
    return node;
  }

  function icon(name, className) {
    const node = document.createElement('i');
    node.setAttribute('data-lucide', name);
    if (className) node.className = className;
    return node;
  }

  function actionButton(label, action, iconName, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className || 'icon-button';
    button.dataset.action = action;
    button.title = label;
    button.setAttribute('aria-label', label);
    if (iconName) button.appendChild(icon(iconName));
    if (className && className.indexOf('icon-button') === -1) text(button, label);
    return button;
  }

  function idOf(item, fallback) {
    return item && (item.id || item._id || item.uuid) || fallback;
  }

  class TasksFeature {
    constructor() {
      this.selectedProjectId = null;
      this.editingProjectId = null;
      this.editingCourseId = null;
      this.editingSubtaskCourseId = null;
      this.editingSubtaskId = null;
      this.editingKnowledgeId = null;
      this.courseMode = 'manual';
      this.projectFilter = 'active';
      this.taskFilter = 'active';
      this.initialized = false;
      this.bound = false;
    }

    get storage() {
      return (StudyFlow && StudyFlow.storage) || window.dataStorage || null;
    }

    projects() {
      const store = this.storage;
      let projects = [];
      try {
        if (store && typeof store.getProjects === 'function') projects = store.getProjects() || [];
        else if (store && Array.isArray(store.projects)) projects = store.projects;
        else if (Array.isArray(StudyFlow.projects)) projects = StudyFlow.projects;
      } catch (error) {
        console.error('读取项目失败:', error);
      }
      if (!Array.isArray(projects)) projects = [];
      projects.forEach((project, projectIndex) => {
        if (!project.id) project.id = `project-${projectIndex}`;
        if (!Array.isArray(project.courses)) project.courses = [];
        if (!Array.isArray(project.knowledge)) project.knowledge = [];
        project.courses.forEach((course, courseIndex) => {
          if (!course.id) course.id = `course-${projectIndex}-${courseIndex}`;
          if (!Array.isArray(course.videos)) course.videos = Array.isArray(course.subtasks) ? course.subtasks : [];
          course.videos.forEach((video, index) => {
            if (video.completed === undefined) video.completed = false;
            if (!video.id) video.id = `video-${projectIndex}-${courseIndex}-${index}`;
          });
        });
        project.knowledge.forEach((note) => { if (!note.id) note.id = uid('knowledge'); });
      });
      return projects;
    }

    presets() {
      return StudyFlow.presets && Array.isArray(StudyFlow.presets.list) ? StudyFlow.presets.list : [];
    }

    presetById(id) {
      const key = trim(id);
      if (!key) return null;
      if (StudyFlow.presets && typeof StudyFlow.presets.get === 'function') return StudyFlow.presets.get(key);
      return this.presets().find((preset) => String(preset.id) === key) || null;
    }

    presetTimeSummary(preset) {
      if (!preset) return '选择项目时保持正在使用的节奏';
      const compact = (value, unit) => `${value}${unit === 'seconds' ? '秒' : '分'}`;
      return `${compact(preset.workTime, preset.workUnit)} 专注 · ${compact(preset.breakTime, preset.breakUnit)} 短休息`;
    }

    renderPresetPreview(previewId, presetId) {
      const preview = byId(previewId);
      if (!preview) return;
      const preset = this.presetById(presetId);
      const glyph = icon(preset ? preset.icon : 'shuffle');
      const copy = document.createElement('span');
      const name = document.createElement('strong');
      const summary = document.createElement('small');
      name.textContent = preset ? preset.name : '跟随当前方案';
      summary.textContent = this.presetTimeSummary(preset);
      copy.append(name, summary);
      preview.replaceChildren(glyph, copy);
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    populatePresetSelect(selectId, previewId, selected) {
      const select = byId(selectId);
      if (!select) return;
      const preferred = trim(selected !== undefined ? selected : select.value);
      select.replaceChildren(new Option('跟随当前方案', ''));
      this.presets().forEach((preset) => {
        select.appendChild(new Option(`${preset.name} · ${this.presetTimeSummary(preset)}`, preset.id));
      });
      select.value = [...select.options].some((option) => option.value === preferred) ? preferred : '';
      this.renderPresetPreview(previewId, select.value);
    }

    save() {
      const store = this.storage;
      try {
        if (store && typeof store.save === 'function') store.save();
        else if (store && typeof store.saveData === 'function') store.saveData();
        else if (Array.isArray(store && store.projects) && window.localStorage) {
          const key = store.STORAGE_KEY || 'modern-project-manager';
          window.localStorage.setItem(key, JSON.stringify(store.projects));
        }
      } catch (error) {
        console.error('保存任务数据失败:', error);
        notify('保存失败，请检查浏览器存储空间', 'error');
      }
    }

    findProject(idOrIndex) {
      const list = this.projects();
      if (idOrIndex == null || idOrIndex === '') return null;
      const index = Number.isInteger(idOrIndex) || /^\d+$/.test(String(idOrIndex)) ? Number(idOrIndex) : -1;
      if (index >= 0 && index < list.length) return { item: list[index], index };
      const found = list.findIndex((project, indexValue) => String(idOf(project, `project-${indexValue}`)) === String(idOrIndex));
      return found >= 0 ? { item: list[found], index: found } : null;
    }

    findCourse(project, idOrIndex) {
      if (!project || idOrIndex == null) return null;
      const courses = Array.isArray(project.courses) ? project.courses : [];
      const index = Number.isInteger(idOrIndex) || /^\d+$/.test(String(idOrIndex)) ? Number(idOrIndex) : -1;
      if (index >= 0 && index < courses.length) return { item: courses[index], index };
      const found = courses.findIndex((course, indexValue) => String(idOf(course, `course-${indexValue}`)) === String(idOrIndex));
      return found >= 0 ? { item: courses[found], index: found } : null;
    }

    findKnowledge(project, idOrIndex) {
      if (!project || idOrIndex == null) return null;
      const notes = Array.isArray(project.knowledge) ? project.knowledge : [];
      const index = Number.isInteger(idOrIndex) || /^\d+$/.test(String(idOrIndex)) ? Number(idOrIndex) : -1;
      if (index >= 0 && index < notes.length) return { item: notes[index], index };
      const found = notes.findIndex((note, indexValue) => String(idOf(note, `knowledge-${indexValue}`)) === String(idOrIndex));
      return found >= 0 ? { item: notes[found], index: found } : null;
    }

    invoke(methods, args, fallback) {
      const store = this.storage;
      if (store) {
        for (const method of methods) {
          if (typeof store[method] === 'function') {
            try {
              const result = store[method](...args);
              return result === undefined ? fallback() : result;
            } catch (error) {
              // A facade can expose a method with a slightly different
              // signature.  Falling through to the local mutation keeps the
              // UI usable and leaves the error visible in the console.
              console.warn(`存储方法 ${method} 调用失败，使用兼容路径`, error);
            }
          }
        }
      }
      return fallback();
    }

    persistAndRender(message, type) {
      this.save();
      this.render();
      this.renderFocusOptions();
      if (message) notify(message, type || 'success');
    }

    init() {
      if (this.initialized) return this;
      this.initialized = true;
      this.bindEvents();
      this.render();
      this.renderFocusOptions();
      return this;
    }

    bindEvents() {
      if (this.bound) return;
      this.bound = true;
      const on = (id, event, handler) => {
        const node = byId(id);
        if (node) node.addEventListener(event, handler);
      };

      on('project-add', 'click', () => this.openProjectDialog());
      on('project-edit', 'click', () => this.openProjectDialog(this.selectedProjectId));
      on('project-delete', 'click', () => this.confirmDeleteProject(this.selectedProjectId));
      on('project-archive', 'click', () => this.toggleProjectArchive(this.selectedProjectId));
      on('course-add', 'click', () => this.openCourseDialog());
      on('knowledge-add', 'click', () => this.openKnowledgeDialog());
      on('subtask-add', 'click', () => this.addSubtaskRow());
      ['course-estimate-hours', 'course-estimate-minutes', 'subtask-estimate-hours', 'subtask-estimate-minutes', 'work-time', 'work-unit'].forEach((id) => on(id, 'input', () => this.updateEstimatePreviews()));
      on('project-preferred-preset', 'change', (event) => this.renderPresetPreview('project-preset-preview', event.target.value));
      document.querySelectorAll('[data-task-filter]').forEach((button) => {
        button.addEventListener('click', () => this.setTaskFilter(button.dataset.taskFilter));
      });
      document.querySelectorAll('[data-project-filter]').forEach((button) => {
        button.addEventListener('click', () => this.setProjectFilter(button.dataset.projectFilter));
      });

      const projectForm = byId('project-form');
      if (projectForm) projectForm.addEventListener('submit', (event) => {
        if (event.submitter && event.submitter.value !== 'default') {
          event.preventDefault();
          this.closeDialog('project-dialog');
          return;
        }
        event.preventDefault();
        this.saveProjectForm();
      });
      const courseForm = byId('course-form');
      if (courseForm) courseForm.addEventListener('submit', (event) => {
        if (event.submitter && event.submitter.value !== 'default') {
          event.preventDefault();
          this.closeDialog('course-dialog');
          return;
        }
        event.preventDefault();
        this.saveCourseForm();
      });
      const subtaskForm = byId('subtask-form');
      if (subtaskForm) subtaskForm.addEventListener('submit', (event) => {
        if (event.submitter && event.submitter.value !== 'default') {
          event.preventDefault();
          this.closeDialog('subtask-dialog');
          return;
        }
        event.preventDefault();
        this.saveSubtaskForm();
      });
      const knowledgeForm = byId('knowledge-form');
      if (knowledgeForm) knowledgeForm.addEventListener('submit', (event) => {
        if (event.submitter && event.submitter.value !== 'default') {
          event.preventDefault();
          this.closeDialog('knowledge-dialog');
          return;
        }
        event.preventDefault();
        this.saveKnowledgeForm();
      });

      document.querySelectorAll('[data-course-mode]').forEach((button) => {
        button.addEventListener('click', () => this.setCourseMode(button.dataset.courseMode));
      });
      document.querySelectorAll('[data-task-tab]').forEach((button) => {
        button.addEventListener('click', () => this.setTaskTab(button.dataset.taskTab));
      });
      document.addEventListener('click', (event) => this.handleDelegatedClick(event));
      document.addEventListener('change', (event) => this.handleDelegatedChange(event));
      document.addEventListener('input', (event) => {
        if (event.target.closest('.subtask-estimate-control')) this.updateEstimatePreviews();
      });
      window.addEventListener('studyflow:data-changed', () => {
        const projects = this.projects();
        if (!projects.some((project, index) => String(idOf(project, `project-${index}`)) === String(this.selectedProjectId))) this.selectedProjectId = null;
        this.render();
        this.renderFocusOptions();
      });
      window.addEventListener('studyflow:presets-changed', () => {
        this.render();
        const dialog = byId('project-dialog');
        if (dialog && dialog.open) this.populatePresetSelect('project-preferred-preset', 'project-preset-preview');
      });
    }

    handleDelegatedClick(event) {
      const cancel = event.target.closest('button[value="cancel"]');
      if (cancel) {
        event.preventDefault();
        const dialog = cancel.closest('dialog');
        if (dialog) this.closeDialog(dialog.id);
        return;
      }
      const actionNode = event.target.closest('[data-action]');
      if (!actionNode) return;
      const action = actionNode.dataset.action;
      if (action === 'add-project') return this.openProjectDialog();
      if (action === 'select-project') return this.selectProject(actionNode.dataset.projectId);
      if (action === 'edit-project') return this.openProjectDialog(actionNode.dataset.projectId);
      if (action === 'delete-project') return this.confirmDeleteProject(actionNode.dataset.projectId);
      if (action === 'toggle-project-archive') return this.toggleProjectArchive(actionNode.dataset.projectId);
      if (action === 'edit-course') return this.openCourseDialog(actionNode.dataset.courseId);
      if (action === 'delete-course') return this.confirmDeleteCourse(actionNode.dataset.courseId);
      if (action === 'edit-knowledge') return this.openKnowledgeDialog(actionNode.dataset.knowledgeId);
      if (action === 'delete-knowledge') return this.confirmDeleteKnowledge(actionNode.dataset.knowledgeId);
      if (action === 'remove-subtask') return this.removeSubtaskRow(actionNode);
      if (action === 'edit-subtask') return this.openSubtaskDialog(actionNode.dataset.courseId, actionNode.dataset.videoId);
      if (action === 'toggle-course-archive') return this.toggleCourseArchive(actionNode.dataset.courseId);
    }

    handleDelegatedChange(event) {
      const checkbox = event.target.closest('[data-action="toggle-video"]');
      if (checkbox) this.toggleVideo(checkbox.dataset.courseId, checkbox.dataset.videoId, checkbox.checked);
      const projectSelect = event.target.closest('#focus-project');
      if (projectSelect) {
        this.renderFocusOptions(projectSelect.value);
        if (StudyFlow.timerView && typeof StudyFlow.timerView.updateAssignment === 'function') StudyFlow.timerView.updateAssignment();
      }
      const courseSelect = event.target.closest('#focus-course');
      if (courseSelect) {
        this.renderFocusOptions(byId('focus-project') && byId('focus-project').value);
        if (StudyFlow.timerView && typeof StudyFlow.timerView.updateAssignment === 'function') StudyFlow.timerView.updateAssignment();
      }
    }

    render() {
      this.renderProjects();
      this.renderWorkspace();
      this.renderKnowledge();
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    renderProjects() {
      const container = byId('project-list');
      const empty = byId('project-empty');
      if (!container) return;
      const projects = this.projects();
      container.replaceChildren();
      if (empty) empty.classList.toggle('hidden', projects.length > 0);
      const visibleProjects = projects.filter((project) => this.projectFilter === 'all' || (this.projectFilter === 'archived' ? Boolean(project.archived) : !project.archived));
      const summary = byId('project-progress-summary');
      if (summary) summary.textContent = `${projects.filter((project) => !project.archived).length} 进行中 · ${projects.filter((project) => project.archived).length} 已归档`;
      if (!visibleProjects.length && projects.length) {
        const inlineEmpty = document.createElement('div');
        inlineEmpty.className = 'project-filter-empty';
        text(inlineEmpty, this.projectFilter === 'archived' ? '还没有归档项目。' : '没有符合当前筛选的项目。');
        container.appendChild(inlineEmpty);
      }
      visibleProjects.forEach((project) => {
        const index = projects.indexOf(project);
        const projectId = String(idOf(project, `project-${index}`));
        const courses = Array.isArray(project.courses) ? project.courses : [];
        const completed = courses.filter((course) => this.isTaskComplete(course)).length;
        const archived = courses.filter((course) => course.archived).length;
        const card = document.createElement('article');
        card.className = `project-card${String(this.selectedProjectId) === projectId ? ' selected' : ''}${project.archived ? ' archived' : ''}`;
        card.dataset.projectId = projectId;
        const header = document.createElement('div');
        header.className = 'project-card-header';
        const select = document.createElement('button');
        select.type = 'button';
        select.className = 'project-select';
        select.dataset.action = 'select-project';
        select.dataset.projectId = projectId;
        select.setAttribute('aria-label', `选择项目 ${trim(project.name) || '未命名项目'}`);
        const visibleName = document.createElement('h3');
        visibleName.textContent = trim(project.name) || '未命名项目';
        // The transparent button owns the whole card hit area; visible text
        // must let pointer events pass through to it.
        visibleName.style.pointerEvents = 'none';
        header.appendChild(visibleName);
        header.appendChild(select);
        const actions = document.createElement('div');
        actions.className = 'card-actions';
         actions.appendChild(actionButton('编辑项目', 'edit-project', 'pencil'));
         actions.lastChild.dataset.projectId = projectId;
         actions.appendChild(actionButton(project.archived ? '恢复项目' : '归档项目', 'toggle-project-archive', project.archived ? 'archive-restore' : 'archive'));
         actions.lastChild.dataset.projectId = projectId;
         actions.appendChild(actionButton('删除项目', 'delete-project', 'trash-2', 'icon-button danger'));
        actions.lastChild.dataset.projectId = projectId;
        header.appendChild(actions);
        card.appendChild(header);
        const meta = document.createElement('div');
        meta.className = 'project-card-meta';
         text(meta, `${courses.length} 个任务`);
         text(meta, `${completed} 个完成`);
         if (archived) text(meta, `${archived} 个归档`);
        if (project.archived) text(meta, '项目已归档', 'project-archived-label');
         card.appendChild(meta);
        const preferredPreset = this.presetById(project.preferredFocusPresetId);
        if (preferredPreset) {
          const badge = document.createElement('span');
          badge.className = 'project-preset-badge';
          badge.append(icon(preferredPreset.icon));
          text(badge, preferredPreset.name);
          card.appendChild(badge);
        }
         if (trim(project.description)) text(card, trim(project.description), 'project-description');
        const progress = document.createElement('div');
        progress.className = 'progress-track';
        const fill = document.createElement('span');
        fill.className = 'progress-fill';
        fill.style.width = `${courses.length ? Math.round(completed / courses.length * 100) : 0}%`;
        progress.appendChild(fill);
        card.appendChild(progress);
        container.appendChild(card);
      });
    }

    renderWorkspace() {
      const workspace = byId('project-workspace');
      const projects = this.projects();
      let selected = this.findProject(this.selectedProjectId);
      const eligible = projects.find((project) => this.projectFilter === 'all' || (this.projectFilter === 'archived' ? Boolean(project.archived) : !project.archived));
      if (selected && this.projectFilter !== 'all' && Boolean(selected.item.archived) !== (this.projectFilter === 'archived')) selected = null;
      if (!selected && eligible) {
        this.selectedProjectId = idOf(eligible, 'project-0');
        selected = this.findProject(this.selectedProjectId);
      }
      if (!workspace) return;
      workspace.classList.toggle('hidden', !selected);
      const title = byId('selected-project-title');
      if (title) title.textContent = selected ? (trim(selected.item.name) || '未命名项目') : '';
      const description = byId('selected-project-description');
      if (description) {
        description.textContent = selected ? trim(selected.item.description) : '';
        description.classList.toggle('hidden', !selected || !trim(selected.item.description));
      }
      const presetBadge = byId('selected-project-preset');
      if (presetBadge) {
        const preset = selected ? this.presetById(selected.item.preferredFocusPresetId) : null;
        presetBadge.classList.toggle('hidden', !preset);
        if (preset) {
          presetBadge.replaceChildren(icon(preset.icon));
          text(presetBadge, `偏好节奏 · ${preset.name}`);
        } else presetBadge.replaceChildren();
      }
      const hasProject = Boolean(selected);
      ['project-edit', 'project-archive', 'project-delete', 'course-add', 'knowledge-add'].forEach((id) => {
        const node = byId(id);
        if (node) node.disabled = !hasProject;
      });
      const archiveButton = byId('project-archive');
      if (archiveButton && selected) {
        archiveButton.classList.toggle('danger-ghost', Boolean(selected.item.archived));
        archiveButton.classList.toggle('ghost', !selected.item.archived);
        const label = archiveButton.querySelector('span');
        if (label) label.textContent = selected.item.archived ? '恢复项目' : '归档项目';
        const glyph = archiveButton.querySelector('svg, [data-lucide]');
        if (glyph) {
          const nextIcon = icon(selected.item.archived ? 'archive-restore' : 'archive');
          glyph.replaceWith(nextIcon);
        }
      }
      if (selected) {
        const locked = Boolean(selected.item.archived);
        ['course-add', 'knowledge-add'].forEach((id) => {
          const node = byId(id);
          if (node) {
            node.disabled = locked;
            node.title = locked ? '恢复项目后即可添加内容' : '';
          }
        });
      }
      this.renderCourses();
    }

    renderCourses() {
      const container = byId('course-list');
      if (!container) return;
      const selected = this.findProject(this.selectedProjectId);
      container.replaceChildren();
      if (!selected || !selected.item.courses.length) {
        const empty = document.createElement('div');
        empty.className = 'inline-empty';
        text(empty, '还没有任务，添加一项就可以开始整理。');
        container.appendChild(empty);
        return;
      }
      const allCourses = Array.isArray(selected.item.courses) ? selected.item.courses : [];
      const courses = allCourses.filter((course) => this.taskFilter === 'all' || (this.taskFilter === 'archived' ? Boolean(course.archived) : !course.archived));
      const summary = byId('task-progress-summary');
      if (summary) {
        const archivedCount = allCourses.filter((course) => course.archived).length;
        const doneCount = allCourses.filter((course) => this.isTaskComplete(course)).length;
        summary.textContent = `${doneCount}/${allCourses.length} 完成 · ${archivedCount} 已归档`;
      }
      const emptyFiltered = !courses.length && allCourses.length;
      if (emptyFiltered) {
        const empty = document.createElement('div');
        empty.className = 'inline-empty';
        text(empty, this.taskFilter === 'archived' ? '还没有归档任务。' : '没有符合当前筛选的任务。');
        container.appendChild(empty);
        return;
      }
      courses.forEach((course, index) => {
        const courseId = String(idOf(course, `course-${index}`));
        const card = document.createElement('article');
        card.className = 'course-card';
        card.dataset.courseId = courseId;
        const head = document.createElement('div');
        head.className = 'course-card-header';
        const titleWrap = document.createElement('div');
        titleWrap.className = 'course-title-wrap';
         const heading = document.createElement('h3');
         heading.textContent = trim(course.name || course.title) || '未命名任务';
         titleWrap.appendChild(heading);
        const videos = Array.isArray(course.videos) ? course.videos : [];
        const subtaskProgress = this.progress(course);
        const pomodoroProgress = this.pomodoroProgress(course);
        const progress = pomodoroProgress.hasEstimate ? pomodoroProgress.percent : subtaskProgress;
        const badge = document.createElement('span');
        badge.className = `soft-badge ${this.isTaskComplete(course) ? 'complete' : ''}`;
        badge.textContent = `${progress}%`;
        titleWrap.appendChild(badge);
        head.appendChild(titleWrap);
        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const edit = actionButton('编辑任务', 'edit-course', 'pencil');
        edit.dataset.courseId = courseId;
        actions.appendChild(edit);
        const del = actionButton('删除任务', 'delete-course', 'trash-2', 'icon-button danger');
        del.dataset.courseId = courseId;
        actions.appendChild(del);
         head.appendChild(actions);
         card.appendChild(head);
         if (trim(course.description)) text(card, trim(course.description), 'course-description');
        const goal = document.createElement('div');
        goal.className = 'course-goal-meta';
        const completedPomodoros = pomodoroProgress.completed;
        const estimatedPomodoros = pomodoroProgress.estimate;
        const remainingPomodoros = Math.max(0, estimatedPomodoros - completedPomodoros);
        text(goal, `${completedPomodoros} / ${estimatedPomodoros} 枚番茄`, 'course-pomodoro-count');
        text(goal, remainingPomodoros ? `还剩 ${remainingPomodoros} 枚` : '目标已完成', `course-pomodoro-remaining${remainingPomodoros ? '' : ' complete'}`);
        const archive = actionButton(course.archived ? '恢复任务' : '归档任务', 'toggle-course-archive', course.archived ? 'archive-restore' : 'archive', 'button ghost course-archive-button');
        archive.dataset.courseId = courseId;
        goal.appendChild(archive);
        card.appendChild(goal);
        const goalTrack = document.createElement('div');
        goalTrack.className = 'progress-track course-pomodoro-track';
        const goalFill = document.createElement('span');
        goalFill.className = 'progress-fill';
        goalFill.style.width = `${Math.min(100, pomodoroProgress.percent)}%`;
        goalTrack.appendChild(goalFill);
        card.appendChild(goalTrack);
        const completedSubtasks = videos.filter((video) => Boolean(video.completed)).length;
        const subtaskSummary = document.createElement('small');
        subtaskSummary.className = 'course-subtask-summary';
        subtaskSummary.textContent = videos.length ? `${completedSubtasks}/${videos.length} 个子任务完成` : '暂无子任务';
        card.appendChild(subtaskSummary);
        if (safeUrl(course.url)) {
          const link = document.createElement('a');
          link.className = 'course-source';
          link.href = safeUrl(course.url);
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.appendChild(icon('external-link'));
          text(link, '打开任务主页');
          card.appendChild(link);
        }
        const list = document.createElement('div');
        list.className = 'subtask-list';
        videos.forEach((video, videoIndex) => {
          const videoId = String(idOf(video, `video-${videoIndex}`));
           const row = document.createElement('div');
          row.className = `subtask-row${video.completed ? ' completed' : ''}`;
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = Boolean(video.completed);
           checkbox.dataset.action = 'toggle-video';
           checkbox.dataset.courseId = courseId;
           checkbox.dataset.videoId = videoId;
           checkbox.setAttribute('aria-label', `${video.completed ? '取消完成' : '标记完成'}：${trim(video.title || video.name) || `子任务 ${videoIndex + 1}`}`);
          row.appendChild(checkbox);
           const nameBlock = document.createElement('span');
           nameBlock.className = 'subtask-name-block';
           const name = document.createElement('span');
           name.className = 'subtask-name-display';
           name.textContent = trim(video.title || video.name) || `子任务 ${videoIndex + 1}`;
           nameBlock.appendChild(name);
           if (trim(video.description)) text(nameBlock, trim(video.description), 'subtask-description-display');
           row.appendChild(nameBlock);
          const subtaskProgress = this.subtaskPomodoroProgress(video);
          const subtaskMeta = document.createElement('small');
          subtaskMeta.className = 'subtask-progress-meta';
          subtaskMeta.textContent = `${subtaskProgress.completed}/${subtaskProgress.estimate} 番茄`;
           row.appendChild(subtaskMeta);
           const editSubtask = actionButton('编辑子任务', 'edit-subtask', 'pencil', 'icon-button subtask-edit-button');
           editSubtask.dataset.courseId = courseId;
           editSubtask.dataset.videoId = videoId;
           row.appendChild(editSubtask);
           if (video.duration && video.duration !== '00:00') text(row, trim(video.duration), 'subtask-duration');
          const videoHref = safeUrl(video.url) || this.generateVideoUrl(course.url, video.index || videoIndex + 1);
          if (videoHref) {
            const link = document.createElement('a');
            link.href = videoHref;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = '打开子任务链接';
            link.setAttribute('aria-label', '打开子任务链接');
            link.appendChild(icon('external-link'));
            row.appendChild(link);
          }
          list.appendChild(row);
        });
        card.appendChild(list);
        if (course.archived) card.classList.add('archived');
        container.appendChild(card);
      });
    }

    renderKnowledge() {
      const container = byId('knowledge-list');
      if (!container) return;
      const selected = this.findProject(this.selectedProjectId);
      container.replaceChildren();
      if (!selected || !selected.item.knowledge.length) {
        const empty = document.createElement('div');
        empty.className = 'inline-empty';
        text(empty, '把常用讲义、题单或课程入口集中放在这里。');
        container.appendChild(empty);
        return;
      }
      selected.item.knowledge.forEach((note, index) => {
        const noteId = String(idOf(note, `knowledge-${index}`));
        const row = document.createElement('article');
        row.className = 'knowledge-card';
        const body = document.createElement('div');
        body.className = 'knowledge-card-body';
        const link = document.createElement('a');
        link.href = safeUrl(note.url) || '#';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = trim(note.name) || '未命名链接';
        body.appendChild(link);
        text(body, trim(note.url), 'knowledge-url');
        row.appendChild(body);
        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const edit = actionButton('编辑链接', 'edit-knowledge', 'pencil');
        edit.dataset.knowledgeId = noteId;
        actions.appendChild(edit);
        const del = actionButton('删除链接', 'delete-knowledge', 'trash-2', 'icon-button danger');
        del.dataset.knowledgeId = noteId;
        actions.appendChild(del);
        row.appendChild(actions);
        container.appendChild(row);
      });
    }

    progress(course) {
      const videos = Array.isArray(course && course.videos) ? course.videos : [];
      if (!videos.length) return 0;
      return Math.round(videos.filter((video) => video.completed).length / videos.length * 100);
    }

    subtaskPomodoroProgress(video) {
      const minutes = Math.max(0, Number(video && video.estimatedMinutes) || 0);
      const storedEstimate = Number(video && video.estimatedPomodoros);
      const estimate = storedEstimate > 0 ? Math.floor(storedEstimate) : this.estimatedPomodoros(minutes, 1);
      const completed = Math.max(0, Math.floor(Number(video && video.completedPomodoros) || 0));
      return { estimate: Math.max(1, estimate), completed, remaining: Math.max(0, estimate - completed), percent: Math.min(100, Math.round(completed / Math.max(1, estimate) * 100)) };
    }

    pomodoroProgress(course) {
      const storedEstimate = Number(course && course.estimatedPomodoros);
      const estimate = storedEstimate > 0 ? Math.floor(storedEstimate) : this.estimatedPomodoros(course && course.estimatedMinutes, 1);
      const completed = Math.max(0, Math.floor(Number(course && course.completedPomodoros) || 0));
      return { estimate: Math.max(1, estimate), completed, remaining: Math.max(0, estimate - completed), percent: Math.min(100, Math.round(completed / Math.max(1, estimate) * 100)), hasEstimate: Boolean(course && (course.estimatedMinutes != null || course.estimatedPomodoros != null)) };
    }

    focusMinutes() {
      const settings = this.storage && typeof this.storage.getSettings === 'function' ? this.storage.getSettings() : {};
      const amount = Number(byId('work-time')?.value || settings.workTime || 25);
      const unit = byId('work-unit')?.value || settings.workUnit || 'minutes';
      return Math.max(1 / 60, unit === 'seconds' ? amount / 60 : amount);
    }

    estimatedPomodoros(minutes, fallback) {
      const total = Math.max(0, Number(minutes) || 0);
      return total > 0 ? Math.max(1, Math.ceil(total / this.focusMinutes())) : Math.max(1, Math.floor(Number(fallback) || 1));
    }

    readDuration(hoursInput, minutesInput, label) {
      const hours = Number(hoursInput?.value || 0);
      const minutes = Number(minutesInput?.value || 0);
      if (!Number.isInteger(hours) || hours < 0 || hours > 999 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) throw new Error(`${label || '预计用时'}请填写有效的小时和分钟`);
      const total = hours * 60 + minutes;
      if (total < 1) throw new Error(`${label || '预计用时'}不能少于 1 分钟`);
      return total;
    }

    updateEstimatePreviews() {
      const hours = Number(byId('course-estimate-hours')?.value || 0);
      const minutes = Number(byId('course-estimate-minutes')?.value || 0);
      const total = Math.max(0, hours * 60 + minutes);
      const preview = byId('course-estimate-preview');
      if (preview) preview.textContent = total ? `当前设置下，预计需要 ${this.estimatedPomodoros(total)} 枚番茄` : '请填写预计用时';
      document.querySelectorAll('.subtask-edit-row').forEach((row) => {
        const h = Number(row.querySelector('.subtask-estimate-hours')?.value || 0);
        const m = Number(row.querySelector('.subtask-estimate-minutes')?.value || 0);
        const value = Math.max(0, h * 60 + m);
        const output = row.querySelector('.subtask-estimate-preview');
        if (output) output.textContent = value ? `预计 ${this.estimatedPomodoros(value)} 枚番茄` : '请填写预计用时';
      });
      const subtaskHours = Number(byId('subtask-estimate-hours')?.value || 0);
      const subtaskMinutes = Number(byId('subtask-estimate-minutes')?.value || 0);
      const subtaskTotal = Math.max(0, subtaskHours * 60 + subtaskMinutes);
      const subtaskPreview = byId('subtask-estimate-preview');
      if (subtaskPreview) subtaskPreview.textContent = subtaskTotal ? `当前设置下，预计需要 ${this.estimatedPomodoros(subtaskTotal)} 枚番茄` : '请填写预计用时';
    }

    isTaskComplete(course) {
      const progress = this.pomodoroProgress(course);
      // A task can be finished either by reaching its Pomodoro target or by
      // checking off every subtask. Both signals are intentional and keep
      // manual task tracking useful alongside the timer workflow.
      return progress.completed >= progress.estimate || this.progress(course) === 100;
    }

    setTaskFilter(filter) {
      this.taskFilter = ['active', 'archived', 'all'].includes(filter) ? filter : 'active';
      document.querySelectorAll('[data-task-filter]').forEach((button) => button.classList.toggle('active', button.dataset.taskFilter === this.taskFilter));
      this.renderCourses();
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    setProjectFilter(filter) {
      this.projectFilter = ['active', 'archived', 'all'].includes(filter) ? filter : 'active';
      document.querySelectorAll('[data-project-filter]').forEach((button) => button.classList.toggle('active', button.dataset.projectFilter === this.projectFilter));
      const projects = this.projects();
      const selected = this.findProject(this.selectedProjectId);
      if (selected && this.projectFilter !== 'all' && Boolean(selected.item.archived) !== (this.projectFilter === 'archived')) this.selectedProjectId = null;
      if (!this.selectedProjectId) {
        const next = projects.find((project) => this.projectFilter === 'all' || (this.projectFilter === 'archived' ? Boolean(project.archived) : !project.archived));
        this.selectedProjectId = next ? idOf(next, '') : null;
      }
      this.render();
    }

    toggleCourseArchive(courseId) {
      const project = this.findProject(this.selectedProjectId);
      const found = project && this.findCourse(project.item, courseId);
      if (!project || !found) return false;
      const archived = !Boolean(found.item.archived);
      const result = this.invoke(archived ? ['archiveTask', 'setTaskArchived'] : ['unarchiveTask', 'setTaskArchived'], archived ? [this.selectedProjectId, courseId] : [this.selectedProjectId, courseId, false], () => {
        found.item.archived = archived;
        found.item.archivedAt = archived ? new Date().toISOString() : null;
        return found.item;
      });
      if (result && result !== true && typeof result === 'object') Object.assign(found.item, result);
      this.persistAndRender(archived ? '任务已归档' : '任务已恢复');
      return true;
    }

    toggleProjectArchive(projectId) {
      const found = this.findProject(projectId);
      if (!found) return false;
      const archived = !Boolean(found.item.archived);
      const result = this.invoke(archived ? ['archiveProject', 'setProjectArchived'] : ['unarchiveProject', 'setProjectArchived'], archived ? [projectId] : [projectId, false], () => {
        found.item.archived = archived;
        found.item.archivedAt = archived ? new Date().toISOString() : null;
        return found.item;
      });
      if (result && typeof result === 'object') Object.assign(found.item, result);
      this.projectFilter = archived ? 'archived' : 'active';
      document.querySelectorAll('[data-project-filter]').forEach((button) => button.classList.toggle('active', button.dataset.projectFilter === this.projectFilter));
      this.persistAndRender(archived ? '项目已归档' : '项目已恢复');
      return true;
    }

    selectProject(id) {
      const found = this.findProject(id);
      if (!found) return;
      this.selectedProjectId = idOf(found.item, `project-${found.index}`);
      this.render();
      this.renderFocusOptions();
    }

    setTaskTab(tab) {
      document.querySelectorAll('[data-task-tab]').forEach((button) => button.classList.toggle('active', button.dataset.taskTab === tab));
      const courses = byId('courses-panel');
      const knowledge = byId('knowledge-panel');
      if (courses) courses.classList.toggle('hidden', tab !== 'courses');
      if (knowledge) knowledge.classList.toggle('hidden', tab !== 'knowledge');
    }

    openDialog(id) {
      const dialog = byId(id);
      if (!dialog) return false;
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      }
      else dialog.setAttribute('open', '');
      return true;
    }

    closeDialog(id) {
      const dialog = byId(id);
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    openProjectDialog(id) {
      const found = id == null ? null : this.findProject(id);
      this.editingProjectId = found ? idOf(found.item, `project-${found.index}`) : null;
      const title = byId('project-form-title');
      const input = byId('project-name');
      const description = byId('project-description');
      if (title) title.textContent = found ? '编辑项目' : '新建项目';
      if (input) {
         input.value = found ? trim(found.item.name) : '';
        window.setTimeout(() => input.focus(), 20);
      }
      if (description) description.value = found ? trim(found.item.description) : '';
      this.populatePresetSelect('project-preferred-preset', 'project-preset-preview', found ? found.item.preferredFocusPresetId : '');
      this.openDialog('project-dialog');
    }

    saveProjectForm() {
      const input = byId('project-name');
      const descriptionInput = byId('project-description');
      const preferredPresetInput = byId('project-preferred-preset');
      const name = trim(input && input.value);
      const description = trim(descriptionInput && descriptionInput.value);
      const preferredFocusPresetId = this.presetById(preferredPresetInput && preferredPresetInput.value) ? trim(preferredPresetInput.value) : null;
      if (!name) {
        notify('请输入项目名称', 'warning');
        if (input) input.focus();
        return false;
      }
      const editing = this.editingProjectId != null;
      const found = editing ? this.findProject(this.editingProjectId) : null;
      if (editing && !found) return false;
      const duplicate = this.projects().some((project, index) => trim(project.name) === name && (!found || index !== found.index));
      if (duplicate) {
        notify('项目名称已存在', 'warning');
        return false;
      }
       const project = { name, description, preferredFocusPresetId };
      if (editing) {
        this.invoke(['updateProject'], [this.editingProjectId, project], () => {
          Object.assign(found.item, project);
          return true;
        });
        this.selectedProjectId = idOf(found.item, this.editingProjectId);
        this.persistAndRender('项目已更新');
      } else {
        const created = this.invoke(['addProject', 'createProject'], [project], () => {
          const list = this.projects();
          const item = { id: uid('project'), name, description, preferredFocusPresetId, addedDate: new Date().toISOString(), courses: [], knowledge: [], focusLogs: [] };
          list.push(item);
          return item;
        });
        const createdItem = created && created.item ? created.item : (created && typeof created === 'object' ? created : null);
        const list = this.projects();
        const candidate = createdItem || list[list.length - 1];
        this.selectedProjectId = candidate ? idOf(candidate, `project-${list.length - 1}`) : null;
        this.persistAndRender('项目已创建');
      }
      this.closeDialog('project-dialog');
      return true;
    }

    openCourseDialog(id) {
      const project = this.findProject(this.selectedProjectId);
      if (!project) {
        notify('请先选择一个项目', 'warning');
        return;
      }
      const found = id == null ? null : this.findCourse(project.item, id);
      this.editingCourseId = found ? idOf(found.item, `course-${found.index}`) : null;
      const title = byId('course-form-title');
      if (title) title.textContent = found ? '编辑任务' : '添加任务';
      this.setCourseMode('manual');
        const name = byId('course-name');
        const url = byId('course-url');
        const description = byId('course-description');
       if (name) name.value = found ? trim(found.item.name || found.item.title) : '';
       const estimateHours = byId('course-estimate-hours');
       const estimateMinutes = byId('course-estimate-minutes');
       const totalMinutes = found
         ? Math.max(1, Number(found.item.estimatedMinutes) || (Number(found.item.estimatedPomodoros) || (found.item.videos && found.item.videos.length) || 1) * this.focusMinutes())
         : this.focusMinutes();
       if (estimateHours) estimateHours.value = String(Math.floor(totalMinutes / 60));
       if (estimateMinutes) estimateMinutes.value = String(Math.round(totalMinutes % 60));
        if (url) url.value = found ? trim(found.item.url) : '';
        if (description) description.value = found ? trim(found.item.description) : '';
      const sourceUrl = byId('course-source-url');
      const sourceContent = byId('course-source-content');
      if (sourceUrl) sourceUrl.value = found ? trim(found.item.url) : '';
      if (sourceContent) sourceContent.value = '';
       this.renderSubtaskEditor(found ? found.item.videos : []);
       this.updateEstimatePreviews();
      this.openDialog('course-dialog');
      window.setTimeout(() => { if (name) name.focus(); }, 20);
    }

    setCourseMode(mode) {
      this.courseMode = mode === 'bilibili' ? 'bilibili' : 'manual';
      document.querySelectorAll('[data-course-mode]').forEach((button) => button.classList.toggle('active', button.dataset.courseMode === this.courseMode));
      const manual = byId('course-manual-fields');
      const bilibili = byId('course-bilibili-fields');
      const nameInput = byId('course-name');
      if (nameInput) nameInput.required = this.courseMode !== 'bilibili';
      if (manual) manual.classList.toggle('hidden', this.courseMode !== 'manual');
      if (bilibili) bilibili.classList.toggle('hidden', this.courseMode !== 'bilibili');
    }

    renderSubtaskEditor(videos) {
      const container = byId('subtask-editor');
      if (!container) return;
      container.replaceChildren();
      const list = Array.isArray(videos) && videos.length ? videos : [{}];
      list.forEach((video) => this.addSubtaskRow(video));
    }

    addSubtaskRow(video) {
      const container = byId('subtask-editor');
      if (!container) return;
      const row = document.createElement('div');
      row.className = 'subtask-form-row subtask-edit-row';
      const name = document.createElement('input');
      name.type = 'text'; name.className = 'subtask-name'; name.maxLength = 160;
       name.placeholder = '子任务名称'; name.value = trim(video && (video.title || video.name));
       const description = document.createElement('input');
       description.type = 'text'; description.className = 'subtask-description'; description.maxLength = 500;
       description.placeholder = '描述（可选）'; description.value = trim(video && video.description);
       const url = document.createElement('input');
       url.type = 'url'; url.className = 'subtask-url';
       url.placeholder = '链接（可选）'; url.value = trim(video && video.url);
       const durationControl = document.createElement('div');
       durationControl.className = 'subtask-estimate-control';
       const hoursLabel = document.createElement('label');
       const hoursInput = document.createElement('input');
       hoursInput.type = 'number'; hoursInput.className = 'subtask-estimate-hours'; hoursInput.min = '0'; hoursInput.max = '999'; hoursInput.step = '1'; hoursInput.inputMode = 'numeric';
       const totalMinutes = Math.max(1, Number(video && video.estimatedMinutes) || this.focusMinutes());
       hoursInput.value = String(Math.floor(totalMinutes / 60));
       const hoursUnit = document.createElement('span'); hoursUnit.textContent = '时';
       hoursLabel.append(hoursInput, hoursUnit);
       const minutesLabel = document.createElement('label');
       const minutesInput = document.createElement('input');
       minutesInput.type = 'number'; minutesInput.className = 'subtask-estimate-minutes'; minutesInput.min = '0'; minutesInput.max = '59'; minutesInput.step = '1'; minutesInput.inputMode = 'numeric'; minutesInput.value = String(Math.round(totalMinutes % 60));
       const minutesUnit = document.createElement('span'); minutesUnit.textContent = '分';
       minutesLabel.append(minutesInput, minutesUnit);
       durationControl.append(hoursLabel, minutesLabel);
       const preview = document.createElement('small'); preview.className = 'subtask-estimate-preview';
       durationControl.appendChild(preview);
       row.append(name, description, durationControl, url);
      const remove = actionButton('移除子任务', 'remove-subtask', 'x', 'icon-button danger');
      row.appendChild(remove);
      if (video && video.id) row.dataset.videoId = String(video.id);
      container.appendChild(row);
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      return row;
    }

    removeSubtaskRow(button) {
      const container = byId('subtask-editor');
      const row = button && button.closest('.subtask-edit-row');
      if (!container || !row) return;
      if (container.children.length <= 1) {
        row.querySelectorAll('input').forEach((input) => { input.value = ''; });
      } else row.remove();
    }

    collectSubtasks() {
      const container = byId('subtask-editor');
      if (!container) return [];
      const videos = [];
      container.querySelectorAll('.subtask-edit-row').forEach((row, index) => {
        const inputs = row.querySelectorAll('input');
         const title = trim(inputs[0] && inputs[0].value);
        if (!title) return;
          const description = trim(row.querySelector('.subtask-description')?.value);
          const urlValue = trim(row.querySelector('.subtask-url')?.value);
         const validUrl = urlValue ? safeUrl(urlValue) : '';
         if (urlValue && !validUrl) throw new Error(`子任务 ${index + 1} 的链接格式不正确`);
         const estimatedMinutes = this.readDuration(row.querySelector('.subtask-estimate-hours'), row.querySelector('.subtask-estimate-minutes'), `子任务 ${index + 1} 预计用时`);
         videos.push({
          id: row.dataset.videoId || uid('video'),
           title,
           name: title,
           description,
           duration: `${Math.floor(estimatedMinutes / 60)}:${String(estimatedMinutes % 60).padStart(2, '0')}`,
           url: validUrl,
           estimatedMinutes,
           estimatedPomodoros: this.estimatedPomodoros(estimatedMinutes),
           completedPomodoros: 0,
           manualCompletedPomodoros: 0,
           pomodoroRecordIds: [],
           manualCompleted: false,
           completed: false,
          index: index + 1
        });
      });
      return videos;
    }

    openSubtaskDialog(courseId, videoId) {
      const project = this.findProject(this.selectedProjectId);
      const course = project && this.findCourse(project.item, courseId);
      const found = course && this.findVideo(course.item, videoId);
      if (!project || !course || !found) return false;
      this.editingSubtaskCourseId = idOf(course.item, courseId);
      this.editingSubtaskId = idOf(found.item, videoId);
      const title = byId('subtask-form-title');
      const name = byId('subtask-name');
      const description = byId('subtask-description');
      const url = byId('subtask-url');
      const hours = byId('subtask-estimate-hours');
      const minutes = byId('subtask-estimate-minutes');
      const total = Math.max(1, Number(found.item.estimatedMinutes) || this.focusMinutes());
      if (title) title.textContent = `编辑子任务 · ${trim(found.item.title || found.item.name) || '未命名'}`;
      if (name) name.value = trim(found.item.title || found.item.name);
      if (description) description.value = trim(found.item.description);
      if (url) url.value = trim(found.item.url);
      if (hours) hours.value = String(Math.floor(total / 60));
      if (minutes) minutes.value = String(Math.round(total % 60));
      this.updateEstimatePreviews();
      this.openDialog('subtask-dialog');
      window.setTimeout(() => { if (name) name.focus(); }, 20);
      return true;
    }

    saveSubtaskForm() {
      const project = this.findProject(this.selectedProjectId);
      const course = project && this.findCourse(project.item, this.editingSubtaskCourseId);
      const found = course && this.findVideo(course.item, this.editingSubtaskId);
      if (!project || !course || !found) return false;
      const nameInput = byId('subtask-name');
      const name = trim(nameInput?.value);
      if (!name) { notify('请输入子任务名称', 'warning'); nameInput?.focus(); return false; }
      const rawUrl = trim(byId('subtask-url')?.value);
      const url = rawUrl ? safeUrl(rawUrl) : '';
      if (rawUrl && !url) { notify('子任务链接格式不正确', 'warning'); return false; }
      let estimatedMinutes;
      try { estimatedMinutes = this.readDuration(byId('subtask-estimate-hours'), byId('subtask-estimate-minutes'), '子任务预计用时'); }
      catch (error) { notify(error.message || '预计用时不正确', 'warning'); return false; }
      const patch = {
        title: name, name, description: trim(byId('subtask-description')?.value), url,
        estimatedMinutes, estimatedPomodoros: this.estimatedPomodoros(estimatedMinutes),
        duration: `${Math.floor(estimatedMinutes / 60)}:${String(estimatedMinutes % 60).padStart(2, '0')}`
      };
      const result = this.invoke(['updateVideo', 'updateSubtask'], [this.selectedProjectId, this.editingSubtaskCourseId, this.editingSubtaskId, patch], () => {
        Object.assign(found.item, patch); return found.item;
      });
      if (result && typeof result === 'object') Object.assign(found.item, result);
      this.persistAndRender('子任务已更新');
      this.closeDialog('subtask-dialog');
      return true;
    }

    saveCourseForm() {
      const project = this.findProject(this.selectedProjectId);
      if (!project) return false;
      const editing = this.editingCourseId != null;
      const found = editing ? this.findCourse(project.item, this.editingCourseId) : null;
      if (editing && !found) return false;
      let course;
      try {
        if (this.courseMode === 'bilibili') {
          const source = trim(byId('course-source-content') && byId('course-source-content').value);
          if (!source) {
            notify('请粘贴 B 站选集内容', 'warning');
            return false;
          }
          const sourceUrlRaw = trim(byId('course-source-url') && byId('course-source-url').value);
          const sourceUrl = sourceUrlRaw ? safeUrl(sourceUrlRaw) : '';
          if (sourceUrlRaw && !sourceUrl) {
            notify('课程链接格式不正确', 'warning');
            return false;
          }
          const videos = this.extractVideos(source, sourceUrl).map((video) => {
            const roundedMinutes = Math.max(1, Math.ceil(this.parseDurationSeconds(video.duration) / 60));
            return { ...video, estimatedMinutes: roundedMinutes, estimatedPomodoros: this.estimatedPomodoros(roundedMinutes), completedPomodoros: 0, manualCompletedPomodoros: 0, pomodoroRecordIds: [] };
          });
          if (!videos.length) {
            notify('没有识别出带时长的选集，请检查粘贴内容', 'warning');
            return false;
          }
          const firstLine = source.split(/\r?\n/).map(trim).find(Boolean) || 'B 站课程';
          const estimatedSeconds = videos.reduce((sum, video) => sum + this.parseDurationSeconds(video.duration), 0);
          const estimatedMinutes = Math.max(1, Math.ceil(estimatedSeconds / 60));
          course = { name: firstLine.replace(/^\d+[.、)\s]+/, '').replace(/\s+((?:\d{1,2}:)?\d{1,3}:[0-5]\d)\s*$/, '').trim() || 'B 站课程', description: trim(byId('course-description')?.value), url: sourceUrl, videos, estimatedMinutes, estimatedPomodoros: this.estimatedPomodoros(estimatedMinutes) };
        } else {
          const nameInput = byId('course-name');
          const urlInput = byId('course-url');
          const name = trim(nameInput && nameInput.value);
          const rawUrl = trim(urlInput && urlInput.value);
          if (!name) {
            notify('请输入任务名称', 'warning');
            if (nameInput) nameInput.focus();
            return false;
          }
          const url = rawUrl ? safeUrl(rawUrl) : '';
          if (rawUrl && !url) {
            notify('任务主页链接格式不正确', 'warning');
            return false;
          }
          const videos = this.collectSubtasks();
          const estimatedMinutes = this.readDuration(byId('course-estimate-hours'), byId('course-estimate-minutes'), '任务预计用时');
           course = { name, url, description: trim(byId('course-description')?.value), videos, estimatedMinutes, estimatedPomodoros: this.estimatedPomodoros(estimatedMinutes) };
        }
        if (!course.estimatedMinutes) course.estimatedMinutes = Math.max(1, course.videos.length || 1) * this.focusMinutes();
        course.estimatedPomodoros = this.estimatedPomodoros(course.estimatedMinutes);
      } catch (error) {
        notify(error.message || '任务内容不完整', 'warning');
        return false;
      }
      if (editing) {
        course.id = idOf(found.item, this.editingCourseId);
        course.addedDate = found.item.addedDate || new Date().toISOString();
        course.estimatedMinutes = Math.max(1, Math.floor(Number(course.estimatedMinutes) || Number(found.item.estimatedMinutes) || (Number(found.item.estimatedPomodoros) || found.item.videos.length || 1) * this.focusMinutes()));
        course.estimatedPomodoros = this.estimatedPomodoros(course.estimatedMinutes);
        course.completedPomodoros = Math.max(0, Math.floor(Number(found.item.completedPomodoros) || 0));
        course.manualCompletedPomodoros = Math.max(0, Math.floor(Number(found.item.manualCompletedPomodoros) || 0));
        course.pomodoroRecordIds = Array.isArray(found.item.pomodoroRecordIds) ? found.item.pomodoroRecordIds.slice() : [];
        course.archived = Boolean(found.item.archived);
        course.archivedAt = found.item.archivedAt || null;
        course.videos = course.videos.map((video, index) => {
          const old = (found.item.videos || []).find((item) => String(idOf(item, '')) === String(video.id)) || found.item.videos && found.item.videos[index];
          return { ...video, completed: old ? Boolean(old.completed) : false, manualCompleted: old ? Boolean(old.manualCompleted) : false, completedPomodoros: old ? Number(old.completedPomodoros) || 0 : 0, manualCompletedPomodoros: old ? Number(old.manualCompletedPomodoros) || 0 : 0, pomodoroRecordIds: old && Array.isArray(old.pomodoroRecordIds) ? old.pomodoroRecordIds.slice() : [], estimatedMinutes: video.estimatedMinutes || (old && Number(old.estimatedMinutes)) || this.focusMinutes(), estimatedPomodoros: Number(video.estimatedPomodoros) || (old && Number(old.estimatedPomodoros)) || this.estimatedPomodoros(video.estimatedMinutes || (old && Number(old.estimatedMinutes)) || this.focusMinutes()), id: video.id || idOf(old, uid('video')) };
        });
        this.invoke(['updateCourse', 'updateTask'], [this.selectedProjectId, this.editingCourseId, course], () => {
          Object.assign(found.item, course);
          return true;
        });
        this.persistAndRender('任务已更新');
      } else {
        course.id = uid('course');
        course.addedDate = new Date().toISOString();
        this.invoke(['addCourse', 'addTask'], [this.selectedProjectId, course], () => {
          project.item.courses.push(course);
          return course;
        });
        this.persistAndRender('任务已添加');
      }
      this.closeDialog('course-dialog');
      return true;
    }

    toggleVideo(courseId, videoId, completed) {
      const project = this.findProject(this.selectedProjectId);
      const course = project && this.findCourse(project.item, courseId);
      if (!project || !course) return;
      const video = this.findVideo(course.item, videoId);
      if (!video) return;
      const automaticPomodoros = Array.isArray(video.item.pomodoroRecordIds) ? video.item.pomodoroRecordIds.length : 0;
      const estimate = Math.max(1, Number(video.item.estimatedPomodoros) || 1);
      const manualCompletedPomodoros = completed ? Math.max(0, estimate - automaticPomodoros) : 0;
      const completedPomodoros = automaticPomodoros + manualCompletedPomodoros;
      const patch = { completed: Boolean(completed), manualCompleted: Boolean(completed), manualCompletedPomodoros, completedPomodoros };
      Object.assign(video.item, patch);
      this.invoke(['updateVideo', 'updateSubtask'], [this.selectedProjectId, courseId, videoId, patch], () => true);
      this.persistAndRender();
    }

    findVideo(course, id) {
      const videos = Array.isArray(course && course.videos) ? course.videos : [];
      const index = Number.isInteger(id) || /^\d+$/.test(String(id)) ? Number(id) : -1;
      if (index >= 0 && index < videos.length) return { item: videos[index], index };
      const found = videos.findIndex((video, indexValue) => String(idOf(video, `video-${indexValue}`)) === String(id));
      return found >= 0 ? { item: videos[found], index: found } : null;
    }

    generateVideoUrl(baseUrl, index) {
      const source = safeUrl(baseUrl);
      if (!source) return '';
      try {
        const url = new URL(source);
        if (!/bilibili\.com$/i.test(url.hostname) && !/\.bilibili\.com$/i.test(url.hostname)) return source;
        url.searchParams.set('p', String(index || 1));
        return url.href;
      } catch (_) { return ''; }
    }

    parseDurationSeconds(value) {
      const parts = String(value || '').trim().split(':').map((part) => Number(part));
      if (parts.some((part) => !Number.isFinite(part) || part < 0) || (parts.length !== 2 && parts.length !== 3)) return 0;
      return Math.max(0, parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]);
    }

    parseDurationMinutes(value) {
      return Math.ceil(this.parseDurationSeconds(value) / 60);
    }

    extractVideos(content, sourceUrl) {
      const videos = [];
      let index = 1;
      String(content || '').split(/\r?\n/).forEach((line) => {
        const raw = trim(line);
        if (!raw) return;
        const durationMatch = raw.match(/(?:^|\s)((?:\d{1,2}:)?\d{1,3}:[0-5]\d)(?=\s|$)/);
        if (!durationMatch) return;
        let title = raw.replace(/^\s*(?:\d+[.、)）]\s*)?/, '');
        title = title.replace(/\s*((?:\d{1,2}:)?\d{1,3}:[0-5]\d)\s*$/, '').trim();
        title = title.replace(/^[-|｜:：]+\s*/, '').trim();
        if (!title) title = `第 ${index} 节`;
        videos.push({
          id: uid('video'), title, name: title, duration: durationMatch[1],
          completed: false, index, url: this.generateVideoUrl(sourceUrl, index)
        });
        index += 1;
      });
      return videos;
    }

    confirm(message, callback) {
      const dialog = byId('confirm-dialog');
      if (dialog && typeof dialog.showModal === 'function') {
        const title = byId('confirm-title');
        const body = byId('confirm-message');
        const ok = byId('confirm-ok');
        const cancel = byId('confirm-cancel');
        if (title) title.textContent = '确认操作';
        if (body) body.textContent = message;
        const cleanup = () => {
          ok && ok.removeEventListener('click', accept);
          cancel && cancel.removeEventListener('click', reject);
          dialog.removeEventListener('cancel', reject);
        };
        const accept = (event) => { event.preventDefault(); cleanup(); dialog.close(); callback(true); };
        const reject = (event) => { event.preventDefault(); cleanup(); dialog.close(); callback(false); };
        ok && ok.addEventListener('click', accept);
        cancel && cancel.addEventListener('click', reject);
        dialog.addEventListener('cancel', reject);
        if (!dialog.open) dialog.showModal();
        return;
      }
      const result = window.uiManager && typeof window.uiManager.confirm === 'function'
        ? window.uiManager.confirm(message)
        : Promise.resolve(window.confirm(message));
      Promise.resolve(result).then(callback);
    }

    confirmDeleteProject(id) {
      const found = this.findProject(id);
      if (!found) return;
      this.confirm(`删除“${trim(found.item.name) || '未命名项目'}”及其任务？`, (yes) => {
        if (!yes) return;
        this.invoke(['deleteProject', 'removeProject'], [id], () => { this.projects().splice(found.index, 1); return true; });
        this.selectedProjectId = null;
        this.persistAndRender('项目已删除');
      });
    }

    confirmDeleteCourse(id) {
      const project = this.findProject(this.selectedProjectId);
      const found = project && this.findCourse(project.item, id);
      if (!project || !found) return;
      this.confirm(`删除任务“${trim(found.item.name || found.item.title) || '未命名任务'}”？`, (yes) => {
        if (!yes) return;
        this.invoke(['deleteCourse', 'deleteTask', 'removeCourse'], [this.selectedProjectId, id], () => { project.item.courses.splice(found.index, 1); return true; });
        this.persistAndRender('任务已删除');
      });
    }

    confirmDeleteKnowledge(id) {
      const project = this.findProject(this.selectedProjectId);
      const found = project && this.findKnowledge(project.item, id);
      if (!project || !found) return;
      this.confirm(`删除链接“${trim(found.item.name) || '未命名链接'}”？`, (yes) => {
        if (!yes) return;
        this.invoke(['deleteKnowledge', 'deleteNote', 'removeKnowledge'], [this.selectedProjectId, id], () => { project.item.knowledge.splice(found.index, 1); return true; });
        this.persistAndRender('链接已删除');
      });
    }

    openKnowledgeDialog(id) {
      const project = this.findProject(this.selectedProjectId);
      if (!project) {
        notify('请先选择一个项目', 'warning');
        return;
      }
      const found = id == null ? null : this.findKnowledge(project.item, id);
      this.editingKnowledgeId = found ? idOf(found.item, `knowledge-${found.index}`) : null;
      const title = byId('knowledge-form-title');
      const name = byId('knowledge-name');
      const url = byId('knowledge-url');
      if (title) title.textContent = found ? '编辑链接' : '添加链接';
      if (name) name.value = found ? trim(found.item.name) : '';
      if (url) url.value = found ? trim(found.item.url) : '';
      this.openDialog('knowledge-dialog');
      window.setTimeout(() => { if (name) name.focus(); }, 20);
    }

    saveKnowledgeForm() {
      const project = this.findProject(this.selectedProjectId);
      if (!project) return false;
      const nameInput = byId('knowledge-name');
      const urlInput = byId('knowledge-url');
      const name = trim(nameInput && nameInput.value);
      const rawUrl = trim(urlInput && urlInput.value);
      const url = safeUrl(rawUrl);
      if (!name) { notify('请输入链接名称', 'warning'); return false; }
      if (!url) { notify('请输入有效的网址', 'warning'); return false; }
      const editing = this.editingKnowledgeId != null;
      const found = editing ? this.findKnowledge(project.item, this.editingKnowledgeId) : null;
      if (editing && !found) return false;
      const note = { name, url };
      if (editing) {
        note.id = idOf(found.item, this.editingKnowledgeId);
        this.invoke(['updateKnowledge', 'updateNote'], [this.selectedProjectId, this.editingKnowledgeId, note], () => { Object.assign(found.item, note); return true; });
        this.persistAndRender('链接已更新');
      } else {
        note.id = uid('knowledge'); note.addedDate = new Date().toISOString();
        this.invoke(['addKnowledge', 'addNote'], [this.selectedProjectId, note], () => { project.item.knowledge.push(note); return note; });
        this.persistAndRender('链接已添加');
      }
      this.closeDialog('knowledge-dialog');
      return true;
    }

    // Small programmatic API used by integrations and the timer assignment
    // panel.  UI actions above add validation/confirmation; these methods
    // expose the same storage-backed operations for callers that already have
    // validated data.
    addProject(data) {
      const result = this.invoke(['addProject', 'createProject'], [data], () => {
        const list = this.projects();
        const item = Object.assign({ id: uid('project'), courses: [], knowledge: [], focusLogs: [], addedDate: new Date().toISOString() }, data || {});
        list.push(item);
        return item;
      });
      this.persistAndRender();
      return result;
    }

    updateProject(ref, patch) {
      const result = this.invoke(['updateProject'], [ref, patch], () => {
        const found = this.findProject(ref);
        if (!found) return null;
        Object.assign(found.item, patch || {});
        return found.item;
      });
      this.persistAndRender();
      return result;
    }

    deleteProject(ref) {
      const found = this.findProject(ref);
      if (!found) return false;
      const result = this.invoke(['deleteProject', 'removeProject'], [ref], () => { this.projects().splice(found.index, 1); return true; });
      this.persistAndRender();
      return result;
    }

    addCourse(projectRef, data) {
      const result = this.invoke(['addCourse', 'addTask'], [projectRef, data], () => {
        const project = this.findProject(projectRef);
        if (!project) return null;
        const item = Object.assign({ id: uid('course'), videos: [], addedDate: new Date().toISOString() }, data || {});
        project.item.courses.push(item);
        return item;
      });
      this.persistAndRender();
      return result;
    }

    updateCourse(projectRef, courseRef, patch) {
      const result = this.invoke(['updateCourse', 'updateTask'], [projectRef, courseRef, patch], () => {
        const project = this.findProject(projectRef); const found = project && this.findCourse(project.item, courseRef);
        if (!found) return null;
        Object.assign(found.item, patch || {});
        return found.item;
      });
      this.persistAndRender();
      return result;
    }

    deleteCourse(projectRef, courseRef) {
      const project = this.findProject(projectRef); const found = project && this.findCourse(project.item, courseRef);
      if (!found) return false;
      const result = this.invoke(['deleteCourse', 'deleteTask', 'removeCourse'], [projectRef, courseRef], () => { project.item.courses.splice(found.index, 1); return true; });
      this.persistAndRender();
      return result;
    }

    updateVideo(projectRef, courseRef, videoRef, patch) {
      const result = this.invoke(['updateVideo', 'updateSubtask'], [projectRef, courseRef, videoRef, patch], () => {
        const project = this.findProject(projectRef); const course = project && this.findCourse(project.item, courseRef); const found = course && this.findVideo(course.item, videoRef);
        if (!found) return null;
        Object.assign(found.item, patch || {});
        return found.item;
      });
      this.persistAndRender();
      return result;
    }

    addKnowledge(projectRef, data) {
      const project = this.findProject(projectRef);
      if (!project) return null;
      const item = Object.assign({ id: uid('knowledge'), addedDate: new Date().toISOString() }, data || {});
      project.item.knowledge.push(item);
      this.persistAndRender();
      return item;
    }

    updateKnowledge(projectRef, noteRef, patch) {
      const project = this.findProject(projectRef); const found = project && this.findKnowledge(project.item, noteRef);
      if (!found) return null;
      Object.assign(found.item, patch || {});
      this.persistAndRender();
      return found.item;
    }

    deleteKnowledge(projectRef, noteRef) {
      const project = this.findProject(projectRef); const found = project && this.findKnowledge(project.item, noteRef);
      if (!found) return false;
      project.item.knowledge.splice(found.index, 1);
      this.persistAndRender();
      return true;
    }

    renderTasks() { this.renderCourses(); }
    renderVideos() { this.renderCourses(); }

    renderFocusOptions(projectValue) {
      const projectSelect = byId('focus-project');
      const courseSelect = byId('focus-course');
      const videoSelect = byId('focus-video');
      if (!projectSelect) return;
      const projects = this.projects();
      const selectedValue = projectValue !== undefined ? projectValue : projectSelect.value;
      projectSelect.replaceChildren();
      const noneProject = document.createElement('option'); noneProject.value = ''; noneProject.textContent = '不归属项目'; projectSelect.appendChild(noneProject);
      projects.forEach((project, index) => {
        if (project.archived) return;
        const option = document.createElement('option'); option.value = String(idOf(project, `project-${index}`)); option.textContent = trim(project.name) || '未命名项目'; projectSelect.appendChild(option);
      });
      projectSelect.value = [...projectSelect.options].some((option) => option.value === String(selectedValue)) ? String(selectedValue) : '';
      const project = this.findProject(projectSelect.value);
      if (courseSelect) {
        const old = courseSelect.value;
        courseSelect.replaceChildren();
        const none = document.createElement('option'); none.value = ''; none.textContent = '不归属任务'; courseSelect.appendChild(none);
        (project ? project.item.courses : []).forEach((course, index) => {
          if (course.archived) return;
          const option = document.createElement('option'); option.value = String(idOf(course, `course-${index}`)); option.textContent = trim(course.name || course.title) || '未命名任务'; courseSelect.appendChild(option);
        });
        courseSelect.disabled = !project;
        if ([...courseSelect.options].some((option) => option.value === old)) courseSelect.value = old;
      }
      if (videoSelect) {
        const course = project && this.findCourse(project.item, courseSelect && courseSelect.value);
        const old = videoSelect.value;
        videoSelect.replaceChildren();
        const none = document.createElement('option'); none.value = ''; none.textContent = '不归属子任务'; videoSelect.appendChild(none);
        (course ? course.item.videos : []).forEach((video, index) => {
          const option = document.createElement('option'); option.value = String(idOf(video, `video-${index}`)); option.textContent = trim(video.title || video.name) || `子任务 ${index + 1}`; videoSelect.appendChild(option);
        });
        videoSelect.disabled = !course;
        if ([...videoSelect.options].some((option) => option.value === old)) videoSelect.value = old;
      }
    }
  }

  const tasks = new TasksFeature();
  StudyFlow.tasks = tasks;
  window.tasksManager = tasks;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => tasks.init(), { once: true });
  else tasks.init();
})(window, document);
