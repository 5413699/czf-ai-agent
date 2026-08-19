(function (global, document) {
  'use strict';

  const root = global.StudyFlow = global.StudyFlow || {};
  const byId = (id) => document.getElementById(id);
  const TIME_FIELDS = ['workTime', 'workUnit', 'breakTime', 'breakUnit', 'longBreakTime', 'longBreakUnit', 'longBreakInterval'];
  const DEFAULT_SOUNDSCAPE = Object.freeze({
    ambient: Object.freeze({ 'spring-rain': 0.10 }),
    musicId: 'chill',
    musicVolume: 0.15,
    masterVolume: 0.5
  });
  const DEFAULT_PROMPT_AUDIO = Object.freeze({
    volume: 0.55,
    startCueId: 'builtin-cue:start',
    completeCueId: 'builtin-cue:complete'
  });
  const FALLBACK_AMBIENT = Object.freeze([
    { id: 'spring-rain', name: '窗边春雨', icon: 'cloud-rain', description: '细密雨点落在窗外，安静包裹思绪', sourceName: '春雨.m4a' },
    { id: 'fan-breeze', name: '午后风扇', icon: 'fan', description: '均匀叶片轻转，为长时专注铺一层柔和底色', sourceName: '风扇.m4a' },
    { id: 'ocean-tide', name: '远岸潮声', icon: 'waves', description: '海浪从远处缓缓往返，适合放松与沉浸', sourceName: '海浪.m4a' },
    { id: 'river-flow', name: '河水长流', icon: 'waves', description: '连绵水流稳定向前，带来清醒而持续的节奏', sourceName: '河流.m4a' },
    { id: 'cafe-room', name: '咖啡馆低语', icon: 'coffee', description: '杯盏与人声保持在远处，营造有人陪伴的专注感', sourceName: '咖啡闲聊.m4a' },
    { id: 'meadow-wind', name: '原野长风', icon: 'wind', description: '开阔风声掠过原野，舒展紧绷的注意力', sourceName: '狂风.m4a' },
    { id: 'fireplace', name: '炉火燃响', icon: 'flame', description: '火焰与细碎爆裂声交替，温暖却不喧闹', sourceName: '烈焰.m4a' },
    { id: 'forest-birds', name: '林间晨鸟', icon: 'bird', description: '清晨鸟鸣散落林间，为学习添一分明亮生气', sourceName: '林鸟.m4a' },
    { id: 'night-owl', name: '深林夜枭', icon: 'moon-star', description: '深夜林中偶尔传来枭鸣，适合安静的夜间工作', sourceName: '猫头鹰.m4a' },
    { id: 'garden-fountain', name: '庭院喷泉', icon: 'droplets', description: '清亮水珠循环落下，让思绪保持轻盈', sourceName: '喷泉.m4a' },
    { id: 'mountain-waterfall', name: '山涧飞瀑', icon: 'mountain-snow', description: '丰沛水声从山涧倾落，适合隔绝周围杂音', sourceName: '瀑布.m4a' },
    { id: 'summer-frogs', name: '夏夜蛙声', icon: 'moon', description: '池畔蛙鸣此起彼伏，唤起松弛的夏夜记忆', sourceName: '蛙鸣.m4a' },
    { id: 'meadow-crickets', name: '草间虫鸣', icon: 'bug', description: '细密虫鸣藏在草间，陪伴缓慢而深入的阅读', sourceName: '蟋蟀.m4a' },
    { id: 'forest-stream', name: '林下清溪', icon: 'tree-pine', description: '浅溪穿过林下石隙，清澈而有层次', sourceName: '小溪.m4a' },
    { id: 'eaves-rain', name: '檐下听雨', icon: 'cloud-rain-wind', description: '雨滴敲过屋檐，带来近在身旁的安心感', sourceName: '雨落屋檐.m4a' }
  ]);
  const FALLBACK_MUSIC = Object.freeze([
    { id: 'calm', name: '静水', icon: 'waves', description: '舒缓旋律如静水铺开，适合阅读与整理', sourceName: 'calm.m4a' },
    { id: 'chill', name: '松弛节拍', icon: 'headphones', description: '轻盈节拍与柔和和弦，适合日常专注', sourceName: 'chill.m4a' },
    { id: 'dark', name: '暗夜', icon: 'moon', description: '低沉克制的夜色氛围，适合深度思考', sourceName: 'dark.m4a' },
    { id: 'flute', name: '远笛', icon: 'music-2', description: '清远笛声留出呼吸感，适合写作与复盘', sourceName: 'flute.m4a' },
    { id: 'guitar', name: '木吉他', icon: 'guitar', description: '温暖拨弦自然起伏，陪伴轻松学习', sourceName: 'guitor.m4a' },
    { id: 'light', name: '微光', icon: 'sparkles', description: '明净旋律缓缓亮起，为思绪留一束微光', sourceName: 'light.m4a' },
    { id: 'pianissimo', name: '弱音钢琴', icon: 'piano', description: '轻触琴键、克制留白，适合安静阅读', sourceName: 'pianissimo.m4a' },
    { id: 'slow', name: '慢行', icon: 'footprints', description: '从容节奏不催不赶，适合长时间推进任务', sourceName: 'slow.m4a' },
    { id: 'space', name: '星海', icon: 'orbit', description: '宽阔氛围向远处延伸，适合夜间沉浸', sourceName: 'space.m4a' }
  ]);

  const BUILT_IN_DEFAULTS = Object.freeze([
    { id: 'classic', name: '经典番茄', scene: '适合日常学习、刚开始建立专注习惯。', icon: 'timer', workTime: 25, workUnit: 'minutes', breakTime: 5, breakUnit: 'minutes', longBreakTime: 15, longBreakUnit: 'minutes', longBreakInterval: 4 },
    { id: 'student', name: '学生自习', scene: '适合听课、阅读、背诵和连续刷题。', icon: 'book-open', workTime: 45, workUnit: 'minutes', breakTime: 10, breakUnit: 'minutes', longBreakTime: 20, longBreakUnit: 'minutes', longBreakInterval: 3 },
    { id: 'deep', name: '深度工作', scene: '适合编程、写作和需要持续推理的难题。', icon: 'brain', workTime: 52, workUnit: 'minutes', breakTime: 17, breakUnit: 'minutes', longBreakTime: 25, longBreakUnit: 'minutes', longBreakInterval: 2 },
    { id: 'light', name: '轻量协作', scene: '适合会议准备、资料整理和碎片任务。', icon: 'messages-square', workTime: 15, workUnit: 'minutes', breakTime: 3, breakUnit: 'minutes', longBreakTime: 10, longBreakUnit: 'minutes', longBreakInterval: 6 },
    { id: 'immersive', name: '长程沉浸', scene: '适合论文、项目开发和长篇内容创作。', icon: 'waves', workTime: 50, workUnit: 'minutes', breakTime: 10, breakUnit: 'minutes', longBreakTime: 30, longBreakUnit: 'minutes', longBreakInterval: 3 }
  ].map((preset) => Object.freeze(Object.assign({}, preset, {
    builtIn: true,
    autoStartFocus: true,
    autoStartBreak: true,
    soundscape: DEFAULT_SOUNDSCAPE,
    promptAudio: DEFAULT_PROMPT_AUDIO
  }))));
  const CUSTOM_PRESET_ICON_IDS = Object.freeze(
    root.utils && Array.isArray(root.utils.focusPresetIconIds)
      ? Array.from(root.utils.focusPresetIconIds)
      : [
        'target', 'book-open', 'brain', 'code-2', 'pen-line',
        'graduation-cap', 'briefcase-business', 'calculator', 'flask-conical', 'notebook-tabs'
      ]
  );
  const DEFAULT_CUSTOM_PRESET_ICON = 'target';
  const PRESET_ICON_COLUMNS = 5;

  let editorSoundscape = cloneSoundscape(DEFAULT_SOUNDSCAPE);
  let editorPromptAudio = clonePromptAudio(DEFAULT_PROMPT_AUDIO);
  let selectedMusicId = DEFAULT_SOUNDSCAPE.musicId;
  let userAmbient = new Map();
  let userMusic = new Map();
  let ambientIconUrls = [];
  let ambientRenderToken = 0;
  let musicIconUrls = [];
  let musicRenderToken = 0;
  let soundscapePreview = null;
  let soundscapePreviewTimer = null;
  let soundscapePreviewToken = 0;
  let presetExpanded = false;
  let ambientExpanded = false;
  let musicExpanded = false;
  let orderMode = null;
  let orderDraft = [];
  let initialized = false;
  const COLLAPSED_SOUND_LIMIT = 4;
  const COLLAPSED_AMBIENT_IDS = Object.freeze(['spring-rain', 'meadow-crickets', 'fireplace', 'meadow-wind']);
  const COLLAPSED_MUSIC_IDS = Object.freeze(['__no-music__', 'chill', 'space', 'slow']);
  const NO_MUSIC_ORDER_ID = '__no-music__';
  const ORDER_KEYS = Object.freeze({
    preset: 'focusPresetOrder',
    ambient: 'ambientSoundOrder',
    music: 'musicTrackOrder'
  });

  function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function cleanText(value, fallback, maximum) {
    const result = String(value == null ? '' : value).trim();
    return (result || fallback || '').slice(0, maximum || 100);
  }

  function normalizeCustomPresetIcon(value, fallback) {
    if (root.utils && typeof root.utils.normalizeFocusPresetIcon === 'function') {
      return root.utils.normalizeFocusPresetIcon(value, fallback);
    }
    const requested = cleanText(value, '', 40);
    if (CUSTOM_PRESET_ICON_IDS.includes(requested)) return requested;
    const fallbackIcon = cleanText(fallback, '', 40);
    return CUSTOM_PRESET_ICON_IDS.includes(fallbackIcon) ? fallbackIcon : DEFAULT_CUSTOM_PRESET_ICON;
  }

  function setPresetIconSelection(value, options) {
    const opts = options || {};
    const selectedIcon = normalizeCustomPresetIcon(value, DEFAULT_CUSTOM_PRESET_ICON);
    const field = byId('custom-preset-icon-field');
    const input = byId('custom-preset-icon');
    const buttons = Array.from(document.querySelectorAll('[data-preset-icon]'));
    if (field) field.hidden = Boolean(opts.builtIn);
    if (input) input.value = selectedIcon;
    buttons.forEach((button) => {
      const selected = button.dataset.presetIcon === selectedIcon;
      button.setAttribute('aria-pressed', String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.disabled = Boolean(opts.builtIn);
      if (selected && opts.focus) button.focus();
    });
    return selectedIcon;
  }

  function bindPresetIconPicker() {
    const buttons = Array.from(document.querySelectorAll('[data-preset-icon]'));
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => setPresetIconSelection(button.dataset.presetIcon));
      button.addEventListener('keydown', (event) => {
        let targetIndex = null;
        if (event.key === 'Home') targetIndex = 0;
        else if (event.key === 'End') targetIndex = buttons.length - 1;
        else if (event.key === 'ArrowRight') targetIndex = (index + 1) % buttons.length;
        else if (event.key === 'ArrowLeft') targetIndex = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === 'ArrowDown') targetIndex = (index + PRESET_ICON_COLUMNS) % buttons.length;
        else if (event.key === 'ArrowUp') targetIndex = (index - PRESET_ICON_COLUMNS + buttons.length) % buttons.length;
        if (targetIndex == null) return;
        event.preventDefault();
        setPresetIconSelection(buttons[targetIndex].dataset.presetIcon, { focus: true });
      });
    });
  }

  function mediaDisplayName(value, fallback) {
    const name = cleanText(value, fallback || '自定义音乐', 80).replace(/\.(?:aac|flac|m4a|mp3|ogg|opus|wav|webm)$/i, '').trim();
    return name || fallback || '自定义音乐';
  }

  function normalizeOrderId(kind, value) {
    if (kind === 'music' && (value == null || value === '' || value === NO_MUSIC_ORDER_ID)) return NO_MUSIC_ORDER_ID;
    return String(value == null ? '' : value).trim();
  }

  function uniqueOrderIds(kind, values) {
    const result = [];
    (Array.isArray(values) ? values : []).forEach((value) => {
      const id = normalizeOrderId(kind, value);
      if (id && !result.includes(id)) result.push(id);
    });
    return result;
  }

  function defaultOrderIds(kind, availableIds) {
    const available = uniqueOrderIds(kind, availableIds);
    const preferred = kind === 'ambient'
      ? COLLAPSED_AMBIENT_IDS
      : kind === 'music' ? COLLAPSED_MUSIC_IDS : [];
    const result = uniqueOrderIds(kind, preferred).filter((id) => available.includes(id));
    available.forEach((id) => {
      if (kind === 'music' && id === NO_MUSIC_ORDER_ID) return;
      if (!result.includes(id)) result.push(id);
    });
    if (kind === 'music' && available.includes(NO_MUSIC_ORDER_ID) && !result.includes(NO_MUSIC_ORDER_ID)) result.push(NO_MUSIC_ORDER_ID);
    return result;
  }

  function normalizedOrderIds(kind, availableIds, source) {
    const available = uniqueOrderIds(kind, availableIds);
    const known = new Set(available);
    const result = uniqueOrderIds(kind, source).filter((id) => known.has(id));
    defaultOrderIds(kind, available).forEach((id) => {
      if (!result.includes(id)) result.push(id);
    });
    return result;
  }

  function effectiveOrderIds(kind, availableIds) {
    const key = ORDER_KEYS[kind];
    const stored = key ? settings()[key] : [];
    const source = orderMode === kind ? orderDraft : stored;
    const result = normalizedOrderIds(kind, availableIds, source);
    if (orderMode === kind) orderDraft = result.slice();
    return result;
  }

  function orderItems(kind, items, idForItem) {
    const map = new Map();
    items.forEach((item) => map.set(normalizeOrderId(kind, idForItem(item)), item));
    return effectiveOrderIds(kind, Array.from(map.keys())).map((id) => map.get(id)).filter(Boolean);
  }

  function availableOrderIds(kind) {
    if (kind === 'preset') return allPresets().map((preset) => preset.id);
    if (kind === 'ambient') return ambientCatalog().map((sound) => sound.id);
    const ids = musicCatalog().map((track) => track.id).concat(Array.from(userMusic.keys()), NO_MUSIC_ORDER_ID);
    if (selectedMusicId && !ids.includes(selectedMusicId)) ids.push(selectedMusicId);
    return uniqueOrderIds('music', ids);
  }

  function renderOrderKind(kind) {
    if (kind === 'preset') render();
    else if (kind === 'ambient') renderAmbientSounds();
    else if (kind === 'music') renderMusicTracks();
  }

  function updateOrderModeUi() {
    document.querySelectorAll('[data-order-start]').forEach((button) => { button.hidden = Boolean(orderMode); });
    document.querySelectorAll('[data-order-toolbar]').forEach((toolbar) => {
      toolbar.hidden = toolbar.dataset.orderToolbar !== orderMode;
    });
    [['preset', 'focus-preset-list'], ['ambient', 'ambient-sound-grid'], ['music', 'music-track-list']].forEach(([kind, id]) => {
      const list = byId(id);
      if (list) list.classList.toggle('ordering', orderMode === kind);
    });
  }

  function beginOrder(kind) {
    if (!ORDER_KEYS[kind] || orderMode) return;
    const available = availableOrderIds(kind);
    orderDraft = normalizedOrderIds(kind, available, settings()[ORDER_KEYS[kind]]);
    orderMode = kind;
    renderOrderKind(kind);
    updateOrderModeUi();
  }

  function cancelOrder() {
    const kind = orderMode;
    orderMode = null;
    orderDraft = [];
    if (kind) renderOrderKind(kind);
    updateOrderModeUi();
  }

  function resetOrderDraft() {
    if (!orderMode) return;
    orderDraft = defaultOrderIds(orderMode, availableOrderIds(orderMode));
    renderOrderKind(orderMode);
    updateOrderModeUi();
  }

  function saveOrder() {
    if (!orderMode) return;
    const kind = orderMode;
    const order = normalizedOrderIds(kind, availableOrderIds(kind), orderDraft);
    const patch = { [ORDER_KEYS[kind]]: order };
    root.storage && root.storage.updateSettings && root.storage.updateSettings(patch);
    orderMode = null;
    orderDraft = [];
    renderOrderKind(kind);
    updateOrderModeUi();
    if (kind === 'preset') dispatchPresetsChanged('reorder');
    notify('显示顺序已保存', 'success');
  }

  function moveOrderItem(kind, id, direction) {
    if (orderMode !== kind) return;
    const normalizedId = normalizeOrderId(kind, id);
    orderDraft = normalizedOrderIds(kind, availableOrderIds(kind), orderDraft);
    const index = orderDraft.indexOf(normalizedId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= orderDraft.length) return;
    [orderDraft[index], orderDraft[target]] = [orderDraft[target], orderDraft[index]];
    renderOrderKind(kind);
    updateOrderModeUi();
  }

  function orderWithout(kind, id) {
    const normalizedId = normalizeOrderId(kind, id);
    if (orderMode === kind) orderDraft = orderDraft.filter((item) => item !== normalizedId);
    const stored = settings()[ORDER_KEYS[kind]];
    return uniqueOrderIds(kind, stored).filter((item) => item !== normalizedId);
  }

  function createOrderRow(kind, id, name, description, icon, index, total, iconUrl) {
    const row = document.createElement('div');
    const normalizedId = normalizeOrderId(kind, id);
    const iconMarkup = iconUrl
      ? `<img src="${escapeHtml(iconUrl)}" alt="">`
      : `<i data-lucide="${escapeHtml(icon || 'circle')}"></i>`;
    row.className = 'list-order-row';
    row.dataset.orderId = normalizedId;
    row.innerHTML = `<span class="list-order-grip" aria-hidden="true"><i data-lucide="grip-vertical"></i></span><span class="list-order-icon">${iconMarkup}</span><span class="list-order-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(description || `第 ${index + 1} 项`)}</small></span><span class="list-order-moves"><button class="icon-button" type="button" data-order-move="-1" title="上移" aria-label="上移${escapeHtml(name)}" ${index === 0 ? 'disabled' : ''}><i data-lucide="arrow-up"></i></button><button class="icon-button" type="button" data-order-move="1" title="下移" aria-label="下移${escapeHtml(name)}" ${index === total - 1 ? 'disabled' : ''}><i data-lucide="arrow-down"></i></button></span>`;
    row.querySelectorAll('[data-order-move]').forEach((button) => {
      button.addEventListener('click', () => moveOrderItem(kind, normalizedId, Number(button.dataset.orderMove)));
    });
    return row;
  }

  function number(value, fallback, minimum, maximum) {
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(maximum, Math.max(minimum, safe));
  }

  function volume(value, fallback) {
    return number(value, fallback, 0, 1);
  }

  function renderVolumeRange(input, output, value) {
    const safe = volume(value, 0);
    const percent = Math.round(safe * 100);
    if (input) {
      input.value = String(safe);
      input.setAttribute('aria-valuetext', `${percent}%`);
    }
    if (output) output.textContent = `${percent}%`;
    return safe;
  }

  function boolean(value, fallback) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'string') return !/^(false|0|off|no)$/i.test(value);
    return value !== false && value !== 0;
  }

  function unit(value) {
    return value === 'seconds' ? 'seconds' : 'minutes';
  }

  function cloneSoundscape(value) {
    const source = object(value) ? value : DEFAULT_SOUNDSCAPE;
    return {
      ambient: Object.assign({}, object(source.ambient) ? source.ambient : {}),
      musicId: source.musicId == null || source.musicId === '' ? null : String(source.musicId),
      musicVolume: volume(source.musicVolume, DEFAULT_SOUNDSCAPE.musicVolume),
      masterVolume: volume(source.masterVolume, DEFAULT_SOUNDSCAPE.masterVolume)
    };
  }

  function normalizeCueId(value, fallback) {
    const id = String(value == null ? '' : value).trim();
    return /^(?:builtin-cue:(?:start|complete)|user-cue:[a-z0-9-]{1,80})$/i.test(id) ? id : fallback;
  }

  function clonePromptAudio(value) {
    const source = object(value) ? value : DEFAULT_PROMPT_AUDIO;
    return {
      volume: volume(source.volume, DEFAULT_PROMPT_AUDIO.volume),
      startCueId: normalizeCueId(source.startCueId, DEFAULT_PROMPT_AUDIO.startCueId),
      completeCueId: normalizeCueId(source.completeCueId, DEFAULT_PROMPT_AUDIO.completeCueId)
    };
  }

  function normalizePromptAudio(value) {
    if (root.promptLibrary && typeof root.promptLibrary.normalizeConfig === 'function') {
      try { return clonePromptAudio(root.promptLibrary.normalizeConfig(value)); } catch (_) { /* use local normalizer */ }
    }
    return clonePromptAudio(value);
  }

  function ambientCatalog() {
    const catalog = root.soundscape && root.soundscape.ambientCatalog;
    const builtIns = Array.isArray(catalog) && catalog.length ? catalog : FALLBACK_AMBIENT;
    const merged = new Map(builtIns.map((item) => [item.id, item]));
    userAmbient.forEach((item) => {
      merged.set(item.id, Object.assign({}, item, {
        kind: 'user',
        name: mediaDisplayName(item.name, '自定义环境音'),
        icon: item.icon || 'audio-waveform',
        description: cleanText(item.description, '保存在当前浏览器，可与其他环境音叠加', 120)
      }));
    });
    return Array.from(merged.values());
  }

  function musicCatalog() {
    const catalog = root.soundscape && root.soundscape.musicCatalog;
    return Array.isArray(catalog) && catalog.length ? catalog : FALLBACK_MUSIC;
  }

  function normalizeSoundscape(value) {
    const source = object(value) ? value : DEFAULT_SOUNDSCAPE;
    if (root.soundscape && typeof root.soundscape.normalizeConfig === 'function') {
      try {
        const normalized = cloneSoundscape(root.soundscape.normalizeConfig(value));
        const sourceAmbient = object(source.ambient) ? source.ambient : {};
        Object.keys(sourceAmbient).forEach((id) => {
          const valueForLayer = volume(sourceAmbient[id], 0);
          if (/^user-ambient:[A-Za-z0-9-]{1,80}$/.test(id) && valueForLayer > 0) normalized.ambient[id] = valueForLayer;
        });
        return normalized;
      } catch (_) { /* use local normalizer */ }
    }
    const knownAmbient = new Set(ambientCatalog().map((item) => item.id));
    const ambient = {};
    const sourceAmbient = object(source.ambient) ? source.ambient : {};
    Object.keys(sourceAmbient).forEach((id) => {
      const valueForLayer = volume(sourceAmbient[id], 0);
      if ((knownAmbient.has(id) || /^user-ambient:[A-Za-z0-9-]{1,80}$/.test(id)) && valueForLayer > 0) ambient[id] = valueForLayer;
    });
    return {
      ambient,
      musicId: Object.prototype.hasOwnProperty.call(source, 'musicId')
        ? (source.musicId == null || source.musicId === '' ? null : String(source.musicId))
        : DEFAULT_SOUNDSCAPE.musicId,
      musicVolume: volume(source.musicVolume, DEFAULT_SOUNDSCAPE.musicVolume),
      masterVolume: volume(source.masterVolume, DEFAULT_SOUNDSCAPE.masterVolume)
    };
  }

  function normalizePreset(input, options) {
    const source = object(input) ? input : {};
    const opts = options || {};
    const fallback = opts.fallback || {};
    const builtInDefault = opts.builtIn
      ? BUILT_IN_DEFAULTS.find((item) => item.id === String(source.id || fallback.id || ''))
      : null;
    const preset = {
      id: String(source.id || fallback.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      name: cleanText(source.name, fallback.name || '我的方案', 24),
      scene: cleanText(source.scene || source.description, fallback.scene || '自定义专注节奏', 100),
      icon: opts.builtIn
        ? cleanText(builtInDefault && builtInDefault.icon, fallback.icon || source.icon || 'timer', 40)
        : normalizeCustomPresetIcon(source.icon, fallback.icon),
      workTime: number(source.workTime, Number(fallback.workTime) || 25, 1, 180),
      workUnit: unit(source.workUnit || fallback.workUnit),
      breakTime: number(source.breakTime, Number(fallback.breakTime) || 5, 1, 120),
      breakUnit: unit(source.breakUnit || fallback.breakUnit),
      longBreakTime: number(source.longBreakTime, Number(fallback.longBreakTime) || 15, 1, 180),
      longBreakUnit: unit(source.longBreakUnit || fallback.longBreakUnit),
      longBreakInterval: Math.round(number(source.longBreakInterval, Number(fallback.longBreakInterval) || 4, 2, 12)),
      autoStartFocus: boolean(source.autoStartFocus, boolean(fallback.autoStartFocus, true)),
      autoStartBreak: boolean(source.autoStartBreak, boolean(fallback.autoStartBreak, true)),
      soundscape: normalizeSoundscape(source.soundscape || fallback.soundscape || DEFAULT_SOUNDSCAPE),
      promptAudio: normalizePromptAudio(source.promptAudio || fallback.promptAudio || DEFAULT_PROMPT_AUDIO)
    };
    if (opts.builtIn) preset.builtIn = true;
    else preset.custom = true;
    if (opts.edited) preset.edited = true;
    return preset;
  }

  function settings() {
    return root.storage && typeof root.storage.getSettings === 'function' ? root.storage.getSettings() || {} : {};
  }

  function rawBuiltIn(id) {
    return BUILT_IN_DEFAULTS.find((preset) => preset.id === id) || null;
  }

  function resolvedBuiltIns() {
    const overrides = object(settings().focusPresetOverrides) ? settings().focusPresetOverrides : {};
    return BUILT_IN_DEFAULTS.map((base) => {
      const override = object(overrides[base.id]) ? overrides[base.id] : null;
      const preset = normalizePreset(Object.assign({}, base, override || {}, {
        id: base.id,
        name: base.name,
        scene: base.scene,
        icon: base.icon
      }), { builtIn: true, fallback: base, edited: Boolean(override) });
      return preset;
    });
  }

  function customPresets() {
    const saved = Array.isArray(settings().customFocusPresets) ? settings().customFocusPresets : [];
    return saved.map((preset, index) => normalizePreset(Object.assign({}, preset, {
      id: preset.id || `custom-${Date.now()}-${index}`
    }), { builtIn: false })).slice(-8);
  }

  function allPresets() {
    return resolvedBuiltIns().concat(customPresets());
  }

  function listedPresets() {
    return orderItems('preset', allPresets(), (preset) => preset.id);
  }

  function presetById(id) {
    const key = String(id || '');
    return allPresets().find((preset) => preset.id === key) || null;
  }

  function editablePayload(preset) {
    const payload = {};
    TIME_FIELDS.forEach((key) => { payload[key] = preset[key]; });
    payload.autoStartFocus = preset.autoStartFocus !== false;
    payload.autoStartBreak = preset.autoStartBreak !== false;
    payload.soundscape = normalizeSoundscape(preset.soundscape);
    payload.promptAudio = normalizePromptAudio(preset.promptAudio);
    return payload;
  }

  function sameEditableConfig(left, right) {
    return JSON.stringify(editablePayload(normalizePreset(left, { builtIn: Boolean(left && left.builtIn) })))
      === JSON.stringify(editablePayload(normalizePreset(right, { builtIn: Boolean(right && right.builtIn) })));
  }

  function currentMatches(preset) {
    const current = settings();
    return TIME_FIELDS.every((key) => String(current[key]) === String(preset[key]))
      && boolean(current.autoStartFocus, true) === preset.autoStartFocus
      && boolean(current.autoStartBreak, true) === preset.autoStartBreak
      && JSON.stringify(normalizeSoundscape(current.soundscape)) === JSON.stringify(normalizeSoundscape(preset.soundscape))
      && JSON.stringify(normalizePromptAudio(current.promptAudio)) === JSON.stringify(normalizePromptAudio(preset.promptAudio));
  }

  function notify(message, type) {
    if (root.ui && typeof root.ui.toast === 'function') root.ui.toast(message, type || 'info');
    else if (global.uiManager && typeof global.uiManager.showNotification === 'function') global.uiManager.showNotification(message, type || 'info');
    else if (global.console) global.console[type === 'error' ? 'error' : 'log'](message);
  }

  function dispatchPresetsChanged(action, presetId) {
    const detail = { action: action || 'update', presetId: String(presetId || '') };
    try { global.dispatchEvent(new CustomEvent('studyflow:presets-changed', { detail })); } catch (_) { /* old embedded browser */ }
    try { document.dispatchEvent(new CustomEvent('studyflow:presets-changed', { detail })); } catch (_) { /* no-op */ }
  }

  async function confirmAction(message, title) {
    if (root.ui && typeof root.ui.confirm === 'function') return root.ui.confirm(message, title);
    return global.confirm(message);
  }

  function setTimeFields(preset) {
    TIME_FIELDS.forEach((key) => {
      const id = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
      const element = byId(id);
      if (element && preset[key] != null) element.value = String(preset[key]);
    });
    const autoFocus = byId('auto-start-focus');
    const autoBreak = byId('auto-start-break');
    if (autoFocus) autoFocus.checked = preset.autoStartFocus !== false;
    if (autoBreak) autoBreak.checked = preset.autoStartBreak !== false;
  }

  function readTimeFields() {
    return {
      workTime: byId('work-time') && byId('work-time').value,
      workUnit: byId('work-unit') && byId('work-unit').value,
      breakTime: byId('break-time') && byId('break-time').value,
      breakUnit: byId('break-unit') && byId('break-unit').value,
      longBreakTime: byId('long-break-time') && byId('long-break-time').value,
      longBreakUnit: byId('long-break-unit') && byId('long-break-unit').value,
      longBreakInterval: byId('long-break-interval') && byId('long-break-interval').value,
      autoStartFocus: byId('auto-start-focus') ? byId('auto-start-focus').checked : true,
      autoStartBreak: byId('auto-start-break') ? byId('auto-start-break').checked : true
    };
  }

  function durationMs(value, selectedUnit) {
    return Math.max(1, Number(value) || 1) * (selectedUnit === 'seconds' ? 1000 : 60000);
  }

  function configureTimer(preset, notifyTimer) {
    if (root.timerView && typeof root.timerView.syncSettings === 'function') {
      return root.timerView.syncSettings(notifyTimer === true);
    }
    if (root.timer && typeof root.timer.configure === 'function') {
      return root.timer.configure({
        focusMs: durationMs(preset.workTime, preset.workUnit),
        shortBreakMs: durationMs(preset.breakTime, preset.breakUnit),
        longBreakMs: durationMs(preset.longBreakTime, preset.longBreakUnit),
        longBreakInterval: preset.longBreakInterval,
        autoStartFocus: preset.autoStartFocus,
        autoStartBreak: preset.autoStartBreak
      });
    }
    return null;
  }

  function updateAutomationNote(config) {
    const note = byId('auto-cycle-note');
    if (!note) return;
    const focus = config.autoStartFocus !== false;
    const rest = config.autoStartBreak !== false;
    let text;
    if (focus && rest) text = '专注与休息均自动衔接';
    else if (!focus && !rest) text = '每个阶段结束后等待手动开始';
    else if (rest) text = '专注后自动休息，休息后等待开始';
    else text = '专注后等待休息，休息后自动专注';
    const span = note.querySelector('span');
    if (span) span.textContent = text;
    else note.textContent = text;
  }

  function markActive(preset) {
    const status = byId('focus-preset-status');
    if (status) {
      status.textContent = preset ? preset.name : '自定义节奏';
      status.title = status.textContent;
    }
    document.querySelectorAll('[data-focus-preset]').forEach((card) => {
      const active = Boolean(preset && card.dataset.focusPreset === preset.id);
      card.classList.toggle('active', active);
      card.setAttribute('aria-current', active ? 'true' : 'false');
    });
  }

  function apply(preset, options) {
    if (!preset) return null;
    stopSoundscapePreview();
    if (root.promptLibrary && typeof root.promptLibrary.stopPreview === 'function') root.promptLibrary.stopPreview();
    const opts = options || {};
    const normalized = normalizePreset(preset, { builtIn: Boolean(preset.builtIn), fallback: preset });
    setTimeFields(normalized);
    editorSoundscape = normalizeSoundscape(normalized.soundscape);
    editorPromptAudio = normalizePromptAudio(normalized.promptAudio);
    selectedMusicId = editorSoundscape.musicId;
    renderSoundscapeControls(false);
    root.storage && root.storage.updateSettings && root.storage.updateSettings(Object.assign({
      activeFocusPresetId: normalized.id,
      autoStartFocus: normalized.autoStartFocus,
      autoStartBreak: normalized.autoStartBreak,
      soundscape: editorSoundscape,
      promptAudio: editorPromptAudio,
      volume: editorPromptAudio.volume
    }, Object.fromEntries(TIME_FIELDS.map((key) => [key, normalized[key]]))));
    if (root.soundscape && typeof root.soundscape.configure === 'function') root.soundscape.configure(editorSoundscape);
    if (root.promptLibrary && typeof root.promptLibrary.applyConfig === 'function') root.promptLibrary.applyConfig(editorPromptAudio);
    configureTimer(normalized, false);
    updateAutomationNote(normalized);
    markActive(normalized);
    renderDock();
    if (opts.notify !== false) notify(`已启用“${normalized.name}”`, 'success');
    return normalized;
  }

  function setMode(mode) {
    const next = mode === 'custom' ? 'custom' : 'presets';
    document.querySelectorAll('[data-focus-settings-mode]').forEach((button) => {
      const active = button.dataset.focusSettingsMode === next;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-focus-settings-panel]').forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.focusSettingsPanel !== next);
    });
  }

  function timeSummary(preset) {
    const compact = (value, selectedUnit) => `${value}${selectedUnit === 'seconds' ? '秒' : '分'}`;
    return `${compact(preset.workTime, preset.workUnit)} / ${compact(preset.breakTime, preset.breakUnit)} / ${compact(preset.longBreakTime, preset.longBreakUnit)} · ${preset.longBreakInterval} 轮长休`;
  }

  function automationSummary(preset) {
    if (preset.autoStartFocus && preset.autoStartBreak) return '双自动';
    if (!preset.autoStartFocus && !preset.autoStartBreak) return '双手动';
    return preset.autoStartBreak ? '休息自动' : '专注自动';
  }

  function musicName(id) {
    if (!id) return '纯环境';
    const builtIn = musicCatalog().find((item) => item.id === id);
    if (builtIn) return builtIn.name;
    const user = userMusic.get(id);
    return user ? mediaDisplayName(user.name, '自定义音乐') : '自定义音乐';
  }

  function createPresetCard(preset, index, total) {
    if (orderMode === 'preset') {
      return createOrderRow('preset', preset.id, preset.name, timeSummary(preset), preset.icon, index, total);
    }
    const article = document.createElement('article');
    article.className = `focus-preset-card${preset.custom ? ' custom' : ''}`;
    article.dataset.focusPreset = preset.id;
    article.innerHTML = `<button type="button" class="focus-preset-summary" aria-expanded="false"><span class="focus-preset-icon"><i data-lucide="${escapeHtml(preset.icon)}"></i></span><span><strong>${escapeHtml(preset.name)}</strong><small>${escapeHtml(timeSummary(preset))} · ${escapeHtml(automationSummary(preset))}</small></span><span class="focus-preset-audio"><i data-lucide="headphones"></i>${escapeHtml(musicName(preset.soundscape.musicId))}</span><i data-lucide="chevron-down"></i></button><div class="focus-preset-detail" hidden><p>${escapeHtml(preset.scene)}</p>${preset.edited ? '<span class="focus-preset-edited">已按你的习惯调整</span>' : ''}<div class="focus-preset-actions${preset.custom ? ' has-delete' : ''}"><button type="button" class="button primary" data-preset-use>使用此方案</button><button type="button" class="icon-button" data-preset-edit title="编辑方案" aria-label="编辑方案"><i data-lucide="pencil"></i></button>${preset.custom ? '<button type="button" class="icon-button danger" data-preset-delete title="删除方案" aria-label="删除方案"><i data-lucide="trash-2"></i></button>' : ''}</div></div>`;
    const summary = article.querySelector('.focus-preset-summary');
    const detail = article.querySelector('.focus-preset-detail');
    summary.addEventListener('click', () => {
      const shouldOpen = detail.hidden;
      document.querySelectorAll('.focus-preset-detail').forEach((item) => {
        item.hidden = true;
        const trigger = item.closest('.focus-preset-card') && item.closest('.focus-preset-card').querySelector('.focus-preset-summary');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
      detail.hidden = !shouldOpen;
      summary.setAttribute('aria-expanded', String(shouldOpen));
    });
    article.querySelector('[data-preset-use]').addEventListener('click', () => apply(preset));
    article.querySelector('[data-preset-edit]').addEventListener('click', () => editPreset(preset, true));
    article.querySelector('[data-preset-delete]')?.addEventListener('click', () => deleteCustomPreset(preset.id).catch((error) => notify(error.message, 'error')));
    return article;
  }

  function render() {
    const list = byId('focus-preset-list');
    if (!list) return;
    const presets = orderItems('preset', allPresets(), (preset) => preset.id);
    const cards = presets.map((preset, index) => createPresetCard(preset, index, presets.length));
    cards.forEach((card, index) => { card.hidden = orderMode !== 'preset' && !presetExpanded && index >= COLLAPSED_SOUND_LIMIT; });
    list.replaceChildren(...cards);
    const showMore = byId('focus-preset-show-more');
    if (showMore) {
      showMore.hidden = orderMode === 'preset' || (!presetExpanded && presets.length <= COLLAPSED_SOUND_LIMIT);
      showMore.setAttribute('aria-expanded', String(presetExpanded));
      const label = showMore.querySelector('span');
      if (label) label.textContent = presetExpanded ? '收起方案' : `查看全部 ${presets.length} 个方案`;
    }
    const current = settings();
    const remembered = presets.find((preset) => preset.id === current.activeFocusPresetId && currentMatches(preset));
    markActive(remembered || presets.find(currentMatches) || null);
    updateOrderModeUi();
    global.lucide && global.lucide.createIcons && global.lucide.createIcons();
  }

  function expandCard(id) {
    const card = Array.from(document.querySelectorAll('[data-focus-preset]')).find((item) => item.dataset.focusPreset === id);
    const summary = card && card.querySelector('.focus-preset-summary');
    if (summary && summary.getAttribute('aria-expanded') !== 'true') summary.click();
  }

  function openSettingsPanel() {
    const panel = byId('timer-settings');
    const backdrop = byId('drawer-backdrop');
    if (panel) panel.classList.add('open');
    const usesDrawerLayout = global.matchMedia && global.matchMedia('(max-width: 1180px)').matches;
    if (backdrop && usesDrawerLayout) backdrop.classList.remove('hidden');
  }

  function fillEditor(preset, kind) {
    const isBuiltIn = kind === 'builtin';
    const isExistingCustom = kind === 'custom' && Boolean(preset.id);
    const id = byId('preset-editor-id');
    const type = byId('preset-editor-kind');
    const name = byId('custom-preset-name');
    const scene = byId('custom-preset-description');
    if (id) id.value = preset.id || '';
    if (type) type.value = isBuiltIn ? 'builtin' : 'custom';
    if (name) {
      name.value = isBuiltIn || isExistingCustom ? preset.name : '';
      name.disabled = isBuiltIn;
    }
    if (scene) {
      scene.value = isBuiltIn || isExistingCustom ? preset.scene : '';
      scene.disabled = isBuiltIn;
    }
    setPresetIconSelection(preset.icon, { builtIn: isBuiltIn });
    const kicker = byId('focus-editor-kicker');
    const title = byId('focus-custom-title');
    const description = byId('focus-editor-description');
    const saveLabel = byId('save-custom-preset-label');
    if (kicker) kicker.textContent = isBuiltIn ? '调整内置方案' : isExistingCustom ? '继续打磨你的方案' : '你的专属节奏';
    if (title) title.textContent = isBuiltIn ? `编辑${preset.name}` : isExistingCustom ? `编辑${preset.name}` : '创建自定义方案';
    if (description) description.textContent = isBuiltIn ? '修改会保存为个人覆盖，随时可以恢复默认。' : '图标、时间、衔接方式和声音会一起保存。';
    if (saveLabel) saveLabel.textContent = isBuiltIn ? '保存并使用修改' : isExistingCustom ? '保存并使用方案' : '保存并使用方案';
    const reset = byId('reset-builtin-preset');
    const remove = byId('delete-custom-preset');
    if (reset) reset.classList.toggle('hidden', !isBuiltIn || !preset.edited);
    if (remove) remove.classList.toggle('hidden', !isExistingCustom);
    setTimeFields(preset);
    editorSoundscape = normalizeSoundscape(preset.soundscape);
    editorPromptAudio = normalizePromptAudio(preset.promptAudio);
    selectedMusicId = editorSoundscape.musicId;
    renderSoundscapeControls(false);
  }

  function startNewCustom(openPanel) {
    const current = settings();
    const preset = normalizePreset(Object.assign({}, current, {
      id: '',
      name: '我的方案',
      scene: '自定义专注节奏',
      icon: DEFAULT_CUSTOM_PRESET_ICON,
      soundscape: current.soundscape || DEFAULT_SOUNDSCAPE,
      promptAudio: current.promptAudio || DEFAULT_PROMPT_AUDIO
    }), { builtIn: false });
    preset.id = '';
    fillEditor(preset, 'new');
    setMode('custom');
    if (openPanel !== false) openSettingsPanel();
  }

  function editPreset(preset, openPanel) {
    if (!preset) return;
    fillEditor(preset, preset.builtIn ? 'builtin' : 'custom');
    setMode('custom');
    if (openPanel !== false) openSettingsPanel();
  }

  function readEditorPreset() {
    const id = String(byId('preset-editor-id') && byId('preset-editor-id').value || '');
    const kind = String(byId('preset-editor-kind') && byId('preset-editor-kind').value || 'custom');
    const base = kind === 'builtin' ? rawBuiltIn(id) : null;
    const name = base ? base.name : cleanText(byId('custom-preset-name') && byId('custom-preset-name').value, '', 24);
    const scene = base ? base.scene : cleanText(byId('custom-preset-description') && byId('custom-preset-description').value, '自定义专注节奏', 100);
    if (!base && !name) {
      notify('请先为方案起一个名字', 'error');
      byId('custom-preset-name') && byId('custom-preset-name').focus();
      return null;
    }
    return normalizePreset(Object.assign({}, base || {}, readTimeFields(), {
      id: id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      scene,
      icon: base ? base.icon : normalizeCustomPresetIcon(byId('custom-preset-icon') && byId('custom-preset-icon').value),
      soundscape: editorSoundscape,
      promptAudio: root.promptLibrary && typeof root.promptLibrary.getEditorConfig === 'function'
        ? root.promptLibrary.getEditorConfig()
        : editorPromptAudio
    }), { builtIn: Boolean(base), fallback: base || {} });
  }

  function saveEditor() {
    const preset = readEditorPreset();
    if (!preset) return;
    const current = settings();
    if (preset.builtIn) {
      const base = rawBuiltIn(preset.id);
      if (!base) return;
      const overrides = Object.assign({}, object(current.focusPresetOverrides) ? current.focusPresetOverrides : {});
      if (sameEditableConfig(preset, base)) delete overrides[preset.id];
      else overrides[preset.id] = editablePayload(preset);
      root.storage && root.storage.updateSettings && root.storage.updateSettings({ focusPresetOverrides: overrides });
      const resolved = presetById(preset.id) || preset;
      apply(resolved, { notify: false });
      render();
      setMode('presets');
      expandCard(resolved.id);
      notify(`“${resolved.name}”的修改已保存`, 'success');
      dispatchPresetsChanged('update', resolved.id);
      return;
    }
    const custom = customPresets().filter((item) => item.id !== preset.id).concat(preset).slice(-8);
    root.storage && root.storage.updateSettings && root.storage.updateSettings({ customFocusPresets: custom });
    apply(preset, { notify: false });
    render();
    setMode('presets');
    expandCard(preset.id);
    notify(`“${preset.name}”已保存并启用`, 'success');
    dispatchPresetsChanged('save', preset.id);
  }

  async function resetBuiltIn() {
    const id = String(byId('preset-editor-id') && byId('preset-editor-id').value || '');
    const base = rawBuiltIn(id);
    if (!base) return;
    const current = settings();
    const overrides = Object.assign({}, object(current.focusPresetOverrides) ? current.focusPresetOverrides : {});
    delete overrides[id];
    root.storage && root.storage.updateSettings && root.storage.updateSettings({ focusPresetOverrides: overrides });
    const restored = normalizePreset(base, { builtIn: true, fallback: base });
    apply(restored, { notify: false });
    fillEditor(restored, 'builtin');
    render();
    notify(`“${base.name}”已恢复默认`, 'success');
    dispatchPresetsChanged('reset', base.id);
  }

  async function deleteCustomPreset(presetId) {
    const id = String(presetId || byId('preset-editor-id') && byId('preset-editor-id').value || '');
    const preset = customPresets().find((item) => item.id === id);
    if (!preset) return false;
    const projects = root.storage && typeof root.storage.getProjects === 'function' ? root.storage.getProjects() || [] : [];
    const affected = projects.filter((project) => String(project.preferredFocusPresetId || '') === id);
    const impact = affected.length ? `有 ${affected.length} 个项目正在使用它，删除后这些项目会改为“跟随当前方案”。` : '计时记录不会受到影响。';
    if (!await confirmAction(`删除“${preset.name}”方案？${impact}`, '删除自定义方案？')) return false;
    const remaining = customPresets().filter((item) => item.id !== id);
    const wasActive = settings().activeFocusPresetId === id;
    root.storage && root.storage.updateSettings && root.storage.updateSettings({
      customFocusPresets: remaining,
      focusPresetOrder: orderWithout('preset', id)
    });
    affected.forEach((project) => {
      if (root.storage && typeof root.storage.updateProject === 'function') root.storage.updateProject(project.id, { preferredFocusPresetId: null });
      else project.preferredFocusPresetId = null;
    });
    if (wasActive) apply(presetById('classic') || normalizePreset(BUILT_IN_DEFAULTS[0], { builtIn: true }), { notify: false });
    render();
    setMode('presets');
    notify(`“${preset.name}”已删除`, 'success');
    dispatchPresetsChanged('delete', id);
    if (affected.length) {
      try { global.dispatchEvent(new Event('studyflow:data-changed')); } catch (_) { /* no-op */ }
    }
    return true;
  }

  function renderAmbientCount() {
    const count = Object.keys(editorSoundscape.ambient).filter((id) => editorSoundscape.ambient[id] > 0).length;
    const output = byId('ambient-selection-count');
    if (output) output.textContent = count ? `已选 ${count} 项` : '暂未选择';
  }

  function clearSoundscapePreviewTimer() {
    if (soundscapePreviewTimer != null) global.clearTimeout(soundscapePreviewTimer);
    soundscapePreviewTimer = null;
  }

  function stopSoundscapePreview() {
    clearSoundscapePreviewTimer();
    soundscapePreviewToken += 1;
    const preview = soundscapePreview;
    soundscapePreview = null;
    if (preview && typeof preview.destroy === 'function') {
      try { preview.destroy(); } catch (_) { /* ignored */ }
    } else if (preview && typeof preview.stop === 'function') {
      try { preview.stop(); } catch (_) { /* ignored */ }
    }
  }

  function scheduleSoundscapePreviewStop() {
    clearSoundscapePreviewTimer();
    soundscapePreviewTimer = global.setTimeout(stopSoundscapePreview, 1200);
  }

  function previewSoundscape() {
    editorSoundscape = normalizeSoundscape(editorSoundscape);
    const main = root.soundscape;
    const snapshot = main && typeof main.getSnapshot === 'function' ? main.getSnapshot() : null;
    if (snapshot && snapshot.playing) {
      stopSoundscapePreview();
      if (typeof main.configure === 'function') main.configure(editorSoundscape);
      renderDock(typeof main.getSnapshot === 'function' ? main.getSnapshot() : snapshot);
      return;
    }
    if (typeof root.FocusSoundscape === 'function') {
      if (!soundscapePreview) {
        soundscapePreview = new root.FocusSoundscape({ config: editorSoundscape, mediaStore: root.mediaStore || null });
      } else if (typeof soundscapePreview.configure === 'function') {
        soundscapePreview.configure(editorSoundscape);
      }
      const preview = soundscapePreview;
      const token = ++soundscapePreviewToken;
      if (preview && typeof preview.play === 'function') {
        Promise.resolve(preview.play()).then(() => {
          if (token !== soundscapePreviewToken || preview !== soundscapePreview) return;
          scheduleSoundscapePreviewStop();
        }).catch(() => {
          if (preview === soundscapePreview) stopSoundscapePreview();
        });
      }
      scheduleSoundscapePreviewStop();
    }
    renderDock();
  }

  function renderAmbientSounds() {
    const grid = byId('ambient-sound-grid');
    if (!grid) return;
    const sounds = orderItems('ambient', ambientCatalog(), (sound) => sound.id);
    const cards = sounds.map((sound, index) => {
      const isUser = sound.kind === 'user' || /^user-ambient:/.test(sound.id);
      const displayName = mediaDisplayName(sound.name, isUser ? '自定义环境音' : '环境音');
      if (orderMode === 'ambient') {
        return createOrderRow('ambient', sound.id, displayName, sound.description || '轻柔环境声', sound.icon, index, sounds.length, sound.iconUrl);
      }
      const activeVolume = Number(editorSoundscape.ambient[sound.id]) || 0;
      const rememberedVolume = activeVolume > 0 ? activeVolume : 0.10;
      const article = document.createElement('article');
      article.className = `ambient-sound-card${activeVolume > 0 ? ' active' : ''}${isUser ? ' user' : ''}`;
      article.dataset.ambientId = sound.id;
      article.hidden = !ambientExpanded && index >= COLLAPSED_SOUND_LIMIT;
      const tooltip = sound.description || displayName;
      const iconMarkup = sound.iconUrl
        ? `<img src="${escapeHtml(sound.iconUrl)}" alt="">`
        : `<i data-lucide="${escapeHtml(sound.icon || 'audio-waveform')}"></i>`;
      const deleteControl = isUser ? `<button class="ambient-card-delete" type="button" title="删除这段环境音" aria-label="删除${escapeHtml(displayName)}"><i data-lucide="trash-2"></i></button>` : '';
      article.innerHTML = `<div class="ambient-card-top"><span class="ambient-card-icon">${iconMarkup}</span><span class="ambient-card-copy"><strong title="${escapeHtml(tooltip)}">${escapeHtml(displayName)}</strong><small>${escapeHtml(sound.description || '轻柔环境声')}</small></span><input class="ambient-card-check" type="checkbox" ${activeVolume > 0 ? 'checked' : ''} aria-label="启用${escapeHtml(displayName)}">${deleteControl}</div><label class="ambient-card-slider" aria-label="${escapeHtml(displayName)}音量"><input type="range" min="0" max="1" step="0.01" value="${rememberedVolume}" aria-valuetext="${Math.round(rememberedVolume * 100)}%" ${activeVolume > 0 ? '' : 'disabled'}><output>${Math.round(rememberedVolume * 100)}%</output></label>`;
      const checkbox = article.querySelector('.ambient-card-check');
      const slider = article.querySelector('.ambient-card-slider input');
      const output = article.querySelector('output');
      const remove = article.querySelector('.ambient-card-delete');
      remove && remove.addEventListener('click', () => {
        deleteUserAmbient(sound).catch((error) => notify(`删除失败：${error.message || '无法访问媒体库'}`, 'error'));
      });
      checkbox.addEventListener('change', () => {
        const enabled = checkbox.checked;
        slider.disabled = !enabled;
        article.classList.toggle('active', enabled);
        if (enabled) editorSoundscape.ambient[sound.id] = Math.max(0.01, Number(slider.value) || 0.10);
        else delete editorSoundscape.ambient[sound.id];
        renderAmbientCount();
        previewSoundscape();
      });
      slider.addEventListener('input', () => {
        const next = volume(slider.value, 0);
        renderVolumeRange(slider, output, next);
        if (next <= 0) {
          checkbox.checked = false;
          article.classList.remove('active');
          delete editorSoundscape.ambient[sound.id];
        } else {
          checkbox.checked = true;
          article.classList.add('active');
          editorSoundscape.ambient[sound.id] = next;
        }
        renderAmbientCount();
        previewSoundscape();
      });
      return article;
    });
    grid.replaceChildren(...cards);
    const showMore = byId('ambient-show-more');
    if (showMore) {
      const hiddenCount = cards.filter((card) => card.hidden).length;
      showMore.hidden = orderMode === 'ambient' || (!ambientExpanded && hiddenCount === 0);
      showMore.setAttribute('aria-expanded', String(ambientExpanded));
      const label = showMore.querySelector('span');
      if (label) label.textContent = ambientExpanded ? '收起环境音' : `查看全部 ${sounds.length} 种环境音`;
    }
    renderAmbientCount();
    updateOrderModeUi();
    global.lucide && global.lucide.createIcons && global.lucide.createIcons();
  }

  async function refreshUserAmbient(options) {
    const opts = options || {};
    const store = root.mediaStore;
    if (!store || typeof store.listAmbient !== 'function') return [];
    const token = ++ambientRenderToken;
    try {
      const tracks = await store.listAmbient();
      const localUrls = [];
      const hydrated = await Promise.all((Array.isArray(tracks) ? tracks : []).map(async (track) => {
        let iconUrl = null;
        if (track && track.hasIcon && typeof store.getIconUrl === 'function') {
          try {
            iconUrl = await store.getIconUrl(track.id);
            if (iconUrl) localUrls.push(iconUrl);
          } catch (_) { iconUrl = null; }
        }
        return Object.assign({}, track, { iconUrl });
      }));
      if (token !== ambientRenderToken) {
        localUrls.forEach((url) => store.revokeObjectUrl && store.revokeObjectUrl(url));
        return Array.from(userAmbient.values());
      }
      revokeAmbientIcons();
      ambientIconUrls = localUrls;
      userAmbient = new Map(hydrated
        .filter((track) => track && /^user-ambient:[A-Za-z0-9-]{1,80}$/.test(String(track.id || '')))
        .map((track) => [track.id, Object.assign({}, track, { name: mediaDisplayName(track.name, '自定义环境音'), kind: 'user' })]));
      if (opts.render !== false) {
        renderAmbientSounds();
        renderDock();
      }
      return Array.from(userAmbient.values());
    } catch (error) {
      if (!opts.silent) notify(`环境音库读取失败：${error.message || '浏览器存储不可用'}`, 'error');
      return [];
    }
  }

  function revokeAmbientIcons() {
    const store = root.mediaStore;
    ambientIconUrls.forEach((url) => {
      if (store && typeof store.revokeObjectUrl === 'function') store.revokeObjectUrl(url);
      else if (global.URL && typeof global.URL.revokeObjectURL === 'function') global.URL.revokeObjectURL(url);
    });
    ambientIconUrls = [];
  }

  function soundscapeWithoutAmbient(config, id) {
    const value = normalizeSoundscape(config);
    delete value.ambient[id];
    return value;
  }

  async function deleteUserAmbient(track) {
    const displayName = mediaDisplayName(track.name, '自定义环境音');
    if (!await confirmAction(`从本地环境音库删除“${displayName}”？使用它的方案会同步移除这层声音。`, '删除本地环境音？')) return;
    const store = root.mediaStore;
    if (!store || typeof store.deleteAmbient !== 'function') throw new Error('环境音媒体库不可用');
    await store.deleteAmbient(track.id);
    const current = settings();
    const custom = (Array.isArray(current.customFocusPresets) ? current.customFocusPresets : []).map((preset) => Object.assign({}, preset, {
      soundscape: soundscapeWithoutAmbient(preset.soundscape, track.id)
    }));
    const overrides = {};
    Object.keys(object(current.focusPresetOverrides) ? current.focusPresetOverrides : {}).forEach((id) => {
      const override = current.focusPresetOverrides[id];
      overrides[id] = Object.assign({}, override, { soundscape: soundscapeWithoutAmbient(override.soundscape, track.id) });
    });
    const activeSoundscape = soundscapeWithoutAmbient(current.soundscape, track.id);
    root.storage && root.storage.updateSettings && root.storage.updateSettings({
      customFocusPresets: custom,
      focusPresetOverrides: overrides,
      soundscape: activeSoundscape,
      ambientSoundOrder: orderWithout('ambient', track.id)
    });
    delete editorSoundscape.ambient[track.id];
    if (root.soundscape && typeof root.soundscape.configure === 'function') root.soundscape.configure(activeSoundscape);
    userAmbient.delete(track.id);
    render();
    renderAmbientSounds();
    renderDock();
    notify(`“${displayName}”已从本地环境音库删除`, 'success');
  }

  function revokeMusicIcons() {
    const store = root.mediaStore;
    musicIconUrls.forEach((url) => {
      if (store && typeof store.revokeObjectUrl === 'function') store.revokeObjectUrl(url);
      else if (global.URL && typeof global.URL.revokeObjectURL === 'function') global.URL.revokeObjectURL(url);
    });
    musicIconUrls = [];
  }

  function createMusicCard(track, kind, iconUrl, index, total) {
    const displayName = mediaDisplayName(track.name, kind === 'user' ? '自定义音乐' : '背景音乐');
    const descriptionText = kind === 'user'
      ? cleanText(track.description, '保存在当前浏览器', 120)
      : track.description || '内置音乐';
    if (orderMode === 'music') {
      return createOrderRow('music', track.id, displayName, descriptionText, track.icon || (kind === 'none' ? 'volume-x' : 'headphones'), index, total, iconUrl);
    }
    const card = document.createElement('div');
    card.className = `music-track-card${kind === 'user' ? ' user' : ''}${kind === 'missing' ? ' missing' : ''}${selectedMusicId === track.id || (!selectedMusicId && track.id === null) ? ' active' : ''}`;
    card.dataset.musicId = track.id == null ? '' : String(track.id);
    card.setAttribute('role', 'radio');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-checked', String(selectedMusicId === track.id || (!selectedMusicId && track.id === null)));
    card.setAttribute('aria-label', `选择${displayName}`);
    const art = document.createElement('span');
    art.className = 'music-track-art';
    if (iconUrl) {
      const image = document.createElement('img');
      image.src = iconUrl;
      image.alt = '';
      art.appendChild(image);
    } else {
      art.innerHTML = `<i data-lucide="${escapeHtml(track.icon || (kind === 'user' ? 'music-2' : 'headphones'))}"></i>`;
    }
    const copy = document.createElement('span');
    copy.className = 'music-track-copy';
    const title = document.createElement('strong');
    title.textContent = displayName;
    const description = document.createElement('small');
    description.textContent = descriptionText;
    copy.append(title, description);
    const state = document.createElement('span');
    state.className = 'music-track-state';
    state.setAttribute('aria-hidden', 'true');
    state.innerHTML = '<i data-lucide="check"></i>';
    card.append(art, copy, state);
    if (kind === 'user') {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'music-track-delete';
      remove.title = '删除这首音乐';
      remove.setAttribute('aria-label', `删除${displayName}`);
      remove.innerHTML = '<i data-lucide="trash-2"></i>';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteUserMusic(track).catch((error) => notify(`删除失败：${error.message || '无法访问媒体库'}`, 'error'));
      });
      card.appendChild(remove);
    }
    const select = () => selectMusic(track.id);
    card.addEventListener('click', select);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
    return card;
  }

  function updateMusicCardStates() {
    document.querySelectorAll('.music-track-card').forEach((card) => {
      const value = card.dataset.musicId || null;
      const active = value === selectedMusicId || (!value && selectedMusicId == null);
      card.classList.toggle('active', active);
      card.setAttribute('aria-checked', String(active));
    });
    const slider = byId('music-volume');
    if (slider) slider.disabled = selectedMusicId == null;
    updateMusicVisibility();
  }

  function updateMusicVisibility() {
    const cards = Array.from(document.querySelectorAll('#music-track-list > *'));
    cards.forEach((card, index) => { card.hidden = orderMode !== 'music' && !musicExpanded && index >= COLLAPSED_SOUND_LIMIT; });
    const showMore = byId('music-show-more');
    if (!showMore) return;
    const hiddenCount = cards.filter((card) => card.hidden).length;
    showMore.hidden = orderMode === 'music' || (!musicExpanded && hiddenCount === 0);
    showMore.setAttribute('aria-expanded', String(musicExpanded));
    const label = showMore.querySelector('span');
    if (label) label.textContent = musicExpanded ? '收起音乐列表' : `查看全部 ${Math.max(0, cards.length - 1)} 首音乐`;
    updateOrderModeUi();
  }

  function selectMusic(id) {
    selectedMusicId = id == null || id === '' ? null : String(id);
    editorSoundscape.musicId = selectedMusicId;
    updateMusicCardStates();
    previewSoundscape();
  }

  async function renderMusicTracks() {
    const list = byId('music-track-list');
    if (!list) return;
    const token = ++musicRenderToken;
    const renderTracks = (tracks, iconUrls) => {
      const descriptors = musicCatalog().map((track) => ({ track, kind: 'builtin', iconUrl: null }))
        .concat(tracks.map((track) => ({ track, kind: 'user', iconUrl: iconUrls && iconUrls.get(track.id) || null })));
      const builtInIds = new Set(musicCatalog().map((track) => track.id));
      if (selectedMusicId && !builtInIds.has(selectedMusicId) && !tracks.some((track) => track.id === selectedMusicId)) {
        descriptors.push({ track: { id: selectedMusicId, name: '音乐文件不可用', icon: 'file-question', description: '请重新选择或上传音乐' }, kind: 'missing', iconUrl: null });
      }
      descriptors.push({ track: { id: null, name: '无音乐', icon: 'volume-x', description: '只保留你选择的环境音' }, kind: 'none', iconUrl: null });
      const ordered = orderItems('music', descriptors, (item) => item.track.id);
      const cards = ordered.map((item, index) => createMusicCard(item.track, item.kind, item.iconUrl, index, ordered.length));
      list.replaceChildren(...cards);
      updateMusicCardStates();
      updateMusicVisibility();
      global.lucide && global.lucide.createIcons && global.lucide.createIcons();
    };
    renderTracks(Array.from(userMusic.values()), new Map());
    const store = root.mediaStore;
    if (!store || typeof store.listMusic !== 'function') return;
    let tracks;
    try {
      tracks = await store.listMusic();
    } catch (error) {
      if (token === musicRenderToken) notify(`音乐库读取失败：${error.message || '浏览器存储不可用'}`, 'error');
      return;
    }
    const localUrls = [];
    const iconUrls = new Map();
    await Promise.all(tracks.map(async (track) => {
      let iconUrl = null;
      if (track.hasIcon && typeof store.getIconUrl === 'function') {
        try {
          iconUrl = await store.getIconUrl(track.id);
          if (iconUrl) localUrls.push(iconUrl);
        } catch (_) { iconUrl = null; }
      }
      if (iconUrl) iconUrls.set(track.id, iconUrl);
    }));
    if (token !== musicRenderToken) {
      localUrls.forEach((url) => store.revokeObjectUrl && store.revokeObjectUrl(url));
      return;
    }
    revokeMusicIcons();
    musicIconUrls = localUrls;
    userMusic = new Map(tracks.map((track) => [track.id, track]));
    render();
    renderTracks(tracks, iconUrls);
    renderDock();
  }

  function soundscapeWithoutMusic(config, id) {
    const value = normalizeSoundscape(config);
    if (value.musicId === id) value.musicId = null;
    return value;
  }

  async function deleteUserMusic(track) {
    const displayName = mediaDisplayName(track.name, '自定义音乐');
    if (!await confirmAction(`从本地音乐库删除“${displayName}”？使用它的方案会切换为无音乐。`, '删除本地音乐？')) return;
    const store = root.mediaStore;
    if (!store || typeof store.deleteMusic !== 'function') throw new Error('媒体库不可用');
    await store.deleteMusic(track.id);
    const current = settings();
    const custom = (Array.isArray(current.customFocusPresets) ? current.customFocusPresets : []).map((preset) => Object.assign({}, preset, {
      soundscape: soundscapeWithoutMusic(preset.soundscape, track.id)
    }));
    const overrides = {};
    Object.keys(object(current.focusPresetOverrides) ? current.focusPresetOverrides : {}).forEach((id) => {
      const override = current.focusPresetOverrides[id];
      overrides[id] = Object.assign({}, override, { soundscape: soundscapeWithoutMusic(override.soundscape, track.id) });
    });
    const activeSoundscape = soundscapeWithoutMusic(current.soundscape, track.id);
    root.storage && root.storage.updateSettings && root.storage.updateSettings({
      customFocusPresets: custom,
      focusPresetOverrides: overrides,
      soundscape: activeSoundscape,
      musicTrackOrder: orderWithout('music', track.id)
    });
    if (selectedMusicId === track.id) {
      selectedMusicId = null;
      editorSoundscape.musicId = null;
    }
    if (root.soundscape && typeof root.soundscape.configure === 'function') root.soundscape.configure(activeSoundscape);
    userMusic.delete(track.id);
    render();
    await renderMusicTracks();
    renderDock();
    notify(`“${displayName}”已从本地音乐库删除`, 'success');
  }

  function renderSoundscapeControls(preview) {
    editorSoundscape = normalizeSoundscape(editorSoundscape);
    selectedMusicId = editorSoundscape.musicId;
    const master = byId('soundscape-master-volume');
    const masterOutput = byId('soundscape-master-display');
    const music = byId('music-volume');
    const musicOutput = byId('music-volume-display');
    renderVolumeRange(master, masterOutput, editorSoundscape.masterVolume);
    if (music) {
      music.disabled = selectedMusicId == null;
    }
    renderVolumeRange(music, musicOutput, editorSoundscape.musicVolume);
    renderAmbientSounds();
    renderMusicTracks();
    if (root.promptLibrary && typeof root.promptLibrary.setEditorConfig === 'function') {
      root.promptLibrary.setEditorConfig(editorPromptAudio);
    }
    if (preview) previewSoundscape();
  }

  function dockConfig() {
    if (root.soundscape && typeof root.soundscape.getConfig === 'function') return root.soundscape.getConfig();
    return normalizeSoundscape(settings().soundscape);
  }

  function dockLabel(config) {
    const selectedAmbient = ambientCatalog().filter((item) => Number(config.ambient[item.id]) > 0);
    const ambientText = selectedAmbient.length ? `${selectedAmbient[0].name}${selectedAmbient.length > 1 ? ` +${selectedAmbient.length - 1}` : ''}` : '';
    const musicText = config.musicId ? musicName(config.musicId) : '';
    if (ambientText && musicText) return `${ambientText} · ${musicText}`;
    return ambientText || musicText || '安静模式';
  }

  function renderDock(snapshot) {
    const soundscape = root.soundscape;
    const state = snapshot || (soundscape && typeof soundscape.getSnapshot === 'function' ? soundscape.getSnapshot() : { playing: false });
    const dock = byId('soundscape-dock');
    const toggle = byId('soundscape-toggle');
    const label = byId('soundscape-now-playing');
    if (dock) dock.classList.toggle('playing', Boolean(state.playing));
    if (label) label.textContent = dockLabel(state.config || dockConfig());
    if (toggle) {
      const icon = state.playing ? 'pause' : 'play';
      if (toggle.dataset.soundscapeIcon !== icon) {
        toggle.dataset.soundscapeIcon = icon;
        toggle.innerHTML = `<i data-lucide="${icon}"></i>`;
        global.lucide && global.lucide.createIcons && global.lucide.createIcons();
      }
      toggle.title = state.playing ? '暂停专注声景' : '播放专注声景';
      toggle.setAttribute('aria-label', toggle.title);
      toggle.setAttribute('aria-pressed', String(Boolean(state.playing)));
    }
  }

  async function toggleSoundscape() {
    const soundscape = root.soundscape;
    const button = byId('soundscape-toggle');
    if (!soundscape || typeof soundscape.toggle !== 'function') {
      notify('当前浏览器无法播放专注声景', 'error');
      return;
    }
    if (button) button.disabled = true;
    try {
      const snapshot = await soundscape.toggle();
      root.storage && root.storage.updateSettings && root.storage.updateSettings({ soundscapePaused: !snapshot.playing });
      renderDock(snapshot);
      if (snapshot.blocked) notify('浏览器阻止了播放，请再次点击播放按钮', 'error');
    } catch (error) {
      notify(`声景播放失败：${error.message || '请检查浏览器音频权限'}`, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function openSoundscapeEditor() {
    const current = settings();
    const active = presetById(current.activeFocusPresetId);
    if (active) editPreset(active, true);
    else startNewCustom(true);
    global.requestAnimationFrame(() => byId('soundscape-editor') && byId('soundscape-editor').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function restoreStoredEditor() {
    stopSoundscapePreview();
    if (root.promptLibrary && typeof root.promptLibrary.stopPreview === 'function') root.promptLibrary.stopPreview();
    const current = settings();
    const active = presetById(current.activeFocusPresetId);
    const restored = normalizePreset(Object.assign({}, active || {}, current, {
      id: active ? active.id : '',
      name: active ? active.name : '我的方案',
      scene: active ? active.scene : '自定义专注节奏',
      icon: active ? active.icon : DEFAULT_CUSTOM_PRESET_ICON,
      soundscape: current.soundscape || DEFAULT_SOUNDSCAPE,
      promptAudio: current.promptAudio || DEFAULT_PROMPT_AUDIO
    }), { builtIn: Boolean(active && active.builtIn), fallback: active || {} });
    fillEditor(restored, active && active.builtIn ? 'builtin' : active && active.custom ? 'custom' : 'new');
    if (root.soundscape && typeof root.soundscape.configure === 'function') root.soundscape.configure(restored.soundscape);
    if (root.promptLibrary && typeof root.promptLibrary.applyConfig === 'function') root.promptLibrary.applyConfig(restored.promptAudio);
    updateAutomationNote(restored);
    renderDock();
  }

  function resetUploadDialog() {
    const form = byId('music-upload-form');
    if (form) form.reset();
    const fileName = byId('custom-music-file-name');
    const iconName = byId('custom-music-icon-name');
    if (fileName) fileName.textContent = 'MP3、WAV、M4A、OGG，最大 100 MB';
    if (iconName) iconName.textContent = 'PNG、JPG 或 WebP，最大 2 MB';
  }

  function resetAmbientUploadDialog() {
    const form = byId('ambient-upload-form');
    if (form) form.reset();
    const fileName = byId('custom-ambient-file-name');
    const iconName = byId('custom-ambient-icon-name');
    if (fileName) fileName.textContent = 'MP3、WAV、M4A、OGG，最大 100 MB';
    if (iconName) iconName.textContent = 'PNG、JPG 或 WebP，最大 2 MB';
  }

  function openAmbientUpload() {
    const dialog = byId('ambient-upload-dialog');
    if (!dialog) return;
    resetAmbientUploadDialog();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  async function saveUploadedAmbient(event) {
    event.preventDefault();
    const store = root.mediaStore;
    const audio = byId('custom-ambient-file') && byId('custom-ambient-file').files && byId('custom-ambient-file').files[0];
    const icon = byId('custom-ambient-icon') && byId('custom-ambient-icon').files && byId('custom-ambient-icon').files[0];
    const name = mediaDisplayName(cleanText(byId('custom-ambient-name') && byId('custom-ambient-name').value, audio && audio.name && audio.name.replace(/\.[^.]+$/, ''), 40), '自定义环境音');
    const description = cleanText(byId('custom-ambient-description') && byId('custom-ambient-description').value, '', 120);
    if (!audio) {
      notify('请先选择一段环境音频', 'error');
      return;
    }
    if (!store || typeof store.saveAmbient !== 'function') {
      notify('当前浏览器无法使用本地环境音库', 'error');
      return;
    }
    const button = byId('ambient-upload-save');
    if (button) button.disabled = true;
    try {
      const track = await store.saveAmbient({ name, description, audioFile: audio, iconFile: icon || null });
      editorSoundscape.ambient[track.id] = Math.max(0.01, Number(editorSoundscape.ambient[track.id]) || 0.10);
      await refreshUserAmbient({ render: false, silent: true });
      renderAmbientSounds();
      previewSoundscape();
      const dialog = byId('ambient-upload-dialog');
      if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
      const storeState = typeof store.getSnapshot === 'function' ? store.getSnapshot() : { persistent: true };
      const displayName = mediaDisplayName(track.name, '自定义环境音');
      notify(storeState.persistent ? `“${displayName}”已加入本地环境音库` : `“${displayName}”仅在本次打开期间可用`, storeState.persistent ? 'success' : 'info');
    } catch (error) {
      notify(`添加环境音失败：${error.message || '文件无法读取'}`, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function openMusicUpload() {
    const dialog = byId('music-upload-dialog');
    if (!dialog) return;
    resetUploadDialog();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  async function saveUploadedMusic(event) {
    event.preventDefault();
    const store = root.mediaStore;
    const audio = byId('custom-music-file') && byId('custom-music-file').files && byId('custom-music-file').files[0];
    const icon = byId('custom-music-icon') && byId('custom-music-icon').files && byId('custom-music-icon').files[0];
    const name = mediaDisplayName(cleanText(byId('custom-music-name') && byId('custom-music-name').value, audio && audio.name && audio.name.replace(/\.[^.]+$/, ''), 40), '自定义音乐');
    const description = cleanText(byId('custom-music-description') && byId('custom-music-description').value, '', 120);
    if (!audio) {
      notify('请先选择一段音乐文件', 'error');
      return;
    }
    if (!store || typeof store.saveMusic !== 'function') {
      notify('当前浏览器无法使用本地音乐库', 'error');
      return;
    }
    const button = byId('music-upload-save');
    if (button) button.disabled = true;
    try {
      const track = await store.saveMusic({ name, description, audioFile: audio, iconFile: icon || null });
      selectedMusicId = track.id;
      editorSoundscape.musicId = track.id;
      await renderMusicTracks();
      updateMusicCardStates();
      previewSoundscape();
      const dialog = byId('music-upload-dialog');
      if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
      const storeState = typeof store.getSnapshot === 'function' ? store.getSnapshot() : { persistent: true };
      const displayName = mediaDisplayName(track.name, '自定义音乐');
      notify(storeState.persistent ? `“${displayName}”已加入本地音乐库` : `“${displayName}”仅在本次打开期间可用`, storeState.persistent ? 'success' : 'info');
    } catch (error) {
      notify(`添加音乐失败：${error.message || '文件无法读取'}`, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindEditor() {
    bindPresetIconPicker();
    document.querySelectorAll('[data-order-start]').forEach((button) => {
      button.addEventListener('click', () => beginOrder(button.dataset.orderStart));
    });
    document.querySelectorAll('[data-order-toolbar]').forEach((toolbar) => {
      toolbar.querySelector('[data-order-reset]')?.addEventListener('click', resetOrderDraft);
      toolbar.querySelector('[data-order-cancel]')?.addEventListener('click', cancelOrder);
      toolbar.querySelector('[data-order-save]')?.addEventListener('click', saveOrder);
    });
    document.querySelectorAll('[data-focus-settings-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        if (orderMode) cancelOrder();
        if (button.dataset.focusSettingsMode === 'custom') startNewCustom(false);
        else {
          setMode('presets');
          restoreStoredEditor();
        }
      });
    });
    byId('save-custom-preset') && byId('save-custom-preset').addEventListener('click', saveEditor);
    byId('reset-builtin-preset') && byId('reset-builtin-preset').addEventListener('click', () => resetBuiltIn().catch((error) => notify(error.message, 'error')));
    byId('delete-custom-preset') && byId('delete-custom-preset').addEventListener('click', () => deleteCustomPreset().catch((error) => notify(error.message, 'error')));
    const master = byId('soundscape-master-volume');
    const music = byId('music-volume');
    master && master.addEventListener('input', () => {
      editorSoundscape.masterVolume = volume(master.value, DEFAULT_SOUNDSCAPE.masterVolume);
      renderVolumeRange(master, byId('soundscape-master-display'), editorSoundscape.masterVolume);
      previewSoundscape();
    });
    music && music.addEventListener('input', () => {
      editorSoundscape.musicVolume = volume(music.value, 0.15);
      renderVolumeRange(music, byId('music-volume-display'), editorSoundscape.musicVolume);
      previewSoundscape();
    });
    byId('open-ambient-upload') && byId('open-ambient-upload').addEventListener('click', openAmbientUpload);
    byId('open-music-upload') && byId('open-music-upload').addEventListener('click', openMusicUpload);
    byId('focus-preset-show-more') && byId('focus-preset-show-more').addEventListener('click', () => {
      presetExpanded = !presetExpanded;
      render();
    });
    byId('ambient-show-more') && byId('ambient-show-more').addEventListener('click', () => {
      ambientExpanded = !ambientExpanded;
      renderAmbientSounds();
    });
    byId('music-show-more') && byId('music-show-more').addEventListener('click', () => {
      musicExpanded = !musicExpanded;
      updateMusicVisibility();
    });
    byId('ambient-upload-form') && byId('ambient-upload-form').addEventListener('submit', saveUploadedAmbient);
    byId('custom-ambient-file') && byId('custom-ambient-file').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      const label = byId('custom-ambient-file-name');
      if (label) label.textContent = file ? '已选择音频文件' : 'MP3、WAV、M4A、OGG，最大 100 MB';
      const name = byId('custom-ambient-name');
      if (file && name && !name.value.trim()) name.value = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
    });
    byId('custom-ambient-icon') && byId('custom-ambient-icon').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      const label = byId('custom-ambient-icon-name');
      if (label) label.textContent = file ? '已选择图标图片' : 'PNG、JPG 或 WebP，最大 2 MB';
    });
    byId('music-upload-form') && byId('music-upload-form').addEventListener('submit', saveUploadedMusic);
    byId('custom-music-file') && byId('custom-music-file').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      const label = byId('custom-music-file-name');
      if (label) label.textContent = file ? '已选择音频文件' : 'MP3、WAV、M4A、OGG，最大 100 MB';
      const name = byId('custom-music-name');
      if (file && name && !name.value.trim()) name.value = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
    });
    byId('custom-music-icon') && byId('custom-music-icon').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      const label = byId('custom-music-icon-name');
      if (label) label.textContent = file ? '已选择封面图片' : 'PNG、JPG 或 WebP，最大 2 MB';
    });
    byId('soundscape-toggle') && byId('soundscape-toggle').addEventListener('click', toggleSoundscape);
    byId('open-soundscape-settings') && byId('open-soundscape-settings').addEventListener('click', openSoundscapeEditor);
    byId('close-settings') && byId('close-settings').addEventListener('click', restoreStoredEditor);
    byId('drawer-backdrop') && byId('drawer-backdrop').addEventListener('click', () => {
      if (!byId('focus-custom-panel') || !byId('focus-custom-panel').classList.contains('hidden')) restoreStoredEditor();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopSoundscapePreview(); });
    global.addEventListener('beforeunload', stopSoundscapePreview, { once: true });
    // The old workbench applied each number-field change immediately. In the
    // new editor these values form one preset and commit together on Save.
    TIME_FIELDS.forEach((key) => {
      const element = byId(key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`));
      element && element.addEventListener('change', (event) => event.stopImmediatePropagation());
    });
  }

  function bindServices() {
    if (root.soundscape && typeof root.soundscape.on === 'function') {
      root.soundscape.on('statechange', (snapshot) => renderDock(snapshot));
    }
    if (root.mediaStore && typeof root.mediaStore.on === 'function') {
      root.mediaStore.on('change', (payload) => {
        if (!payload || !payload.kind || payload.kind === 'ambient') refreshUserAmbient({ silent: true });
        if (!payload || !payload.kind || payload.kind === 'music') renderMusicTracks();
      });
    }
  }

  async function init() {
    if (initialized || !byId('focus-preset-list')) return;
    initialized = true;
    await refreshUserAmbient({ render: false, silent: true });
    bindEditor();
    bindServices();
    const current = settings();
    const starting = normalizePreset(Object.assign({}, current, {
      id: '',
      name: '我的方案',
      scene: '自定义专注节奏',
      icon: DEFAULT_CUSTOM_PRESET_ICON,
      soundscape: current.soundscape || DEFAULT_SOUNDSCAPE,
      promptAudio: current.promptAudio || DEFAULT_PROMPT_AUDIO
    }), { builtIn: false });
    if (root.soundscape && typeof root.soundscape.configure === 'function') root.soundscape.configure(starting.soundscape);
    if (root.promptLibrary && typeof root.promptLibrary.applyConfig === 'function') root.promptLibrary.applyConfig(starting.promptAudio);
    fillEditor(starting, 'new');
    render();
    renderDock();
    updateAutomationNote(starting);
    setMode('presets');
  }

  root.presets = {
    builtIns: BUILT_IN_DEFAULTS,
    get list() { return listedPresets(); },
    get: presetById,
    remove: deleteCustomPreset,
    getEditorSoundscape() { return cloneSoundscape(editorSoundscape); },
    apply,
    render,
    setMode,
    edit: editPreset,
    normalize: normalizePreset
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
