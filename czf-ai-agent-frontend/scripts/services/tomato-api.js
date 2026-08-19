(function (global) {
  'use strict';

  const root = global.StudyFlow = global.StudyFlow || {};
  const STORAGE_KEY = 'studyflow:tomato-api-base-url';
  const DEFAULT_BASE_URL = 'http://localhost:8123/api';

  function normalizeBaseUrl(value) {
    const fallback = global.location.protocol === 'file:' ? DEFAULT_BASE_URL : '/api';
    return String(value || fallback).trim().replace(/\/+$/, '');
  }

  function requestId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  class TomatoApiError extends Error {
    constructor(message, details) {
      super(message || '请求失败');
      this.name = 'TomatoApiError';
      Object.assign(this, details || {});
    }
  }

  const TomatoApi = {
    timeoutMs: 90000,

    getBaseUrl() {
      try { return normalizeBaseUrl(global.localStorage.getItem(STORAGE_KEY)); }
      catch (_) { return normalizeBaseUrl(); }
    },

    setBaseUrl(value) {
      const normalized = normalizeBaseUrl(value);
      try { global.localStorage.setItem(STORAGE_KEY, normalized); } catch (_) { /* localStorage may be disabled */ }
      return normalized;
    },

    createChatId: requestId,

    async request(path, options) {
      const config = options || {};
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = global.setTimeout(() => controller?.abort(), Number(config.timeoutMs) || this.timeoutMs);
      let response;
      try {
        response = await global.fetch(`${this.getBaseUrl()}${path}`, {
          method: config.method || 'GET',
          headers: Object.assign({ Accept: 'application/json' }, config.body ? { 'Content-Type': 'application/json' } : {}, config.headers || {}),
          body: config.body ? JSON.stringify(config.body) : undefined,
          signal: controller?.signal
        });
      } catch (error) {
        const timedOut = error && error.name === 'AbortError';
        throw new TomatoApiError(timedOut ? 'AI 服务响应超时，请稍后重试' : '无法连接本地 AI 服务，请确认后端已经启动', {
          code: timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
          cause: error
        });
      } finally {
        global.clearTimeout(timeout);
      }

      const contentType = response.headers.get('content-type') || '';
      let data = null;
      try { data = contentType.includes('application/json') ? await response.json() : await response.text(); }
      catch (_) { data = null; }
      if (!response.ok) {
        const problem = data && typeof data === 'object' ? data : {};
        throw new TomatoApiError(problem.message || `AI 服务返回了 HTTP ${response.status}`, {
          status: response.status,
          code: problem.code || 'HTTP_ERROR',
          requestId: problem.requestId || response.headers.get('x-request-id') || '',
          payload: data
        });
      }
      return data;
    },

    async health() {
      return this.request('/health', { timeoutMs: 8000 });
    },

    async createPlan(input) {
      const body = {
        goal: String(input.goal || '').trim(),
        context: String(input.context || '').trim(),
        pomodoroMinutes: Number(input.pomodoroMinutes),
        chatId: input.chatId || requestId()
      };
      return this.request('/tomato-assistant/plans', { method: 'POST', body });
    }
  };

  root.tomatoApi = TomatoApi;
  root.TomatoApiError = TomatoApiError;
})(window);
