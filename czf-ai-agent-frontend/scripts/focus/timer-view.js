(function (global) {
    'use strict';

    const StudyFlow = global.StudyFlow = global.StudyFlow || {};
    const byId = (id) => global.document && global.document.getElementById(id);

    function text(value, fallback) {
        const result = value == null ? '' : String(value).trim();
        return result || (fallback || '');
    }

    function escapeHtml(value) {
        const source = text(value);
        return source.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    }

    function formatTime(seconds) {
        const total = Math.max(0, Math.ceil(Number(seconds) || 0));
        const minutes = Math.floor(total / 60);
        const remainder = total % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
    }

    const PHASE_LABELS = {
        focus: '专注中',
        shortBreak: '短休息',
        longBreak: '长休息'
    };

    const PHASE_KICKERS = {
        focus: '下一阶段：短休息',
        shortBreak: '下一阶段：专注',
        longBreak: '下一阶段：专注'
    };

    class FocusTimerView {
        constructor(options) {
            const opts = options || {};
            this.engine = opts.engine || StudyFlow.timer || global.focusTimer;
            this.audio = opts.audio || StudyFlow.audio || global.focusAudio;
            this.soundscape = opts.soundscape || StudyFlow.soundscape || null;
            this.promptLibrary = opts.promptLibrary || StudyFlow.promptLibrary || null;
            this.initialized = false;
            this.unsubscribers = [];
            this.assignment = null;
            this.lastSnapshot = null;
            this.ringFrame = null;
            this.assignmentMeasureFrame = null;
            this.assignmentDisplayValue = '';
            this.assignmentExpanded = false;
            this.pendingProjectPresetId = null;
            this.reducedMotion = false;
            this.motionMedia = null;
        }

        init() {
            if (this.initialized || !this.engine || !global.document) return this;
            this.initialized = true;
            this.bindControls();
            this.bindAssignment();
            this.subscribe();
            this.bindMotionPreference();
            this._hydrateSettings();
            const restored = this.engine.getSnapshot();
            if (restored.status === 'idle') this.syncSettings(false);
            else this._hydrateRunningCycle(restored);
            if (restored.status === 'running') this._playSoundscapeIfEnabled();
            this.render(this.engine.getSnapshot());
            return this;
        }

        bindMotionPreference() {
            if (typeof global.matchMedia !== 'function') return;
            this.motionMedia = global.matchMedia('(prefers-reduced-motion: reduce)');
            this.reducedMotion = Boolean(this.motionMedia.matches);
            const onChange = (event) => {
                this.reducedMotion = Boolean(event.matches);
                if (this.reducedMotion) this.stopRingAnimation();
                else if (this.lastSnapshot?.status === 'running') this.startRingAnimation();
                this.renderRing(this.lastSnapshot);
            };
            if (typeof this.motionMedia.addEventListener === 'function') this.motionMedia.addEventListener('change', onChange);
            else if (typeof this.motionMedia.addListener === 'function') this.motionMedia.addListener(onChange);
            this.unsubscribers.push(() => {
                if (typeof this.motionMedia?.removeEventListener === 'function') this.motionMedia.removeEventListener('change', onChange);
                else if (typeof this.motionMedia?.removeListener === 'function') this.motionMedia.removeListener(onChange);
                this.stopRingAnimation();
            });
        }

        _hydrateSettings() {
            const settings = StudyFlow.storage?.getSettings?.();
            if (!settings) return;
            const set = (id, value) => { const element = byId(id); if (element && value != null) element.value = String(value); };
            set('work-time', settings.workTime);
            set('work-unit', settings.workUnit || 'minutes');
            set('break-time', settings.breakTime);
            set('break-unit', settings.breakUnit || 'minutes');
            set('long-break-time', settings.longBreakTime);
            set('long-break-unit', settings.longBreakUnit || 'minutes');
            set('long-break-interval', settings.longBreakInterval);
            const autoStartFocus = byId('auto-start-focus');
            const autoStartBreak = byId('auto-start-break');
            if (autoStartFocus) autoStartFocus.checked = settings.autoStartFocus !== false;
            if (autoStartBreak) autoStartBreak.checked = settings.autoStartBreak !== false;
            if (settings.soundscape && this.soundscape?.configure) this.soundscape.configure(settings.soundscape, { persist: false });
            if (settings.promptAudio && this.promptLibrary?.applyConfig) this.promptLibrary.applyConfig(settings.promptAudio);
        }

        _hydrateRunningCycle(snapshot) {
            const settings = snapshot?.settings || {};
            const appSettings = StudyFlow.storage?.getSettings?.() || {};
            const set = (id, value) => { const element = byId(id); if (element && value != null) element.value = String(value); };
            const unitValue = (milliseconds, unit) => unit === 'seconds'
                ? Math.max(1, Math.round(Number(milliseconds || 0) / 1000))
                : Math.max(1, Math.round(Number(milliseconds || 0) / 60000));
            const workUnit = appSettings.workUnit || 'minutes';
            const breakUnit = appSettings.breakUnit || 'minutes';
            const longBreakUnit = appSettings.longBreakUnit || 'minutes';
            set('work-unit', workUnit);
            set('break-unit', breakUnit);
            set('long-break-unit', longBreakUnit);
            set('work-time', unitValue(settings.focusMs, workUnit));
            set('break-time', unitValue(settings.shortBreakMs, breakUnit));
            set('long-break-time', unitValue(settings.longBreakMs, longBreakUnit));
            set('long-break-interval', settings.longBreakInterval);
            if (byId('auto-start-focus')) byId('auto-start-focus').checked = settings.autoStartFocus !== false;
            if (byId('auto-start-break')) byId('auto-start-break').checked = settings.autoStartBreak !== false;
        }

        bindControls() {
            byId('start-timer')?.addEventListener('click', () => this.engine.start());
            byId('pause-timer')?.addEventListener('click', () => this.engine.pause());
            byId('resume-timer')?.addEventListener('click', () => this.engine.resume());
            byId('stop-timer')?.addEventListener('click', () => this.engine.stop());
            byId('skip-phase')?.addEventListener('click', () => this.engine.skipPhase());
        }

        _callSoundscape(method) {
            if (!this.soundscape || typeof this.soundscape[method] !== 'function') return;
            try {
                const result = this.soundscape[method]();
                if (result && typeof result.catch === 'function') result.catch(() => undefined);
            } catch (_) {
                // Soundscape failures must never interrupt timer controls.
            }
        }

        _playSoundscapeIfEnabled() {
            if (StudyFlow.storage?.getSettings?.().soundscapePaused === true) return;
            this._callSoundscape('play');
        }

        _readAssignment() {
            const label = text(byId('focus-label')?.value);
            const project = byId('focus-project');
            const course = byId('focus-course');
            const video = byId('focus-video');
            const selected = (select) => {
                if (!select || !select.value) return null;
                const option = select.options && select.options[select.selectedIndex];
                return { id: select.value, name: text(option?.textContent) };
            };
            const projectValue = selected(project);
            const courseValue = selected(course);
            const videoValue = selected(video);
            return {
                label,
                projectId: projectValue?.id || null,
                projectName: projectValue?.name || '',
                courseId: courseValue?.id || null,
                courseName: courseValue?.name || '',
                videoId: videoValue?.id || null,
                videoName: videoValue?.name || ''
            };
        }

        bindAssignment() {
            const project = byId('focus-project');
            ['focus-label', 'focus-project', 'focus-course', 'focus-video'].forEach((id) => {
                byId(id)?.addEventListener('input', () => this.updateAssignment());
                byId(id)?.addEventListener('change', () => this.updateAssignment());
            });
            project?.addEventListener('change', () => this.handleProjectPreference());
            this.assignment = this._readAssignment();
            this.engine.assignmentProvider = () => this._readAssignment();
            const toggle = byId('current-focus-assignment-toggle');
            toggle?.addEventListener('click', () => {
                const summary = byId('current-focus-assignment');
                if (!summary?.classList.contains('is-collapsible')) return;
                this.assignmentExpanded = !this.assignmentExpanded;
                summary.classList.toggle('is-expanded', this.assignmentExpanded);
                this._renderAssignmentToggle();
            });
            const onResize = () => this._scheduleAssignmentOverflowCheck();
            global.addEventListener?.('resize', onResize, { passive: true });
            this.unsubscribers.push(() => global.removeEventListener?.('resize', onResize));
            const onRoute = (event) => {
                if (event?.detail?.view === 'focus') this._scheduleAssignmentOverflowCheck();
            };
            const onVisibility = () => {
                if (!global.document?.hidden) this._scheduleAssignmentOverflowCheck();
            };
            global.document?.addEventListener?.('studyflow:route', onRoute);
            global.document?.addEventListener?.('visibilitychange', onVisibility);
            this.unsubscribers.push(() => {
                global.document?.removeEventListener?.('studyflow:route', onRoute);
                global.document?.removeEventListener?.('visibilitychange', onVisibility);
            });
        }

        updateAssignment() {
            this.assignment = this._readAssignment();
            this.engine.setAssignment(this.assignment);
            this.renderAssignment(this.assignment);
        }

        _selectedProjectPreset() {
            const projectId = byId('focus-project')?.value;
            if (!projectId) return null;
            const project = StudyFlow.storage?.getProject?.(projectId);
            const presetId = text(project?.preferredFocusPresetId);
            if (!presetId) return null;
            const preset = StudyFlow.presets?.get?.(presetId)
                || StudyFlow.presets?.list?.find?.((item) => String(item.id) === presetId);
            return preset ? { id: presetId, preset } : null;
        }

        _applyProjectPreset(preference, notify) {
            if (!preference || !StudyFlow.presets?.apply) return false;
            StudyFlow.presets.apply(preference.preset, { notify: false });
            this.pendingProjectPresetId = null;
            if (notify !== false) this._notify(`已启用项目偏好“${preference.preset.name}”`, 'success');
            return true;
        }

        handleProjectPreference() {
            const preference = this._selectedProjectPreset();
            if (!preference) {
                this.pendingProjectPresetId = null;
                return false;
            }
            const snapshot = this.engine.getSnapshot();
            if (snapshot.status === 'idle' || (snapshot.status === 'waiting' && snapshot.phase === 'focus')) {
                return this._applyProjectPreset(preference, true);
            }
            this.pendingProjectPresetId = preference.id;
            this._notify(`“${preference.preset.name}”将在下一轮专注前启用`, 'info');
            return true;
        }

        applyPendingProjectPreset() {
            if (!this.pendingProjectPresetId) return false;
            const preference = this._selectedProjectPreset();
            if (!preference || preference.id !== this.pendingProjectPresetId) {
                this.pendingProjectPresetId = null;
                return false;
            }
            return this._applyProjectPreset(preference, false);
        }

        subscribe() {
            ['tick', 'start', 'pause', 'resume', 'stop', 'phasechange', 'waiting', 'recovery', 'settingschange', 'assignmentchange'].forEach((name) => {
                this.unsubscribers.push(this.engine.on(name, (snapshot) => this.render(snapshot && snapshot.phase ? snapshot : this.engine.getSnapshot())));
            });
            ['start', 'resume', 'recovery'].forEach((name) => {
                this.unsubscribers.push(this.engine.on(name, () => this._playSoundscapeIfEnabled()));
            });
            this.unsubscribers.push(this.engine.on('pause', () => this._callSoundscape('pause')));
            this.unsubscribers.push(this.engine.on('beforePhaseChange', (transition) => {
                if (transition?.nextPhase === 'focus') this.applyPendingProjectPreset();
            }));
            this.unsubscribers.push(this.engine.on('stop', () => {
                this._callSoundscape('stop');
                this.applyPendingProjectPreset();
            }));
            this.unsubscribers.push(this.engine.on('sessionComplete', () => {
                global.dispatchEvent?.(new CustomEvent('studyflow:focus-record-create'));
                global.dispatchEvent?.(new Event('studyflow:data-changed'));
                global.document?.dispatchEvent?.(new CustomEvent('studyflow:focus-record-create'));
                global.document?.dispatchEvent?.(new Event('studyflow:data-changed'));
            }));
        }

        syncSettings(notify) {
            const autoStartFocus = byId('auto-start-focus')?.checked !== false;
            const autoStartBreak = byId('auto-start-break')?.checked !== false;
            const workUnit = byId('work-unit')?.value || 'minutes';
            const breakUnit = byId('break-unit')?.value || 'minutes';
            const longBreakUnit = byId('long-break-unit')?.value || 'minutes';
            const duration = (value, unit) => Math.max(1, Number(value) || 1) * (unit === 'seconds' ? 1000 : 60000);
            const snapshot = this.engine.configure({
                focusMs: duration(byId('work-time')?.value, workUnit),
                shortBreakMs: duration(byId('break-time')?.value, breakUnit),
                longBreakMs: duration(byId('long-break-time')?.value, longBreakUnit),
                longBreakInterval: Math.max(2, Math.min(12, Number(byId('long-break-interval')?.value) || 4)),
                autoStartFocus,
                autoStartBreak
            });
            const settings = snapshot.settings || {};
            const toMinutesOrSeconds = (milliseconds, unit) => unit === 'seconds' ? Math.max(1, Math.round(milliseconds / 1000)) : Math.max(1, Math.round(milliseconds / 60000));
            StudyFlow.storage?.updateSettings?.({
                workTime: toMinutesOrSeconds(settings.focusMs, workUnit), workUnit,
                breakTime: toMinutesOrSeconds(settings.shortBreakMs, breakUnit), breakUnit,
                longBreakTime: toMinutesOrSeconds(settings.longBreakMs, longBreakUnit), longBreakUnit,
                longBreakInterval: settings.longBreakInterval,
                autoStartFocus: settings.autoStartFocus !== false,
                autoStartBreak: settings.autoStartBreak !== false
            });
            if (notify !== false) this._notify('计时设置已更新', 'success');
            this.render(snapshot);
            return snapshot;
        }

        _notify(message, type) {
            if (StudyFlow.ui?.toast) StudyFlow.ui.toast(message, type);
            else if (global.uiManager?.showNotification) global.uiManager.showNotification(message, type);
        }

        render(snapshot) {
            if (!snapshot) return;
            this.lastSnapshot = snapshot;
            const phase = snapshot.phase || 'focus';
            const status = snapshot.status || 'idle';
            const phaseLabel = byId('timer-phase-label');
            const display = byId('timer-display');
            const round = byId('timer-round-label');
            const kicker = byId('timer-cycle-status');
            const ring = byId('timer-progress-ring');
            if (phaseLabel) phaseLabel.textContent = status === 'idle' ? '准备专注' : status === 'waiting' ? (phase === 'focus' ? '等待开始专注' : '等待开始休息') : PHASE_LABELS[phase] || '专注';
            if (display) {
                display.textContent = formatTime(snapshot.remainingSeconds);
                display.dataset.phase = phase;
            }
            if (round) round.textContent = `第 ${snapshot.round || 1} 轮`;
            if (kicker) kicker.textContent = status === 'paused' ? '已暂停' : status === 'waiting' ? (phase === 'focus' ? '准备好后，开始下一轮' : '休息一下，再继续出发') : (PHASE_KICKERS[phase] || '循环进行中');
            if (ring) this.renderRing(snapshot);
            this.renderDots(snapshot);
            this.renderAssignment(snapshot.assignment || this.assignment || this._readAssignment());
            this.renderButtons(status, phase);
            this.renderCycleNote(snapshot);
            this.renderStream(snapshot);
            const root = byId('focus-timer-root');
            if (root) { root.dataset.phase = phase; root.dataset.status = status; }
            const titleSuffix = document.body?.classList.contains('obs-mode') ? '沉浸模式' : '番茄自习室';
            document.title = status === 'running' || status === 'paused' || status === 'waiting' ? `${formatTime(snapshot.remainingSeconds)} · ${PHASE_LABELS[phase] || '专注'} | ${titleSuffix}` : `番茄自习室${titleSuffix === '沉浸模式' ? ' · 沉浸模式' : ''}`;
        }

        renderRing(snapshot) {
            const ring = byId('timer-progress-ring');
            if (!ring || !snapshot) return;
            const progress = this.ringProgress(snapshot);
            ring.style.setProperty('--progress', `${progress * 360}deg`);
            const streamRing = byId('stream-progress-ring');
            streamRing?.style.setProperty('--stream-progress', `${progress * 360}deg`);
            streamRing?.style.setProperty('--stream-progress-pct', `${progress * 100}%`);
            if (snapshot.status === 'running' && !this.reducedMotion) this.startRingAnimation();
            else this.stopRingAnimation();
        }

        ringProgress(snapshot, timestamp) {
            if (!snapshot) return 0;
            if (snapshot.status !== 'running' || !snapshot.phaseEndsAt || !snapshot.durationMs) {
                return Math.max(0, Math.min(1, Number(snapshot.progress) || 0));
            }
            const currentTime = timestamp == null ? Date.now() : timestamp;
            const remaining = Math.max(0, Number(snapshot.phaseEndsAt) - currentTime);
            return Math.max(0, Math.min(1, 1 - remaining / Number(snapshot.durationMs)));
        }

        requestRingFrame(callback) {
            if (typeof global.requestAnimationFrame === 'function') return global.requestAnimationFrame(callback);
            return global.setTimeout(() => callback(Date.now()), 50);
        }

        cancelRingFrame(frame) {
            if (frame == null) return;
            if (typeof global.cancelAnimationFrame === 'function') global.cancelAnimationFrame(frame);
            else global.clearTimeout(frame);
        }

        startRingAnimation() {
            if (this.ringFrame != null || this.reducedMotion || this.lastSnapshot?.status !== 'running') return;
            const paint = (timestamp) => {
                this.ringFrame = null;
                if (this.reducedMotion || this.lastSnapshot?.status !== 'running') {
                    this.renderRing(this.lastSnapshot);
                    return;
                }
                const degrees = this.ringProgress(this.lastSnapshot, Date.now()) * 360;
                const ring = byId('timer-progress-ring');
                if (ring) ring.style.setProperty('--progress', `${degrees}deg`);
                const streamRing = byId('stream-progress-ring');
                streamRing?.style.setProperty('--stream-progress', `${degrees}deg`);
                streamRing?.style.setProperty('--stream-progress-pct', `${degrees / 3.6}%`);
                this.ringFrame = this.requestRingFrame(paint);
            };
            this.ringFrame = this.requestRingFrame(paint);
        }

        stopRingAnimation() {
            if (this.ringFrame != null) this.cancelRingFrame(this.ringFrame);
            this.ringFrame = null;
        }

        renderButtons(status, phase) {
            const start = byId('start-timer');
            const pause = byId('pause-timer');
            const resume = byId('resume-timer');
            start?.classList.toggle('hidden', status !== 'idle' && status !== 'waiting');
            pause?.classList.toggle('hidden', status !== 'running');
            resume?.classList.toggle('hidden', status !== 'paused');
            if (start) {
                const label = status === 'waiting' ? (phase === 'focus' ? '开始专注' : '开始休息') : '开始专注';
                start.setAttribute('aria-label', label);
                start.title = label;
                const span = start.querySelector('span');
                if (span) span.textContent = label;
            }
            if (pause) pause.setAttribute('aria-label', '暂停');
            if (resume) resume.setAttribute('aria-label', '继续');
            const streamStart = byId('stream-start-timer');
            const streamPause = byId('stream-pause-timer');
            const streamResume = byId('stream-resume-timer');
            streamStart?.classList.toggle('hidden', status !== 'idle' && status !== 'waiting');
            streamPause?.classList.toggle('hidden', status !== 'running');
            streamResume?.classList.toggle('hidden', status !== 'paused');
            if (streamStart) {
                const label = status === 'waiting' ? (phase === 'focus' ? '开始专注' : '开始休息') : '开始专注';
                streamStart.setAttribute('aria-label', label);
                streamStart.title = label;
                const span = streamStart.querySelector('span');
                if (span) span.textContent = label;
            }
        }

        renderCycleNote(snapshot) {
            const note = byId('auto-cycle-note');
            const label = note?.querySelector('span');
            if (!label) return;
            const focus = snapshot.settings?.autoStartFocus !== false;
            const rest = snapshot.settings?.autoStartBreak !== false;
            if (focus && rest) label.textContent = '专注与休息均自动衔接';
            else if (rest) label.textContent = '专注后自动休息，休息后手动继续';
            else if (focus) label.textContent = '专注后手动休息，休息后自动继续';
            else label.textContent = '每个阶段结束后由你决定何时继续';
        }

        renderDots(snapshot) {
            const container = byId('timer-round-dots');
            if (!container) return;
            const interval = Math.max(2, Number(snapshot.settings?.longBreakInterval) || 4);
            const current = Math.min(interval, Math.max(1, Number(snapshot.round) || 1));
            container.innerHTML = Array.from({ length: interval }, (_, index) => {
                const number = index + 1;
                const classes = ['round-dot'];
                if (number < current || (number === interval && snapshot.completedFocuses >= interval)) classes.push('done');
                if (number === current) classes.push('current');
                return `<span class="${classes.join(' ')}" aria-label="第 ${number} 轮"></span>`;
            }).join('');
        }

        renderAssignment(assignment) {
            const summary = byId('current-focus-assignment');
            if (!summary) return;
            const label = text(assignment?.label);
            const hierarchy = [assignment?.projectName, assignment?.courseName, assignment?.videoName].filter(Boolean).join(' · ');
            const value = label || hierarchy || '自由专注';
            const copy = byId('current-focus-assignment-text') || summary.querySelector('.assignment-summary-copy');
            if (!copy) return;
            if (this.assignmentDisplayValue !== value) {
                this.assignmentDisplayValue = value;
                this.assignmentExpanded = false;
                summary.classList.remove('is-collapsible', 'is-expanded');
                copy.textContent = value;
                this._renderAssignmentToggle();
                this._scheduleAssignmentOverflowCheck();
            }
        }

        _renderAssignmentToggle() {
            const summary = byId('current-focus-assignment');
            const toggle = byId('current-focus-assignment-toggle');
            if (!summary || !toggle) return;
            const collapsible = summary.classList.contains('is-collapsible');
            if (!collapsible) this.assignmentExpanded = false;
            summary.classList.toggle('is-expanded', collapsible && this.assignmentExpanded);
            toggle.hidden = !collapsible;
            toggle.setAttribute('aria-expanded', String(collapsible && this.assignmentExpanded));
            const label = toggle.querySelector('span');
            if (label) label.textContent = this.assignmentExpanded ? '收起' : '展开';
        }

        _scheduleAssignmentOverflowCheck() {
            if (this.assignmentMeasureFrame != null) {
                if (typeof global.cancelAnimationFrame === 'function') global.cancelAnimationFrame(this.assignmentMeasureFrame);
                else global.clearTimeout(this.assignmentMeasureFrame);
            }
            const measure = () => {
                this.assignmentMeasureFrame = null;
                const summary = byId('current-focus-assignment');
                const copy = byId('current-focus-assignment-text');
                if (!summary || !copy) return;
                if (copy.getClientRects?.().length === 0 || copy.clientWidth <= 0) return;
                summary.classList.remove('is-collapsible');
                const style = typeof global.getComputedStyle === 'function' ? global.getComputedStyle(copy) : null;
                const fontSize = style ? Number.parseFloat(style.fontSize) || 12 : 12;
                const lineHeight = style ? Number.parseFloat(style.lineHeight) || fontSize * 1.5 : fontSize * 1.5;
                const collapsible = copy.scrollHeight > lineHeight * 3 + 1;
                summary.classList.toggle('is-collapsible', collapsible);
                if (!collapsible) this.assignmentExpanded = false;
                this._renderAssignmentToggle();
            };
            this.assignmentMeasureFrame = typeof global.requestAnimationFrame === 'function'
                ? global.requestAnimationFrame(measure)
                : global.setTimeout(measure, 0);
        }

        renderStream(snapshot) {
            if (!snapshot) return;
            const phase = snapshot.phase || 'focus';
            const status = snapshot.status || 'idle';
            const stream = byId('stream-view');
            const phaseEl = byId('stream-phase');
            const timeEl = byId('stream-time');
            const statusEl = byId('stream-status');
            const labelEl = byId('stream-label');
            const roundEl = byId('stream-round');
            if (stream) {
                stream.dataset.phase = phase;
                stream.dataset.status = status;
            }
            if (phaseEl) phaseEl.textContent = status === 'idle' ? '准备专注' : status === 'waiting' ? (phase === 'focus' ? '等待开始专注' : '等待开始休息') : (PHASE_LABELS[phase] || '专注');
            if (timeEl) timeEl.textContent = formatTime(snapshot.remainingSeconds);
            if (statusEl) statusEl.textContent = status === 'running' ? '计时进行中' : status === 'paused' ? '已暂停' : status === 'waiting' ? '等待继续' : '等待开始';
            if (labelEl) {
                const assignment = snapshot.assignment || {};
                labelEl.textContent = text(assignment.label || assignment.videoName || assignment.courseName || assignment.projectName, '自由专注');
            }
            if (roundEl) roundEl.textContent = `第 ${snapshot.round || 1} 轮 · 今日 ${this._todayCount()} 枚`;
            const progress = this.ringProgress(snapshot);
            const streamRing = byId('stream-progress-ring');
            streamRing?.style.setProperty('--stream-progress', `${progress * 360}deg`);
            streamRing?.style.setProperty('--stream-progress-pct', `${progress * 100}%`);
        }

        _todayCount() {
            const records = StudyFlow.storage?.getFocusRecords?.() || this.engine.getSessions?.() || [];
            const today = new Date(); today.setHours(0, 0, 0, 0);
            return records.filter((record) => new Date(record.completedAt || record.timestamp || record.startedAt || 0) >= today && (record.phase === 'focus' || record.sessionType === 'work')).length;
        }

    }

    StudyFlow.FocusTimerView = FocusTimerView;
    if (!StudyFlow.timerView) StudyFlow.timerView = new FocusTimerView();
    global.timerView = StudyFlow.timerView;

    if (global.document) {
        const init = () => StudyFlow.timerView.init();
        if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', init, { once: true });
        else init();
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
