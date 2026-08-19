(function (global) {
    'use strict';

    const StudyFlow = global.StudyFlow = global.StudyFlow || {};
    const DAY = 24 * 60 * 60 * 1000;
    const MAX_TRANSITIONS_PER_TICK = 100;
    const RECOVERY_BATCH_SIZE = 25;

    const DEFAULTS = {
        focus: 25 * 60 * 1000,
        shortBreak: 5 * 60 * 1000,
        longBreak: 15 * 60 * 1000,
        longBreakInterval: 4,
        autoStartFocus: true,
        autoStartBreak: true
    };

    const PHASES = ['focus', 'shortBreak', 'longBreak'];
    const STATUSES = ['idle', 'running', 'paused', 'waiting'];

    function storage() {
        try { return global.localStorage || null; } catch (error) { return null; }
    }

    function finite(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function positive(value, fallback) {
        return Math.max(1, finite(value, fallback));
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, finite(value, min)));
    }

    function boolean(value, fallback) {
        if (value == null) return Boolean(fallback);
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['false', '0', 'off', 'no'].indexOf(normalized) >= 0) return false;
            if (['true', '1', 'on', 'yes'].indexOf(normalized) >= 0) return true;
        }
        return Boolean(value);
    }

    function now() { return Date.now(); }

    function phaseFromLegacy(value) {
        if (value === 'break' || value === 'short-break' || value === 'shortBreak') return 'shortBreak';
        if (value === 'long-break' || value === 'longBreak') return 'longBreak';
        return 'focus';
    }

    function clone(value) {
        if (value == null) return value;
        try { return JSON.parse(JSON.stringify(value)); } catch (error) { return value; }
    }

    function asDuration(value, unit, fallback) {
        const amount = positive(value, fallback / 60000);
        return Math.round((unit === 'seconds' ? amount * 1000 : amount * 60000));
    }

    /**
     * Clock-driven Pomodoro state machine. It deliberately contains no modal
     * or presentation code: phase transitions are automatic and observable via
     * the event API.
     */
    class FocusTimerEngine {
        constructor(options) {
            const opts = options || {};
            this.storageKey = opts.storageKey || 'studyflow.focus.timer';
            this.legacyStorageKey = opts.legacyStorageKey || 'focus-timer-state';
            this.sessionsKey = opts.sessionsKey || 'studyflow.focus.sessions';
            this.tickRate = Math.max(200, finite(opts.tickRate, 500));
            this.audio = opts.audio || StudyFlow.audio || global.focusAudio || null;
            this.listeners = Object.create(null);
            this.interval = null;
            this.soundHandoff = null;
            this.transitionToken = 0;
            this.recoveryTimer = null;
            this.recoveryTargetAt = null;
            this.recoveryInProgress = false;
            this.assignmentProvider = typeof opts.assignmentProvider === 'function' ? opts.assignmentProvider : null;
            this.onSessionComplete = typeof opts.onSessionComplete === 'function' ? opts.onSessionComplete : null;
            this.settings = {
                focusMs: DEFAULTS.focus,
                shortBreakMs: DEFAULTS.shortBreak,
                longBreakMs: DEFAULTS.longBreak,
                longBreakInterval: DEFAULTS.longBreakInterval,
                autoStartFocus: DEFAULTS.autoStartFocus,
                autoStartBreak: DEFAULTS.autoStartBreak
            };
            this.state = {
                phase: 'focus',
                status: 'idle',
                round: 1,
                phaseStartedAt: null,
                phaseEndsAt: null,
                phaseDurationMs: DEFAULTS.focus,
                pausedRemainingMs: DEFAULTS.focus,
                completedFocuses: 0,
                assignment: null,
                lastTransitionAt: null
            };
            this._loadSettingsFromDom();
            this._load();
            this._bindLifecycle();
            this._emit('ready', this.getSnapshot());
        }

        _bindLifecycle() {
            if (global.document) {
                global.document.addEventListener('visibilitychange', () => {
                    if (!global.document.hidden) this.recover();
                });
            }
            if (global.addEventListener) global.addEventListener('beforeunload', () => this.persist());
        }

        on(eventName, callback) {
            if (typeof callback !== 'function') return function () {};
            if (!this.listeners[eventName]) this.listeners[eventName] = [];
            this.listeners[eventName].push(callback);
            return () => this.off(eventName, callback);
        }

        once(eventName, callback) {
            const unsubscribe = this.on(eventName, (payload) => {
                unsubscribe();
                callback(payload);
            });
            return unsubscribe;
        }

        off(eventName, callback) {
            const list = this.listeners[eventName];
            if (!list) return;
            this.listeners[eventName] = list.filter((item) => item !== callback);
        }

        _emit(eventName, payload) {
            const callbacks = (this.listeners[eventName] || []).slice();
            callbacks.forEach((callback) => {
                try { callback(payload); } catch (error) {
                    // Keep one consumer from breaking timer ticks.
                    if (global.console) global.console.error('[FocusTimerEngine]', error);
                }
            });
            if (eventName !== 'statechange' && this.listeners['statechange']) {
                const stateCallbacks = this.listeners['statechange'].slice();
                stateCallbacks.forEach((callback) => {
                    try { callback(this.getSnapshot(), eventName, payload); } catch (error) {
                        if (global.console) global.console.error('[FocusTimerEngine]', error);
                    }
                });
            }
        }

        _loadSettingsFromDom() {
            const read = (timeId, unitId, current) => {
                const time = global.document && global.document.getElementById(timeId);
                if (!time) return current;
                const unit = global.document.getElementById(unitId);
                return asDuration(time.value, unit ? unit.value : 'minutes', current);
            };
            this.settings.focusMs = read('work-time', 'work-unit', this.settings.focusMs || DEFAULTS.focus);
            this.settings.shortBreakMs = read('break-time', 'break-unit', this.settings.shortBreakMs || DEFAULTS.shortBreak);
            this.settings.longBreakMs = read('long-break-time', 'long-break-unit', this.settings.longBreakMs || DEFAULTS.longBreak);
            const interval = global.document && global.document.getElementById('long-break-interval');
            if (interval) this.settings.longBreakInterval = clamp(interval.value, 2, 12);
            const autoStartFocus = global.document && global.document.getElementById('auto-start-focus');
            const autoStartBreak = global.document && global.document.getElementById('auto-start-break');
            if (autoStartFocus) this.settings.autoStartFocus = Boolean(autoStartFocus.checked);
            if (autoStartBreak) this.settings.autoStartBreak = Boolean(autoStartBreak.checked);
        }

        _load() {
            const store = storage();
            if (!store) return;
            let parsed = null;
            try { parsed = JSON.parse(store.getItem(this.storageKey) || 'null'); } catch (error) { parsed = null; }
            if (!parsed) {
                try {
                    const legacy = JSON.parse(store.getItem(this.legacyStorageKey) || 'null');
                    if (legacy) parsed = this._migrateLegacy(legacy);
                } catch (error) { parsed = null; }
            }
            if (!parsed) {
                this.state.pausedRemainingMs = this._durationFor('focus');
                return;
            }
            this._applySettings(parsed.settings || parsed);
            const incoming = parsed.state || parsed;
            this.state.phase = PHASES.indexOf(incoming.phase) >= 0 ? incoming.phase : phaseFromLegacy(incoming.sessionType);
            this.state.status = STATUSES.indexOf(incoming.status) >= 0
                ? incoming.status
                : (incoming.isRunning ? 'running' : 'idle');
            this.state.round = Math.max(1, Math.floor(finite(incoming.round != null ? incoming.round : incoming.currentRound, 1)));
            this.state.phaseStartedAt = finite(incoming.phaseStartedAt, null);
            this.state.phaseEndsAt = finite(incoming.phaseEndsAt, null);
            this.state.phaseDurationMs = positive(incoming.phaseDurationMs,
                this.state.phaseStartedAt != null && this.state.phaseEndsAt != null
                    ? Math.max(1, this.state.phaseEndsAt - this.state.phaseStartedAt)
                    : this._durationFor(this.state.phase));
            this.state.pausedRemainingMs = Math.max(0, finite(incoming.pausedRemainingMs, finite(incoming.timeLeft, this._durationFor(this.state.phase)) * 1000));
            if (incoming.timeLeft != null && incoming.phaseEndsAt == null && this.state.status === 'running') {
                this.state.phaseEndsAt = now() + Math.max(0, finite(incoming.timeLeft, 0) * 1000);
                this.state.phaseStartedAt = now();
            }
            this.state.completedFocuses = Math.max(0, Math.floor(finite(incoming.completedFocuses, 0)));
            this.state.assignment = clone(incoming.assignment || null);
            this.state.lastTransitionAt = finite(incoming.lastTransitionAt, null);
            if (this.state.status === 'running' && !this.state.phaseEndsAt) {
                this.state.status = 'paused';
                this.state.pausedRemainingMs = this._durationFor(this.state.phase);
            }
            if (this.state.status === 'running') {
                this._recoverExpired(now());
            }
            if (this.state.status === 'idle') {
                this.state.phaseEndsAt = null;
                this.state.phaseStartedAt = null;
                this.state.phaseDurationMs = this._durationFor(this.state.phase);
                this.state.pausedRemainingMs = this._durationFor(this.state.phase);
            }
            if (this.state.status === 'waiting') {
                this.state.phaseEndsAt = null;
                this.state.phaseStartedAt = null;
                this.state.phaseDurationMs = this._durationFor(this.state.phase);
                this.state.pausedRemainingMs = this._durationFor(this.state.phase);
            }
            this.persist();
        }

        _migrateLegacy(legacy) {
            const phase = phaseFromLegacy(legacy.sessionType);
            const remaining = Math.max(0, finite(legacy.timeLeft, 0) * 1000);
            const settings = {
                focusMs: asDuration(legacy.workTime || legacy.workMinutes || 25, legacy.workUnit || 'minutes', DEFAULTS.focus),
                shortBreakMs: asDuration(legacy.breakTime || legacy.breakMinutes || 5, legacy.breakUnit || 'minutes', DEFAULTS.shortBreak),
                longBreakMs: asDuration(legacy.longBreakTime || legacy.longBreakMinutes || 15, legacy.longBreakUnit || 'minutes', DEFAULTS.longBreak),
                longBreakInterval: clamp(legacy.longBreakInterval || 4, 2, 12),
                autoStartFocus: DEFAULTS.autoStartFocus,
                autoStartBreak: DEFAULTS.autoStartBreak
            };
            const status = legacy.isRunning ? 'running' : 'idle';
            return {
                version: 2,
                settings,
                state: {
                    phase,
                    status,
                    round: Math.max(1, Math.floor(finite(legacy.currentRound, 1))),
                    phaseStartedAt: status === 'running' ? now() : null,
                    phaseEndsAt: status === 'running' ? now() + remaining : null,
                    phaseDurationMs: settings.focusMs,
                    pausedRemainingMs: remaining || settings.focusMs,
                    completedFocuses: 0,
                    assignment: null
                }
            };
        }

        _applySettings(source) {
            if (!source) return;
            const settings = source.settings || source;
            if (settings.focusMs != null) this.settings.focusMs = positive(settings.focusMs, DEFAULTS.focus);
            else if (settings.workMinutes != null || settings.workTime != null) this.settings.focusMs = asDuration(settings.workTime || settings.workMinutes, settings.workUnit || 'minutes', DEFAULTS.focus);
            if (settings.shortBreakMs != null) this.settings.shortBreakMs = positive(settings.shortBreakMs, DEFAULTS.shortBreak);
            else if (settings.breakMinutes != null || settings.breakTime != null) this.settings.shortBreakMs = asDuration(settings.breakTime || settings.breakMinutes, settings.breakUnit || 'minutes', DEFAULTS.shortBreak);
            if (settings.longBreakMs != null) this.settings.longBreakMs = positive(settings.longBreakMs, DEFAULTS.longBreak);
            else if (settings.longBreakMinutes != null || settings.longBreakTime != null) this.settings.longBreakMs = asDuration(settings.longBreakTime || settings.longBreakMinutes, settings.longBreakUnit || 'minutes', DEFAULTS.longBreak);
            if (settings.longBreakInterval != null) this.settings.longBreakInterval = clamp(settings.longBreakInterval, 2, 12);
            if (settings.autoStartFocus != null) this.settings.autoStartFocus = boolean(settings.autoStartFocus, DEFAULTS.autoStartFocus);
            if (settings.autoStartBreak != null) this.settings.autoStartBreak = boolean(settings.autoStartBreak, DEFAULTS.autoStartBreak);
        }

        _durationFor(phase) {
            if (phase === 'shortBreak') return this.settings.shortBreakMs;
            if (phase === 'longBreak') return this.settings.longBreakMs;
            return this.settings.focusMs;
        }

        getDuration(phase) { return this._durationFor(phase || this.state.phase); }

        configure(changes) {
            const source = changes || {};
            if (source.focusMs != null || source.focus != null || source.workMinutes != null) this.settings.focusMs = source.focusMs != null ? positive(source.focusMs, DEFAULTS.focus) : asDuration(source.focus || source.workMinutes, source.focusUnit || source.workUnit || 'minutes', DEFAULTS.focus);
            if (source.shortBreakMs != null || source.shortBreak != null || source.breakMinutes != null) this.settings.shortBreakMs = source.shortBreakMs != null ? positive(source.shortBreakMs, DEFAULTS.shortBreak) : asDuration(source.shortBreak || source.breakMinutes, source.shortBreakUnit || source.breakUnit || 'minutes', DEFAULTS.shortBreak);
            if (source.longBreakMs != null || source.longBreak != null || source.longBreakMinutes != null) this.settings.longBreakMs = source.longBreakMs != null ? positive(source.longBreakMs, DEFAULTS.longBreak) : asDuration(source.longBreak || source.longBreakMinutes, source.longBreakUnit || source.longBreakUnit || 'minutes', DEFAULTS.longBreak);
            if (source.longBreakInterval != null) this.settings.longBreakInterval = clamp(source.longBreakInterval, 2, 12);
            if (source.autoStartFocus != null) this.settings.autoStartFocus = boolean(source.autoStartFocus, this.settings.autoStartFocus);
            if (source.autoStartBreak != null) this.settings.autoStartBreak = boolean(source.autoStartBreak, this.settings.autoStartBreak);
            if (this.state.status === 'idle' || this.state.status === 'waiting') {
                this.state.phaseDurationMs = this._durationFor(this.state.phase);
                this.state.pausedRemainingMs = this.state.phaseDurationMs;
            }
            this.persist();
            this._emit('settingschange', this.getSnapshot());
            this._emit('tick', this.getSnapshot());
            return this.getSnapshot();
        }

        setAssignment(assignment) {
            this.state.assignment = assignment ? clone(assignment) : null;
            this.persist();
            this._emit('assignmentchange', this.state.assignment);
            return this.state.assignment;
        }

        getAssignment() {
            if (this.assignmentProvider) {
                try { return clone(this.assignmentProvider()); } catch (error) { /* use saved assignment */ }
            }
            return clone(this.state.assignment);
        }

        _remaining(nowValue) {
            if (this.state.status === 'running' && this.state.phaseEndsAt != null) return Math.max(0, this.state.phaseEndsAt - nowValue);
            if (this.state.status === 'paused' || this.state.status === 'waiting') return Math.max(0, this.state.pausedRemainingMs);
            return Math.max(0, this._durationFor(this.state.phase));
        }

        getSnapshot(at) {
            const atTime = finite(at, now());
            const duration = this.state.status === 'idle' || this.state.status === 'waiting'
                ? this._durationFor(this.state.phase)
                : positive(this.state.phaseDurationMs, this._durationFor(this.state.phase));
            const remainingMs = this._remaining(atTime);
            const isWaiting = this.state.status === 'waiting';
            return {
                version: 2,
                phase: this.state.phase,
                status: this.state.status,
                round: this.state.round,
                phaseStartedAt: this.state.phaseStartedAt,
                phaseEndsAt: this.state.phaseEndsAt,
                pausedRemainingMs: this.state.pausedRemainingMs,
                remainingMs,
                remainingSeconds: Math.ceil(remainingMs / 1000),
                durationMs: duration,
                progress: duration > 0 ? clamp(1 - remainingMs / duration, 0, 1) : 0,
                completedFocuses: this.state.completedFocuses,
                assignment: this.getAssignment(),
                settings: clone(this.settings),
                isWaiting,
                waitingFor: isWaiting ? this.state.phase : null,
                availableActions: {
                    start: this.state.status === 'idle' || isWaiting,
                    startPendingPhase: isWaiting,
                    pause: this.state.status === 'running',
                    resume: this.state.status === 'paused',
                    stop: this.state.status !== 'idle',
                    skip: true
                },
                timestamp: atTime
            };
        }

        getState() { return this.getSnapshot(); }

        _startTicker() {
            if (this.interval || this.recoveryInProgress) return;
            this.interval = global.setInterval(() => this._tick(), this.tickRate);
        }

        _stopTicker() {
            if (this.interval) global.clearInterval(this.interval);
            this.interval = null;
        }

        _tick() {
            if (this.state.status !== 'running' || this.recoveryInProgress) return;
            this._advanceExpired(now(), false);
            if (this.state.status === 'running') {
                this.persist();
                this._emit('tick', this.getSnapshot());
            }
        }

        _advanceExpired(at, recovering, limit) {
            const transitionLimit = Math.max(1, Math.floor(finite(limit, MAX_TRANSITIONS_PER_TICK)));
            let transitions = 0;
            while (this.state.status === 'running' && this.state.phaseEndsAt != null && at >= this.state.phaseEndsAt && transitions < transitionLimit) {
                const endedPhase = this.state.phase;
                const endedRound = this.state.round;
                const endedAt = this.state.phaseEndsAt;
                this._completePhase(endedPhase, endedRound, endedAt, recovering);
                transitions += 1;
                if (this.state.status !== 'running') break;
            }
            return transitions;
        }

        _isExpiredAt(at) {
            return this.state.status === 'running'
                && this.state.phaseEndsAt != null
                && at >= this.state.phaseEndsAt;
        }

        _cancelRecovery() {
            this.recoveryInProgress = false;
            this.recoveryTargetAt = null;
            if (this.recoveryTimer != null) global.clearTimeout(this.recoveryTimer);
            this.recoveryTimer = null;
        }

        _finishRecovery() {
            this._cancelRecovery();
            if (this.state.status !== 'running') {
                this.persist();
                return;
            }
            this._startTicker();
            this.persist();
            const snapshot = this.getSnapshot();
            this._emit('recovery', snapshot);
            this._emit('tick', snapshot);
        }

        _runRecoveryBatch() {
            if (!this.recoveryInProgress) return;
            if (this.state.status !== 'running') {
                this._finishRecovery();
                return;
            }
            const targetAt = this.recoveryTargetAt;
            this._advanceExpired(targetAt, true, RECOVERY_BATCH_SIZE);
            if (this._isExpiredAt(targetAt)) {
                this.recoveryTimer = global.setTimeout(() => {
                    this.recoveryTimer = null;
                    this._runRecoveryBatch();
                }, 0);
                return;
            }
            this._finishRecovery();
        }

        _recoverExpired(at) {
            if (this.state.status !== 'running') return this.getSnapshot();
            const targetAt = finite(at, now());
            if (this.recoveryInProgress) {
                this.recoveryTargetAt = Math.max(this.recoveryTargetAt || targetAt, targetAt);
                return this.getSnapshot();
            }
            this.recoveryInProgress = true;
            this.recoveryTargetAt = targetAt;
            this._stopTicker();
            this._runRecoveryBatch();
            return this.getSnapshot();
        }

        _completePhase(phase, round, endedAt, recovering) {
            const completedAt = endedAt || now();
            const snapshotBefore = this.getSnapshot(completedAt);
            this._emit('phaseComplete', { phase, round, at: completedAt, snapshot: snapshotBefore, recovering: Boolean(recovering) });
            if (!recovering && this.audio && typeof this.audio.playComplete === 'function') this.audio.playComplete();
            let nextPhase;
            let nextRound;
            if (phase === 'focus') {
                this.state.completedFocuses += 1;
                this._recordFocusSession(snapshotBefore, completedAt);
                nextPhase = this.state.completedFocuses % this.settings.longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
                nextRound = round;
            } else {
                nextPhase = 'focus';
                nextRound = round + 1;
            }
            this._emit('beforePhaseChange', {
                currentPhase: phase,
                nextPhase,
                nextRound,
                at: completedAt,
                recovering: Boolean(recovering)
            });
            const autoStart = this._shouldAutoStart(nextPhase);
            this._transitionTo(nextPhase, nextRound, completedAt, autoStart);
            if (autoStart && !recovering) this._queueStartCue();
        }

        _queueStartCue() {
            const token = ++this.transitionToken;
            if (this.soundHandoff) global.clearTimeout(this.soundHandoff);
            this.soundHandoff = global.setTimeout(() => {
                this.soundHandoff = null;
                if (token !== this.transitionToken || this.state.status !== 'running') return;
                if (this.audio && typeof this.audio.playStart === 'function') this.audio.playStart();
            }, 650);
        }

        _shouldAutoStart(phase) {
            return phase === 'focus' ? this.settings.autoStartFocus !== false : this.settings.autoStartBreak !== false;
        }

        _transitionTo(phase, round, transitionAt, autoStart) {
            const shouldStart = autoStart !== false;
            this.state.phase = phase;
            this.state.round = Math.max(1, Math.floor(round || 1));
            this.state.lastTransitionAt = transitionAt || now();
            this.state.phaseDurationMs = this._durationFor(phase);
            this.state.pausedRemainingMs = this.state.phaseDurationMs;
            if (shouldStart) {
                this.state.status = 'running';
                this.state.phaseStartedAt = this.state.lastTransitionAt;
                this.state.phaseEndsAt = this.state.phaseStartedAt + this.state.phaseDurationMs;
                this._startTicker();
            } else {
                this.transitionToken += 1;
                if (this.soundHandoff) { global.clearTimeout(this.soundHandoff); this.soundHandoff = null; }
                this.state.status = 'waiting';
                this.state.phaseStartedAt = null;
                this.state.phaseEndsAt = null;
                this._stopTicker();
            }
            // Persist at the boundary itself. A waiting state would otherwise
            // bypass the running-only persistence at the end of _tick().
            this.persist();
            const snapshot = this.getSnapshot();
            this._emit('phasechange', snapshot);
            if (!shouldStart) this._emit('waiting', snapshot);
            return snapshot;
        }

        start() {
            if (this.state.status === 'running') return this.getSnapshot();
            if (this.state.status === 'paused') return this.resume();
            this.state.phase = this.state.phase || 'focus';
            this.state.round = Math.max(1, this.state.round || 1);
            this.state.status = 'running';
            this.state.phaseStartedAt = now();
            this.state.phaseDurationMs = this._durationFor(this.state.phase);
            this.state.phaseEndsAt = this.state.phaseStartedAt + this.state.phaseDurationMs;
            this.state.pausedRemainingMs = this.state.phaseDurationMs;
            this.state.assignment = this.getAssignment();
            if (this.audio && typeof this.audio.unlock === 'function') this.audio.unlock();
            if (this.audio && typeof this.audio.playStart === 'function') this.audio.playStart();
            this._startTicker();
            this.persist();
            this._emit('start', this.getSnapshot());
            this._emit('tick', this.getSnapshot());
            return this.getSnapshot();
        }

        startPendingPhase() {
            if (this.state.status !== 'waiting') return this.getSnapshot();
            return this.start();
        }

        pause() {
            if (this.state.status !== 'running') return this.getSnapshot();
            this._cancelRecovery();
            this.transitionToken += 1;
            if (this.soundHandoff) { global.clearTimeout(this.soundHandoff); this.soundHandoff = null; }
            const at = now();
            this.state.pausedRemainingMs = this._remaining(at);
            this.state.status = 'paused';
            this.state.phaseEndsAt = null;
            this._stopTicker();
            this.persist();
            this._emit('pause', this.getSnapshot());
            return this.getSnapshot();
        }

        resume() {
            if (this.state.status !== 'paused') return this.state.status === 'idle' ? this.start() : this.getSnapshot();
            const at = now();
            this.state.status = 'running';
            this.state.phaseStartedAt = at;
            if (!this.state.phaseDurationMs) this.state.phaseDurationMs = this._durationFor(this.state.phase);
            this.state.phaseEndsAt = at + Math.max(0, this.state.pausedRemainingMs || this._durationFor(this.state.phase));
            if (this.audio && typeof this.audio.unlock === 'function') this.audio.unlock();
            this._startTicker();
            this.persist();
            this._emit('resume', this.getSnapshot());
            this._emit('tick', this.getSnapshot());
            return this.getSnapshot();
        }

        stop() {
            this._cancelRecovery();
            this._stopTicker();
            this.transitionToken += 1;
            if (this.soundHandoff) { global.clearTimeout(this.soundHandoff); this.soundHandoff = null; }
            this.state.phase = 'focus';
            this.state.status = 'idle';
            this.state.round = 1;
            this.state.phaseStartedAt = null;
            this.state.phaseEndsAt = null;
            this.state.phaseDurationMs = this._durationFor('focus');
            this.state.pausedRemainingMs = this.state.phaseDurationMs;
            this.state.completedFocuses = 0;
            this.state.assignment = null;
            if (this.audio && typeof this.audio.stop === 'function') this.audio.stop();
            this.persist();
            this._emit('stop', this.getSnapshot());
            this._emit('tick', this.getSnapshot());
            return this.getSnapshot();
        }

        reset() { return this.stop(); }

        skipPhase() {
            if (this.recoveryInProgress) return this.getSnapshot();
            const wasRunning = this.state.status === 'running';
            const wasPaused = this.state.status === 'paused';
            if (this.state.status === 'waiting') {
                const skippedPhase = this.state.phase;
                const nextPhase = skippedPhase === 'focus' ? 'shortBreak' : 'focus';
                const nextRound = skippedPhase === 'focus' ? this.state.round : this.state.round + 1;
                this._emit('beforePhaseChange', {
                    currentPhase: skippedPhase,
                    nextPhase,
                    nextRound,
                    at: now(),
                    recovering: false,
                    skipped: true
                });
                const autoStart = this._shouldAutoStart(nextPhase);
                const snapshot = this._transitionTo(nextPhase, nextRound, now(), autoStart);
                // The skipped phase never started, so it produces no completion
                // sound and no focus record. Only cue an actually started phase.
                if (autoStart) this._queueStartCue();
                this._emit('skip', snapshot);
                this._emit('tick', snapshot);
                return snapshot;
            }
            if (!wasRunning && !wasPaused) {
                this.state.phase = this.state.phase === 'focus' ? 'shortBreak' : 'focus';
                this.state.lastTransitionAt = now();
                this.state.status = 'idle';
                this.state.phaseStartedAt = null;
                this.state.phaseEndsAt = null;
                this.state.phaseDurationMs = this._durationFor(this.state.phase);
                this.state.pausedRemainingMs = this.state.phaseDurationMs;
                this.persist();
                const snapshot = this.getSnapshot();
                this._emit('phasechange', snapshot);
                this._emit('tick', snapshot);
                return snapshot;
            }
            if (wasPaused) {
                this.state.status = 'running';
                this.state.phaseStartedAt = now();
                this.state.phaseEndsAt = this.state.phaseStartedAt;
            }
            this._advanceExpired(now(), false);
            if (this.state.status === 'running') {
                this.persist();
                this._emit('tick', this.getSnapshot());
            }
            return this.getSnapshot();
        }

        recover() {
            if (this.state.status !== 'running') return this.getSnapshot();
            return this._recoverExpired(now());
        }

        persist() {
            const store = storage();
            if (!store) return false;
            const payload = {
                version: 2,
                settings: clone(this.settings),
                state: {
                    phase: this.state.phase,
                    status: this.state.status,
                    round: this.state.round,
                    phaseStartedAt: this.state.phaseStartedAt,
                    phaseEndsAt: this.state.phaseEndsAt,
                    phaseDurationMs: this.state.phaseDurationMs,
                    pausedRemainingMs: this.state.status === 'running' ? this._remaining(now()) : this.state.pausedRemainingMs,
                    completedFocuses: this.state.completedFocuses,
                    assignment: clone(this.state.assignment),
                    lastTransitionAt: this.state.lastTransitionAt
                },
                savedAt: now()
            };
            try {
                store.setItem(this.storageKey, JSON.stringify(payload));
                return true;
            } catch (error) {
                return false;
            }
        }

        clearPersistence() {
            const store = storage();
            if (store) {
                try { store.removeItem(this.storageKey); } catch (error) { /* ignore */ }
            }
        }

        getSessions() {
            const store = storage();
            if (!store) return [];
            try {
                const records = JSON.parse(store.getItem(this.sessionsKey) || '[]');
                return Array.isArray(records) ? records : [];
            } catch (error) { return []; }
        }

        _recordFocusSession(snapshot, completedAt) {
            const assignment = snapshot.assignment || this.getAssignment() || null;
            const durationSeconds = Math.max(0, Math.round(snapshot.durationMs / 1000));
            const startedAt = snapshot.phaseStartedAt ? new Date(snapshot.phaseStartedAt).toISOString() : new Date(completedAt - durationSeconds * 1000).toISOString();
            const record = {
                id: `focus-${completedAt}-${Math.random().toString(36).slice(2, 8)}`,
                timestamp: new Date(completedAt).toISOString(),
                startedAt,
                completedAt: new Date(completedAt).toISOString(),
                durationSeconds,
                durationMinutes: durationSeconds / 60,
                duration: durationSeconds / 60,
                round: snapshot.round,
                phase: 'focus',
                sessionType: 'work',
                label: assignment && assignment.label ? assignment.label : '自由专注',
                taskName: assignment && assignment.label ? assignment.label : '自由专注',
                projectId: assignment ? (assignment.projectId != null && assignment.projectId !== '' ? assignment.projectId : (assignment.projectIndex != null ? assignment.projectIndex : null)) : null,
                courseId: assignment ? (assignment.courseId != null && assignment.courseId !== '' ? assignment.courseId : (assignment.courseIndex != null ? assignment.courseIndex : null)) : null,
                videoId: assignment ? (assignment.videoId != null && assignment.videoId !== '' ? assignment.videoId : (assignment.videoIndex != null ? assignment.videoIndex : null)) : null,
                projectName: assignment && assignment.projectName || '',
                courseName: assignment && assignment.courseName || '',
                videoName: assignment && assignment.videoName || '',
                assignment: clone(assignment),
                source: 'timer'
            };
            const store = storage();
            if (store) {
                try {
                    const records = this.getSessions();
                    records.push(record);
                    store.setItem(this.sessionsKey, JSON.stringify(records.slice(-1000)));
                } catch (error) { /* quota errors should not stop cycling */ }
            }
            // The v2 storage facade is the source used by the profile page.
            // Prefer its normalizer so imported/exported records stay coherent.
            if (global.StudyFlow && global.StudyFlow.storage && typeof global.StudyFlow.storage.addFocusRecord === 'function') {
                try {
                    const stored = global.StudyFlow.storage.addFocusRecord(record);
                    if (stored && stored.id) record.id = stored.id;
                } catch (error) {
                    // Local session history remains available even if storage rejects a record.
                }
            }
            // A completed focus is also a unit of task progress.  Keep this
            // update in the storage facade so it is persisted atomically and
            // repeated recovery events remain idempotent by record id.
            if (global.StudyFlow && global.StudyFlow.storage && typeof global.StudyFlow.storage.recordTaskPomodoro === 'function') {
                try {
                    const task = global.StudyFlow.storage.recordTaskPomodoro(record);
                    if (task) {
                        record.taskProgress = {
                            estimatedPomodoros: task.estimatedPomodoros,
                            completedPomodoros: task.completedPomodoros,
                            remainingPomodoros: Math.max(0, Number(task.estimatedPomodoros || 1) - Number(task.completedPomodoros || 0)),
                            archived: Boolean(task.archived),
                            taskId: task.id
                        };
                    }
                } catch (error) {
                    if (global.console) global.console.warn('[FocusTimerEngine] task progress update failed', error);
                }
            }
            this._attachToProject(record);
            this._emit('sessionComplete', record);
            this._emit('complete', record);
            if (this.onSessionComplete) {
                try { this.onSessionComplete(record); } catch (error) { if (global.console) global.console.error('[FocusTimerEngine]', error); }
            }
        }

        _attachToProject(record) {
            const dataStorage = global.dataStorage;
            if (!dataStorage || typeof dataStorage.getProjects !== 'function') return;
            const assignment = record.assignment || {};
            const projects = dataStorage.getProjects();
            let project = null;
            if (assignment.projectId != null) project = projects.find((item) => String(item.id) === String(assignment.projectId));
            if (!project && assignment.projectIndex != null) project = projects[Number(assignment.projectIndex)];
            if (!project && /^\d+$/.test(String(assignment.projectId || ''))) project = projects[Number(assignment.projectId)];
            if (!project && assignment.projectName) project = projects.find((item) => item.name === assignment.projectName);
            if (!project) return;
            if (!Array.isArray(project.focusLogs)) project.focusLogs = [];
            project.focusLogs.push({
                id: record.id,
                duration: record.durationMinutes,
                durationSeconds: record.durationSeconds,
                timestamp: record.timestamp,
                round: record.round,
                sessionType: 'work',
                assignment: clone(assignment)
            });
            if (typeof dataStorage.saveData === 'function') dataStorage.saveData();
        }

        getStatus() {
            const snapshot = this.getSnapshot();
            return {
                isRunning: snapshot.status === 'running',
                isPaused: snapshot.status === 'paused',
                timeLeft: snapshot.remainingSeconds,
                sessionType: snapshot.phase,
                currentRound: snapshot.round,
                ...snapshot
            };
        }

        // Compatibility aliases for the original timer script.
        startFocus() { return this.start(); }
        startZenFocus() { return this.start(); }
        continueCycle() { return this.startPendingPhase(); }
        pauseTimer() { return this.pause(); }
        resumeTimer() { return this.resume(); }
        stopTimer() { return this.stop(); }
        skipBreak() { return this.skipPhase(); }
        startBreak() { return this.state.status === 'waiting' && this.state.phase !== 'focus' ? this.startPendingPhase() : this.skipPhase(); }
        saveTimerState() { return this.persist(); }
        loadTimerState() { return this.recover(); }
        syncTimerState() { return this.recover(); }
    }

    StudyFlow.FocusTimerEngine = FocusTimerEngine;
    if (!StudyFlow.timer) StudyFlow.timer = new FocusTimerEngine();
    global.focusTimer = StudyFlow.timer;
    global.FocusTimer = FocusTimerEngine;
})(typeof globalThis !== 'undefined' ? globalThis : window);
