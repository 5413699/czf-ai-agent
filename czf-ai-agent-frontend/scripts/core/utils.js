(function (root) {
  'use strict';

  // Small, dependency-free helpers shared by the StudyFlow modules.
  var cryptoObject = root && root.crypto;
  var FOCUS_PRESET_ICON_IDS = Object.freeze([
    'target', 'book-open', 'brain', 'code-2', 'pen-line',
    'graduation-cap', 'briefcase-business', 'calculator', 'flask-conical', 'notebook-tabs'
  ]);
  var DEFAULT_FOCUS_PRESET_ICON = 'target';

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    if (value === undefined || value === null) return value;
    if (typeof root.structuredClone === 'function') {
      try { return root.structuredClone(value); } catch (ignored) { /* fall through */ }
    }
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) {
      var result = {};
      Object.keys(value).forEach(function (key) { result[key] = clone(value[key]); });
      return result;
    }
    return value;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    var normalizedPrefix = String(prefix || 'item').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'item';
    if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
      try { return normalizedPrefix + '_' + cryptoObject.randomUUID(); } catch (ignored) { /* fall through */ }
    }
    var time = Date.now().toString(36);
    var random = Math.random().toString(36).slice(2, 10);
    return normalizedPrefix + '_' + time + '_' + random;
  }

  function ensureId(value, prefix, used) {
    var candidate = value === undefined || value === null ? '' : String(value).trim();
    if (!candidate || (used && used[candidate])) {
      do { candidate = createId(prefix); } while (used && used[candidate]);
    }
    if (used) used[candidate] = true;
    return candidate;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function firstDefined() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (arguments[i] !== undefined && arguments[i] !== null) return arguments[i];
    }
    return undefined;
  }

  function nonEmptyString(value, fallback) {
    var text = value === undefined || value === null ? '' : String(value).trim();
    return text || (fallback === undefined ? '' : String(fallback));
  }

  function toFiniteNumber(value, fallback) {
    var number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? number : (fallback === undefined ? 0 : fallback);
  }

  function toBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback === undefined ? false : Boolean(fallback);
    if (typeof value === 'string') {
      if (/^(false|0|no|off)$/i.test(value.trim())) return false;
      if (/^(true|1|yes|on)$/i.test(value.trim())) return true;
    }
    return Boolean(value);
  }

  function parseJson(value, fallback) {
    if (typeof value !== 'string') return value === undefined ? fallback : value;
    try { return JSON.parse(value); } catch (ignored) { return fallback; }
  }

  function isoDate(value, fallback) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (value !== undefined && value !== null && String(value).trim()) {
      var date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return fallback || nowIso();
  }

  function merge(base, patch) {
    var result = clone(base) || {};
    if (!isObject(patch)) return result;
    Object.keys(patch).forEach(function (key) {
      result[key] = patch[key] === undefined ? result[key] : clone(patch[key]);
    });
    return result;
  }

  function escapeHTML(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  function normalizeFocusPresetIcon(value, fallback) {
    var requested = String(value === undefined || value === null ? '' : value).trim();
    if (FOCUS_PRESET_ICON_IDS.indexOf(requested) >= 0) return requested;
    var fallbackIcon = String(fallback === undefined || fallback === null ? '' : fallback).trim();
    return FOCUS_PRESET_ICON_IDS.indexOf(fallbackIcon) >= 0 ? fallbackIcon : DEFAULT_FOCUS_PRESET_ICON;
  }

  function durationToSeconds(value) {
    if (typeof value === 'number') return Math.max(0, Math.round(value));
    var parts = String(value === undefined || value === null ? '' : value).trim().split(':').map(Number);
    if (parts.some(function (part) { return !Number.isFinite(part); })) return 0;
    if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
    if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
    return Math.max(0, Number(parts[0]) || 0);
  }

  function formatDuration(value) {
    var total = Math.max(0, Math.round(toFiniteNumber(value, 0)));
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;
    return hours ? String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') : String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }

  function dateLabel(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? '未记录时间' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function dispatch(name, detail) {
    if (!root.document || typeof root.document.dispatchEvent !== 'function') return;
    try {
      root.document.dispatchEvent(new root.CustomEvent(name, { detail: detail || {} }));
    } catch (_) {
      // Older embedded browser shells may not expose CustomEvent constructors.
      var event = root.document.createEvent('Event');
      event.initEvent(name, false, false);
      event.detail = detail || {};
      root.document.dispatchEvent(event);
    }
  }

  var api = {
    isObject: isObject,
    clone: clone,
    nowIso: nowIso,
    createId: createId,
    ensureId: ensureId,
    asArray: asArray,
    firstDefined: firstDefined,
    nonEmptyString: nonEmptyString,
    toFiniteNumber: toFiniteNumber,
    toBoolean: toBoolean,
    parseJson: parseJson,
    isoDate: isoDate,
    merge: merge,
    dispatch: dispatch,
    escapeHTML: escapeHTML,
    focusPresetIconIds: FOCUS_PRESET_ICON_IDS,
    normalizeFocusPresetIcon: normalizeFocusPresetIcon,
    durationToSeconds: durationToSeconds,
    formatDuration: formatDuration,
    dateLabel: dateLabel,
    // Compatibility names used by the first refactor draft and legacy modules.
    id: createId,
    now: nowIso,
    text: nonEmptyString,
    number: toFiniteNumber,
    safeUrl: function (value) {
      var text = nonEmptyString(value);
      if (!text) return '';
      // Keep relative/local links usable while rejecting script/data URLs.
      if (/^(javascript|vbscript|data):/i.test(text)) return '';
      return text;
    }
  };

  root.StudyFlow = root.StudyFlow || {};
  root.StudyFlow.utils = api;
  // Alias retained for small integrations that loaded the utility module directly.
  root.StudyFlowUtils = api;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
