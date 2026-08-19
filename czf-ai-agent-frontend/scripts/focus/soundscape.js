(function (global) {
  'use strict';

  const StudyFlow = global.StudyFlow = global.StudyFlow || {};
  const ASSET_ROOT = 'assets/audio/soundscape';

  function catalog(items) {
    return Object.freeze(items.map((item) => Object.freeze(item)));
  }

  const ambientCatalog = catalog([
    { id: 'spring-rain', name: '窗边春雨', icon: 'cloud-rain', description: '细密雨点落在窗外，安静包裹思绪', sourceName: '春雨.m4a', src: `${ASSET_ROOT}/ambient/spring-rain.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/spring-rain.flac` },
    { id: 'fan-breeze', name: '午后风扇', icon: 'fan', description: '均匀叶片轻转，为长时专注铺一层柔和底色', sourceName: '风扇.m4a', src: `${ASSET_ROOT}/ambient/fan-breeze.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/fan-breeze.flac` },
    { id: 'ocean-tide', name: '远岸潮声', icon: 'waves', description: '海浪从远处缓缓往返，适合放松与沉浸', sourceName: '海浪.m4a', src: `${ASSET_ROOT}/ambient/ocean-tide.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/ocean-tide.flac` },
    { id: 'river-flow', name: '河水长流', icon: 'waves', description: '连绵水流稳定向前，带来清醒而持续的节奏', sourceName: '河流.m4a', src: `${ASSET_ROOT}/ambient/river-flow.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/river-flow.flac` },
    { id: 'cafe-room', name: '咖啡馆低语', icon: 'coffee', description: '杯盏与人声保持在远处，营造有人陪伴的专注感', sourceName: '咖啡闲聊.m4a', src: `${ASSET_ROOT}/ambient/cafe-room.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/cafe-room.flac` },
    { id: 'meadow-wind', name: '原野长风', icon: 'wind', description: '开阔风声掠过原野，舒展紧绷的注意力', sourceName: '狂风.m4a', src: `${ASSET_ROOT}/ambient/meadow-wind.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/meadow-wind.flac` },
    { id: 'fireplace', name: '炉火燃响', icon: 'flame', description: '火焰与细碎爆裂声交替，温暖却不喧闹', sourceName: '烈焰.m4a', src: `${ASSET_ROOT}/ambient/fireplace.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/fireplace.flac` },
    { id: 'forest-birds', name: '林间晨鸟', icon: 'bird', description: '清晨鸟鸣散落林间，为学习添一分明亮生气', sourceName: '林鸟.m4a', src: `${ASSET_ROOT}/ambient/forest-birds.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/forest-birds.flac` },
    { id: 'night-owl', name: '深林夜枭', icon: 'moon-star', description: '深夜林中偶尔传来枭鸣，适合安静的夜间工作', sourceName: '猫头鹰.m4a', src: `${ASSET_ROOT}/ambient/night-owl.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/night-owl.flac` },
    { id: 'garden-fountain', name: '庭院喷泉', icon: 'droplets', description: '清亮水珠循环落下，让思绪保持轻盈', sourceName: '喷泉.m4a', src: `${ASSET_ROOT}/ambient/garden-fountain.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/garden-fountain.flac` },
    { id: 'mountain-waterfall', name: '山涧飞瀑', icon: 'mountain-snow', description: '丰沛水声从山涧倾落，适合隔绝周围杂音', sourceName: '瀑布.m4a', src: `${ASSET_ROOT}/ambient/mountain-waterfall.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/mountain-waterfall.flac` },
    { id: 'summer-frogs', name: '夏夜蛙声', icon: 'moon', description: '池畔蛙鸣此起彼伏，唤起松弛的夏夜记忆', sourceName: '蛙鸣.m4a', src: `${ASSET_ROOT}/ambient/summer-frogs.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/summer-frogs.flac` },
    { id: 'meadow-crickets', name: '草间虫鸣', icon: 'bug', description: '细密虫鸣藏在草间，陪伴缓慢而深入的阅读', sourceName: '蟋蟀.m4a', src: `${ASSET_ROOT}/ambient/meadow-crickets.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/meadow-crickets.flac` },
    { id: 'forest-stream', name: '林下清溪', icon: 'tree-pine', description: '浅溪穿过林下石隙，清澈而有层次', sourceName: '小溪.m4a', src: `${ASSET_ROOT}/ambient/forest-stream.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/forest-stream.flac` },
    { id: 'eaves-rain', name: '檐下听雨', icon: 'cloud-rain-wind', description: '雨滴敲过屋檐，带来近在身旁的安心感', sourceName: '雨落屋檐.m4a', src: `${ASSET_ROOT}/ambient/eaves-rain.m4a`, seamlessSrc: `${ASSET_ROOT}/ambient-long/eaves-rain.flac` }
  ]);

  const musicCatalog = catalog([
    { id: 'calm', name: '静水', icon: 'waves', description: '舒缓旋律如静水铺开，适合阅读与整理', sourceName: 'calm.m4a', src: `${ASSET_ROOT}/music/calm.m4a` },
    { id: 'chill', name: '松弛节拍', icon: 'headphones', description: '轻盈节拍与柔和和弦，适合日常专注', sourceName: 'chill.m4a', src: `${ASSET_ROOT}/music/chill.m4a` },
    { id: 'dark', name: '暗夜', icon: 'moon', description: '低沉克制的夜色氛围，适合深度思考', sourceName: 'dark.m4a', src: `${ASSET_ROOT}/music/dark.m4a` },
    { id: 'flute', name: '远笛', icon: 'music-2', description: '清远笛声留出呼吸感，适合写作与复盘', sourceName: 'flute.m4a', src: `${ASSET_ROOT}/music/flute.m4a` },
    { id: 'guitar', name: '木吉他', icon: 'guitar', description: '温暖拨弦自然起伏，陪伴轻松学习', sourceName: 'guitor.m4a', src: `${ASSET_ROOT}/music/guitar.m4a` },
    { id: 'light', name: '微光', icon: 'sparkles', description: '明净旋律缓缓亮起，为思绪留一束微光', sourceName: 'light.m4a', src: `${ASSET_ROOT}/music/light.m4a` },
    { id: 'pianissimo', name: '弱音钢琴', icon: 'piano', description: '轻触琴键、克制留白，适合安静阅读', sourceName: 'pianissimo.m4a', src: `${ASSET_ROOT}/music/pianissimo.m4a` },
    { id: 'slow', name: '慢行', icon: 'footprints', description: '从容节奏不催不赶，适合长时间推进任务', sourceName: 'slow.m4a', src: `${ASSET_ROOT}/music/slow.m4a` },
    { id: 'space', name: '星海', icon: 'orbit', description: '宽阔氛围向远处延伸，适合夜间沉浸', sourceName: 'space.m4a', src: `${ASSET_ROOT}/music/space.m4a` }
  ]);

  const ambientById = new Map(ambientCatalog.map((item) => [item.id, item]));
  const musicById = new Map(musicCatalog.map((item) => [item.id, item]));
  const ambientIds = new Set(ambientById.keys());
  const USER_AMBIENT_PATTERN = /^user-ambient:[a-z0-9][a-z0-9-]{0,79}$/i;
  let supportsFlac;

  const DEFAULT_CONFIG = Object.freeze({
    ambient: Object.freeze({ 'spring-rain': 0.10 }),
    musicId: 'chill',
    musicVolume: 0.15,
    masterVolume: 0.5
  });

  function clamp(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(1, Math.max(0, number));
  }

  function cloneConfig(config) {
    return {
      ambient: Object.assign({}, config.ambient),
      musicId: config.musicId,
      musicVolume: config.musicVolume,
      masterVolume: config.masterVolume
    };
  }

  function isUserAmbientId(value) {
    return USER_AMBIENT_PATTERN.test(String(value || ''));
  }

  function normalizeConfig(value) {
    const source = value && typeof value === 'object' ? value : {};
    const ambientSource = source.ambient && typeof source.ambient === 'object' && !Array.isArray(source.ambient)
      ? source.ambient
      : DEFAULT_CONFIG.ambient;
    const ambient = {};
    Object.keys(ambientSource).slice(0, 24).forEach((id) => {
      if (!ambientIds.has(id) && !isUserAmbientId(id)) return;
      ambient[id] = clamp(ambientSource[id], 0);
    });
    let musicId = Object.prototype.hasOwnProperty.call(source, 'musicId') ? source.musicId : DEFAULT_CONFIG.musicId;
    if (musicId != null) musicId = String(musicId).trim() || null;
    return {
      ambient,
      musicId,
      musicVolume: clamp(source.musicVolume, DEFAULT_CONFIG.musicVolume),
      masterVolume: clamp(source.masterVolume, DEFAULT_CONFIG.masterVolume)
    };
  }

  function resolvedAssetUrl(src) {
    if (!global.document || !global.document.baseURI || typeof global.URL !== 'function') return src;
    try { return new global.URL(src, global.document.baseURI).href; } catch (_) { return src; }
  }

  function supportsSeamlessFlac() {
    if (typeof supportsFlac === 'boolean') return supportsFlac;
    if (!global.document || typeof global.document.createElement !== 'function') return true;
    const probe = global.document.createElement('audio');
    supportsFlac = typeof probe.canPlayType !== 'function' || Boolean(probe.canPlayType('audio/flac'));
    return supportsFlac;
  }

  class FocusSoundscape {
    constructor(options) {
      const opts = options || {};
      this.mediaStore = opts.mediaStore || StudyFlow.mediaStore || null;
      this.ambientCatalog = ambientCatalog;
      this.musicCatalog = musicCatalog;
      this.config = normalizeConfig(opts.config);
      this.ambientNodes = new Map();
      this.ambientLoads = new Map();
      this.musicNode = null;
      this.preparedMusic = null;
      this.preparingMusicId = null;
      this.preparePromise = Promise.resolve(null);
      this.prepareToken = 0;
      this.musicToken = 0;
      this.transitionToken = 0;
      this.status = 'idle';
      this.desiredPlaying = false;
      this.blocked = false;
      this.lastError = null;
      this.listeners = Object.create(null);
      this.mediaUnsubscribe = this._bindMediaStore();
      this._prepareMusic();
    }

    normalizeConfig(value) { return normalizeConfig(value); }
    getConfig() { return cloneConfig(this.config); }

    on(eventName, callback) {
      let name = eventName;
      let listener = callback;
      if (typeof eventName === 'function') {
        name = 'statechange';
        listener = eventName;
      }
      if (typeof listener !== 'function') return function () {};
      if (!this.listeners[name]) this.listeners[name] = [];
      this.listeners[name].push(listener);
      return () => {
        this.listeners[name] = (this.listeners[name] || []).filter((item) => item !== listener);
      };
    }

    _emit(eventName, payload) {
      (this.listeners[eventName] || []).slice().forEach((listener) => {
        try { listener(payload); } catch (error) {
          if (global.console) global.console.error('[FocusSoundscape]', error);
        }
      });
      if (eventName !== 'statechange') {
        (this.listeners.statechange || []).slice().forEach((listener) => {
          try { listener(this.getSnapshot(), eventName, payload); } catch (error) {
            if (global.console) global.console.error('[FocusSoundscape]', error);
          }
        });
      }
    }

    _reportError(error, code) {
      this.lastError = error || new Error('声景播放失败');
      this._emit('error', { code: code || 'playback', error: this.lastError, snapshot: this.getSnapshot() });
    }

    _mediaStore() {
      return this.mediaStore || StudyFlow.mediaStore || null;
    }

    _bindMediaStore() {
      const store = this._mediaStore();
      if (!store || typeof store.on !== 'function') return null;
      return store.on('change', (event) => {
        const payload = event || {};
        if (payload.type === 'delete' && payload.kind === 'ambient' && payload.id) {
          if (!Object.prototype.hasOwnProperty.call(this.config.ambient, payload.id)) return;
          const ambient = Object.assign({}, this.config.ambient);
          delete ambient[payload.id];
          this.configure(Object.assign({}, this.config, { ambient }));
        } else if (payload.type === 'clear') {
          const ambient = {};
          Object.keys(this.config.ambient).forEach((id) => {
            if (!isUserAmbientId(id)) ambient[id] = this.config.ambient[id];
          });
          const musicId = this.config.musicId && !musicById.has(this.config.musicId) ? null : this.config.musicId;
          this.configure(Object.assign({}, this.config, { ambient, musicId }));
        }
      });
    }

    _makeAudio(src) {
      if (typeof global.Audio !== 'function') return null;
      const audio = new global.Audio(resolvedAssetUrl(src));
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
      return audio;
    }

    _targetVolume(node) {
      const layerVolume = node.kind === 'ambient'
        ? (this.config.ambient[node.id] || 0)
        : this.config.musicVolume;
      return clamp(layerVolume * this.config.masterVolume, 0);
    }

    _setNodeGain(node, target) {
      if (!node || !node.audio) return 0;
      node.gain = clamp(target, 0);
      try { node.audio.volume = node.gain; } catch (_) { /* ignored */ }
      return node.gain;
    }

    _createNode(id, kind, src, objectUrl) {
      const audio = this._makeAudio(src);
      if (!audio) return null;
      const node = {
        id,
        kind,
        audios: [audio],
        audio,
        gain: 0,
        objectUrl: objectUrl || null,
        disposing: false,
        disposed: false
      };
      this._bindAudioEvents(node, audio);
      this._setNodeGain(node, 0);
      return node;
    }

    _bindAudioEvents(node, audio) {
      if (!audio || typeof audio.addEventListener !== 'function') return;
      audio.addEventListener('error', () => {
        if (!node.disposed && this.status !== 'idle') {
          this._reportError(new Error('无法读取所选声音文件'), 'media-error');
        }
      });
    }

    _createAmbient(id) {
      const item = ambientById.get(id);
      if (!item) return null;
      // Older Chromium builds used by streaming tools may not advertise FLAC.
      // Keep the lossless loop for modern browsers, but use its long AAC
      // counterpart instead of falling back to the short source clip.
      let src = item.src;
      if (item.seamlessSrc) {
        src = supportsSeamlessFlac()
          ? item.seamlessSrc
          : item.seamlessSrc.replace(/\.flac$/i, '.m4a');
      }
      const node = this._createNode(id, 'ambient', src);
      if (node) this.ambientNodes.set(id, node);
      return node;
    }

    _cancelAmbientLoad(id) {
      const load = this.ambientLoads.get(id);
      if (!load) return;
      load.cancelled = true;
      this.ambientLoads.delete(id);
    }

    _cancelAmbientLoads(activeIds) {
      const active = activeIds || null;
      Array.from(this.ambientLoads.keys()).forEach((id) => {
        if (!active || !active.has(id)) this._cancelAmbientLoad(id);
      });
    }

    _ensureAmbient(id) {
      const existing = this.ambientNodes.get(id);
      if (existing) return Promise.resolve(existing);
      if (ambientIds.has(id)) return Promise.resolve(this._createAmbient(id));
      if (!isUserAmbientId(id)) return Promise.resolve(null);
      const pending = this.ambientLoads.get(id);
      if (pending) return pending.promise;
      const store = this._mediaStore();
      if (!store || typeof store.getAudioUrl !== 'function') {
        this._reportError(new Error('当前浏览器无法读取自定义环境音'), 'ambient-store');
        return Promise.resolve(null);
      }
      const load = { cancelled: false, promise: null };
      load.promise = Promise.resolve().then(() => store.getAudioUrl(id)).then((url) => {
        const stillConfigured = Number(this.config.ambient[id]) > 0;
        if (load.cancelled || !stillConfigured) {
          this._releaseObjectUrl(url);
          return null;
        }
        if (!url) {
          this._reportError(new Error('找不到所选的自定义环境音'), 'missing-ambient');
          return null;
        }
        const current = this.ambientNodes.get(id);
        if (current) {
          this._releaseObjectUrl(url);
          return current;
        }
        const node = this._createNode(id, 'ambient', url, url);
        if (!node) {
          this._releaseObjectUrl(url);
          return null;
        }
        this.ambientNodes.set(id, node);
        return node;
      }).catch((error) => {
        if (!load.cancelled) this._reportError(error, 'ambient-load');
        return null;
      }).finally(() => {
        if (this.ambientLoads.get(id) === load) this.ambientLoads.delete(id);
      });
      this.ambientLoads.set(id, load);
      return load.promise;
    }

    async _playNode(node) {
      if (!node || !node.audio) return false;
      node.disposing = false;
      node.disposed = false;
      if (node.audio.ended) {
        try { node.audio.currentTime = 0; } catch (_) { /* ignored */ }
      }
      this._setNodeGain(node, this._targetVolume(node));
      const result = node.audio.play();
      if (result && typeof result.then === 'function') await result;
      if (node.disposed || node.disposing || !this.desiredPlaying) {
        try { node.audio.pause(); } catch (_) { /* ignored */ }
        return false;
      }
      return true;
    }

    _releaseObjectUrl(url) {
      if (!url) return;
      const store = this._mediaStore();
      if (store && typeof store.revokeObjectUrl === 'function') store.revokeObjectUrl(url);
      else if (global.URL && typeof global.URL.revokeObjectURL === 'function') global.URL.revokeObjectURL(url);
    }

    _finishNode(node, reset) {
      if (!node || !node.audio) return;
      node.disposed = true;
      node.disposing = false;
      node.audios.forEach((audio) => {
        try { audio.pause(); } catch (_) { /* ignored */ }
        if (reset) {
          try { audio.currentTime = 0; } catch (_) { /* ignored */ }
        }
        try { audio.volume = 0; } catch (_) { /* ignored */ }
      });
      node.gain = 0;
      if (node.objectUrl) this._releaseObjectUrl(node.objectUrl);
      node.objectUrl = null;
    }

    _disposeNode(node) {
      if (!node) return;
      node.disposing = true;
      this._finishNode(node, true);
    }

    async _syncAmbient(playNodes) {
      const shouldPlay = arguments.length ? Boolean(playNodes) : this.desiredPlaying;
      const active = new Set();
      const operations = [];
      Object.keys(this.config.ambient).forEach((id) => {
        const volume = this.config.ambient[id];
        if ((!ambientIds.has(id) && !isUserAmbientId(id)) || volume <= 0) return;
        active.add(id);
        operations.push(this._ensureAmbient(id).then(async (node) => {
          if (!node) return null;
          if (Number(this.config.ambient[id]) <= 0 || this.ambientNodes.get(id) !== node) {
            if (this.ambientNodes.get(id) === node) this.ambientNodes.delete(id);
            this._disposeNode(node);
            return null;
          }
          if (shouldPlay && this.desiredPlaying) {
            if (node.audio.paused) await this._playNode(node);
            else this._setNodeGain(node, this._targetVolume(node));
          } else {
            this._setNodeGain(node, this._targetVolume(node));
          }
          return node;
        }));
      });
      this._cancelAmbientLoads(active);
      Array.from(this.ambientNodes.entries()).forEach(([id, node]) => {
        if (active.has(id)) return;
        this.ambientNodes.delete(id);
        this._disposeNode(node);
      });
      await Promise.all(operations);
      return Array.from(this.ambientNodes.values());
    }

    _releasePreparedMusic() {
      if (!this.preparedMusic) return;
      this._releaseObjectUrl(this.preparedMusic.url);
      this.preparedMusic = null;
    }

    _prepareMusic() {
      const id = this.config.musicId;
      if (!id || musicById.has(id)) {
        this.prepareToken += 1;
        this.preparingMusicId = null;
        this.preparePromise = Promise.resolve(null);
        this._releasePreparedMusic();
        return this.preparePromise;
      }
      if (this.musicNode && this.musicNode.kind === 'user' && this.musicNode.id === id) return Promise.resolve(null);
      if (this.preparedMusic && this.preparedMusic.id === id) return Promise.resolve(this.preparedMusic);
      if (this.preparingMusicId === id && this.preparePromise) return this.preparePromise;
      const token = ++this.prepareToken;
      this._releasePreparedMusic();
      const store = this._mediaStore();
      if (!store || typeof store.getAudioUrl !== 'function') {
        this.preparingMusicId = null;
        this.preparePromise = Promise.resolve(null);
        return this.preparePromise;
      }
      this.preparingMusicId = id;
      this.preparePromise = store.getAudioUrl(id).then((url) => {
        if (token !== this.prepareToken || this.config.musicId !== id) {
          this._releaseObjectUrl(url);
          return null;
        }
        this.preparedMusic = url ? { id, url } : null;
        if (!url) this._reportError(new Error('找不到所选的自定义音乐'), 'missing-music');
        return this.preparedMusic;
      }).catch((error) => {
        if (token === this.prepareToken) this._reportError(error, 'music-load');
        return null;
      }).finally(() => {
        if (token === this.prepareToken) this.preparingMusicId = null;
      });
      return this.preparePromise;
    }

    async _createMusic(id, syncToken) {
      const item = musicById.get(id);
      if (item) return this._createNode(id, 'builtin', item.src);
      if (!this.preparedMusic || this.preparedMusic.id !== id) await this._prepareMusic();
      if (syncToken !== this.musicToken || this.config.musicId !== id) return null;
      if (!this.preparedMusic || this.preparedMusic.id !== id) return null;
      const prepared = this.preparedMusic;
      this.preparedMusic = null;
      return this._createNode(id, 'user', prepared.url, prepared.url);
    }

    async _syncMusic() {
      const id = this.config.musicId;
      if (this.musicNode && this.musicNode.id === id) {
        if (this.desiredPlaying) {
          if (this.musicNode.audio.paused) await this._playNode(this.musicNode);
          else this._setNodeGain(this.musicNode, this._targetVolume(this.musicNode));
        } else {
          this._setNodeGain(this.musicNode, this._targetVolume(this.musicNode));
        }
        return this.musicNode;
      }
      const token = ++this.musicToken;
      const previous = this.musicNode;
      this.musicNode = null;
      if (previous) this._disposeNode(previous);
      if (!id) return null;
      const node = await this._createMusic(id, token);
      if (token !== this.musicToken || this.config.musicId !== id) {
        if (node) this._disposeNode(node);
        return null;
      }
      this.musicNode = node;
      if (node && this.desiredPlaying) await this._playNode(node);
      return node;
    }

    _handlePlaybackError(error) {
      this.blocked = true;
      this.status = 'blocked';
      this._reportError(error, 'autoplay-blocked');
    }

    configure(value) {
      this.config = normalizeConfig(value);
      this.blocked = false;
      this.lastError = null;
      this._prepareMusic();
      if (this.status !== 'idle' && this.status !== 'unavailable') {
        this._syncAmbient().catch((error) => this._handlePlaybackError(error));
        this._syncMusic().catch((error) => this._handlePlaybackError(error));
      }
      const result = this.getConfig();
      this._emit('configchange', result);
      return result;
    }

    setAmbientVolume(id, volume) {
      const key = String(id || '');
      if (!ambientIds.has(key) && !isUserAmbientId(key)) return this.getConfig();
      const ambient = Object.assign({}, this.config.ambient, { [key]: clamp(volume, 0) });
      return this.configure(Object.assign({}, this.config, { ambient }));
    }

    setMusic(id) {
      const musicId = id == null || String(id).trim() === '' ? null : String(id).trim();
      return this.configure(Object.assign({}, this.config, { musicId }));
    }

    setMusicVolume(volume) {
      return this.configure(Object.assign({}, this.config, { musicVolume: clamp(volume, this.config.musicVolume) }));
    }

    setMasterVolume(volume) {
      return this.configure(Object.assign({}, this.config, { masterVolume: clamp(volume, this.config.masterVolume) }));
    }

    async play() {
      if (this.status === 'playing' && !this.blocked) return this.getSnapshot();
      if (typeof global.Audio !== 'function') {
        this.status = 'unavailable';
        this._reportError(new Error('当前浏览器不支持声景播放'), 'unsupported');
        return this.getSnapshot();
      }
      const token = ++this.transitionToken;
      this.desiredPlaying = true;
      this.blocked = false;
      this.lastError = null;
      this.status = 'playing';
      const tasks = [this._syncAmbient(true), this._syncMusic()];
      const results = await Promise.allSettled(tasks);
      if (token !== this.transitionToken || !this.desiredPlaying) return this.getSnapshot();
      const failure = results.find((result) => result.status === 'rejected');
      if (failure) this._handlePlaybackError(failure.reason);
      this.status = this.blocked ? 'blocked' : 'playing';
      const snapshot = this.getSnapshot();
      this._emit('play', snapshot);
      return snapshot;
    }

    async pause() {
      if (this.status !== 'playing' && this.status !== 'blocked') return this.getSnapshot();
      const token = ++this.transitionToken;
      this.desiredPlaying = false;
      this.status = 'paused';
      const nodes = Array.from(this.ambientNodes.values());
      if (this.musicNode) nodes.push(this.musicNode);
      if (token !== this.transitionToken || this.status !== 'paused') return this.getSnapshot();
      nodes.forEach((node) => {
        try { node.audio.pause(); } catch (_) { /* ignored */ }
      });
      const snapshot = this.getSnapshot();
      this._emit('pause', snapshot);
      return snapshot;
    }

    toggle() {
      return this.status === 'playing' ? this.pause() : this.play();
    }

    stop() {
      ++this.transitionToken;
      this.desiredPlaying = false;
      this.blocked = false;
      this.musicToken += 1;
      this._cancelAmbientLoads();
      this.ambientNodes.forEach((node) => this._disposeNode(node));
      this.ambientNodes.clear();
      if (this.musicNode) this._disposeNode(this.musicNode);
      this.musicNode = null;
      this.status = 'idle';
      this._prepareMusic();
      const snapshot = this.getSnapshot();
      this._emit('stop', snapshot);
      return snapshot;
    }

    getSnapshot() {
      return {
        status: this.status,
        playing: this.status === 'playing',
        paused: this.status === 'paused',
        blocked: this.blocked,
        config: this.getConfig(),
        activeAmbientIds: Array.from(this.ambientNodes.keys()),
        activeMusicId: this.musicNode ? this.musicNode.id : null,
        error: this.lastError ? String(this.lastError.message || this.lastError) : ''
      };
    }

    async destroy() {
      this.stop();
      this.prepareToken += 1;
      this._releasePreparedMusic();
      if (typeof this.mediaUnsubscribe === 'function') this.mediaUnsubscribe();
      this.mediaUnsubscribe = null;
      this.listeners = Object.create(null);
    }
  }

  StudyFlow.FocusSoundscape = FocusSoundscape;
  StudyFlow.soundscape = StudyFlow.soundscape || new FocusSoundscape();
})(typeof globalThis !== 'undefined' ? globalThis : window);
