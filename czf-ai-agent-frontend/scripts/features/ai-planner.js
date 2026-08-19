(function (global) {
  'use strict';

  const root = global.StudyFlow = global.StudyFlow || {};
  const U = root.utils || {};
  const byId = (id) => document.getElementById(id);
  const trim = (value) => String(value == null ? '' : value).trim();
  const escape = (value) => typeof U.escapeHTML === 'function'
    ? U.escapeHTML(value)
    : trim(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  const EXAMPLE_RESPONSE = {
    requestId: 'example-preview',
    chatId: 'example-preview',
    pomodoroMinutes: 25,
    plan: {
      goal: '完成 Spring AI 结构化输出接口并理解整条调用链',
      assumptions: ['已有可注入的 ChatClient', '本轮先完成直接拆解，不接入登录与云同步'],
      tasks: [
        { title: '定义 HTTP 输入与输出', action: '创建请求、响应 DTO，并写出一份可用于联调的 JSON 示例。', output: '4 个 DTO 与一份请求响应样例', completionCriteria: 'pomodoroMinutes 有 5 到 120 的校验，前后端字段名完全一致', estimatedMinutes: 25, pomodoroCount: 1 },
        { title: '接通结构化模型调用', action: '把番茄时长和目标注入提示词，使用 entity 映射为 TomatoTaskPlan。', output: '可返回结构化计划的应用服务方法', completionCriteria: '返回的任务均有动作、产出、完成标准和分钟数', estimatedMinutes: 50, pomodoroCount: 2 },
        { title: '补齐接口与异常边界', action: '新增 Controller，并分别处理参数错误、模型不可用和模型格式异常。', output: '一个稳定的 POST 接口与三类错误响应', completionCriteria: 'MockMvc 覆盖成功和错误分支，测试不调用真实模型', estimatedMinutes: 50, pomodoroCount: 2 }
      ],
      completionSign: '前端能提交自定义番茄时长，后端返回结构化任务，并能把结果保存到任务空间。',
      firstAction: '先在纸上写出请求 JSON 和响应 JSON，各保留一个最小成功示例。'
    }
  };

  function formatError(error) {
    if (error?.code === 'INVALID_RESPONSE') return { title: '返回内容还不能使用', message: error.message, icon: 'braces', action: '重新生成' };
    if (error?.code === 'REQUEST_TIMEOUT') return { title: '这次思考得有点久', message: '请求已超时。可以缩短目标描述后重试，或检查模型服务状态。', icon: 'clock-alert', action: '重试请求' };
    if (error?.status === 400) return { title: '请求参数需要调整', message: error.message || '请检查目标和番茄时长。', icon: 'circle-alert', action: '返回修改' };
    if (error?.status === 503 || error?.status === 502) return { title: 'AI 服务暂时不可用', message: error.message || '后端已收到请求，但模型服务没有正常响应。', icon: 'cloud-off', action: '稍后重试' };
    return { title: '还没有连接到 AI 后端', message: error?.message || '请确认 Spring Boot 已在本机 8123 端口启动，并检查联调地址。', icon: 'unplug', action: '测试连接' };
  }

  const Planner = {
    initialized: false,
    currentPlan: null,
    currentEnvelope: null,
    lastWasExample: false,
    importMode: 'existing',
    selectedPresetId: '',
    presetExpanded: false,

    init() {
      if (this.initialized) return this;
      this.initialized = true;
      const baseInput = byId('ai-api-base-url');
      if (baseInput && root.tomatoApi) baseInput.value = root.tomatoApi.getBaseUrl();
      this.bindInputs();
      this.bindResultActions();
      this.bindImportDialog();
      this.updateGoalCount();
      this.renderPresetOptions();
      global.addEventListener('studyflow:presets-changed', () => {
        this.renderPresetOptions();
        const dialog = byId('ai-import-dialog');
        if (dialog?.open) this.populateProjectPresetSelect();
      });
      return this;
    },

    bindInputs() {
      byId('ai-planner-form')?.addEventListener('submit', (event) => { event.preventDefault(); this.generate(); });
      byId('ai-goal')?.addEventListener('input', () => this.updateGoalCount());
      byId('ai-api-base-url')?.addEventListener('change', (event) => {
        if (root.tomatoApi) event.target.value = root.tomatoApi.setBaseUrl(event.target.value);
        this.setConnection('unknown', '未检测');
      });
      byId('ai-preset-show-more')?.addEventListener('click', () => {
        this.presetExpanded = !this.presetExpanded;
        this.renderPresetOptions();
      });
      byId('ai-test-connection')?.addEventListener('click', () => this.testConnection());
      byId('ai-show-example')?.addEventListener('click', () => this.showExample());
    },

    bindResultActions() {
      byId('ai-regenerate')?.addEventListener('click', () => this.generate());
      byId('ai-copy-plan')?.addEventListener('click', () => this.copyPlan());
      byId('ai-import-plan')?.addEventListener('click', () => this.openImportDialog());
    },

    bindImportDialog() {
      document.querySelectorAll('[data-ai-import-mode]').forEach((button) => button.addEventListener('click', () => this.setImportMode(button.dataset.aiImportMode)));
      byId('ai-import-preferred-preset')?.addEventListener('change', (event) => this.renderProjectPresetPreview(event.target.value));
      byId('ai-import-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        if (event.submitter?.value !== 'default') { this.closeImportDialog(); return; }
        this.importPlan();
      });
    },

    render() {
      this.updateGoalCount();
      this.renderPresetOptions();
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    updateGoalCount() {
      const value = trim(byId('ai-goal')?.value);
      if (byId('ai-goal-count')) byId('ai-goal-count').textContent = String(value.length);
    },

    presets() {
      return root.presets && Array.isArray(root.presets.list) ? root.presets.list : [];
    },

    presetById(id) {
      if (root.presets && typeof root.presets.get === 'function') return root.presets.get(id);
      return this.presets().find((preset) => String(preset.id) === String(id || '')) || null;
    },

    presetMinutes(preset) {
      if (!preset || preset.workUnit === 'seconds') return null;
      const minutes = Number(preset.workTime);
      return Number.isInteger(minutes) && minutes >= 5 && minutes <= 120 ? minutes : null;
    },

    presetTimeSummary(preset) {
      const compact = (value, unit) => `${value}${unit === 'seconds' ? '秒' : '分'}`;
      return `${compact(preset.workTime, preset.workUnit)} 专注 · ${compact(preset.breakTime, preset.breakUnit)} 短休息`;
    },

    presetUnavailableReason(preset) {
      if (preset?.workUnit === 'seconds') return '秒级测试方案，不适用于 AI 拆解';
      return '专注时长需在 5–120 分钟之间';
    },

    renderPresetOptions() {
      const list = byId('ai-preset-list');
      if (!list) return;
      const presets = this.presets();
      let selected = this.presetById(this.selectedPresetId || byId('ai-selected-preset-id')?.value);
      if (!selected || this.presetMinutes(selected) == null) {
        const activeId = root.storage?.getSettings?.()?.activeFocusPresetId;
        selected = presets.find((preset) => preset.id === activeId && this.presetMinutes(preset) != null)
          || presets.find((preset) => preset.id === 'classic' && this.presetMinutes(preset) != null)
          || presets.find((preset) => this.presetMinutes(preset) != null)
          || null;
      }
      this.selectedPresetId = selected?.id || '';
      if (byId('ai-selected-preset-id')) byId('ai-selected-preset-id').value = this.selectedPresetId;
      list.innerHTML = presets.map((preset, index) => {
        const available = this.presetMinutes(preset) != null;
        const active = available && preset.id === this.selectedPresetId;
        const hidden = !this.presetExpanded && index >= 4;
        return `<button type="button" class="ai-preset-option${active ? ' active' : ''}" data-ai-preset="${escape(preset.id)}" role="radio" aria-checked="${String(active)}"${hidden ? ' hidden' : ''}${available ? '' : ' disabled'}><span class="ai-preset-option-icon"><i data-lucide="${escape(preset.icon || 'timer')}"></i></span><span class="ai-preset-option-copy"><strong>${escape(preset.name)}</strong><small>${escape(this.presetTimeSummary(preset))}</small><em>${escape(available ? preset.scene : this.presetUnavailableReason(preset))}</em></span><i class="ai-preset-option-check" data-lucide="${available ? 'check' : 'ban'}"></i></button>`;
      }).join('');
      list.querySelectorAll('[data-ai-preset]:not(:disabled)').forEach((button) => button.addEventListener('click', () => {
        this.selectedPresetId = button.dataset.aiPreset;
        if (byId('ai-selected-preset-id')) byId('ai-selected-preset-id').value = this.selectedPresetId;
        this.renderPresetOptions();
      }));
      const summary = byId('ai-preset-selection-summary');
      if (summary) summary.textContent = selected ? `${selected.name} · 每枚 ${this.presetMinutes(selected)} 分钟` : '没有可用于拆解的方案';
      const showMore = byId('ai-preset-show-more');
      if (showMore) {
        showMore.hidden = presets.length <= 4;
        showMore.setAttribute('aria-expanded', String(this.presetExpanded));
        const label = showMore.querySelector('span');
        if (label) label.textContent = this.presetExpanded ? '收起方案' : `查看全部 ${presets.length} 个方案`;
      }
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    setConnection(status, label) {
      const badge = byId('ai-connection-badge');
      if (!badge) return;
      badge.dataset.status = status;
      const copy = badge.querySelector('span');
      if (copy) copy.textContent = label;
    },

    async testConnection() {
      const button = byId('ai-test-connection');
      const input = byId('ai-api-base-url');
      if (root.tomatoApi && input) input.value = root.tomatoApi.setBaseUrl(input.value);
      this.setConnection('loading', '检测中');
      if (button) button.disabled = true;
      try {
        if (!root.tomatoApi) throw new Error('AI 请求模块未加载');
        await root.tomatoApi.health();
        this.setConnection('online', '后端已连接');
        root.ui?.toast?.('本地后端连接正常', 'success');
      } catch (error) {
        this.setConnection('offline', '连接失败');
        root.ui?.toast?.(error.message || '无法连接本地后端', 'error');
      } finally {
        if (button) button.disabled = false;
      }
    },

    input() {
      const goal = trim(byId('ai-goal')?.value);
      const context = trim(byId('ai-context')?.value);
      const preset = this.presetById(this.selectedPresetId);
      const pomodoroMinutes = this.presetMinutes(preset);
      if (!goal) throw new Error('请先写下想要推进的目标');
      if (pomodoroMinutes == null) throw new Error('请选择一个专注时长为 5 到 120 分钟的方案');
      return { goal, context, pomodoroMinutes, chatId: root.tomatoApi?.createChatId?.() };
    },

    async generate() {
      let input;
      try { input = this.input(); }
      catch (error) { root.ui?.toast?.(error.message, 'error'); return; }
      const baseInput = byId('ai-api-base-url');
      if (root.tomatoApi && baseInput) baseInput.value = root.tomatoApi.setBaseUrl(baseInput.value);
      this.showLoading(input.goal);
      this.setGenerating(true);
      try {
        if (!root.tomatoApi) throw new Error('AI 请求模块未加载');
        const response = await root.tomatoApi.createPlan(input);
        const normalized = this.normalizeResponse(response, input.pomodoroMinutes);
        this.currentEnvelope = response;
        this.currentPlan = normalized;
        this.lastWasExample = false;
        this.setConnection('online', '后端已连接');
        this.renderPlan(normalized, response, false);
      } catch (error) {
        this.showError(error);
      } finally {
        this.setGenerating(false);
      }
    },

    normalizeResponse(response, fallbackMinutes) {
      const source = response && typeof response === 'object' ? response : null;
      const plan = source?.plan;
      if (!plan || !trim(plan.goal) || !Array.isArray(plan.tasks) || !plan.tasks.length) {
        const error = new Error('响应必须包含 plan.goal 和至少一个 plan.tasks 项。请检查后端结构化输出。');
        error.code = 'INVALID_RESPONSE';
        throw error;
      }
      const duration = Math.max(5, Number(source.pomodoroMinutes) || Number(fallbackMinutes) || 25);
      const tasks = plan.tasks.map((task, index) => {
        if (!task || !trim(task.title) || !trim(task.action)) {
          const error = new Error(`第 ${index + 1} 个任务缺少 title 或 action。`);
          error.code = 'INVALID_RESPONSE';
          throw error;
        }
        const estimatedMinutes = Math.max(1, Math.round(Number(task.estimatedMinutes) || duration));
        return {
          title: trim(task.title),
          action: trim(task.action),
          output: trim(task.output) || '完成这一小步的可检查产出',
          completionCriteria: trim(task.completionCriteria) || '可以明确判断这一小步已经完成',
          estimatedMinutes,
          pomodoroCount: Math.max(1, Math.round(Number(task.pomodoroCount) || Math.ceil(estimatedMinutes / duration)))
        };
      });
      return {
        goal: trim(plan.goal),
        assumptions: Array.isArray(plan.assumptions) ? plan.assumptions.map(trim).filter(Boolean) : [],
        tasks,
        completionSign: trim(plan.completionSign) || '所有步骤的完成标准均已满足。',
        firstAction: trim(plan.firstAction) || tasks[0].action,
        pomodoroMinutes: duration
      };
    },

    showExample() {
      const normalized = this.normalizeResponse(EXAMPLE_RESPONSE, 25);
      this.currentEnvelope = EXAMPLE_RESPONSE;
      this.currentPlan = normalized;
      this.lastWasExample = true;
      this.renderPlan(normalized, EXAMPLE_RESPONSE, true);
    },

    setGenerating(active) {
      const button = byId('ai-generate');
      if (!button) return;
      button.disabled = active;
      button.innerHTML = active ? '<i data-lucide="loader-circle"></i><span>正在拆解...</span>' : '<i data-lucide="wand-sparkles"></i><span>生成番茄计划</span>';
      button.classList.toggle('loading', active);
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    showLoading(goal) {
      const panel = byId('ai-result-panel');
      const state = byId('ai-result-state');
      byId('ai-plan-view')?.classList.add('hidden');
      if (panel) panel.setAttribute('aria-busy', 'true');
      if (!state) return;
      state.classList.remove('hidden');
      state.dataset.state = 'loading';
      state.innerHTML = `<span class="ai-state-visual"><i data-lucide="loader-circle"></i></span><h2>正在把目标切成可执行的小步</h2><p>围绕“${escape(goal)}”安排动作、产出与完成标准。</p><div class="ai-thinking-lines" aria-hidden="true"><i></i><i></i><i></i></div>`;
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    showError(error) {
      const detail = formatError(error);
      const panel = byId('ai-result-panel');
      const state = byId('ai-result-state');
      if (panel) panel.setAttribute('aria-busy', 'false');
      byId('ai-plan-view')?.classList.add('hidden');
      if (!state) return;
      state.classList.remove('hidden');
      state.dataset.state = 'error';
      state.innerHTML = `<span class="ai-state-visual"><i data-lucide="${detail.icon}"></i></span><h2>${escape(detail.title)}</h2><p>${escape(detail.message)}</p><div class="ai-error-actions"><button class="button secondary" id="ai-error-connect" type="button"><i data-lucide="plug-zap"></i>测试连接</button><button class="button primary" id="ai-error-retry" type="button"><i data-lucide="refresh-cw"></i>${escape(detail.action)}</button></div>${error?.requestId ? `<small class="ai-request-id">请求 ID：${escape(error.requestId)}</small>` : ''}`;
      byId('ai-error-connect')?.addEventListener('click', () => this.testConnection());
      byId('ai-error-retry')?.addEventListener('click', () => error?.status === 400 ? byId('ai-goal')?.focus() : this.generate());
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    renderPlan(plan, envelope, example) {
      const panel = byId('ai-result-panel');
      const state = byId('ai-result-state');
      if (panel) panel.setAttribute('aria-busy', 'false');
      state?.classList.add('hidden');
      byId('ai-plan-view')?.classList.remove('hidden');
      byId('ai-plan-goal').textContent = plan.goal;
      byId('ai-plan-completion').textContent = plan.completionSign;
      const source = byId('ai-result-source');
      if (source) source.innerHTML = example ? '<i data-lucide="panels-top-left"></i>界面示例 · 未请求 AI' : '<i data-lucide="sparkles"></i>AI 生成';
      const totalMinutes = plan.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
      const totalPomodoros = plan.tasks.reduce((sum, task) => sum + task.pomodoroCount, 0);
      byId('ai-plan-metrics').innerHTML = [
        ['list-checks', plan.tasks.length, '可执行步骤'],
        ['clock-3', totalMinutes, '预计分钟'],
        ['timer', totalPomodoros, `枚 ${plan.pomodoroMinutes} 分钟番茄`]
      ].map(([icon, value, label]) => `<span><i data-lucide="${icon}"></i><strong>${escape(value)}</strong><small>${escape(label)}</small></span>`).join('');
      const assumptions = byId('ai-assumptions');
      assumptions?.classList.toggle('hidden', !plan.assumptions.length);
      if (assumptions?.querySelector('p')) assumptions.querySelector('p').textContent = plan.assumptions.join('；');
      byId('ai-task-timeline').innerHTML = plan.tasks.map((task, index) => `<li><span class="ai-task-index">${String(index + 1).padStart(2, '0')}</span><article><header><div><small>${task.pomodoroCount} 枚番茄 · ${task.estimatedMinutes} 分钟</small><h3>${escape(task.title)}</h3></div><i data-lucide="circle-dashed"></i></header><p class="ai-task-action">${escape(task.action)}</p><div class="ai-task-contract"><span><i data-lucide="package-check"></i><span><small>产出</small>${escape(task.output)}</span></span><span><i data-lucide="badge-check"></i><span><small>完成标准</small>${escape(task.completionCriteria)}</span></span></div></article></li>`).join('');
      byId('ai-first-action').textContent = plan.firstAction;
      byId('ai-raw-json').textContent = JSON.stringify(envelope, null, 2);
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    planText() {
      if (!this.currentPlan) return '';
      const plan = this.currentPlan;
      const lines = [`【${plan.goal}】`, `完成标志：${plan.completionSign}`, ''];
      plan.tasks.forEach((task, index) => {
        lines.push(`${index + 1}. ${task.title}（${task.estimatedMinutes} 分钟 / ${task.pomodoroCount} 枚番茄）`);
        lines.push(`动作：${task.action}`, `产出：${task.output}`, `完成标准：${task.completionCriteria}`, '');
      });
      lines.push(`立即开始：${plan.firstAction}`);
      return lines.join('\n');
    },

    async copyPlan() {
      const value = this.planText();
      if (!value) return;
      try {
        if (global.navigator?.clipboard?.writeText) await global.navigator.clipboard.writeText(value);
        else throw new Error('clipboard unavailable');
        root.ui?.toast?.('番茄计划已复制', 'success');
      } catch (_) {
        root.ui?.toast?.('浏览器未允许自动复制，可在原始 JSON 中手动复制', 'error');
      }
    },

    activeProjects() {
      return (root.storage?.getProjects?.() || []).filter((project) => !project.archived);
    },

    populateProjectPresetSelect(selected) {
      const select = byId('ai-import-preferred-preset');
      if (!select) return;
      const preferred = String(selected !== undefined ? selected : select.value || '');
      select.replaceChildren(new Option('跟随当前方案', ''));
      this.presets().forEach((preset) => select.appendChild(new Option(`${preset.name} · ${this.presetTimeSummary(preset)}`, preset.id)));
      select.value = [...select.options].some((option) => option.value === preferred) ? preferred : '';
      this.renderProjectPresetPreview(select.value);
    },

    renderProjectPresetPreview(presetId) {
      const preview = byId('ai-import-preset-preview');
      if (!preview) return;
      const preset = this.presetById(presetId);
      preview.innerHTML = `<i data-lucide="${escape(preset?.icon || 'shuffle')}"></i><span><strong>${escape(preset?.name || '跟随当前方案')}</strong><small>${escape(preset ? this.presetTimeSummary(preset) : '选择项目时保持正在使用的节奏')}</small></span>`;
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    openImportDialog() {
      if (!this.currentPlan) return;
      const projects = this.activeProjects();
      const select = byId('ai-import-project');
      if (select) {
        select.replaceChildren();
        projects.forEach((project) => select.appendChild(new Option(trim(project.name || project.title) || '未命名项目', String(project.id))));
      }
      const minutes = this.currentPlan.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
      byId('ai-import-task-count').textContent = `${this.currentPlan.tasks.length} 个步骤`;
      byId('ai-import-duration').textContent = `${minutes} 分钟`;
      byId('ai-import-empty-hint').hidden = projects.length > 0;
      this.populateProjectPresetSelect('');
      this.setImportMode(projects.length ? 'existing' : 'new');
      if (!projects.length) byId('ai-import-project-name').value = `${this.currentPlan.goal.slice(0, 30)}计划`;
      const dialog = byId('ai-import-dialog');
      if (typeof dialog?.showModal === 'function') dialog.showModal(); else dialog?.setAttribute('open', '');
      if (global.lucide?.createIcons) global.lucide.createIcons();
    },

    closeImportDialog() {
      const dialog = byId('ai-import-dialog');
      if (typeof dialog?.close === 'function' && dialog.open) dialog.close(); else dialog?.removeAttribute('open');
    },

    setImportMode(mode) {
      const hasProjects = this.activeProjects().length > 0;
      this.importMode = mode === 'existing' && hasProjects ? 'existing' : 'new';
      document.querySelectorAll('[data-ai-import-mode]').forEach((button) => {
        const active = button.dataset.aiImportMode === this.importMode;
        button.classList.toggle('active', active);
        button.disabled = button.dataset.aiImportMode === 'existing' && !hasProjects;
      });
      byId('ai-import-existing-panel')?.classList.toggle('hidden', this.importMode !== 'existing');
      byId('ai-import-new-panel')?.classList.toggle('hidden', this.importMode !== 'new');
    },

    importPlan() {
      if (!this.currentPlan || !root.tasks) return;
      let project = null;
      let createdProject = null;
      try {
        if (this.importMode === 'new') {
          const name = trim(byId('ai-import-project-name')?.value);
          if (!name) { root.ui?.toast?.('请为新项目起一个名字', 'error'); byId('ai-import-project-name')?.focus(); return; }
          const preferredPresetId = this.presetById(byId('ai-import-preferred-preset')?.value) ? byId('ai-import-preferred-preset').value : null;
          createdProject = root.tasks.addProject({ name, title: name, description: trim(byId('ai-import-project-description')?.value), preferredFocusPresetId: preferredPresetId });
          project = createdProject;
        } else {
          const ref = byId('ai-import-project')?.value;
          project = this.activeProjects().find((item) => String(item.id) === String(ref));
        }
        if (!project) throw new Error('没有找到要写入的项目');
        const plan = this.currentPlan;
        const description = [plan.completionSign ? `完成标志：${plan.completionSign}` : '', plan.assumptions.length ? `拆解前提：${plan.assumptions.join('；')}` : ''].filter(Boolean).join('\n');
        const course = root.tasks.addCourse(project.id, {
          name: plan.goal,
          title: plan.goal,
          description,
          estimatedMinutes: plan.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
          estimatedPomodoros: plan.tasks.reduce((sum, task) => sum + task.pomodoroCount, 0),
          videos: plan.tasks.map((task, index) => ({
            title: task.title,
            name: task.title,
            description: [`动作：${task.action}`, `产出：${task.output}`, `完成标准：${task.completionCriteria}`].join('\n'),
            estimatedMinutes: task.estimatedMinutes,
            estimatedPomodoros: task.pomodoroCount,
            index: index + 1
          }))
        });
        if (!course) throw new Error('任务写入失败');
        this.closeImportDialog();
        root.tasks.projectFilter = 'active';
        root.tasks.selectProject?.(project.id);
        root.ui?.go?.('tasks');
        root.ui?.toast?.(this.lastWasExample ? '示例计划已保存到本地任务空间' : 'AI 计划已保存到本地任务空间', 'success');
      } catch (error) {
        if (createdProject?.id) root.tasks.deleteProject?.(createdProject.id);
        root.ui?.toast?.(`保存失败：${error.message || '无法写入本地任务'}`, 'error');
      }
    }
  };

  root.aiPlanner = Planner;
})(window);
