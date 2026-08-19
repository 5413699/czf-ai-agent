(function (global) {
  'use strict';

  var root = global.StudyFlow = global.StudyFlow || {};
  var u = root.utils || global.StudyFlowUtils || {};
  var PROJECT_KEY = 'modern-project-manager';
  var META_KEY = 'studyflow-meta-v2';
  var SETTINGS_KEY = 'studyflow-settings-v2';
  var SCHEMA_VERSION = 4;
  var MAX_BACKUP_FILE_BYTES = 205 * 1024 * 1024;
  // These are the application-owned keys.  Clearing data must never call
  // localStorage.clear(), because the browser may contain unrelated apps.
  var APP_STORAGE_KEYS = [
    PROJECT_KEY,
    META_KEY,
    SETTINGS_KEY,
    'studyflow.focus.timer',
    'studyflow.focus.sessions',
    'studyflow.focus.audio',
    'focus-timer-state',
    'selected-theme'
  ];
  var DEFAULT_SETTINGS = {
    theme: 'day',
    streamBackground: 'solid',
    streamTheme: 'night',
    streamClockStyle: 'orbit',
    volume: 0.55,
    workTime: 25,
    workUnit: 'minutes',
    breakTime: 5,
    breakUnit: 'minutes',
    longBreakTime: 15,
    longBreakUnit: 'minutes',
    longBreakInterval: 4,
    autoStartFocus: true,
    autoStartBreak: true,
    activeFocusPresetId: 'classic',
    customFocusPresets: [],
    focusPresetOverrides: {},
    soundscapePaused: false,
    soundscape: {
      ambient: { 'spring-rain': 0.10 },
      musicId: 'chill',
      musicVolume: 0.15,
      masterVolume: 0.5
    },
    promptAudio: {
      volume: 0.55,
      startCueId: 'builtin-cue:start',
      completeCueId: 'builtin-cue:complete'
    }
  };

  function clone(value) {
    return typeof u.clone === 'function' ? u.clone(value) : JSON.parse(JSON.stringify(value));
  }
  function now() { return typeof u.nowIso === 'function' ? u.nowIso() : new Date().toISOString(); }
  function id(value, prefix, used) {
    if (typeof u.ensureId === 'function') return u.ensureId(value, prefix, used);
    var candidate = value || ((prefix || 'item') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2));
    if (used) { while (used[candidate]) candidate += '_1'; used[candidate] = true; }
    return String(candidate);
  }
  function text(value, fallback) {
    if (typeof u.nonEmptyString === 'function') return u.nonEmptyString(value, fallback);
    var result = value === undefined || value === null ? '' : String(value).trim();
    return result || (fallback || '');
  }
  function date(value, fallback) {
    return typeof u.isoDate === 'function' ? u.isoDate(value, fallback) : (value || fallback || now());
  }
  function number(value, fallback) {
    if (typeof u.toFiniteNumber === 'function') return u.toFiniteNumber(value, fallback);
    var result = Number(value);
    return Number.isFinite(result) ? result : (fallback || 0);
  }
  function array(value) { return Array.isArray(value) ? value : []; }
  function safeUrl(value) {
    if (typeof u.safeUrl === 'function') return u.safeUrl(value);
    var result = text(value);
    return /^(javascript|vbscript|data):/i.test(result) ? '' : result;
  }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function boolean(value, fallback) {
    return typeof u.toBoolean === 'function' ? u.toBoolean(value, fallback) : (value === undefined ? fallback : value !== false);
  }
  function normalizePresetIcon(value) {
    if (typeof u.normalizeFocusPresetIcon === 'function') return u.normalizeFocusPresetIcon(value);
    var allowed = ['target', 'book-open', 'brain', 'code-2', 'pen-line', 'graduation-cap', 'briefcase-business', 'calculator', 'flask-conical', 'notebook-tabs'];
    var icon = String(value === undefined || value === null ? '' : value).trim();
    return allowed.indexOf(icon) >= 0 ? icon : 'target';
  }
  function unitVolume(value, fallback) { return Math.min(1, Math.max(0, number(value, fallback))); }
  function validAmbientId(value) {
    var soundId = String(value || '');
    return /^[a-z0-9][a-z0-9-]{0,48}$/i.test(soundId)
      || /^user-ambient:[a-z0-9][a-z0-9-]{0,79}$/i.test(soundId);
  }
  function normalizeSoundscape(value) {
    var hasValue = object(value);
    var source = hasValue ? value : DEFAULT_SETTINGS.soundscape;
    var ambientSource = object(source.ambient) ? source.ambient : {};
    var ambient = {};
    Object.keys(ambientSource).slice(0, 24).forEach(function (soundId) {
      if (!validAmbientId(soundId)) return;
      var volume = unitVolume(ambientSource[soundId], 0);
      if (volume > 0) ambient[soundId] = volume;
    });
    var musicId;
    if (Object.prototype.hasOwnProperty.call(source, 'musicId')) musicId = source.musicId == null || source.musicId === '' ? null : text(source.musicId);
    else musicId = DEFAULT_SETTINGS.soundscape.musicId;
    return {
      ambient: ambient,
      musicId: musicId,
      musicVolume: unitVolume(source.musicVolume, DEFAULT_SETTINGS.soundscape.musicVolume),
      masterVolume: unitVolume(source.masterVolume, DEFAULT_SETTINGS.soundscape.masterVolume)
    };
  }
  function validCueId(value, fallback) {
    var cueId = String(value || '');
    return /^(?:builtin-cue:(?:start|complete)|user-cue:[a-z0-9-]{1,80})$/i.test(cueId) ? cueId : fallback;
  }
  function normalizePromptAudio(value) {
    var source = object(value) ? value : DEFAULT_SETTINGS.promptAudio;
    return {
      volume: unitVolume(source.volume, DEFAULT_SETTINGS.promptAudio.volume),
      startCueId: validCueId(source.startCueId, DEFAULT_SETTINGS.promptAudio.startCueId),
      completeCueId: validCueId(source.completeCueId, DEFAULT_SETTINGS.promptAudio.completeCueId)
    };
  }
  function storageAvailable() {
    try { return !!global.localStorage; } catch (ignored) { return false; }
  }
  function readJson(key, fallback) {
    if (!storageAvailable()) return fallback;
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
      // A malformed backup should not prevent the rest of the application loading.
      return fallback;
    }
  }
  function writeJson(key, value) {
    if (!storageAvailable()) return false;
    try { global.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { return false; }
  }

  function normalizeVideo(input, index, usedIds) {
    var source = object(input) ? input : {};
    var item = Object.assign({}, source);
    item.id = id(source.id, 'video', usedIds);
    item.title = text(source.title, text(source.name, '子任务 ' + (index + 1)));
    // `name` is kept as an alias because older task renderers use it.
    item.name = text(source.name, item.title);
    item.description = text(source.description);
    item.url = safeUrl(source.url || source.link || source.href);
    item.duration = text(source.duration, '00:00');
    item.estimatedMinutes = Math.max(0, Math.floor(number(source.estimatedMinutes, number(source.estimateMinutes, 0))));
    var videoEstimate = source.estimatedPomodoros;
    item.estimatedPomodoros = Math.max(1, Math.floor(number(videoEstimate, item.estimatedMinutes > 0 ? Math.ceil(item.estimatedMinutes / 25) : 1)));
    item.completedPomodoros = Math.max(0, Math.floor(number(source.completedPomodoros, 0)));
    item.manualCompletedPomodoros = Math.max(0, Math.floor(number(source.manualCompletedPomodoros, item.completedPomodoros)));
    item.pomodoroRecordIds = array(source.pomodoroRecordIds).map(function (value) { return text(value); }).filter(Boolean).slice(-2000);
    item.manualCompleted = source.manualCompleted !== undefined ? Boolean(source.manualCompleted) : Boolean(source.completed);
    item.completed = item.manualCompleted || item.completedPomodoros >= item.estimatedPomodoros;
    item.index = number(source.index, index + 1);
    item.createdAt = date(source.createdAt || source.addedDate);
    item.updatedAt = date(source.updatedAt, item.createdAt);
    return item;
  }

  function normalizeCourse(input, index, usedIds) {
    var source = object(input) ? input : {};
    var item = Object.assign({}, source);
    item.id = id(source.id, 'course', usedIds);
    item.name = text(source.name, text(source.title, '任务 ' + (index + 1)));
    item.title = text(source.title, item.name);
    item.url = safeUrl(source.url || source.link || source.href);
    item.description = text(source.description);
    item.addedDate = date(source.addedDate || source.createdAt);
    item.createdAt = date(source.createdAt, item.addedDate);
    item.updatedAt = date(source.updatedAt, item.createdAt);
    var videoIds = Object.create(null);
    item.videos = array(source.videos || source.subtasks || source.items).map(function (video, videoIndex) {
      return normalizeVideo(video, videoIndex, videoIds);
    });
    // Pomodoro progress belongs to the task itself rather than to a view.
    // Keep the fields explicit so a task can be resumed and archived without
    // reconstructing state from the currently visible subtask list.
    var estimateSource = source.estimatedPomodoros;
    if (estimateSource === undefined) estimateSource = source.pomodoroEstimate;
    if (estimateSource === undefined) estimateSource = source.pomodoroTarget;
    if (estimateSource === undefined) estimateSource = source.targetPomodoros;
    var defaultEstimate = item.videos.length || 1;
    item.estimatedMinutes = Math.max(1, Math.floor(number(source.estimatedMinutes, number(source.estimateMinutes, number(estimateSource, defaultEstimate) * 25))));
    item.estimatedPomodoros = Math.max(1, Math.floor(number(estimateSource, Math.ceil(item.estimatedMinutes / 25))));
    var completedSource = source.completedPomodoros;
    if (completedSource === undefined) completedSource = source.pomodorosCompleted;
    if (completedSource === undefined) completedSource = source.actualPomodoros;
    item.completedPomodoros = Math.max(0, Math.floor(number(completedSource, 0)));
    item.manualCompletedPomodoros = Math.max(0, Math.floor(number(source.manualCompletedPomodoros, item.completedPomodoros)));
    // Keep a bounded ledger of completion IDs for idempotent timer recovery.
    item.pomodoroRecordIds = array(source.pomodoroRecordIds || source.completedPomodoroIds)
      .map(function (value) { return text(value); }).filter(Boolean).slice(-2000);
    if (source.manualCompletedPomodoros === undefined && item.pomodoroRecordIds.length) {
      item.manualCompletedPomodoros = Math.max(0, item.completedPomodoros - item.pomodoroRecordIds.length);
    }
    item.archived = Boolean(source.archived || source.status === 'archived');
    item.archivedAt = item.archived && source.archivedAt ? date(source.archivedAt) : null;
    item.completedAt = source.completedAt ? date(source.completedAt) : null;
    return item;
  }

  function normalizeKnowledge(input, index, usedIds) {
    var source = object(input) ? input : {};
    var item = Object.assign({}, source);
    item.id = id(source.id, 'note', usedIds);
    item.name = text(source.name, text(source.title, '链接 ' + (index + 1)));
    item.title = text(source.title, item.name);
    item.url = safeUrl(source.url || source.link || source.href);
    item.createdAt = date(source.createdAt || source.addedDate);
    item.updatedAt = date(source.updatedAt, item.createdAt);
    return item;
  }

  function normalizeProject(input, index, usedIds) {
    var source = object(input) ? input : {};
    var item = Object.assign({}, source);
    item.id = id(source.id, 'project', usedIds);
    item.name = text(source.name, text(source.title, '项目 ' + (index + 1)));
    item.title = text(source.title, item.name);
    item.description = text(source.description);
    item.preferredFocusPresetId = text(source.preferredFocusPresetId) || null;
    item.url = safeUrl(source.url || source.link || source.href);
    item.addedDate = date(source.addedDate || source.createdAt);
    item.createdAt = date(source.createdAt, item.addedDate);
    item.updatedAt = date(source.updatedAt, item.createdAt);
    item.archived = Boolean(source.archived || source.status === 'archived');
    item.archivedAt = item.archived && source.archivedAt ? date(source.archivedAt) : null;
    var courseIds = Object.create(null);
    item.courses = array(source.courses || source.tasks).map(function (course, courseIndex) {
      return normalizeCourse(course, courseIndex, courseIds);
    });
    var noteIds = Object.create(null);
    item.knowledge = array(source.knowledge || source.notes).map(function (note, noteIndex) {
      return normalizeKnowledge(note, noteIndex, noteIds);
    });
    // Keep the old per-project log field intact for old integrations.
    item.focusLogs = array(source.focusLogs || source.focusRecords).map(function (record) { return clone(record); });
    return item;
  }

  function normalizeRecord(input, index) {
    var source = object(input) ? input : {};
    var item = Object.assign({}, source);
    item.id = id(source.id, 'focus', Object.create(null));
    item.startedAt = date(source.startedAt || source.timestamp || source.startTime);
    item.completedAt = source.completedAt || source.endedAt || source.endTime ? date(source.completedAt || source.endedAt || source.endTime) : null;
    item.timestamp = source.timestamp || item.startedAt;
    item.durationSeconds = source.durationSeconds !== undefined
      ? Math.max(0, number(source.durationSeconds, 0))
      : Math.max(0, number(source.duration, 0) * 60);
    item.duration = source.duration !== undefined ? number(source.duration, 0) : item.durationSeconds / 60;
    item.phase = text(source.phase, text(source.sessionType, 'work'));
    item.sessionType = text(source.sessionType, item.phase);
    item.round = Math.max(1, number(source.round, index + 1));
    item.label = text(source.label, text(source.taskName, '自由专注'));
    item.taskName = text(source.taskName, item.label);
    item.projectId = source.projectId || null;
    item.courseId = source.courseId || source.taskId || null;
    item.videoId = source.videoId || source.subtaskId || null;
    item.source = text(source.source, 'timer');
    item.createdAt = date(source.createdAt, item.startedAt);
    item.updatedAt = date(source.updatedAt, item.createdAt);
    return item;
  }

  function normalizeSettings(value) {
    var settings = Object.assign({}, DEFAULT_SETTINGS, object(value) ? value : {});
    settings.promptAudio = normalizePromptAudio(settings.promptAudio);
    settings.volume = settings.promptAudio.volume;
    ['workTime', 'breakTime', 'longBreakTime', 'longBreakInterval'].forEach(function (key) {
      settings[key] = Math.max(1, number(settings[key], DEFAULT_SETTINGS[key]));
    });
    settings.autoStartFocus = boolean(settings.autoStartFocus, true);
    settings.autoStartBreak = boolean(settings.autoStartBreak, true);
    settings.soundscapePaused = boolean(settings.soundscapePaused, false);
    settings.soundscape = normalizeSoundscape(settings.soundscape);
    settings.theme = text(settings.theme, DEFAULT_SETTINGS.theme);
    settings.streamBackground = text(settings.streamBackground, DEFAULT_SETTINGS.streamBackground);
    settings.streamTheme = ['night', 'day', 'eye'].indexOf(settings.streamTheme) >= 0 ? settings.streamTheme : DEFAULT_SETTINGS.streamTheme;
    settings.streamClockStyle = ['orbit', 'tomato-fill', 'desk-card'].indexOf(settings.streamClockStyle) >= 0 ? settings.streamClockStyle : DEFAULT_SETTINGS.streamClockStyle;
    settings.activeFocusPresetId = text(settings.activeFocusPresetId);
    settings.customFocusPresets = array(settings.customFocusPresets).filter(object).map(function (preset) {
      var normalized = Object.assign({}, preset);
      normalized.icon = normalizePresetIcon(normalized.icon);
      return normalized;
    }).slice(-8);
    settings.focusPresetOverrides = object(settings.focusPresetOverrides)
      ? Object.keys(settings.focusPresetOverrides).reduce(function (result, id) {
        if (!object(settings.focusPresetOverrides[id])) return result;
        result[id] = Object.assign({}, settings.focusPresetOverrides[id]);
        delete result[id].icon;
        return result;
      }, {})
      : {};
    return settings;
  }

  function normalizeProjects(value) {
    var used = Object.create(null);
    return array(value).map(function (project, index) { return normalizeProject(project, index, used); });
  }

  function projectIndex(projects, ref) {
    if (typeof ref === 'number' && ref >= 0 && ref < projects.length) return ref;
    var value = String(ref === undefined || ref === null ? '' : ref);
    var byId = projects.findIndex(function (project) { return project.id === value; });
    if (byId >= 0) return byId;
    return /^\d+$/.test(value) ? Number(value) : -1;
  }
  function childIndex(children, ref) {
    if (typeof ref === 'number' && ref >= 0 && ref < children.length) return ref;
    var value = String(ref === undefined || ref === null ? '' : ref);
    var byId = children.findIndex(function (child) { return child.id === value; });
    if (byId >= 0) return byId;
    return /^\d+$/.test(value) ? Number(value) : -1;
  }

  function readMeta() {
    var value = readJson(META_KEY, {});
    return object(value) ? value : {};
  }

  class StudyFlowStorage {
    constructor() {
      var rawProjects = readJson(PROJECT_KEY, []);
      // The legacy key is intentionally an array. New metadata is kept separate.
      if (object(rawProjects) && Array.isArray(rawProjects.projects)) rawProjects = rawProjects.projects;
      this.projects = normalizeProjects(rawProjects);
      var meta = readMeta();
      this.focusRecords = array(meta.focusRecords).map(normalizeRecord);
      // Migrate logs that were only stored inside the legacy projects.
      if (!this.focusRecords.length) {
        this.projects.forEach(function (project) {
          project.focusLogs.forEach(function (record) { this.focusRecords.push(normalizeRecord(record, this.focusRecords.length)); }, this);
        }, this);
      }
      this.settings = normalizeSettings(Object.assign({}, readJson(SETTINGS_KEY, {}), meta.settings || {}));
      this.persist();
    }

    persist() {
      var projectSaved = writeJson(PROJECT_KEY, this.projects);
      var metaSaved = writeJson(META_KEY, {
        schemaVersion: SCHEMA_VERSION,
        focusRecords: this.focusRecords,
        settings: this.settings,
        updatedAt: now()
      });
      var settingsSaved = writeJson(SETTINGS_KEY, this.settings);
      return projectSaved && metaSaved && settingsSaved;
    }

    persistStrict() {
      if (!storageAvailable()) throw new Error('浏览器存储不可用');
      var keys = [PROJECT_KEY, META_KEY, SETTINGS_KEY];
      var values = {};
      var previous = {};
      values[PROJECT_KEY] = JSON.stringify(this.projects);
      values[META_KEY] = JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        focusRecords: this.focusRecords,
        settings: this.settings,
        updatedAt: now()
      });
      values[SETTINGS_KEY] = JSON.stringify(this.settings);
      try {
        keys.forEach(function (key) { previous[key] = global.localStorage.getItem(key); });
      } catch (error) {
        var readFailure = new Error('无法读取浏览器中的原有数据');
        readFailure.originalError = error;
        readFailure.storageRollbackComplete = true;
        throw readFailure;
      }
      try {
        keys.forEach(function (key) { global.localStorage.setItem(key, values[key]); });
      } catch (error) {
        var rollbackError = null;
        keys.forEach(function (key) {
          try {
            if (previous[key] === null || previous[key] === undefined) global.localStorage.removeItem(key);
            else global.localStorage.setItem(key, previous[key]);
          } catch (failure) {
            rollbackError = rollbackError || failure;
          }
        });
        var failure = new Error('数据无法完整写入浏览器存储');
        failure.originalError = error;
        if (rollbackError) failure.rollbackError = rollbackError;
        failure.storageRollbackComplete = !rollbackError;
        throw failure;
      }
      return true;
    }

    saveData() { this.persist(); return true; }
    loadData() { return this.projects; }
    ensureDataIntegrity() { this.projects = normalizeProjects(this.projects); return this.projects; }
    getProjects() { return this.projects; }
    getSnapshot() {
      return {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: now(),
        projects: clone(this.projects),
        focusRecords: clone(this.focusRecords),
        settings: clone(this.settings)
      };
    }
    getProject(ref) { var index = projectIndex(this.projects, ref); return index >= 0 ? this.projects[index] : null; }
    getProjectById(idValue) { return this.getProject(idValue); }

    addProject(data) {
      var source = object(data) ? data : { name: data };
      if (!text(source.name, text(source.title))) throw new Error('项目名称不能为空');
      if (this.projects.some(function (project) { return project.name === text(source.name, text(source.title)); })) throw new Error('项目名称已存在');
      var project = normalizeProject(Object.assign({}, source, { courses: [], knowledge: [], focusLogs: [] }), this.projects.length, Object.create(null));
      this.projects.push(project); this.persist(); return project;
    }
    updateProject(ref, patch) {
      var index = projectIndex(this.projects, ref); if (index < 0) return null;
      var current = this.projects[index];
      var next = Object.assign({}, current, object(patch) ? patch : {}, { id: current.id, updatedAt: now() });
      next.courses = current.courses; next.knowledge = current.knowledge; next.focusLogs = current.focusLogs;
      this.projects[index] = normalizeProject(next, index, Object.create(null)); this.persist(); return this.projects[index];
    }
    deleteProject(ref) { var index = projectIndex(this.projects, ref); if (index < 0) return false; this.projects.splice(index, 1); this.persist(); return true; }
    setProjectArchived(ref, archived) {
      var project = this.getProject(ref); if (!project) return null;
      project.archived = archived !== false;
      project.archivedAt = project.archived ? now() : null;
      project.updatedAt = now();
      this.persist(); return project;
    }
    archiveProject(ref) { return this.setProjectArchived(ref, true); }
    unarchiveProject(ref) { return this.setProjectArchived(ref, false); }

    addCourse(projectRef, data) {
      var project = this.getProject(projectRef); if (!project) return null;
      var course = normalizeCourse(data, project.courses.length, Object.create(null)); project.courses.push(course); project.updatedAt = now(); this.persist(); return course;
    }
    getCourse(projectRef, courseRef) {
      var project = this.getProject(projectRef); if (!project) return null;
      var index = childIndex(project.courses, courseRef); return index >= 0 ? project.courses[index] : null;
    }
    updateCourse(projectRef, courseRef, patch) {
      var project = this.getProject(projectRef); if (!project) return null;
      var index = childIndex(project.courses, courseRef); if (index < 0) return null;
      var current = project.courses[index]; var next = Object.assign({}, current, object(patch) ? patch : {}, { id: current.id, updatedAt: now() });
      if (object(patch) && patch.videos !== undefined) next.videos = array(patch.videos);
      project.courses[index] = normalizeCourse(next, index, Object.create(null)); project.updatedAt = now(); this.persist(); return project.courses[index];
    }
    deleteCourse(projectRef, courseRef) { var project = this.getProject(projectRef); if (!project) return false; var index = childIndex(project.courses, courseRef); if (index < 0) return false; project.courses.splice(index, 1); project.updatedAt = now(); this.persist(); return true; }

    getTaskProgress(projectRef, courseRef) {
      var course = this.getCourse(projectRef, courseRef);
      if (!course) return null;
      var estimate = Math.max(1, number(course.estimatedPomodoros, 1));
      var completed = Math.max(0, number(course.completedPomodoros, 0));
      return {
        estimatedPomodoros: estimate,
        completedPomodoros: completed,
        remainingPomodoros: Math.max(0, estimate - completed),
        percent: Math.min(100, Math.round(completed / estimate * 100)),
        archived: Boolean(course.archived)
      };
    }

    getSubtaskProgress(projectRef, courseRef, videoRef) {
      var video = this.getVideo(projectRef, courseRef, videoRef);
      if (!video) return null;
      var estimate = Math.max(1, number(video.estimatedPomodoros, 1));
      var completed = Math.max(0, number(video.completedPomodoros, 0));
      return { estimatedPomodoros: estimate, completedPomodoros: completed, remainingPomodoros: Math.max(0, estimate - completed), percent: Math.min(100, Math.round(completed / estimate * 100)) };
    }

    incrementTaskPomodoros(projectRef, courseRef, amount, options) {
      var project = this.getProject(projectRef);
      if (!project) return null;
      var course = this.getCourse(projectRef, courseRef);
      if (!course) return null;
      var count = Math.max(1, Math.floor(number(amount, 1)));
      var opts = object(options) ? options : {};
      var recordId = text(opts.recordId);
      if (!Array.isArray(course.pomodoroRecordIds)) course.pomodoroRecordIds = [];
      if (recordId && course.pomodoroRecordIds.indexOf(recordId) >= 0) return course;
      course.completedPomodoros = Math.max(0, Math.floor(number(course.completedPomodoros, 0))) + count;
      course.manualCompletedPomodoros = Math.max(0, Math.floor(number(course.manualCompletedPomodoros, course.completedPomodoros - count)));
      if (recordId) course.pomodoroRecordIds = course.pomodoroRecordIds.concat(recordId).slice(-2000);
      course.updatedAt = now();
      if (course.completedPomodoros >= Math.max(1, number(course.estimatedPomodoros, 1))) course.completedAt = course.completedAt || course.updatedAt;
      project.updatedAt = course.updatedAt;
      this.persist();
      return course;
    }

    incrementSubtaskPomodoros(projectRef, courseRef, videoRef, amount, options) {
      var project = this.getProject(projectRef);
      var course = this.getCourse(projectRef, courseRef);
      var video = this.getVideo(projectRef, courseRef, videoRef);
      if (!project || !course || !video) return null;
      var count = Math.max(1, Math.floor(number(amount, 1)));
      var opts = object(options) ? options : {};
      var recordId = text(opts.recordId);
      if (!Array.isArray(video.pomodoroRecordIds)) video.pomodoroRecordIds = [];
      if (recordId && video.pomodoroRecordIds.indexOf(recordId) >= 0) return video;
      video.completedPomodoros = Math.max(0, Math.floor(number(video.completedPomodoros, 0))) + count;
      if (recordId) video.pomodoroRecordIds = video.pomodoroRecordIds.concat(recordId).slice(-2000);
      video.completed = video.completedPomodoros >= Math.max(1, number(video.estimatedPomodoros, 1));
      video.updatedAt = now();
      project.updatedAt = video.updatedAt;
      this.persist();
      return video;
    }

    recordTaskPomodoro(record) {
      var source = object(record) ? record : {};
      var assignment = object(source.assignment) ? source.assignment : source;
      var project = this.getProject(assignment.projectId);
      if (!project && assignment.projectIndex != null) project = this.getProject(Number(assignment.projectIndex));
      if (!project && assignment.projectName) project = this.projects.find(function (item) { return item.name === assignment.projectName; });
      if (!project) return null;
      var course = this.getCourse(project.id, assignment.courseId);
      if (!course && assignment.courseIndex != null) course = this.getCourse(project.id, Number(assignment.courseIndex));
      if (!course && assignment.courseName) course = project.courses.find(function (item) { return item.name === assignment.courseName; });
      if (!course) return null;
      var video = this.getVideo(project.id, course.id, assignment.videoId);
      if (!video && assignment.videoIndex != null) video = this.getVideo(project.id, course.id, Number(assignment.videoIndex));
      if (!video && assignment.videoName) video = course.videos.find(function (item) { return item.name === assignment.videoName || item.title === assignment.videoName; });
      if (video) this.incrementSubtaskPomodoros(project.id, course.id, video.id, 1, { recordId: source.id });
      return this.incrementTaskPomodoros(project.id, course.id, 1, { recordId: source.id });
    }

    setTaskArchived(projectRef, courseRef, archived) {
      var project = this.getProject(projectRef);
      var course = this.getCourse(projectRef, courseRef);
      if (!project || !course) return null;
      course.archived = archived !== false;
      course.archivedAt = course.archived ? now() : null;
      course.updatedAt = now();
      project.updatedAt = course.updatedAt;
      this.persist();
      return course;
    }
    archiveTask(projectRef, courseRef) { return this.setTaskArchived(projectRef, courseRef, true); }
    unarchiveTask(projectRef, courseRef) { return this.setTaskArchived(projectRef, courseRef, false); }

    addVideo(projectRef, courseRef, data) { var course = this.getCourse(projectRef, courseRef); if (!course) return null; var video = normalizeVideo(data, course.videos.length, Object.create(null)); course.videos.push(video); this.persist(); return video; }
    getVideo(projectRef, courseRef, videoRef) { var course = this.getCourse(projectRef, courseRef); if (!course) return null; var index = childIndex(course.videos, videoRef); return index >= 0 ? course.videos[index] : null; }
    updateVideo(projectRef, courseRef, videoRef, patch) { var course = this.getCourse(projectRef, courseRef); if (!course) return null; var index = childIndex(course.videos, videoRef); if (index < 0) return null; var current = course.videos[index]; course.videos[index] = normalizeVideo(Object.assign({}, current, object(patch) ? patch : {}, { id: current.id, updatedAt: now() }), index, Object.create(null)); this.persist(); return course.videos[index]; }
    deleteVideo(projectRef, courseRef, videoRef) { var course = this.getCourse(projectRef, courseRef); if (!course) return false; var index = childIndex(course.videos, videoRef); if (index < 0) return false; course.videos.splice(index, 1); this.persist(); return true; }

    rebuildTaskProgress() {
      var records = this.focusRecords || [];
      this.projects.forEach(function (project) {
        array(project.courses).forEach(function (course) {
          var ids = Array.isArray(course.pomodoroRecordIds) ? course.pomodoroRecordIds.filter(Boolean) : [];
          // Drop ledger entries whose record was deleted or re-assigned. This
          // keeps task progress truthful when a user edits history later.
          ids = ids.filter(function (recordId) {
            return records.some(function (record) {
              if (!record || String(record.id) !== String(recordId)) return false;
              if (record.phase !== 'focus' && record.sessionType !== 'work') return false;
              var assignment = object(record.assignment) ? record.assignment : record;
              var sameId = assignment.courseId != null && String(assignment.courseId) === String(course.id);
              var sameProject = (assignment.projectId != null && String(assignment.projectId) === String(project.id)) || (assignment.projectName && String(assignment.projectName) === String(project.name));
              var legacyNameMatch = assignment.courseId == null && sameProject && assignment.courseName && String(assignment.courseName) === String(course.name);
              return sameId || legacyNameMatch;
            });
          });
          var linked = records.filter(function (record) {
            if (!record || (record.phase !== 'focus' && record.sessionType !== 'work')) return false;
            var assignment = object(record.assignment) ? record.assignment : record;
            var sameId = assignment.courseId != null && String(assignment.courseId) === String(course.id);
            var sameProject = (assignment.projectId != null && String(assignment.projectId) === String(project.id)) || (assignment.projectName && String(assignment.projectName) === String(project.name));
            var sameName = assignment.courseId == null && sameProject && assignment.courseName && String(assignment.courseName) === String(course.name);
            return sameId || sameName;
          });
          var linkedIds = linked.map(function (record) { return text(record.id); }).filter(Boolean);
          if (ids.length || linkedIds.length) {
            var merged = ids.concat(linkedIds).filter(function (value, index, list) { return list.indexOf(value) === index; }).slice(-2000);
            course.pomodoroRecordIds = merged;
            course.completedPomodoros = Math.max(0, number(course.manualCompletedPomodoros, 0)) + merged.length;
          } else if (course.pomodoroRecordIds.length) {
            // A formerly linked record was removed or re-assigned.
            course.pomodoroRecordIds = [];
            course.completedPomodoros = Math.max(0, number(course.manualCompletedPomodoros, 0));
          } else if (course.completedPomodoros === undefined) {
            course.completedPomodoros = 0;
          }
          course.estimatedPomodoros = Math.max(1, Math.floor(number(course.estimatedPomodoros, array(course.videos).length || 1)));
          if (course.completedPomodoros >= course.estimatedPomodoros) course.completedAt = course.completedAt || now();
          array(course.videos).forEach(function (video) {
            var linkedVideo = records.filter(function (record) {
              if (!record || (record.phase !== 'focus' && record.sessionType !== 'work')) return false;
              var assignment = object(record.assignment) ? record.assignment : record;
              var sameCourse = assignment.courseId != null && String(assignment.courseId) === String(course.id);
              var sameVideo = assignment.videoId != null && String(assignment.videoId) === String(video.id);
              return sameCourse && sameVideo;
            });
            var linkedVideoIds = linkedVideo.map(function (record) { return text(record.id); }).filter(Boolean).slice(-2000);
            video.pomodoroRecordIds = linkedVideoIds;
            video.manualCompletedPomodoros = Math.max(0, number(video.manualCompletedPomodoros, 0));
            video.completedPomodoros = video.manualCompletedPomodoros + linkedVideoIds.length;
            video.estimatedPomodoros = Math.max(1, Math.floor(number(video.estimatedPomodoros, video.estimatedMinutes > 0 ? Math.ceil(video.estimatedMinutes / 25) : 1)));
            video.completed = Boolean(video.manualCompleted) || video.completedPomodoros >= video.estimatedPomodoros;
          });
        });
      });
      return this.projects;
    }

    getFocusRecords() { return this.focusRecords; }
    addFocusRecord(data) { var record = normalizeRecord(data, this.focusRecords.length); this.focusRecords.push(record); this.persist(); return record; }
    createFocusRecord(data) { return this.addFocusRecord(data); }
    updateFocusRecord(ref, patch) { var index = childIndex(this.focusRecords, ref); if (index < 0) return null; var current = this.focusRecords[index]; this.focusRecords[index] = normalizeRecord(Object.assign({}, current, object(patch) ? patch : {}, { id: current.id, updatedAt: now() }), index); this.rebuildTaskProgress(); this.persist(); return this.focusRecords[index]; }
    deleteFocusRecord(ref) { var index = childIndex(this.focusRecords, ref); if (index < 0) return false; this.focusRecords.splice(index, 1); this.rebuildTaskProgress(); this.persist(); return true; }
    clearFocusRecords() { this.focusRecords = []; this.rebuildTaskProgress(); this.persist(); return true; }

    getSettings() { return this.settings; }
    updateSettings(patch) { this.settings = normalizeSettings(Object.assign({}, this.settings, object(patch) ? patch : {})); this.persist(); return this.settings; }
    setSettings(patch) { return this.updateSettings(patch); }

    getStatistics() {
      var stats = { totalProjects: this.projects.length, totalTasks: 0, completedTasks: 0, archivedTasks: 0, totalVideos: 0, completedVideos: 0, totalPomodoroTarget: 0, completedPomodoros: 0, totalKnowledge: 0, totalFocusRecords: this.focusRecords.length, totalFocusMinutes: 0 };
      this.projects.forEach(function (project) {
        stats.totalTasks += project.courses.length; stats.totalKnowledge += project.knowledge.length;
        project.courses.forEach(function (course) {
          stats.totalVideos += course.videos.length;
          var completed = course.videos.filter(function (video) { return video.completed; }).length;
          stats.completedVideos += completed;
          var estimate = Math.max(1, number(course.estimatedPomodoros, course.videos.length || 1));
          var pomodoros = Math.max(0, number(course.completedPomodoros, 0));
          stats.totalPomodoroTarget += estimate;
          stats.completedPomodoros += pomodoros;
          if (course.archived) stats.archivedTasks += 1;
          if (pomodoros >= estimate || (course.videos.length && completed === course.videos.length)) stats.completedTasks += 1;
        });
      });
      stats.totalFocusMinutes = this.focusRecords.reduce(function (sum, record) { return sum + number(record.durationSeconds, number(record.duration, 0) * 60) / 60; }, 0);
      return stats;
    }

    async createBackupPayload() {
      var payload = this.getSnapshot();
      payload.media = root.mediaStore && typeof root.mediaStore.exportRecords === 'function'
        ? await root.mediaStore.exportRecords()
        : [];
      return payload;
    }
    exportPayload() { return this.createBackupPayload(); }
    exportData() { return this.downloadExport(); }
    async downloadExport(filename) {
      var payload = JSON.stringify(await this.createBackupPayload(), null, 2);
      if (!global.Blob || !global.URL || !global.document) return payload;
      try {
        var blob = new Blob([payload], { type: 'application/json;charset=utf-8' }); var url = URL.createObjectURL(blob); var link = document.createElement('a');
        link.href = url; link.download = filename || ('studyflow-backup-' + new Date().toISOString().slice(0, 10) + '.json'); link.style.display = 'none'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      } catch (error) { return false; }
      return true;
    }
    async importPayload(payload) {
      if (typeof payload === 'string' && payload.length > MAX_BACKUP_FILE_BYTES) {
        throw new Error('备份文件不能超过 205MB');
      }
      var data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!object(data) || data.schemaVersion !== SCHEMA_VERSION || !Array.isArray(data.projects)
        || !Array.isArray(data.focusRecords) || !object(data.settings) || !Array.isArray(data.media)) {
        throw new Error('请选择当前版本导出的完整备份包');
      }
      var stagedProjects = normalizeProjects(data.projects);
      var stagedRecords = data.focusRecords.map(normalizeRecord);
      var stagedSettings = normalizeSettings(data.settings);
      var oldProjects = this.projects;
      var oldRecords = this.focusRecords;
      var oldSettings = this.settings;
      var mediaStore = root.mediaStore;
      var oldMedia = null;
      var oldMediaFormat = null;
      var mediaCommitted = false;
      var stateAssigned = false;
      var persistenceStarted = false;
      var persistenceCommitted = false;

      if (mediaStore && typeof mediaStore.replaceRecords === 'function') {
        if (typeof mediaStore.captureRecords === 'function') {
          oldMedia = await mediaStore.captureRecords();
          oldMediaFormat = 'records';
        } else if (typeof mediaStore.exportRecords === 'function') {
          oldMedia = await mediaStore.exportRecords();
          oldMediaFormat = 'backup';
        } else {
          throw new Error('无法为当前媒体库创建导入恢复点');
        }
      } else if (data.media.length) {
        throw new Error('当前浏览器无法恢复备份中的媒体文件');
      }

      try {
        if (mediaStore && typeof mediaStore.replaceRecords === 'function') {
          await mediaStore.replaceRecords(data.media, { strict: true });
          mediaCommitted = true;
        }
        this.projects = stagedProjects;
        this.focusRecords = stagedRecords;
        this.settings = stagedSettings;
        stateAssigned = true;
        this.rebuildTaskProgress();
        persistenceStarted = true;
        this.persistStrict();
        persistenceCommitted = true;

        if (root.promptLibrary && typeof root.promptLibrary.refresh === 'function') {
          await root.promptLibrary.refresh({ render: false, silent: true });
        }
        if (root.promptLibrary && typeof root.promptLibrary.applyConfig === 'function') {
          root.promptLibrary.applyConfig(this.settings.promptAudio);
        }
        if (root.soundscape && typeof root.soundscape.configure === 'function') {
          root.soundscape.configure(this.settings.soundscape);
        }
        return this.getSnapshot();
      } catch (error) {
        this.projects = oldProjects;
        this.focusRecords = oldRecords;
        this.settings = oldSettings;
        var rollbackFailures = [];
        if (mediaCommitted) {
          try {
            if (oldMediaFormat === 'records' && typeof mediaStore.restoreRecords === 'function') {
              await mediaStore.restoreRecords(oldMedia, { strict: true });
            } else {
              await mediaStore.replaceRecords(oldMedia, { strict: true });
            }
          } catch (failure) {
            rollbackFailures.push(failure);
          }
        }
        if (stateAssigned && (persistenceCommitted || (persistenceStarted && error.storageRollbackComplete !== true))) {
          try { this.persistStrict(); } catch (failure) { rollbackFailures.push(failure); }
        }
        try {
          if (root.promptLibrary && typeof root.promptLibrary.refresh === 'function') {
            await root.promptLibrary.refresh({ render: false, silent: true });
          }
          if (root.promptLibrary && typeof root.promptLibrary.applyConfig === 'function') {
            root.promptLibrary.applyConfig(oldSettings.promptAudio);
          }
          if (root.soundscape && typeof root.soundscape.configure === 'function') {
            root.soundscape.configure(oldSettings.soundscape);
          }
        } catch (failure) {
          rollbackFailures.push(failure);
        }
        if (rollbackFailures.length) {
          error.message = (error.message || '导入失败') + '；旧数据回滚未完全成功：' + (rollbackFailures[0].message || '浏览器存储不可用');
          error.rollbackErrors = rollbackFailures;
        }
        throw error;
      }
    }
    async importData(file) {
      if (!file) throw new Error('未选择文件');
      if (typeof file !== 'string' && Number.isFinite(Number(file.size)) && Number(file.size) > MAX_BACKUP_FILE_BYTES) {
        throw new Error('备份文件不能超过 205MB');
      }
      var content;
      if (typeof file === 'string') content = file;
      else if (typeof file.text === 'function') content = await file.text();
      else content = await new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = function () { reject(new Error('文件读取失败')); }; reader.readAsText(file); });
      return this.importPayload(content);
    }
    async resetAllData() {
      try { root.soundscape && root.soundscape.stop && root.soundscape.stop(); } catch (ignored) { /* no-op */ }
      try { root.audio && root.audio.stop && root.audio.stop(); } catch (ignored) { /* no-op */ }
      if (root.mediaStore && typeof root.mediaStore.clear === 'function') await root.mediaStore.clear();
      this.projects = [];
      this.focusRecords = [];
      this.settings = normalizeSettings(DEFAULT_SETTINGS);
      var removed = true;
      if (storageAvailable()) {
        try {
          // Remove only the keys owned by this app.  Avoid a broad prefix
          // match: another tool may intentionally share this origin.
          for (var index = global.localStorage.length - 1; index >= 0; index -= 1) {
            var key = global.localStorage.key(index);
            if (APP_STORAGE_KEYS.indexOf(key) >= 0) {
              try { global.localStorage.removeItem(key); } catch (error) { removed = false; }
            }
          }
        } catch (error) {
          removed = false;
        }
      }
      return removed;
    }
    async clearAllData() { return this.resetAllData(); }
  }

  var storage = new StudyFlowStorage();
  root.Storage = StudyFlowStorage;
  root.storage = storage;

  // Legacy facade: the old app expects a mutable project array and index returns.
  var facade = storage;
  facade.STORAGE_KEY = PROJECT_KEY;
  global.dataStorage = facade;
  if (typeof module !== 'undefined' && module.exports) module.exports = StudyFlowStorage;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
