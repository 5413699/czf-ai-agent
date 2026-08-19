(function (global) {
    'use strict';

    const StudyFlow = global.StudyFlow = global.StudyFlow || {};
    const DEFAULT_CONFIG = Object.freeze({
        volume: 0.55,
        startCueId: 'builtin-cue:start',
        completeCueId: 'builtin-cue:complete'
    });

    function clamp(value, fallback) {
        const number = Number(value);
        return Math.min(1, Math.max(0, Number.isFinite(number) ? number : fallback));
    }

    function normalizeKind(kind) {
        const value = String(kind || 'complete').toLowerCase();
        return value === 'start' || value === 'begin' || value === 'focus-start' ? 'start' : 'complete';
    }

    function normalizeCueId(value, fallback) {
        const id = String(value == null ? '' : value).trim();
        return /^(?:builtin-cue:(?:start|complete)|user-cue:[a-z0-9-]{1,80})$/i.test(id) ? id : fallback;
    }

    function normalizeConfig(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            volume: clamp(source.volume, DEFAULT_CONFIG.volume),
            startCueId: normalizeCueId(source.startCueId, DEFAULT_CONFIG.startCueId),
            completeCueId: normalizeCueId(source.completeCueId, DEFAULT_CONFIG.completeCueId)
        };
    }

    function resolvedAssetUrl(source) {
        if (!source || !global.document || !global.document.baseURI || typeof global.URL !== 'function') return source;
        try { return new global.URL(source, global.document.baseURI).href; } catch (_) { return source; }
    }

    function once(callback) {
        let called = false;
        return function () {
            if (called) return;
            called = true;
            if (typeof callback === 'function') callback();
        };
    }

    class FocusAudio {
        constructor(options) {
            const opts = options || {};
            this.defaultSources = {
                start: opts.startSource || 'assets/audio/focus-start.mp3',
                complete: opts.completeSource || 'assets/audio/focus-complete.mp3'
            };
            this.fallbackSources = {
                start: opts.startFallbackSource || 'assets/audio/focus-start.wav',
                complete: opts.completeFallbackSource || 'assets/audio/focus-complete.wav'
            };
            this.config = normalizeConfig(Object.assign({}, opts.config || {}, {
                volume: opts.volume == null ? (opts.config && opts.config.volume) : opts.volume
            }));
            this.volume = this.config.volume;
            this.sourceResolver = typeof opts.sourceResolver === 'function' ? opts.sourceResolver : null;
            this.channels = { start: null, complete: null, preview: null };
            this.channelTokens = { start: 0, complete: 0, preview: 0 };
            this.audio = null;
            this.audioContext = null;
            this.listeners = Object.create(null);
        }

        normalizeConfig(value) { return normalizeConfig(value); }

        setSourceResolver(resolver) {
            this.sourceResolver = typeof resolver === 'function' ? resolver : null;
            return this;
        }

        configure(value) {
            this.config = normalizeConfig(Object.assign({}, this.config, value || {}));
            this.setVolume(this.config.volume, { emit: false });
            const snapshot = this.getSettings();
            this._emit('configchange', snapshot);
            return snapshot;
        }

        getSettings() {
            return Object.assign({}, this.config, { volume: this.volume });
        }

        getSource(kind) {
            return this.defaultSources[normalizeKind(kind)];
        }

        on(eventName, callback) {
            if (typeof callback !== 'function') return function () {};
            if (!this.listeners[eventName]) this.listeners[eventName] = [];
            this.listeners[eventName].push(callback);
            return () => this.off(eventName, callback);
        }

        off(eventName, callback) {
            const list = this.listeners[eventName];
            if (list) this.listeners[eventName] = list.filter((item) => item !== callback);
        }

        _emit(eventName, payload) {
            (this.listeners[eventName] || []).slice().forEach((callback) => {
                try { callback(payload); } catch (error) {
                    if (global.console) global.console.error('[FocusAudio]', error);
                }
            });
        }

        setVolume(value, options) {
            const opts = options || {};
            this.volume = clamp(value, this.volume);
            this.config.volume = this.volume;
            ['start', 'complete'].forEach((channel) => {
                const state = this.channels[channel];
                if (state && state.media) state.media.volume = this.volume;
                if (state && state.gains) state.gains.forEach((gain) => { gain.gain.value = Math.max(0.0001, this.volume * 0.18); });
            });
            if (opts.emit !== false) this._emit('volume', this.volume);
            return this.volume;
        }

        setPreviewVolume(value) {
            const state = this.channels.preview;
            if (!state) return false;
            const volume = clamp(value, this.volume);
            state.volume = volume;
            if (state.media) state.media.volume = volume;
            if (state.gains) state.gains.forEach((gain) => { gain.gain.value = Math.max(0.0001, volume * 0.18); });
            return true;
        }

        isPreviewing(cueId) {
            const state = this.channels.preview;
            return Boolean(state && (!cueId || state.cueId === cueId));
        }

        unlock() {
            try {
                const AudioContext = global.AudioContext || global.webkitAudioContext;
                if (!AudioContext) return Promise.resolve(false);
                if (!this.audioContext) this.audioContext = new AudioContext();
                if (this.audioContext.state === 'suspended') return this.audioContext.resume().then(() => true).catch(() => false);
                return Promise.resolve(true);
            } catch (_) {
                return Promise.resolve(false);
            }
        }

        async _resolve(cueId, kind, mediaFallback) {
            if (!mediaFallback && this.sourceResolver) {
                try {
                    const value = await this.sourceResolver(cueId, kind);
                    if (typeof value === 'string' && value) return { source: value, release: null };
                    if (value && value.source) return Object.assign({}, value, { release: once(value.release) });
                } catch (error) {
                    this._emit('error', { kind, cueId, error, phase: 'resolve' });
                }
            }
            return {
                id: mediaFallback ? `fallback:${kind}` : `builtin-cue:${kind}`,
                source: mediaFallback ? this.fallbackSources[kind] : this.defaultSources[kind],
                release: null,
                fallback: Boolean(mediaFallback)
            };
        }

        _releaseState(channel, state, reset) {
            if (!state) return;
            if (state.media) {
                state.media.onended = null;
                state.media.onerror = null;
                try { state.media.pause(); } catch (_) { /* ignored */ }
                if (reset !== false) {
                    try { state.media.currentTime = 0; } catch (_) { /* ignored */ }
                }
            }
            (state.oscillators || []).forEach((node) => {
                try { node.stop(); } catch (_) { /* already stopped */ }
            });
            if (typeof state.release === 'function') state.release();
            if (this.channels[channel] === state) this.channels[channel] = null;
            if (this.audio === state.media) this.audio = null;
        }

        _stopChannel(channel, reset) {
            this.channelTokens[channel] += 1;
            this._releaseState(channel, this.channels[channel], reset);
        }

        _startOscillatorFallback(channel, cueId, kind, volume) {
            try {
                const AudioContext = global.AudioContext || global.webkitAudioContext;
                if (!AudioContext) return false;
                if (!this.audioContext) this.audioContext = new AudioContext();
                const context = this.audioContext;
                const now = context.currentTime;
                const notes = kind === 'start' ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25];
                const state = { cueId, kind, volume, oscillators: [], gains: [] };
                this.channels[channel] = state;
                notes.forEach((frequency, index) => {
                    const oscillator = context.createOscillator();
                    const gain = context.createGain();
                    const begin = now + index * 0.16;
                    oscillator.type = 'sine';
                    oscillator.frequency.value = frequency;
                    gain.gain.setValueAtTime(0.0001, begin);
                    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.18), begin + 0.025);
                    gain.gain.exponentialRampToValueAtTime(0.0001, begin + 0.42);
                    oscillator.connect(gain);
                    gain.connect(context.destination);
                    oscillator.start(begin);
                    oscillator.stop(begin + 0.45);
                    state.oscillators.push(oscillator);
                    state.gains.push(gain);
                });
                global.setTimeout(() => {
                    if (this.channels[channel] === state) this._releaseState(channel, state, false);
                }, 720);
                return true;
            } catch (_) {
                return false;
            }
        }

        async _playChannel(channel, cueId, kind, volume, mediaFallback) {
            this._stopChannel(channel, true);
            const token = this.channelTokens[channel];
            const descriptor = await this._resolve(cueId, kind, mediaFallback);
            if (token !== this.channelTokens[channel]) {
                if (typeof descriptor.release === 'function') descriptor.release();
                return false;
            }
            if (typeof global.Audio !== 'function') {
                if (typeof descriptor.release === 'function') descriptor.release();
                const played = this._startOscillatorFallback(channel, cueId, kind, volume);
                this._emit('play', { channel, kind, cueId, fallback: true });
                return played;
            }
            let media;
            try {
                media = new global.Audio(resolvedAssetUrl(descriptor.source));
            } catch (error) {
                if (typeof descriptor.release === 'function') descriptor.release();
                if (!mediaFallback) return this._playChannel(channel, cueId, kind, volume, true);
                return this._startOscillatorFallback(channel, cueId, kind, volume);
            }
            const state = {
                cueId,
                kind,
                volume,
                media,
                release: descriptor.release,
                fallback: Boolean(mediaFallback || descriptor.fallback)
            };
            this.channels[channel] = state;
            if (channel !== 'preview') this.audio = media;
            media.preload = 'auto';
            media.volume = clamp(volume, this.volume);
            media.onended = () => {
                if (this.channels[channel] !== state) return;
                this._releaseState(channel, state, false);
                this._emit('ended', { channel, kind, cueId });
            };
            const fail = (error) => {
                if (this.channels[channel] !== state) return Promise.resolve(false);
                this._releaseState(channel, state, true);
                this._emit('error', { channel, kind, cueId, source: descriptor.source, error, phase: 'play' });
                if (!mediaFallback) return this._playChannel(channel, cueId, kind, volume, true);
                const played = this._startOscillatorFallback(channel, cueId, kind, volume);
                return Promise.resolve(played);
            };
            media.onerror = () => { fail(new Error('提示音文件无法播放')); };
            try {
                const result = media.play();
                this._emit('play', { channel, kind, cueId, source: descriptor.source, fallback: state.fallback });
                if (result && typeof result.then === 'function') return result.then(() => true).catch(fail);
                return true;
            } catch (error) {
                return fail(error);
            }
        }

        play(kind) {
            const key = normalizeKind(kind);
            this.stopPreview();
            const cueId = key === 'start' ? this.config.startCueId : this.config.completeCueId;
            return this._playChannel(key, cueId, key, this.volume, false);
        }

        previewCue(cueId, options) {
            const opts = options || {};
            const kind = normalizeKind(opts.kind || (cueId === DEFAULT_CONFIG.startCueId ? 'start' : 'complete'));
            return this._playChannel('preview', cueId, kind, clamp(opts.volume, this.volume), false);
        }

        stopPreview() { this._stopChannel('preview', true); }

        stop() {
            this._stopChannel('start', true);
            this._stopChannel('complete', true);
            this.stopPreview();
            return this.getSettings();
        }

        reset() {
            this.stop();
            return this.configure(DEFAULT_CONFIG);
        }

        destroy() {
            this.stop();
            this.listeners = Object.create(null);
            if (this.audioContext && typeof this.audioContext.close === 'function') {
                try { this.audioContext.close(); } catch (_) { /* ignored */ }
            }
            this.audioContext = null;
        }

        playStart() { return this.play('start'); }
        playComplete() { return this.play('complete'); }
        playEnd() { return this.play('complete'); }
    }

    StudyFlow.FocusAudio = FocusAudio;
    StudyFlow.audio = StudyFlow.audio || new FocusAudio();
    global.focusAudio = StudyFlow.audio;
    global.FocusAudio = FocusAudio;
    global.AudioManager = FocusAudio;
})(typeof globalThis !== 'undefined' ? globalThis : window);
