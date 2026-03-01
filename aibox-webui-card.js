const DEFAULTS = {
  host: "", ws_port: 8082, speaker_port: 8080, http_port: 8081,
  tunnel_host: "", tunnel_port: 443, tunnel_path: "/",
  speaker_tunnel_host: "", speaker_tunnel_port: 443, speaker_tunnel_path: "/",
  mode: "auto", title: "AI BOX",
  rooms: null,
  default_tab: "media", show_background: true,
  reconnect_ms: 1500, connect_timeout_ms: 2500,
};

const VOICES = {1:'Ngọc Anh',2:'Minh Anh',3:'Khánh An',4:'Bảo Ngọc',5:'Thanh Mai',6:'Hà My',7:'Thùy Dung',8:'Diệu Linh',9:'Lan Anh',10:'Ngọc Hà',11:'Mai Anh',12:'Bảo Châu',13:'Tú Linh',14:'An Nhiên',15:'Minh Khang',16:'Hoàng Nam',17:'Gia Huy',18:'Đức Anh',19:'Quang Minh',20:'Bảo Long',21:'Hải Đăng',22:'Tuấn Kiệt',23:'Nhật Minh',24:'Anh Dũng',25:'Trung Kiên',26:'Khánh Duy',27:'Phúc An',28:'Thành Đạt',29:'Hữu Phước',30:'Thiên Ân'};
const VFILES = {1:'ngocanh',2:'minhanh',3:'khanhan',4:'baongoc',5:'thanhmai',6:'hamy',7:'thuydung',8:'dieulinh',9:'lananh',10:'ngocha',11:'maianh',12:'baochau',13:'tulinh',14:'annhien',15:'minhkhang',16:'hoangnam',17:'giahuy',18:'ducanh',19:'quangminh',20:'baolong',21:'haidang',22:'tuankiet',23:'nhatminh',24:'anhdung',25:'trungkien',26:'khanhduy',27:'phucan',28:'thanhdat',29:'huuphuoc',30:'thienan'};
const VBASE = 'https://r1.truongblack.me/download/';
const EQ_PRESETS = { flat:[0,0,0,0,0], bass:[800,400,0,0,0], vocal:[-200,0,600,400,0], rock:[500,200,-200,300,500], jazz:[300,0,200,400,300] };
const EQ_LABELS = ['60Hz','230Hz','910Hz','3.6K','14K'];

class AiBoxCard extends HTMLElement {
  static getStubConfig() {
    return { mode: "auto", title: "AI BOX", rooms: [] };
  }

  static getConfigElement() {
    return null;
  }

  setConfig(config) {
    if (!config) throw new Error("Thiếu cấu hình");
    this._config = { ...DEFAULTS, ...(config || {}) };

    this._rooms = Array.isArray(this._config.rooms) && this._config.rooms.length
      ? this._config.rooms.map((r, i) => ({
          name: r.name || `Loa ${i + 1}`,
          host: (r.host || "").trim() || window.location.hostname,
          tunnel_host: (r.tunnel_host || "").trim(),
          tunnel_port: Number(r.tunnel_port || 443),
          tunnel_path: (r.tunnel_path || "/").trim() || "/",
          speaker_tunnel_host: (r.speaker_tunnel_host || "").trim(),
          speaker_tunnel_port: Number(r.speaker_tunnel_port || 443),
          speaker_tunnel_path: (r.speaker_tunnel_path || "/").trim() || "/",
        }))
      : null;

    if (this._rooms && this._currentRoomIdx === undefined) this._currentRoomIdx = 0;
    this._applyRoomToConfig();
    this._ws = null; this._wsConnected = false;
    this._spkWs = null; this._spkHb = null; this._spkEqHb = null; this._spkReconnect = null;
    this._activeTab = this._config.default_tab;
    this._activeSearchTab = 'songs';
    this._activeAudioTab = 'eq';
    this._activeLightTab = 'main';
    this._audioOpen = false;
    this._lightOpen = false;
    this._reconnectTimer = null; this._connectTimeout = null;
    this._progressInterval = null; this._toastTimer = null;
    this._volDragging = false; this._volSendTimer = null; this._volLockTimer = null;
    this._ctrlGuard = 0;
    this._audioGuard = 0;
    this._lastCpuIdle = null; this._lastCpuTotal = null;
    this._offline = false;
    this._retryIn = 0;
    this._retryCountdownTimer = null;
    this._failCount = 0;
    this._dropCount = 0;

    this._state = {
      chat: [], chatBg64: "", tiktokReply: false, chatSessionActive: false,
      chatSpeaking: false,
      ledEnabled: null, dlnaOpen: null, airplayOpen: null, bluetoothOn: null,
      lightEnabled: null, brightness: 100, speed: 50, edgeOn: false, edgeInt: 100,
      wakeWordEnabled: null, wakeWordSensitivity: null,
      customAiEnabled: null, voiceId: null, live2dModel: null,
      otaUrl: null, otaOptions: null,
      hassConfigured: null, hassUrl: "", hassAgentId: "", hassApiKeyMasked: false,
      wifiStatus: null, wifiNetworks: [], wifiSaved: [],
      macAddress: "", macIsCustom: false,
      media: { source: null, isPlaying: false, title: "Không có nhạc", artist: "---",
        thumb: "", position: 0, duration: 0, autoNext: true, repeat: false, shuffle: false },
      volume: 0, sys: { cpu: 0, ram: 0 },
      alarms: [], playlists: [], playlistSongs: [],
      eqEnabled: false,
      eqBands: [0,0,0,0,0],
      bass: { enabled: false, strength: 0 }, loudness: { enabled: false, gain: 0 },
      bassVol: 231, highVol: 231, surroundW: 40,
      premium: -1, premQrB64: "",
    };

    if (this._inited) { this._render(); this._bind(); this._connectWsAuto(); }
  }

  _applyRoomToConfig() {
    if (this._rooms) {
      const r = this._rooms[this._currentRoomIdx || 0];
      this._host = r.host;
      this._roomTunnelHost = r.tunnel_host;
      this._roomTunnelPort = r.tunnel_port;
      this._roomTunnelPath = r.tunnel_path;
      this._roomSpkTunnelHost = r.speaker_tunnel_host;
      this._roomSpkTunnelPort = r.speaker_tunnel_port;
      this._roomSpkTunnelPath = r.speaker_tunnel_path;
    } else {
      this._host = (this._config.host || "").trim() || window.location.hostname;
      this._roomTunnelHost = (this._config.tunnel_host || "").trim();
      this._roomTunnelPort = Number(this._config.tunnel_port || 443);
      this._roomTunnelPath = (this._config.tunnel_path || "/").trim() || "/";
      this._roomSpkTunnelHost = (this._config.speaker_tunnel_host || "").trim();
      this._roomSpkTunnelPort = Number(this._config.speaker_tunnel_port || 443);
      this._roomSpkTunnelPath = (this._config.speaker_tunnel_path || "/").trim() || "/";
    }
  }

  _switchRoom(idx) {
    if (!this._rooms || idx === this._currentRoomIdx) return;
    this._currentRoomIdx = idx;
    this._applyRoomToConfig();
    this._resetState();
    this._closeWs();
    this._offline = false;
    clearInterval(this._retryCountdownTimer); this._retryCountdownTimer = null;
    this._failCount = 0;
    this._dropCount = 0;
    this._renderRoomPills();
    this._renderMedia(); this._renderVolume();
    this._renderControlToggles(); this._renderLight();
    this._renderChatMsgs(); this._renderChatBg(); this._renderTikTok(); this._renderSessionBtn();
    this._renderSystem(); this._renderAlarms();
    this._setConnDot(false); this._setConnText("WS");
    this._toast("🏠 " + this._rooms[idx].name, "success");
    setTimeout(() => this._connectWsAuto(), 100);
  }

  _resetState() {
    this._state = {
      chat: [], chatBg64: "", tiktokReply: false, chatSessionActive: false, chatSpeaking: false,
      ledEnabled: null, dlnaOpen: null, airplayOpen: null, bluetoothOn: null,
      lightEnabled: null, brightness: 100, speed: 50, edgeOn: false, edgeInt: 100,
      wakeWordEnabled: null, wakeWordSensitivity: null,
      customAiEnabled: null, voiceId: null, live2dModel: null,
      otaUrl: null, otaOptions: null,
      hassConfigured: null, hassUrl: "", hassAgentId: "", hassApiKeyMasked: false,
      wifiStatus: null, wifiNetworks: [], wifiSaved: [],
      macAddress: "", macIsCustom: false,
      media: { source: null, isPlaying: false, title: "Không có nhạc", artist: "---",
        thumb: "", position: 0, duration: 0, autoNext: true, repeat: false, shuffle: false },
      volume: 0, sys: { cpu: 0, ram: 0 },
      alarms: [], playlists: [], playlistSongs: [],
      eqEnabled: false, eqBands: [0,0,0,0,0],
      bass: { enabled: false, strength: 0 }, loudness: { enabled: false, gain: 0 },
      bassVol: 231, highVol: 231, surroundW: 40,
      premium: -1, premQrB64: "",
    };
    this._ctrlGuard = 0; this._audioGuard = 0; this._volDragging = false;
  }

  _renderRoomPills() {
    const bar = this.querySelector("#roomBar"); if (!bar || !this._rooms) return;
    bar.querySelectorAll(".room-pill").forEach((pill, i) => {
      pill.classList.toggle("active", i === (this._currentRoomIdx || 0));
    });
  }

  set hass(h) { this._hass = h; if (!this._inited) { this._inited = true; this._render(); this._bind(); this._connectWsAuto(); } }
  connectedCallback() { if (this._inited) this._connectWsAuto(); }
  disconnectedCallback() { this._closeWs(); this._stopTabServices(); }
  getCardSize() { return 9; }

  _isHttps() { return window.location.protocol === "https:"; }
  _lanWsUrl() { return `ws://${this._host}:${this._config.ws_port}`; }
  _tunnelWsUrl() {
    const host = this._roomTunnelHost; if (!host) return "";
    const port = this._roomTunnelPort;
    const path = this._roomTunnelPath;
    const base = `wss://${host}${port === 443 ? "" : ":" + port}${path.startsWith("/") ? path : "/" + path}`;
    const ip = this._host;
    if (ip) return base + (base.includes("?") ? "&" : "?") + "ip=" + encodeURIComponent(ip);
    return base;
  }

  _buildCandidates() {
    const mode  = (this._config.mode || "auto").toLowerCase();
    const https = this._isHttps();
    const list  = [];
    if (mode === "lan") {
      if (https) {
        this._toast("HTTPS không hỗ trợ LAN WS, cần cấu hình tunnel_host", "error");
      } else {
        list.push({ url: this._lanWsUrl(), label: "LAN WS" });
      }
    } else if (mode === "tunnel") {
      const t = this._tunnelWsUrl(); if (t) list.push({ url: t, label: "TUNNEL WSS" });
    } else {
      if (https) {
        const t = this._tunnelWsUrl(); if (t) list.push({ url: t, label: "TUNNEL WSS" });
      } else {
        list.push({ url: this._lanWsUrl(), label: "LAN WS" });
      }
    }
    return list;
  }

  _connectWsAuto() {
    if (this._ws && (this._ws.readyState === 0 || this._ws.readyState === 1)) return;
    clearTimeout(this._reconnectTimer);
    const candidates = this._buildCandidates();
    if (!candidates.length) {
      this._wsConnected = false; this._setConnDot(false);
      this._toast(this._isHttps() ? "HTTPS: cần cấu hình tunnel_host" : "Chưa có host", "error");
      return;
    }
    this._doTry(candidates, 0, 1);
  }

  _doTry(candidates, idx, attempt) {
    const MAX_PER_URL = 3;
    clearTimeout(this._reconnectTimer);
    if (this._ws && (this._ws.readyState === 0 || this._ws.readyState === 1)) return;

    const c = candidates[idx];
    const total    = candidates.length * MAX_PER_URL;
    const doneSoFar = idx * MAX_PER_URL + (attempt - 1);

    this._setOffline(true, this._config.reconnect_ms, doneSoFar, total);

    this._tryOnce(c.url, c.label).then(ok => {
      if (ok) return;

      const newDone = doneSoFar + 1;

      if (attempt < MAX_PER_URL) {
        this._toast(`${c.label} lần ${attempt}/${MAX_PER_URL} thất bại`, "error");
        this._setOffline(true, this._config.reconnect_ms, newDone, total);
        this._reconnectTimer = setTimeout(
          () => this._doTry(candidates, idx, attempt + 1),
          this._config.reconnect_ms
        );
      } else if (idx + 1 < candidates.length) {
        const nextLabel = candidates[idx + 1].label;
        this._toast(`${c.label} hết lượt → thử ${nextLabel}`, "error");
        this._setOffline(true, this._config.reconnect_ms, newDone, total);
        this._reconnectTimer = setTimeout(
          () => this._doTry(candidates, idx + 1, 1),
          this._config.reconnect_ms
        );
      } else {
        this._wsConnected = false; this._setConnDot(false); this._setConnText("WS");
        this._toast("Thiết bị offline!", "error");
        this._setOffline(true, 0, newDone, total);
      }
    });
  }

  _tryOnce(url, label) {
    return new Promise(resolve => {
      let connected = false, settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        clearTimeout(this._connectTimeout);
        resolve(val);
      };

      let ws;
      try { ws = new WebSocket(url); } catch (_) { finish(false); return; }
      this._ws = ws;

      this._connectTimeout = setTimeout(() => {
        if (!connected) { try { ws.close(); } catch(_) {} finish(false); }
      }, this._config.connect_timeout_ms);

      ws.onopen = () => {
        connected = true;
        this._dropCount = 0;
        this._wsConnected = true;
        this._chatLoaded = false;
        this._setConnDot(true);
        this._setConnText(label);
        this._setOffline(false);
        this._toast("Đã kết nối: " + label, "success");
        this._requestInitial();
        finish(true);
      };

      ws.onclose = () => {
        if (!connected) {
          this._ws = null;
          finish(false);
        } else {
          this._wsConnected = false;
          this._setConnDot(false);
          this._setConnText("WS");
          this._stopTabServices();
          clearTimeout(this._reconnectTimer);

          const MAX_DROP = 3;
          this._dropCount = (this._dropCount || 0) + 1;

          if (this._dropCount >= MAX_DROP) {
            this._dropCount = 0;
            this._toast("Thiết bị offline sau " + MAX_DROP + " lần drop!", "error");
            this._setOffline(true, 0, MAX_DROP, MAX_DROP);
          } else {
            this._toast(`Drop ${this._dropCount}/${MAX_DROP} — thiết bị không phản hồi`, "error");
            this._setOffline(true, 0, this._dropCount, MAX_DROP);
          }
        }
      };

      ws.onerror = () => {};
      ws.onmessage = ev => this._handleMsg(ev.data);
    });
  }

  _tryConnect(url, label) { return this._tryOnce(url, label); }

  _closeWs() {
    clearTimeout(this._reconnectTimer); clearTimeout(this._connectTimeout);
    clearInterval(this._retryCountdownTimer); this._retryCountdownTimer = null;
    this._stopTabServices();
    try { this._ws?.close(); } catch(_) {} this._ws = null; this._wsConnected = false; this._setConnDot(false);
    this._closeSpkWs();
    this._stopWaveform();
  }

  _send(obj) { if (this._ws?.readyState === 1) this._ws.send(JSON.stringify(obj)); }

  _spkWsUrl() { return `ws://${this._host}:${this._config.speaker_port || 8080}`; }
  _spkTunnelWsUrl() {
    const host = this._roomSpkTunnelHost; if (!host) return "";
    const port = this._roomSpkTunnelPort;
    const path = this._roomSpkTunnelPath;
    const base = `wss://${host}${port === 443 ? "" : ":" + port}${path.startsWith("/") ? path : "/" + path}`;
    const ip = this._host;
    if (ip) return base + (base.includes("?") ? "&" : "?") + "ip=" + encodeURIComponent(ip);
    return base;
  }

  _connectSpkWs() {
    if (this._spkWs && (this._spkWs.readyState === 0 || this._spkWs.readyState === 1)) return;
    const https = this._isHttps();
    let url;
    if (https) { url = this._spkTunnelWsUrl(); if (!url) return; }
    else { url = this._spkWsUrl(); }
    try {
      this._spkWs = new WebSocket(url);
      this._spkWs.onopen = () => { this._startSpkHeartbeat(); };
      this._spkWs.onmessage = ev => this._handleSpkMsg(ev.data);
      this._spkWs.onclose = () => {
        this._stopSpkHeartbeat();
        clearTimeout(this._spkReconnect);
        this._spkReconnect = setTimeout(() => this._connectSpkWs(), 3000);
      };
      this._spkWs.onerror = () => {};
    } catch(_) {}
  }

  _closeSpkWs() {
    this._stopSpkHeartbeat(); clearTimeout(this._spkReconnect);
    try { this._spkWs?.close(); } catch(_) {} this._spkWs = null;
  }

  _startSpkHeartbeat() {
    this._stopSpkHeartbeat();
    if (this._spkWs?.readyState === 1) {
      this._spkWs.send(JSON.stringify({ type: 'get_info' }));
      this._spkWs.send(JSON.stringify({ type: 'get_eq_config' }));
    }
    this._spkHb = setInterval(() => { if (this._spkWs?.readyState === 1) this._spkWs.send(JSON.stringify({ type: 'get_info' })); }, 950);
    this._spkEqHb = setInterval(() => {
      if (this._spkWs?.readyState === 1) {
        this._spkWs.send(JSON.stringify({ type: 'get_eq_config' }));
        this._spkWs.send(JSON.stringify({ type: 'get_device_info' }));
      }
    }, 3000);
  }

  _stopSpkHeartbeat() {
    if (this._spkHb) { clearInterval(this._spkHb); this._spkHb = null; }
    if (this._spkEqHb) { clearInterval(this._spkEqHb); this._spkEqHb = null; }
  }

  _sendSpk(obj) {
    if (this._spkWs?.readyState === 1) { this._spkWs.send(JSON.stringify(obj)); }
    else { this._send(obj); }
  }

  _sendSpkMsg(arg1, arg2, obj) {
    const d = { type: 'send_message', what: 4, arg1, arg2 };
    if (obj !== undefined) d.obj = String(obj);
    this._sendSpk(d);
  }

  _sendVolume(vol) {
    if (this._spkWs?.readyState === 1) {
      this._spkWs.send(JSON.stringify({ type: "set_vol", vol: vol }));
      this._spkWs.send(JSON.stringify({ type: "send_message", what: 4, arg1: 5, arg2: vol }));
    }
    if (this._isHttps()) {
      this._send({ type: "set_vol", vol: vol });
      this._send({ type: "send_message", what: 4, arg1: 5, arg2: vol });
      this._send({ action: "set_volume", value: vol });
      this._send({ action: "set_volume", volume: vol });
      return;
    }
    const port = this._config.speaker_port || 8080;
    const url = `ws://${this._host}:${port}`;
    try {
      const ws = new WebSocket(url);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "set_vol", vol: vol }));
        ws.send(JSON.stringify({ type: "send_message", what: 4, arg1: 5, arg2: vol }));
        setTimeout(() => { try { ws.close(); } catch(_) {} }, 500);
      };
      ws.onerror = () => { this._send({ action: "set_volume", value: vol }); };
    } catch(e) { this._send({ action: "set_volume", value: vol }); }
  }

  _handleSpkMsg(raw) {
    let d; try { d = JSON.parse(raw); } catch { return; }
    let s;
    if (typeof d.data === "string") { try { s = JSON.parse(d.data); } catch { s = d; } }
    else { s = d.data || d; }

    if (!this._volDragging) {
      const vol = s.vol !== undefined ? Number(s.vol) : null;
      if (vol !== null && vol !== this._state.volume) { this._state.volume = vol; this._renderVolume(); }
    }

    const ctrlOk = Date.now() - this._ctrlGuard > 3000;
    if (ctrlOk) {
      if (s.dlna_open !== undefined) this._state.dlnaOpen = !!s.dlna_open;
      if (s.airplay_open !== undefined) this._state.airplayOpen = !!s.airplay_open;
      if (s.device_state !== undefined) this._state.bluetoothOn = (s.device_state === 3);
      if (s.music_light_enable !== undefined) this._state.lightEnabled = !!s.music_light_enable;
      if (s.music_light_luma !== undefined) this._state.brightness = Math.max(1, Math.min(200, Math.round(s.music_light_luma)));
      if (s.music_light_chroma !== undefined) this._state.speed = Math.max(1, Math.min(100, Math.round(s.music_light_chroma)));
      if (s.music_light_mode !== undefined) this._state.lightMode = s.music_light_mode;
      this._renderControlToggles(); this._renderLight();
    }

    const isEqResponse = d.type === "get_eq_config" || d.code === 200;
    const audioOk = isEqResponse || (Date.now() - this._audioGuard > 3000);

    if (audioOk) {
      if (s.eq) {
        const eqEn = s.eq.Eq_Enable !== undefined ? s.eq.Eq_Enable : s.eq.sound_effects_eq_enable;
        if (eqEn !== undefined) { this._state.eqEnabled = !!eqEn; this._updateSwitch("#swEq", this._state.eqEnabled); }
        if (s.eq.Bands?.list) {
          s.eq.Bands.list.forEach((b, i) => {
            const lv = b.BandLevel ?? 0;
            this._state.eqBands[i] = lv;
            const inp = this.querySelector(`input[data-band="${i}"]`);
            if (inp) inp.value = lv;
          });
          this._renderEqBands();
        }
      }
      if (s.bass) {
        const bassEn = s.bass.Bass_Enable ?? s.bass.sound_effects_bass_enable;
        if (bassEn !== undefined) { this._state.bass.enabled = !!bassEn; this._updateSwitch("#swBass", this._state.bass.enabled); }
        if (s.bass.Current_Strength !== undefined) {
          this._state.bass.strength = s.bass.Current_Strength;
          const bs = this.querySelector("#bassSlider"); if (bs) bs.value = s.bass.Current_Strength;
          const bv = this.querySelector("#bassVal"); if (bv) bv.textContent = Math.round(s.bass.Current_Strength / 10) + "%";
        }
      }
      if (s.loudness) {
        const loudEn = s.loudness.Loudness_Enable ?? s.loudness.sound_effects_loudness_enable;
        if (loudEn !== undefined) { this._state.loudness.enabled = !!loudEn; this._updateSwitch("#swLoud", this._state.loudness.enabled); }
        if (s.loudness.Current_Gain !== undefined) {
          const g = Math.round(s.loudness.Current_Gain);
          this._state.loudness.gain = g;
          const ls = this.querySelector("#loudSlider"); if (ls) ls.value = g;
          const lv = this.querySelector("#loudVal"); if (lv) lv.textContent = (g / 100).toFixed(1) + " dB";
        }
      }
      if (s.Mixer) {
        const bvRaw = s.Mixer['DAC Digital Volume L'];
        if (bvRaw !== undefined) {
          const v = parseInt(bvRaw, 10); this._state.bassVol = v;
          const bvs = this.querySelector("#bvSlider"); if (bvs) bvs.value = v;
          const bvl = this.querySelector("#bvVal"); if (bvl) bvl.textContent = this._dbStr(v);
        }
        const hvRaw = s.Mixer['DAC Digital Volume R'];
        if (hvRaw !== undefined) {
          const v = parseInt(hvRaw, 10); this._state.highVol = v;
          const hvs = this.querySelector("#hvSlider"); if (hvs) hvs.value = v;
          const hvl = this.querySelector("#hvVal"); if (hvl) hvl.textContent = this._dbStr(v);
        }
      }
    }

    if (d.type === "get_device_info") {
      const dd = typeof d.data === "string" ? (() => { try { return JSON.parse(d.data); } catch { return {}; } })() : (d.data || {});
      if (Array.isArray(dd.cpuinfo) && dd.cpuinfo.length > 2) this._state.sys.cpu = Math.round(dd.cpuinfo[2] * 100 * 10) / 10;
      if (typeof dd.meminfo === "string") {
        const mTotal = (dd.meminfo.match(/MemTotal:\s+(\d+)/) || [])[1];
        const mFree  = (dd.meminfo.match(/MemFree:\s+(\d+)/)  || [])[1];
        const mBuf   = (dd.meminfo.match(/Buffers:\s+(\d+)/)  || [])[1];
        const mCach  = (dd.meminfo.match(/\bCached:\s+(\d+)/) || [])[1];
        if (mTotal && mFree) {
          const used = parseInt(mTotal) - parseInt(mFree) - (parseInt(mBuf)||0) - (parseInt(mCach)||0);
          this._state.sys.ram = Math.round(used / parseInt(mTotal) * 100);
        }
      }
      this._renderSystem();
    }
  }

  _requestInitial() {
    if (!this._spkWs || this._spkWs.readyState > 1) this._connectSpkWs();
    else this._startSpkHeartbeat();
    this._loadTab(this._activeTab, true);
  }

  _loadTab(tab, isFirst = false) {
    this._stopTabServices();

    if (tab === 'media') {
      this._send({ action: 'get_info' });
      this._startProgressTick();
      this._startWaveform();

    } else if (tab === 'control') {
      this._send({ action: 'get_info' });
      this._send({ action: 'alarm_list' });
      this._send({ action: 'led_get_state' });
      this._send({ action: 'wake_word_get_enabled' });
      this._send({ action: 'wake_word_get_sensitivity' });
      this._send({ action: 'custom_ai_get_enabled' });
      this._send({ action: 'voice_id_get' });
      this._send({ action: 'live2d_get_model' });
      this._ctrlPoll = setInterval(() => {
        this._send({ action: 'led_get_state' });
        this._send({ action: 'get_info' });
      }, 5000);

    } else if (tab === 'chat') {
      this._send({ action: 'get_info' });
      if (!this._chatLoaded) {
        this._send({ action: 'chat_get_history' });
      }
      this._send({ action: 'get_chat_background' });
      this._send({ action: 'custom_ai_get_enabled' });

    } else if (tab === 'system') {
      this._send({ action: 'get_info' });
      this._send({ action: 'get_device_info' });
      this._send({ action: 'ota_get' });
      this._send({ action: 'hass_get' });
      this._send({ action: 'wifi_get_status' });
      this._send({ action: 'wifi_get_saved' });
      this._send({ action: 'mac_get' });
      this._send({ action: 'get_premium_status' });
      this._sysPoll = setInterval(() => {
        this._send({ action: 'get_info' });
        this._send({ action: 'get_device_info' });
      }, 3000);
    }
  }

  _stopTabServices() {
    this._stopWaveform();
    clearInterval(this._progressInterval);  this._progressInterval = null;
    clearInterval(this._ctrlPoll);  this._ctrlPoll = null;
    clearInterval(this._sysPoll);   this._sysPoll = null;
  }

  _startProgressTick() {
    clearInterval(this._progressInterval);
    this._progressInterval = setInterval(() => {
      const m = this._state.media;
      if (m.isPlaying && m.duration > 0 && m.position < m.duration) { m.position += 1; this._updateProgressOnly(); }
    }, 1000);
  }

  // ============================================================
  // FIX 1: Ball mode — peak độc lập, bars hiển thị đúng
  // ============================================================
  _startWaveform() {
    this._stopWaveform();
    const BAR_COUNT = 25, MAX_H = 72;

    const cur  = new Float32Array(BAR_COUNT).fill(3);
    const vel  = new Float32Array(BAR_COUNT).fill(0);
    const envelope = Float32Array.from({length: BAR_COUNT}, (_, i) => {
      const d = Math.abs(i / (BAR_COUNT - 1) - 0.5);
      return 0.15 + 0.85 * Math.exp(-Math.pow(d / 0.35, 2));
    });
    let w1 = 0, w2 = 0, w3 = 0, beatAmp = 0, beatTgt = 0;
    let bpm = 118 + Math.random() * 30, frameSinceBeat = 0, lastTs = 0;

    const peak   = new Float32Array(BAR_COUNT).fill(3);
    const pvel   = new Float32Array(BAR_COUNT).fill(0);
    const lockAt = new Float32Array(BAR_COUNT).fill(0);
    const locked = new Uint8Array(BAR_COUNT).fill(0);

    const tick = (ts) => {
      this._waveRaf = requestAnimationFrame(tick);
      const dt = Math.min((ts - (lastTs || ts)) / 16.67, 3); lastTs = ts;
      const isPlaying = this._state.media.isPlaying;
      const curMode = this._waveStyle || 'ball';

      w1 += 0.0045 * dt; w2 += 0.010 * dt; w3 += 0.0065 * dt;
      const fpb = (60 / bpm) * 60; frameSinceBeat += dt;
      if (frameSinceBeat >= fpb) {
        frameSinceBeat -= fpb;
        beatTgt = isPlaying ? (0.6 + Math.random() * 0.4) : 0;
        bpm += (Math.random() - 0.5) * 2; bpm = Math.max(22, Math.min(42, bpm));
      }
      beatAmp += (beatTgt - beatAmp) * 0.08 * dt; beatTgt *= Math.pow(0.82, dt);

      for (let i = 0; i < BAR_COUNT; i++) {
        const env = envelope[i], x = i / (BAR_COUNT - 1);
        const travelOffset = x * Math.PI * 3.5;
        const s1 = Math.sin(w1 * 2 * Math.PI + travelOffset) * 0.5 + 0.5;
        const s2 = Math.sin(w2 * 2 * Math.PI + travelOffset * 1.7) * 0.3 + 0.3;
        const s3 = Math.abs(Math.sin(w3 * 2 * Math.PI + travelOffset * 0.8));
        const beatPulse = beatAmp * (0.6 + 0.4 * Math.sin(w1 * Math.PI * 4));
        const tgt = 4 + (s1 * 0.45 + s2 * 0.30 + s3 * 0.15 + beatPulse * 0.40) * env * MAX_H;

        if (curMode === 'classic') {
          vel[i] = vel[i] * 0.68 + (tgt - cur[i]) * 0.26 * dt;
          cur[i] = Math.max(2, Math.min(MAX_H, cur[i] + vel[i]));
        } else {
          // Ball mode: bar đẩy nhanh lên, về 0px khi chạm peak, đợi peak rơi 2/3 mới đẩy tiếp
          vel[i] = vel[i] * 0.68 + (tgt - cur[i]) * 0.26 * dt;
          const newH = Math.max(0, Math.min(MAX_H, cur[i] + vel[i]));

          // Peak rơi độc lập, chậm hơn để tự nhiên
          if (peak[i] > 3) {
            pvel[i] += 0.018 * dt;
            peak[i] = Math.max(3, peak[i] - pvel[i]);
          }

          if (locked[i]) {
            cur[i] = 0;
            if (peak[i] <= 6) { // peak phải rơi gần sát đáy mới unlock
              locked[i] = 0;
              lockAt[i] = 0;
            }
          } else {
            cur[i] = newH;
            if (cur[i] >= peak[i] && cur[i] > 8) {
              peak[i] = cur[i];
              pvel[i] = 0;
              lockAt[i] = cur[i];
              locked[i] = 1;
              cur[i] = 0;
            }
          }
        }
      }

      const bars = this._waveBars;
      const balls = this._waveBalls;
      if (!bars || bars.length !== BAR_COUNT) {
        const wv = this.querySelector('#waveform');
        if (wv) { this._waveBars = wv.querySelectorAll('.wv-bar'); this._waveBalls = wv.querySelectorAll('.wv-ball'); }
        return;
      }
      for (let i = 0; i < BAR_COUNT; i++) {
        bars[i].style.height = cur[i] + 'px';
        if (balls && balls[i]) balls[i].style.bottom = peak[i] + 'px';
      }
    };

    const wv = this.querySelector('#waveform');
    if (wv) { this._waveBars = wv.querySelectorAll('.wv-bar'); this._waveBalls = wv.querySelectorAll('.wv-ball'); }
    this._waveRaf = requestAnimationFrame(tick);
  }

  _stopWaveform() {
    if (this._waveRaf) { cancelAnimationFrame(this._waveRaf); this._waveRaf = null; }
    this._waveBars = null; this._waveBalls = null;
  }

  _toggleWaveStyle() {
    this._waveStyle = (this._waveStyle || 'ball') === 'ball' ? 'classic' : 'ball';
    const wv = this.querySelector('#waveform');
    if (wv) {
      if (this._waveStyle === 'classic') {
        let html = ''; for (let i = 0; i < 25; i++) html += `<div class="wv-col"><div class="wv-ball" style="display:none"></div><div class="wv-bar"></div></div>`;
        wv.innerHTML = html;
      } else {
        let html = ''; for (let i = 0; i < 25; i++) html += `<div class="wv-col"><div class="wv-ball"></div><div class="wv-bar"></div></div>`;
        wv.innerHTML = html;
      }
      this._waveBars  = wv.querySelectorAll('.wv-bar');
      this._waveBalls = wv.querySelectorAll('.wv-ball');
    }
    const btn = this.querySelector('#btnWaveStyle');
    if (btn) btn.textContent = this._waveStyle === 'classic' ? '≡' : '⚬';
    this._toast(this._waveStyle === 'classic' ? '≡ Classic bars' : '⚬ Peak ball', 'success');
  }

  _fmtTime(s) { s = Math.max(0, Math.floor(Number(s || 0))); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; }
  _esc(s) { return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  _dbStr(v) { const d = v - 231; return (d >= 0 ? "+" : "") + d + " dB"; }
  _setConnDot(on) { const d = this.querySelector("#connDot"); if (d) d.classList.toggle("on", !!on); }
  _setConnText(t) { const el = this.querySelector("#connText"); if (el) el.textContent = t || "WS"; }

  _setOffline(offline, retryMs = 0, done = 0, total = 0) {
    this._offline = offline;
    this._offlineDone = done;
    this._offlineTotal = total;
    clearInterval(this._retryCountdownTimer);
    this._retryCountdownTimer = null;

    this._updateRoomPillState();

    const overlay = this.querySelector("#offlineOverlay");
    if (!overlay) return;

    if (!offline) { overlay.style.display = "none"; return; }

    overlay.style.display = "flex";
    this._retryIn = Math.ceil(retryMs / 1000);
    this._renderOfflineOverlay(overlay);

    if (retryMs > 0) {
      this._retryCountdownTimer = setInterval(() => {
        this._retryIn = Math.max(0, this._retryIn - 1);
        const ov = this.querySelector("#offlineOverlay");
        if (ov) this._renderOfflineOverlay(ov);
        if (this._retryIn <= 0) { clearInterval(this._retryCountdownTimer); this._retryCountdownTimer = null; }
      }, 1000);
    }
  }

  _renderOfflineOverlay(overlay) {
    const roomName = this._rooms
      ? this._rooms[this._currentRoomIdx || 0]?.name || "Thiết bị"
      : (this._config.title || "Thiết bị");
    const host = this._host || "";
    const done  = this._offlineDone  || 0;
    const total = this._offlineTotal || 0;
    const isPermanent = total > 0 && done >= total;

    const progressBar = total > 0
      ? `<div style="width:160px;height:4px;background:rgba(148,163,184,.15);border-radius:999px;margin:6px auto 0">
           <div style="height:100%;width:${Math.round(done/total*100)}%;background:${isPermanent?'#ef4444':'#a78bfa'};border-radius:999px;transition:width .3s"></div>
         </div>
         <div style="font-size:10px;color:rgba(226,232,240,.4);margin-top:3px">${done}/${total} lần thử</div>`
      : '';

    overlay.innerHTML = `
      <div class="offline-box">
        <div class="offline-icon">${isPermanent ? "🔌" : "📡"}</div>
        <div class="offline-title" style="color:${isPermanent ? "#fca5a5" : "#fcd34d"}">${isPermanent ? "Thiết bị offline" : "Đang kết nối lại..."}</div>
        <div class="offline-room">${this._esc(roomName)}</div>
        <div class="offline-host">${this._esc(host)}</div>
        ${progressBar}
        <div class="offline-retry" style="margin-top:6px">
          ${isPermanent
            ? `<span style="color:rgba(226,232,240,.45);font-size:11px">Đã thử hết ${total} lần — không kết nối được</span>`
            : (this._retryIn > 0
                ? `Thử lại sau <b>${this._retryIn}s</b>`
                : `Đang thử kết nối...`)
          }
        </div>
        <button class="offline-btn" id="btnOfflineRetry">🔄 Thử lại</button>
      </div>`;
    const btn = overlay.querySelector("#btnOfflineRetry");
    if (btn) btn.onclick = () => {
      clearTimeout(this._reconnectTimer);
      clearInterval(this._retryCountdownTimer);
      this._retryCountdownTimer = null;
      this._offlineDone = 0; this._offlineTotal = 0;
      this._dropCount = 0;
      this._connectWsAuto();
    };
  }

  _updateRoomPillState() {
    if (!this._rooms) return;
    const bar = this.querySelector("#roomBar"); if (!bar) return;
    bar.querySelectorAll(".room-pill").forEach((pill, i) => {
      const isActive = i === (this._currentRoomIdx || 0);
      pill.classList.toggle("active", isActive);
      pill.classList.toggle("offline", isActive && this._offline);
    });
  }

  _toast(msg, type = "") {
    const el = this.querySelector("#toast"); if (!el) return;
    el.textContent = msg; el.className = `toast on${type ? " " + type : ""}`;
    clearTimeout(this._toastTimer); this._toastTimer = setTimeout(() => { if (el) el.className = "toast"; }, 2200);
  }

  _render() {
    const tab = this._activeTab;
    this.innerHTML = `
<ha-card>
<div class="wrap">
  <div class="header">
    <div class="brand"><div class="badge-icon">👑</div><span class="title-text">${this._esc(this._config.title)}</span></div>
    <div class="conn-row"><div class="dot" id="connDot"></div><span class="conn-label" id="connText">WS</span></div>
  </div>
  ${this._rooms ? `
  <div class="room-bar" id="roomBar">
    ${this._rooms.map((r,i) => `<button class="room-pill ${i===(this._currentRoomIdx||0)?'active':''}" data-ridx="${i}">
      <span class="room-pill-dot"></span><span>${this._esc(r.name)}</span></button>`).join('')}
  </div>` : ''}
  <div class="tabs">
    ${["media","control","chat","system"].map(k=>`<button class="tab ${tab===k?"active":""}" data-tab="${k}">${{media:"♪ Media",control:"⚙ Control",chat:"💬 Chat",system:"✦ System"}[k]}</button>`).join("")}
  </div>
  <div class="body">
    <div class="offline-overlay" id="offlineOverlay" style="display:none"></div>
    ${this._panelMedia(tab)}
    ${this._panelControl(tab)}
    ${this._panelChat(tab)}
    ${this._panelSystem(tab)}
  </div>
  <div class="toast" id="toast"></div>
</div>
</ha-card>

<style>
*{box-sizing:border-box;margin:0;padding:0}
ha-card{border-radius:20px;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif}
.wrap{background:radial-gradient(ellipse 120% 60% at 50% 0%,rgba(109,40,217,.28),transparent 65%),linear-gradient(180deg,#0a0f1e,#060912);border:1px solid rgba(109,40,217,.2);padding:14px 14px 10px;position:relative;-webkit-tap-highlight-color:transparent}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.brand{display:flex;align-items:center;gap:9px}
.badge-icon{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,rgba(109,40,217,.4),rgba(67,20,120,.4));border:1px solid rgba(139,92,246,.35);display:grid;place-items:center;font-size:16px}
.title-text{font-weight:900;font-size:16px;color:#e2e8f0;letter-spacing:.5px}
.conn-row{display:flex;align-items:center;gap:7px}
.dot{width:9px;height:9px;border-radius:50%;background:rgba(239,68,68,.9);box-shadow:0 0 8px rgba(239,68,68,.4);transition:all .3s}
.dot.on{background:rgba(34,197,94,.9);box-shadow:0 0 10px rgba(34,197,94,.5)}
.conn-label{font-size:10px;color:rgba(226,232,240,.6)}
.room-bar{display:flex;gap:6px;overflow-x:auto;padding:0 0 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin-bottom:4px}
.room-bar::-webkit-scrollbar{display:none}
.room-pill{display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:999px;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.4);color:rgba(226,232,240,.6);transition:all .18s;flex-shrink:0}
.room-pill:hover{background:rgba(109,40,217,.2);border-color:rgba(139,92,246,.25);color:#c4b5fd}
.room-pill.active{background:linear-gradient(135deg,rgba(109,40,217,.45),rgba(91,33,182,.4));border-color:rgba(139,92,246,.5);color:#fff;box-shadow:0 2px 14px rgba(109,40,217,.3)}
.room-pill-dot{width:6px;height:6px;border-radius:50%;background:rgba(148,163,184,.4);transition:all .2s;flex-shrink:0}
.room-pill.active .room-pill-dot{background:#86efac;box-shadow:0 0 6px rgba(34,197,94,.7)}
.room-pill.offline{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.35);color:rgba(252,165,165,.9)}
.room-pill.offline .room-pill-dot{background:rgba(239,68,68,.9);box-shadow:0 0 6px rgba(239,68,68,.6);animation:offBlink 1.2s ease-in-out infinite}
@keyframes offBlink{0%,100%{opacity:1}50%{opacity:.3}}
.offline-overlay{position:absolute;inset:0;z-index:50;background:rgba(6,9,18,.92);border-radius:12px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.offline-box{text-align:center;padding:24px 20px;display:flex;flex-direction:column;align-items:center;gap:8px}
.offline-icon{font-size:40px;animation:offBlink 1.5s ease-in-out infinite}
.offline-title{font-size:16px;font-weight:900;color:#fca5a5;letter-spacing:.5px}
.offline-room{font-size:13px;font-weight:700;color:#e2e8f0}
.offline-host{font-size:10px;color:rgba(226,232,240,.4);font-family:monospace}
.offline-retry{font-size:12px;color:rgba(226,232,240,.6);margin-top:4px}
.offline-retry b{color:#fbbf24}
.offline-btn{margin-top:8px;padding:10px 24px;border-radius:12px;cursor:pointer;font-size:12px;font-weight:700;border:1px solid rgba(139,92,246,.4);background:linear-gradient(135deg,rgba(109,40,217,.5),rgba(91,33,182,.4));color:#fff;transition:all .15s}
.offline-btn:hover{box-shadow:0 2px 16px rgba(109,40,217,.5);transform:translateY(-1px)}
.tabs{display:flex;gap:6px;background:rgba(2,6,23,.5);border:1px solid rgba(148,163,184,.1);padding:5px;border-radius:14px;margin-bottom:12px}
.tab{flex:1;font-size:11px;padding:8px 6px;border-radius:10px;cursor:pointer;color:rgba(226,232,240,.6);background:transparent;border:none;font-weight:600;transition:all .2s}
.tab.active{color:#fff;background:rgba(109,40,217,.5);border:1px solid rgba(139,92,246,.3);font-weight:800;box-shadow:0 2px 12px rgba(109,40,217,.25)}
.body{height:520px;overflow:hidden;position:relative}
.panel{display:none;position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;padding-right:4px}
.panel::-webkit-scrollbar{width:4px}.panel::-webkit-scrollbar-thumb{background:rgba(139,92,246,.3);border-radius:999px}
.panel.active{display:block;animation:fadeIn .2s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.media-card{border-radius:16px;overflow:hidden;border:1px solid rgba(148,163,184,.12);background:linear-gradient(180deg,rgba(30,20,60,.9),rgba(10,15,30,.95));padding:14px;margin-bottom:12px}
.mc-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.mc-info{flex:1;min-width:0}
.mc-title{font-size:15px;font-weight:900;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-artist{font-size:11px;color:rgba(226,232,240,.55);margin-top:2px}
.mc-badges{display:flex;align-items:center;gap:6px;flex-shrink:0}
.mc-source{font-size:9px;padding:3px 8px;border-radius:6px;background:rgba(109,40,217,.3);border:1px solid rgba(139,92,246,.3);color:#c4b5fd;font-weight:800;letter-spacing:1px}
.mc-icon-btn{width:28px;height:28px;border-radius:50%;border:1px solid rgba(148,163,184,.15);background:transparent;color:rgba(226,232,240,.5);cursor:pointer;font-size:13px;display:grid;place-items:center;transition:all .15s}
.mc-icon-btn:hover{background:rgba(109,40,217,.2)}.mc-icon-btn.active-btn{color:#86efac;border-color:rgba(34,197,94,.3)}
.mc-vis{
  position:relative;border-radius:14px;overflow:hidden;margin-bottom:0;
  border:1px solid rgba(139,92,246,.2);
  background:linear-gradient(135deg,#0c0618 0%,#12082a 100%);display:flex;flex-direction:column;
}
.mc-bg{
  position:absolute;inset:0;z-index:0;
  background-size:cover;background-position:center;
  filter:blur(18px) brightness(.75) saturate(1.5);
  transform:scale(1.25);
  opacity:0;transition:opacity .6s ease;
}
.mc-bg.show{opacity:1}
.mc-vis::after{
  content:'';position:absolute;inset:0;z-index:1;
  background:linear-gradient(to bottom,rgba(4,2,12,.05) 0%,rgba(4,2,12,.25) 100%);
  pointer-events:none;
}
/* FIX 2: mc-top đảo chiều — đĩa nhạc phải, waveform trái */
.mc-top{
  display:flex;align-items:center;gap:11px;
  padding:12px 14px;position:relative;z-index:2;flex:1;
  flex-direction:row-reverse;
}
.mc-thumb-wrap{
  width:72px;height:72px;border-radius:50%;overflow:hidden;flex-shrink:0;
  border:2.5px solid rgba(139,92,246,.55);
  box-shadow:0 0 20px rgba(109,40,217,.5);position:relative;
}
.mc-thumb{width:100%;height:100%;object-fit:cover}
.mc-thumb.spin{animation:sp 12s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
.mc-thumb-fb{width:100%;height:100%;display:grid;place-items:center;background:rgba(109,40,217,.18);font-size:28px}
/* FIX 2: waveform-wrap chiếm toàn bộ phần còn lại bên trái */
.waveform-wrap{
  display:flex;flex-direction:column;align-items:flex-start;
  flex:1;height:72px;overflow:hidden;position:relative;z-index:2;
}
.waveform{display:flex;align-items:flex-end;justify-content:space-evenly;flex:1;width:100%}
/* FIX 3: nút waveform style lớn hơn, dễ thấy */
.wv-style-btn{
  flex-shrink:0;width:28px;height:28px;border-radius:50%;
  border:1px solid rgba(139,92,246,.45);
  background:rgba(109,40,217,.25);
  color:rgba(167,139,250,.95);
  cursor:pointer;font-size:14px;
  display:grid;place-items:center;
  align-self:flex-start;
  margin:0 0 4px 2px;
  transition:all .15s;padding:0;line-height:1;
}
.wv-style-btn:hover{background:rgba(109,40,217,.5);border-color:rgba(139,92,246,.7);transform:scale(1.1)}
.wv-col{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;position:relative;flex:1;height:100%}
.wv-bar{width:3px;flex-shrink:0;background:linear-gradient(to top,rgba(88,28,220,.7),rgba(167,139,250,.9));border-radius:2px 2px 1px 1px;will-change:height;height:3px;opacity:.9}
.wv-ball{position:absolute;bottom:3px;width:5px;height:5px;border-radius:50%;background:#c4b5fd;box-shadow:0 0 4px rgba(167,139,250,.8);left:50%;transform:translateX(-50%);transition:bottom 0.05s linear;pointer-events:none}
.mc-seek-wrap{
  position:relative;z-index:2;padding:4px 12px 10px 12px;flex-shrink:0;
}
.mc-seek-row{display:flex;align-items:center;gap:7px}
.mc-seek-bar{
  flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.12);
  cursor:pointer;position:relative;overflow:visible;
}
.mc-seek-fill{
  height:100%;background:linear-gradient(to right,#6d28d9,#a78bfa);
  border-radius:2px;transition:width .4s linear;pointer-events:none;
}
.mc-seek-thumb{
  position:absolute;top:50%;right:calc(100% - var(--spct,0%));
  transform:translate(50%,-50%);
  width:11px;height:11px;border-radius:50%;background:#c4b5fd;
  box-shadow:0 0 6px rgba(167,139,250,.7);opacity:0;transition:opacity .15s;pointer-events:none;
}
.mc-seek-bar:hover .mc-seek-thumb{opacity:1}
.progress-row{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.time-txt{font-size:10px;color:rgba(226,232,240,.55);min-width:32px;font-family:monospace}
.time-txt.right{text-align:right}
.seekbar-wrap{flex:1;height:6px;border-radius:999px;background:rgba(148,163,184,.15);cursor:pointer;position:relative;overflow:hidden}
.seekbar-fill{height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#a78bfa);transition:width .25s linear}
.media-controls{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:14px}
.ctrl-btn{width:38px;height:38px;border-radius:50%;border:1px solid rgba(148,163,184,.15);background:rgba(2,6,23,.4);color:rgba(226,232,240,.8);cursor:pointer;font-size:14px;display:grid;place-items:center;transition:all .15s}
.ctrl-btn:hover{background:rgba(109,40,217,.3);border-color:rgba(139,92,246,.3)}
.ctrl-btn.play{width:52px;height:52px;font-size:20px;background:linear-gradient(135deg,#7c3aed,#5b21b6);border:1px solid rgba(139,92,246,.5);box-shadow:0 4px 20px rgba(109,40,217,.4);color:#fff}
.ctrl-btn.stop{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.25);color:rgba(239,68,68,.9)}
.ctrl-btn.active-btn{background:rgba(34,197,94,.15);border-color:rgba(34,197,94,.3);color:rgba(34,197,94,.9)}
.vol-row{display:flex;align-items:center;gap:8px;margin-top:10px;padding:0 2px}
.vol-icon{font-size:12px;color:rgba(226,232,240,.6)}
.vol-label{font-size:10px;color:rgba(226,232,240,.5);min-width:40px;text-align:right}
input[type=range]{flex:1;-webkit-appearance:none;height:5px;border-radius:999px;background:rgba(148,163,184,.2);outline:none;cursor:pointer}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#7c3aed;border:2px solid rgba(167,139,250,.5);cursor:pointer}
.search-tabs{display:flex;gap:2px;margin-bottom:8px;border-bottom:1px solid rgba(148,163,184,.12);padding-bottom:6px}
.stab{padding:5px 10px;cursor:pointer;font-size:11px;font-weight:700;color:rgba(226,232,240,.5);background:transparent;border:none;border-bottom:2px solid transparent;transition:all .15s}
.stab.active{color:#a78bfa;border-bottom-color:#7c3aed}
.search-row{display:flex;gap:8px;margin-bottom:8px}
.search-inp{flex:1;background:rgba(2,6,23,.5);border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:9px 12px;color:#e2e8f0;font-size:12px;outline:none}
.search-inp:focus{border-color:rgba(139,92,246,.5)}
.search-btn{padding:9px 14px;border-radius:12px;cursor:pointer;background:linear-gradient(135deg,#7c3aed,#5b21b6);border:1px solid rgba(139,92,246,.4);color:#fff;font-size:14px}
.search-results{max-height:160px;overflow-y:auto}
.search-results::-webkit-scrollbar{width:4px}
.search-results::-webkit-scrollbar-thumb{background:rgba(139,92,246,.3);border-radius:999px}
.result-item{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:10px;cursor:pointer;border:1px solid transparent;transition:all .15px;margin-bottom:4px}
.result-item:hover{background:rgba(109,40,217,.2);border-color:rgba(139,92,246,.2)}
.result-thumb{width:36px;height:36px;border-radius:8px;object-fit:cover;background:rgba(109,40,217,.2);flex-shrink:0;font-size:16px;display:grid;place-items:center}
.result-info{flex:1;min-width:0}
.result-title{font-size:11px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.result-sub{font-size:10px;color:rgba(226,232,240,.5)}
.result-btns{display:flex;gap:4px;flex-shrink:0}
.rbtn{padding:5px 10px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700;border:none;transition:all .15s}
.rbtn-add{background:rgba(109,40,217,.25);color:#a78bfa;border:1px solid rgba(139,92,246,.3);padding:5px 8px}
.rbtn-add:hover{background:rgba(109,40,217,.4)}
.rbtn-play{background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:1px solid rgba(139,92,246,.4)}
.rbtn-play:hover{box-shadow:0 2px 10px rgba(109,40,217,.4)}
.ctrl-section{margin-bottom:12px}
.section-label{font-size:10px;color:rgba(226,232,240,.45);font-weight:700;letter-spacing:1px;margin-bottom:8px;text-transform:uppercase}
.toggle-item{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.1);background:rgba(2,6,23,.3);margin-bottom:6px}
.toggle-left .tog-name{font-size:12px;font-weight:800;color:#e2e8f0}
.toggle-left .tog-desc{font-size:10px;color:rgba(226,232,240,.5);margin-top:2px}
.sw{width:42px;height:24px;border-radius:999px;cursor:pointer;border:1px solid rgba(148,163,184,.2);background:rgba(148,163,184,.12);position:relative;transition:all .2s;flex-shrink:0}
.sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:rgba(226,232,240,.7);transition:all .18s}
.sw.on{background:rgba(34,197,94,.2);border-color:rgba(34,197,94,.4)}.sw.on::after{left:21px;background:#86efac}
.sw.unknown{opacity:.5}
.slider-row{padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.1);background:rgba(2,6,23,.3);margin-bottom:6px}
.slider-row-top{display:flex;justify-content:space-between;margin-bottom:6px}
.slider-row-top .s-name{font-size:12px;font-weight:800;color:#e2e8f0}
.slider-row-top .s-val{font-size:11px;color:#a78bfa}
.sub-tabs{display:flex;gap:4px;margin-bottom:8px}
.sub-tab{padding:5px 10px;border-radius:8px;cursor:pointer;font-size:10px;font-weight:700;border:1px solid rgba(148,163,184,.12);background:transparent;color:rgba(226,232,240,.5);transition:all .15s}
.sub-tab.active{background:rgba(109,40,217,.3);border-color:rgba(139,92,246,.3);color:#c4b5fd}
.eq-container{display:flex;justify-content:space-evenly;align-items:flex-end;padding:8px 0;width:100%}
.eq-band{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.eq-band-val{font-size:10px;font-weight:700;color:#a78bfa;text-align:center;min-height:16px;line-height:16px}
.eq-band input[type=range]{writing-mode:vertical-lr;direction:rtl;-webkit-appearance:slider-vertical;width:22px;height:95px;flex:none;padding:0}
.eq-band label{font-size:9px;color:rgba(226,232,240,.4)}
.preset-row{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:6px 0}
.preset-btn{padding:4px 10px;border-radius:8px;cursor:pointer;font-size:10px;font-weight:700;border:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.3);color:rgba(226,232,240,.5);transition:all .15s}
.preset-btn:hover{background:rgba(109,40,217,.2);border-color:rgba(139,92,246,.2);color:#c4b5fd}
.collapsible-header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.1);background:rgba(2,6,23,.4);cursor:pointer;margin-bottom:6px;transition:all .15s;user-select:none}
.collapsible-header:hover{background:rgba(109,40,217,.15);border-color:rgba(139,92,246,.2)}
.collapsible-title{font-size:11px;font-weight:800;color:#e2e8f0;display:flex;align-items:center;gap:6px}
.collapsible-arrow{font-size:10px;color:rgba(226,232,240,.5);transition:transform .2s}
.collapsible-arrow.open{transform:rotate(180deg)}
.collapsible-body{overflow:hidden;transition:max-height .3s ease}
.collapsible-body.closed{display:none}
.alarm-item{padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.1);background:rgba(2,6,23,.3);margin-bottom:6px}
.alarm-time{font-size:22px;font-weight:900;color:#e2e8f0}
.alarm-meta{font-size:10px;color:rgba(226,232,240,.5);margin-top:3px}
.alarm-actions{display:flex;gap:4px;flex-shrink:0}
.chat-wrap{border-radius:16px;overflow:hidden;border:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.4);position:relative}
.chat-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.22;display:none;pointer-events:none}
.msgs{position:relative;height:240px;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:7px;scroll-behavior:smooth}
.msgs::-webkit-scrollbar{width:4px}.msgs::-webkit-scrollbar-thumb{background:rgba(139,92,246,.3);border-radius:999px}
.mrow{display:flex}.mrow.user{justify-content:flex-end}.mrow.server{justify-content:flex-start}
.bubble{max-width:82%;padding:8px 11px;border-radius:14px;font-size:12px;line-height:1.45;color:#fff}
.bubble.user{background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:14px 14px 4px 14px}
.bubble.server{background:linear-gradient(135deg,#15803d,#16a34a);border-radius:14px 14px 14px 4px}
.chat-input-row{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(148,163,184,.1);position:relative}
.chat-inp{flex:1;background:rgba(2,6,23,.4);border:1px solid rgba(148,163,184,.15);border-radius:12px;padding:9px 12px;color:#e2e8f0;font-size:12px;outline:none}
.chat-inp:focus{border-color:rgba(139,92,246,.4)}
.send-btn{width:42px;border-radius:12px;border:1px solid rgba(34,197,94,.3);background:linear-gradient(135deg,rgba(21,128,61,.5),rgba(22,163,74,.4));color:#86efac;cursor:pointer;font-size:15px;display:grid;place-items:center}
.chat-actions{display:flex;gap:8px;padding:0 10px 8px}
.chat-action-btn{flex:1;padding:9px;border-radius:12px;cursor:pointer;font-size:11px;font-weight:700;border:1px solid rgba(109,40,217,.3);background:linear-gradient(135deg,rgba(109,40,217,.3),rgba(91,33,182,.25));color:#c4b5fd}
.chat-action-btn.alt{background:rgba(148,163,184,.1);border-color:rgba(148,163,184,.15);color:rgba(226,232,240,.8)}
.chat-action-btn.danger{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.2);color:rgba(252,165,165,.9)}
.chat-action-btn.session-active{background:linear-gradient(135deg,rgba(234,179,8,.35),rgba(161,98,7,.3));border-color:rgba(234,179,8,.4);color:#fde68a;animation:sessionPulse 2s ease-in-out infinite}
.chat-action-btn.interrupt{background:linear-gradient(135deg,rgba(239,68,68,.35),rgba(185,28,28,.3));border-color:rgba(239,68,68,.4);color:#fca5a5;animation:sessionPulse 2s ease-in-out infinite}
@keyframes sessionPulse{0%,100%{opacity:1}50%{opacity:.75}}
.tiktok-btn{display:flex;align-items:center;gap:8px;margin:0 10px 10px;padding:9px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.3);color:#e2e8f0;font-size:11px;cursor:pointer}
.tk-dot{width:8px;height:8px;border-radius:50%;background:rgba(148,163,184,.5);flex-shrink:0;transition:all .2s}
.tk-dot.on{background:rgba(34,197,94,.9);box-shadow:0 0 8px rgba(34,197,94,.5)}
.sys-info-item{padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.1);background:rgba(2,6,23,.3);margin-bottom:8px}
.sys-label{font-size:10px;color:rgba(226,232,240,.45);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.sys-value{font-size:12px;color:#e2e8f0;font-weight:700;word-break:break-all}
.stat-bar-wrap{height:8px;background:rgba(148,163,184,.12);border-radius:999px;margin-top:6px;overflow:hidden}
.stat-bar{height:100%;border-radius:999px;transition:width .5s ease}
.stat-bar.cpu{background:linear-gradient(90deg,#7c3aed,#a78bfa)}
.stat-bar.ram{background:linear-gradient(90deg,#0891b2,#38bdf8)}
.form-row{margin-bottom:8px}
.form-label{font-size:10px;color:rgba(226,232,240,.5);margin-bottom:4px}
.form-inp{width:100%;background:rgba(2,6,23,.4);border:1px solid rgba(148,163,184,.15);border-radius:10px;padding:8px 10px;color:#e2e8f0;font-size:11px;outline:none}
.form-inp:focus{border-color:rgba(139,92,246,.4)}
select.form-inp{cursor:pointer}
.form-btn{padding:8px 14px;border-radius:10px;cursor:pointer;font-size:11px;font-weight:700;border:1px solid rgba(139,92,246,.3);background:rgba(109,40,217,.3);color:#c4b5fd}
.form-btn.sm{padding:6px 10px;font-size:10px}
.form-btn.danger{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.25);color:rgba(252,165,165,.9)}
.form-btn.green{background:rgba(34,197,94,.15);border-color:rgba(34,197,94,.3);color:#86efac}
.wifi-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:10px;border:1px solid rgba(148,163,184,.1);background:rgba(2,6,23,.25);margin-bottom:5px;cursor:pointer}
.wifi-item:hover{background:rgba(109,40,217,.1)}
.wifi-ssid{font-size:11px;color:#e2e8f0;font-weight:700}
.wifi-rssi{font-size:10px;color:rgba(226,232,240,.5)}
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:200;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}
.modal-box{background:linear-gradient(180deg,#0f172a,#0a0f1e);border:1px solid rgba(139,92,246,.2);border-radius:18px;padding:18px;max-width:420px;width:100%;max-height:85vh;overflow-y:auto}
.modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.modal-head h3{font-size:14px;font-weight:900;color:#e2e8f0}
.modal-close{background:none;border:none;color:rgba(226,232,240,.5);cursor:pointer;font-size:18px;padding:4px}
.modal-close:hover{color:#e2e8f0}
.pl-item{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:10px;border:1px solid rgba(148,163,184,.1);background:rgba(2,6,23,.25);margin-bottom:5px}
.pl-name{font-size:11px;font-weight:700;color:#e2e8f0;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-count{font-size:9px;color:rgba(226,232,240,.45);margin-left:8px}
.pl-btns{display:flex;gap:3px;margin-left:8px}
.al-days{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.al-days label{display:flex;align-items:center;gap:3px;font-size:10px;color:rgba(226,232,240,.6);cursor:pointer}
.al-days input{width:14px;height:14px;accent-color:#7c3aed}
.toast{position:fixed;z-index:9999;left:50%;transform:translateX(-50%);bottom:16px;background:rgba(2,6,23,.9);border:1px solid rgba(148,163,184,.2);color:#e2e8f0;padding:9px 14px;border-radius:12px;font-size:11px;opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;white-space:nowrap}
.toast.on{opacity:1;transform:translateX(-50%) translateY(-6px)}
.toast.success{border-color:rgba(34,197,94,.3);color:#86efac}
.toast.error{border-color:rgba(239,68,68,.3);color:#fca5a5}
.fx{display:flex}.aic{align-items:center}.jcb{justify-content:space-between}.g4{gap:4px}.g6{gap:6px}.g8{gap:8px}.mt6{margin-top:6px}.mt8{margin-top:8px}.mb6{margin-bottom:6px}.mb8{margin-bottom:8px}.f1{flex:1;min-width:0}.o5{opacity:.5}
.hidden{display:none!important}
@media(max-width:480px){.wrap{padding:10px 10px 8px}.title-text{font-size:14px}.badge-icon{width:28px;height:28px;font-size:13px}.tabs{padding:4px;gap:4px}.tab{font-size:10px;padding:7px 4px}.body{height:460px}.mc-thumb-wrap{width:60px;height:60px}.mc-vis{height:86px}.mc-title{font-size:13px}.ctrl-btn{width:34px;height:34px;font-size:13px}.ctrl-btn.play{width:46px;height:46px;font-size:18px}.msgs{height:200px}.bubble{font-size:11px}.toggle-left .tog-name{font-size:11px}.sw{width:38px;height:22px}.sw::after{width:14px;height:14px;top:3px;left:3px}.sw.on::after{left:19px}.rbtn{font-size:10px;padding:4px 8px}.eq-band input[type=range]{height:70px}.eq-band-val{font-size:9px}}
</style>
`;
    this._setConnDot(this._wsConnected);
    if (this._rooms) this._renderRoomPills();
    if (this._offline) this._setOffline(true, this._retryIn * 1000);
    this._renderMedia(); this._renderVolume();
    this._renderControlToggles(); this._renderLight();
    this._renderWakeWord(); this._renderCustomAi(); this._renderVoice();
    this._renderOta(); this._renderHass();
    this._renderWifiStatus(); this._renderWifiSaved();
    this._renderChatMsgs(); this._renderChatBg(); this._renderTikTok(); this._renderSessionBtn();
    this._renderSystem(); this._renderAlarms();
  }

  // ============================================================
  // FIX 2: Layout đĩa nhạc phải — waveform + nút trái
  // ============================================================
  _panelMedia(tab) {
    let wvContent = '';
    for (let i = 0; i < 25; i++) {
      wvContent += `<div class="wv-col"><div class="wv-ball"></div><div class="wv-bar"></div></div>`;
    }
    return `
<div class="panel ${tab==="media"?"active":""}" id="p-media">
  <div class="media-card">
    <div class="mc-header">
      <div class="mc-info">
        <div class="mc-title" id="mediaTitle">Không có nhạc</div>
        <div class="mc-artist" id="mediaArtist">---</div>
      </div>
      <div class="mc-badges">
        <span class="mc-source" id="sourceLabel">IDLE</span>
        <button class="mc-icon-btn" id="btnRepeat" title="Repeat">↻</button>
        <button class="mc-icon-btn" id="btnShuffle" title="Shuffle">⇄</button>
      </div>
    </div>
    <div class="mc-vis" id="mcVis">
      <div class="mc-bg" id="mcBg"></div>
      <div class="mc-top">
        <div class="mc-thumb-wrap">
          <img id="mediaThumb" class="mc-thumb" style="display:none" />
          <div id="thumbFallback" class="mc-thumb-fb">🎵</div>
        </div>
        <div class="waveform-wrap" id="waveformWrap" style="display:none">
          <button class="wv-style-btn" id="btnWaveStyle" title="Đổi kiểu hiệu ứng">⚬</button>
          <div class="waveform" id="waveform">${wvContent}</div>
        </div>
      </div>
      <div class="mc-seek-wrap">
        <div class="mc-seek-row">
          <span class="time-txt" id="posText">0:00</span>
          <div class="mc-seek-bar" id="seekWrap">
            <div class="mc-seek-fill" id="seekBar"></div>
            <div class="mc-seek-thumb" id="seekThumb"></div>
          </div>
          <span class="time-txt right" id="durText">0:00</span>
        </div>
      </div>
    </div>
    <div class="media-controls">
      <button class="ctrl-btn" id="btnPrev" title="Previous">⏮</button>
      <button class="ctrl-btn play" id="btnPlayPause" title="Play/Pause">▶</button>
      <button class="ctrl-btn stop" id="btnStop" title="Stop">■</button>
      <button class="ctrl-btn" id="btnNext" title="Next">⏭</button>
    </div>
    <div class="vol-row">
      <span class="vol-icon">🔊</span>
      <input type="range" id="volSlider" min="0" max="15" value="0" />
      <span class="vol-label" id="volLabel">0</span>
    </div>
  </div>
  <div class="search-tabs">
    <button class="stab active" data-stab="songs">Songs</button>
    <button class="stab" data-stab="playlist">Playlist</button>
    <button class="stab" data-stab="zing">Zing MP3</button>
    <button class="stab" data-stab="playlists">≡ Playlists</button>
  </div>
  <div class="search-row" id="searchBox">
    <input class="search-inp" id="searchInp" placeholder="Tìm bài hát..." autocomplete="off" />
    <button class="search-btn" id="searchBtn">🔍</button>
  </div>
  <div id="plMgr" class="hidden">
    <div class="fx g4 mb6"><button class="form-btn sm" id="btnPlCreate">+ Tạo playlist</button><button class="form-btn sm" id="btnPlRefresh">🔄</button></div>
    <div id="plList"></div>
    <div id="plSongs" class="hidden mt6"></div>
  </div>
  <div id="searchResults" class="search-results"></div>
</div>`;
  }

  _panelControl(tab) {
    let voiceOpts = ''; for (let i = 1; i <= 30; i++) voiceOpts += `<option value="${i}">${i}. ${VOICES[i]}</option>`;
    const at = this._activeAudioTab, lt = this._activeLightTab;
    const audioOpen = this._audioOpen, lightOpen = this._lightOpen;
    return `
<div class="panel ${tab==="control"?"active":""}" id="p-control">
  <div class="ctrl-section">
    <div class="section-label">📡 CONTROL</div>
    <div class="toggle-item"><div class="toggle-left"><div class="tog-name">🎙 Wake Word (Ô Kề Na Bu)</div></div><div class="sw unknown" id="swWake"></div></div>
    <div id="wakeSensRow" style="display:none">
      <div class="slider-row"><div class="slider-row-top"><span class="s-name">Độ nhạy (nên để 0.95~0.99)</span><span class="s-val" id="wakeVal">0.90</span></div><input type="range" id="wakeSlider" min="0" max="1" step="0.01" value="0.90" style="width:100%" /><div class="fx jcb" style="font-size:9px;color:rgba(226,232,240,.35)"><span>Dễ kích hoạt</span><span>Khó kích hoạt</span></div></div>
    </div>
    <div class="toggle-item" id="customAiRow" style="display:none"><div class="toggle-left"><div class="tog-name">🧠 Chống Điếc AI</div><div class="tog-desc">Khi bật sẽ nhận diện giọng nói chuẩn 99% và đổi giọng AI</div></div><div class="sw unknown" id="swCustomAi"></div></div>
  </div>
  <div class="ctrl-section" id="voiceRow" style="display:none">
    <div class="section-label">🎤 Chọn Giọng Nói AI</div>
    <div class="fx g4 aic"><select class="form-inp" id="voiceSel" style="flex:1">${voiceOpts}</select><button class="form-btn sm" id="btnVoicePv">▶ Play</button></div>
  </div>
  <div class="ctrl-section" id="live2dRow" style="display:none">
    <div class="section-label">👤 Chọn Model Live2D</div>
    <select class="form-inp" id="live2dSel"><option value="hiyori">Hiyori</option><option value="mao">Mao</option><option value="miara">Miara</option><option value="nicole">Nicole</option><option value="changli">Changli</option></select>
  </div>
  <div class="ctrl-section">
    <div class="toggle-item"><div class="toggle-left"><div class="tog-name">📡 DLNA</div></div><div class="sw unknown" id="swDlna"></div></div>
    <div class="toggle-item"><div class="toggle-left"><div class="tog-name">🍎 AirPlay</div></div><div class="sw unknown" id="swAirplay"></div></div>
    <div class="toggle-item"><div class="toggle-left"><div class="tog-name">🔵 Bluetooth</div></div><div class="sw unknown" id="swBt"></div></div>
    <div class="toggle-item"><div class="toggle-left"><div class="tog-name">💡 Đèn LED Chờ (Tắt để nháy theo nhạc)</div></div><div class="sw unknown" id="swLed"></div></div>
  </div>

  <div class="ctrl-section">
    <div class="collapsible-header" id="audioCollHeader">
      <span class="collapsible-title">🎛 Audio Engine</span>
      <span class="collapsible-arrow ${audioOpen ? 'open' : ''}" id="audioArrow">▼</span>
    </div>
    <div class="collapsible-body ${audioOpen ? '' : 'closed'}" id="audioCollBody">
      <div class="sub-tabs" style="margin-top:6px">
        <button class="sub-tab ${at==='eq'?'active':''}" data-atab="eq">Equalizer</button>
        <button class="sub-tab ${at==='sur'?'active':''}" data-atab="sur">Surround</button>
      </div>
      <div id="audioEq" class="${at!=='eq'?'hidden':''}">
        <div class="toggle-item mb6"><div class="toggle-left"><div class="tog-name">🎚 Equalizer Enable</div></div><div class="sw" id="swEq"></div></div>
        <div class="eq-container" id="eqBands"></div>
        <div class="preset-row">${['flat','bass','vocal','rock','jazz'].map(p=>`<button class="preset-btn" data-pr="${p}">${p==='bass'?'Bass Boost':p.charAt(0).toUpperCase()+p.slice(1)}</button>`).join('')}</div>
        <div class="toggle-item mt6"><div class="toggle-left"><div class="tog-name">🎵 Tăng cường bass</div></div><div class="sw" id="swBass"></div></div>
        <div class="slider-row"><div class="slider-row-top"><span class="s-name">Strength</span><span class="s-val" id="bassVal">0%</span></div><input type="range" id="bassSlider" min="0" max="1000" step="10" value="0" style="width:100%" /><div class="fx jcb" style="font-size:9px;color:rgba(226,232,240,.35)"><span>0%</span><span>50%</span><span>100%</span></div></div>
        <div class="toggle-item mt6"><div class="toggle-left"><div class="tog-name">🔊 Độ lớn âm thanh</div></div><div class="sw" id="swLoud"></div></div>
        <div class="slider-row"><div class="slider-row-top"><span class="s-name">Gain</span><span class="s-val" id="loudVal">0.0 dB</span></div><input type="range" id="loudSlider" min="-3000" max="3000" value="0" style="width:100%" /><div class="fx jcb" style="font-size:9px;color:rgba(226,232,240,.35)"><span>-30 dB</span><span>0 dB</span><span>+30 dB</span></div></div>
        <div class="section-label mt8">🔊 Dải Trung-Cao</div>
        <div class="slider-row"><div class="slider-row-top"><span class="s-name">Âm trầm trung</span><span class="s-val" id="bvVal">+0 dB</span></div><input type="range" id="bvSlider" min="211" max="251" value="231" style="width:100%" /><div class="fx jcb" style="font-size:9px;color:rgba(226,232,240,.35)"><span>-20 dB</span><span>0 dB</span><span>+20 dB</span></div></div>
        <div class="slider-row"><div class="slider-row-top"><span class="s-name">Âm nốt cao</span><span class="s-val" id="hvVal">+0 dB</span></div><input type="range" id="hvSlider" min="211" max="251" value="231" style="width:100%" /><div class="fx jcb" style="font-size:9px;color:rgba(226,232,240,.35)"><span>-20 dB</span><span>0 dB</span><span>+20 dB</span></div></div>
      </div>
      <div id="audioSur" class="${at!=='sur'?'hidden':''}">
        <div class="slider-row"><div class="slider-row-top"><span class="s-name">↔ Width</span><span class="s-val" id="surWVal">40</span></div><input type="range" id="surW" min="0" max="100" value="40" style="width:100%" /></div>
        <div class="slider-row"><div class="slider-row-top"><span class="s-name">🎯 Presence</span><span class="s-val" id="surPVal">30</span></div><input type="range" id="surP" min="0" max="100" value="30" style="width:100%" /></div>
        <div class="slider-row"><div class="slider-row-top"><span class="s-name">🌌 Space</span><span class="s-val" id="surSVal">10</span></div><input type="range" id="surS" min="0" max="100" value="10" style="width:100%" /></div>
        <div class="preset-row"><button class="preset-btn" data-sur="cinema">🎬 Cinema</button><button class="preset-btn" data-sur="wide">🌌 Wide Space</button><button class="preset-btn" data-sur="reset">↺ Reset</button></div>
      </div>
    </div>
  </div>

  <div class="ctrl-section">
    <div class="collapsible-header" id="lightCollHeader">
      <span class="collapsible-title">💡 Lighting Control</span>
      <span class="collapsible-arrow ${lightOpen ? 'open' : ''}" id="lightArrow">▼</span>
    </div>
    <div class="collapsible-body ${lightOpen ? '' : 'closed'}" id="lightCollBody">
      <div class="sub-tabs" style="margin-top:6px">
        <button class="sub-tab ${lt==='main'?'active':''}" data-ltab="main">Đèn Chính (RGB)</button>
        <button class="sub-tab ${lt==='edge'?'active':''}" data-ltab="edge">Đèn Viền (Edge)</button>
      </div>
      <div id="lightMain" class="${lt!=='main'?'hidden':''}">
        <div class="toggle-item"><div class="toggle-left"><div class="tog-name">Trạng thái</div></div><div class="sw unknown" id="swLight"></div></div>
        <div class="slider-row"><div class="slider-row-top"><span class="s-name">⚙ Cường độ sáng</span><span class="s-val" id="brightVal">200</span></div><input type="range" id="brightSlider" min="1" max="200" value="200" style="width:100%" /></div>
        <div class="slider-row"><div class="slider-row-top"><span class="s-name">⚡ Tốc độ</span><span class="s-val" id="speedVal">1</span></div><input type="range" id="speedSlider" min="1" max="100" value="1" style="width:100%" /></div>
        <div class="section-label mt6" style="font-size:11px">Chế độ tích hợp (Firmware)</div>
        <div class="preset-row">${[['0','Mặc Định'],['1','Xoay vòng'],['2','Nháy 1'],['3','Đơn sắc'],['4','Nháy 2'],['7','Hơi thở']].map(([v,n])=>`<button class="preset-btn" data-lmode="${v}">${n}</button>`).join('')}</div>
      </div>
      <div id="lightEdge" class="${lt!=='edge'?'hidden':''}">
        <div class="toggle-item"><div class="toggle-left"><div class="tog-name">Trạng thái</div></div><div class="sw" id="swEdge"></div></div>
        <div class="slider-row"><div class="slider-row-top"><span class="s-name">💡 Cường độ viền</span><span class="s-val" id="edgeVal">100%</span></div><input type="range" id="edgeSlider" min="0" max="100" value="100" style="width:100%" /></div>
      </div>
    </div>
  </div>

  <div class="ctrl-section">
    <div class="fx jcb aic mb6"><div class="section-label" style="margin:0">⏰ Báo thức</div>
    <div class="fx g4"><button class="form-btn sm" id="btnAlarmAdd">+ Thêm</button><button class="form-btn sm" id="btnAlarmRefresh">🔄</button></div></div>
    <div id="alarmList"><div style="text-align:center;padding:12px;color:rgba(226,232,240,.4);font-size:11px">Chưa có báo thức</div></div>
  </div>
</div>`;
  }

  _panelChat(tab) {
    return `
<div class="panel ${tab==="chat"?"active":""}" id="p-chat">
  <div class="chat-wrap">
    <img class="chat-bg" id="chatBg" alt="" />
    <div class="msgs" id="chatMsgs"><div style="text-align:center;padding:30px 0;color:rgba(226,232,240,.4);font-size:12px">Chưa có tin nhắn</div></div>
    <div class="chat-input-row">
      <input class="chat-inp" id="chatInp" placeholder="Nhập tin nhắn..." autocomplete="off" />
      <button class="send-btn" id="chatSend">➤</button>
    </div>
    <div class="chat-actions">
      <button class="chat-action-btn session-btn" id="btnSession">🎤 Wake Up</button>
      <button class="chat-action-btn alt" id="btnTestMic">🎙 Test Mic</button>
      <button class="chat-action-btn danger" id="btnChatClear">🧹 Clear</button>
    </div>
    <button class="tiktok-btn" id="btnTikTok"><div class="tk-dot" id="tkDot"></div><span>📹</span><span id="tkText">TikTok Reply: OFF</span></button>
  </div>
</div>`;
  }

  _panelSystem(tab) {
    const roomInfo = this._rooms
      ? `<div class="sys-info-item mb6"><div class="sys-label">Thiết bị đang chọn</div><div class="sys-value" style="color:#a78bfa">${this._esc(this._rooms[this._currentRoomIdx||0]?.name||"—")}</div><div style="font-size:10px;color:rgba(226,232,240,.4);margin-top:3px">${this._esc(this._rooms[this._currentRoomIdx||0]?.host||"—")}</div></div>`
      : '';
    return `
<div class="panel ${tab==="system"?"active":""}" id="p-system">
  ${roomInfo}
  <div class="sys-info-item"><div class="sys-label">CPU</div><div class="sys-value" id="cpuVal">0%</div><div class="stat-bar-wrap"><div class="stat-bar cpu" id="cpuBar" style="width:0%"></div></div></div>
  <div class="sys-info-item"><div class="sys-label">RAM</div><div class="sys-value" id="ramVal">0%</div><div class="stat-bar-wrap"><div class="stat-bar ram" id="ramBar" style="width:0%"></div></div></div>
  <div class="sys-info-item"><div class="sys-label">MAC Address</div>
  <div class="fx jcb aic"><div class="sys-value" id="macVal">--</div><span style="font-size:9px;color:rgba(226,232,240,.4)" id="macType"></span></div>
  <div class="fx g4 mt6"><button class="form-btn sm" id="btnMacGet">🔄</button><button class="form-btn sm" id="btnMacRandom">🔀 Random</button><button class="form-btn sm danger" id="btnMacReal">MAC thực</button></div></div>
  <div class="ctrl-section mt8"><div class="section-label">OTA Server</div>
  <div class="form-row"><select class="form-inp" id="otaSel"></select></div>
  <div class="fx g4"><button class="form-btn sm" id="btnOtaRefresh">🔄</button><button class="form-btn sm" id="btnOtaSave">💾 Lưu</button></div></div>
  <div class="ctrl-section mt8"><div class="section-label">Home Assistant</div>
  <div class="form-row"><div class="form-label">HA URL</div><input class="form-inp" id="hassUrl" placeholder="http://192.168.x.x:8123" /></div>
  <div class="form-row"><div class="form-label">Agent ID</div><input class="form-inp" id="hassAgent" placeholder="conversation.xxx" /></div>
  <div class="form-row"><div class="form-label">API Key</div><input class="form-inp" id="hassKey" placeholder="eyJ..." type="password" /></div>
  <button class="form-btn" id="btnHassSave">💾 Lưu HASS</button></div>
  <div class="ctrl-section mt8"><div class="section-label">WiFi</div>
  <div id="wifiStatusArea"></div>
  <div class="fx g4 mt6"><button class="form-btn sm" id="btnWifiScan">📡 Quét WiFi</button><button class="form-btn sm" id="btnWifiSavedRef">🔄 Đã lưu</button></div>
  <div id="wifiScanArea" class="mt6"></div>
  <div id="wifiSavedArea" class="mt6"></div></div>
  <div class="sys-info-item mt8"><div class="sys-label">Kết nối</div>
  <div class="sys-value" style="font-size:10px">${this._esc(this._isHttps()?"HTTPS – tunnel WSS":"HTTP – WS LAN")} | ${this._isHttps() ? (this._tunnelWsUrl() ? `Tunnel: ${this._esc(this._tunnelWsUrl())}` : "Chưa có tunnel") : `LAN: ${this._esc(this._lanWsUrl())}`}</div></div>
</div>`;
  }

  _bind() {
    if (this._rooms) {
      this.querySelectorAll(".room-pill").forEach(pill => {
        pill.onclick = () => this._switchRoom(parseInt(pill.dataset.ridx));
      });
    }

    this.querySelectorAll(".tab").forEach(b => { b.onclick = () => {
      const newTab = b.dataset.tab;
      if (newTab === this._activeTab) return;
      this._activeTab = newTab;
      this._render(); this._bind();
      this._loadTab(newTab);
    }; });

    this._on("#btnWaveStyle", () => this._toggleWaveStyle());
    this._on("#seekWrap", null, el => { el.onclick = e => { const m = this._state.media; if (!m.duration) return; const r = el.getBoundingClientRect(); const pos = Math.floor(m.duration * Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); m.position = pos; this._send({ action: "seek", position: pos }); this._updateProgressOnly(); }; });
    this._on("#btnPlayPause", () => {
      if (this._state.media.isPlaying) this._send({ action: "pause" });
      else this._send({ action: "resume" });
      this._sendSpk({ type: 'send_message', what: 65536, arg1: 0, arg2: 1, obj: 'playorpause' });
    });
    this._on("#btnStop", () => { this._send({ action: "stop" }); this._sendSpk({ type: 'send_message', what: 65536, arg1: 0, arg2: 1, obj: 'stop' }); });
    this._on("#btnPrev", () => { this._send({ action: "prev" }); this._sendSpk({ type: 'send_message', what: 65536, arg1: 0, arg2: 1, obj: 'pre' }); });
    this._on("#btnNext", () => { this._send({ action: "next" }); this._sendSpk({ type: 'send_message', what: 65536, arg1: 0, arg2: 1, obj: 'next' }); });
    this._on("#btnRepeat", () => this._send({ action: "toggle_repeat" }));
    this._on("#btnShuffle", () => this._send({ action: "toggle_auto_next" }));

    this.querySelectorAll(".stab").forEach(b => { b.onclick = () => {
      this._activeSearchTab = b.dataset.stab;
      this.querySelectorAll(".stab").forEach(x => x.classList.remove("active")); b.classList.add("active");
      const isPlaylists = b.dataset.stab === "playlists";
      const sb = this.querySelector("#searchBox"), pm = this.querySelector("#plMgr"), sr = this.querySelector("#searchResults");
      if (sb) sb.classList.toggle("hidden", isPlaylists);
      if (sr) sr.classList.toggle("hidden", isPlaylists);
      if (pm) pm.classList.toggle("hidden", !isPlaylists);
      if (isPlaylists) this._send({ action: "playlist_list" });
      else if (sr) sr.innerHTML = "";
    }; });
    this._on("#searchBtn", () => this._doSearch());
    const si = this.querySelector("#searchInp"); if (si) si.onkeypress = e => { if (e.key === "Enter") this._doSearch(); };
    this._on("#btnPlCreate", () => { const n = prompt("Tên playlist:"); if (n?.trim()) this._send({ action: "playlist_create", name: n.trim() }); });
    this._on("#btnPlRefresh", () => this._send({ action: "playlist_list" }));

    const vs = this.querySelector("#volSlider");
    if (vs) {
      vs.oninput = () => {
        const v = parseInt(vs.value, 10);
        this._volDragging = true;
        this._state.volume = v;
        const l = this.querySelector("#volLabel"); if (l) l.textContent = `Mức ${v}`;
        clearTimeout(this._volSendTimer);
        this._volSendTimer = setTimeout(() => this._sendVolume(v), 100);
        clearTimeout(this._volLockTimer);
        this._volLockTimer = setTimeout(() => { this._volDragging = false; }, 2000);
      };
      vs.onchange = () => {
        clearTimeout(this._volSendTimer);
        const v = parseInt(vs.value, 10);
        this._state.volume = v;
        this._sendVolume(v);
        clearTimeout(this._volLockTimer);
        this._volLockTimer = setTimeout(() => { this._volDragging = false; }, 2000);
      };
    }

    this._bindSwitch("#swLed", () => { this._ctrlGuard = Date.now(); this._state.ledEnabled = !this._state.ledEnabled; this._send({ action: "led_toggle" }); this._renderControlToggles(); });
    this._bindSwitch("#swDlna", () => { this._ctrlGuard = Date.now(); this._state.dlnaOpen = !this._state.dlnaOpen; this._sendSpk({ type: "Set_DLNA_Open", open: this._state.dlnaOpen ? 1 : 0 }); this._renderControlToggles(); });
    this._bindSwitch("#swAirplay", () => { this._ctrlGuard = Date.now(); this._state.airplayOpen = !this._state.airplayOpen; this._sendSpk({ type: "Set_AirPlay_Open", open: this._state.airplayOpen ? 1 : 0 }); this._renderControlToggles(); });
    this._bindSwitch("#swBt", () => {
      this._ctrlGuard = Date.now();
      this._state.bluetoothOn = !this._state.bluetoothOn;
      if (this._state.bluetoothOn) { this._sendSpk({ type: "send_message", what: 64, arg1: 1, arg2: -1, type_id: "Open Bluetooth" }); }
      else { this._sendSpk({ type: "send_message", what: 64, arg1: 2, arg2: -1, type_id: "Close Bluetooth" }); }
      this._renderControlToggles();
    });

    const audioHdr = this.querySelector("#audioCollHeader");
    if (audioHdr) {
      audioHdr.onclick = () => {
        this._audioOpen = !this._audioOpen;
        const body = this.querySelector("#audioCollBody");
        const arrow = this.querySelector("#audioArrow");
        if (body) body.classList.toggle("closed", !this._audioOpen);
        if (arrow) arrow.classList.toggle("open", this._audioOpen);
        if (this._audioOpen) this._buildEqBands();
      };
    }

    const lightHdr = this.querySelector("#lightCollHeader");
    if (lightHdr) {
      lightHdr.onclick = () => {
        this._lightOpen = !this._lightOpen;
        const body = this.querySelector("#lightCollBody");
        const arrow = this.querySelector("#lightArrow");
        if (body) body.classList.toggle("closed", !this._lightOpen);
        if (arrow) arrow.classList.toggle("open", this._lightOpen);
      };
    }

    this.querySelectorAll("[data-ltab]").forEach(b => { b.onclick = () => {
      this._activeLightTab = b.dataset.ltab;
      this.querySelectorAll("[data-ltab]").forEach(x => x.classList.remove("active")); b.classList.add("active");
      const lm = this.querySelector("#lightMain"), le = this.querySelector("#lightEdge");
      if (lm) lm.classList.toggle("hidden", b.dataset.ltab !== "main");
      if (le) le.classList.toggle("hidden", b.dataset.ltab !== "edge");
    }; });
    this._bindSwitch("#swLight", () => { this._ctrlGuard = Date.now(); this._state.lightEnabled = !this._state.lightEnabled; this._sendSpkMsg(64, this._state.lightEnabled ? 1 : 0); this._renderLight(); });
    this._bindSlider("#brightSlider", "#brightVal", v => { this._ctrlGuard = Date.now(); this._sendSpkMsg(65, v); }, v => v);
    this._bindSlider("#speedSlider", "#speedVal", v => { this._ctrlGuard = Date.now(); this._sendSpkMsg(66, v); }, v => v);

    this._bindSwitch("#swEdge", () => {
      this._ctrlGuard = Date.now(); this._state.edgeOn = !this._state.edgeOn;
      this._sendSpk({ type_id: 'Turn on light', type: 'shell', shell: this._state.edgeOn ? 'lights_test set 7fffff8000 ffffff' : 'lights_test set 7fffff8000 0' });
      this._updateSwitch("#swEdge", this._state.edgeOn);
    });
    this._bindSlider("#edgeSlider", "#edgeVal", v => {
      this._ctrlGuard = Date.now(); if (!this._state.edgeOn) return;
      const h = Math.round((v / 100) * 255).toString(16).padStart(2, '0');
      this._sendSpk({ type_id: 'Turn on light', type: 'shell', shell: `lights_test set 7fffff8000 ${h}${h}${h}` });
    }, v => v + "%");

    this.querySelectorAll("[data-lmode]").forEach(b => { b.onclick = () => { const mode = parseInt(b.dataset.lmode); this._sendSpkMsg(67, mode); this._state.lightMode = mode; }; });

    this.querySelectorAll("[data-atab]").forEach(b => { b.onclick = () => {
      this._activeAudioTab = b.dataset.atab;
      this.querySelectorAll("[data-atab]").forEach(x => x.classList.remove("active")); b.classList.add("active");
      const eq = this.querySelector("#audioEq"), sur = this.querySelector("#audioSur");
      if (eq) eq.classList.toggle("hidden", b.dataset.atab !== "eq");
      if (sur) sur.classList.toggle("hidden", b.dataset.atab !== "sur");
    }; });

    this._bindSwitch("#swEq", () => {
      this._audioGuard = Date.now();
      this._state.eqEnabled = !this._state.eqEnabled;
      this._sendSpk({ type: "set_eq_enable", enable: this._state.eqEnabled });
      this._updateSwitch("#swEq", this._state.eqEnabled);
    });

    this._buildEqBands();
    this.querySelectorAll("[data-pr]").forEach(b => { b.onclick = () => {
      this._audioGuard = Date.now();
      const vals = EQ_PRESETS[b.dataset.pr]; if (!vals) return;
      vals.forEach((v, i) => { this._sendSpk({ type: "set_eq_bandlevel", band: i, level: parseInt(v) }); this._state.eqBands[i] = v; });
      this._renderEqBands();
    }; });

    this._bindSwitch("#swBass", () => { this._audioGuard = Date.now(); this._state.bass.enabled = !this._state.bass.enabled; this._sendSpk({ type: "set_bass_enable", enable: this._state.bass.enabled }); this._updateSwitch("#swBass", this._state.bass.enabled); });
    this._bindSlider("#bassSlider", "#bassVal", v => { this._audioGuard = Date.now(); this._sendSpk({ type: "set_bass_strength", strength: parseInt(v) }); }, v => Math.round(v / 10) + "%");

    this._bindSwitch("#swLoud", () => { this._audioGuard = Date.now(); this._state.loudness.enabled = !this._state.loudness.enabled; this._sendSpk({ type: "set_loudness_enable", enable: this._state.loudness.enabled }); this._updateSwitch("#swLoud", this._state.loudness.enabled); });
    this._bindSlider("#loudSlider", "#loudVal", v => { this._audioGuard = Date.now(); this._sendSpk({ type: "set_loudness_gain", gain: parseInt(v) }); }, v => (v / 100).toFixed(1) + " dB");

    this._bindSlider("#bvSlider", "#bvVal", v => {
      this._audioGuard = Date.now();
      this._sendSpk({ type: "sends", list: [{ type: "setMixerValue", controlName: "DAC Digital Volume L", value: String(v) }, { type: "get_eq_config" }] });
    }, v => this._dbStr(v));
    this._bindSlider("#hvSlider", "#hvVal", v => {
      this._audioGuard = Date.now();
      this._sendSpk({ type: "sends", list: [{ type: "setMixerValue", controlName: "DAC Digital Volume R", value: String(v) }, { type: "get_eq_config" }] });
    }, v => this._dbStr(v));

    this._bindSlider("#surW", "#surWVal", v => { this._audioGuard = Date.now(); this._sendSpkMsg(60, v); }, v => v);
    this._bindSlider("#surP", "#surPVal", null, v => v);
    this._bindSlider("#surS", "#surSVal", null, v => v);
    this.querySelectorAll("[data-sur]").forEach(b => { b.onclick = () => {
      this._audioGuard = Date.now();
      let w, p, s;
      if (b.dataset.sur === "cinema") { w=70; p=50; s=30; }
      else if (b.dataset.sur === "wide") { w=90; p=40; s=60; }
      else { w=40; p=30; s=10; }
      this._setSlider("#surW", "#surWVal", w); this._setSlider("#surP", "#surPVal", p); this._setSlider("#surS", "#surSVal", s);
      this._sendSpkMsg(60, w);
    }; });

    this._bindSwitch("#swWake", () => { const en = !this._state.wakeWordEnabled; this._state.wakeWordEnabled = en; this._send({ action: "wake_word_set_enabled", enabled: en }); this._renderWakeWord(); });
    const wsl = this.querySelector("#wakeSlider");
    if (wsl) { wsl.oninput = () => { const v = this.querySelector("#wakeVal"); if (v) v.textContent = parseFloat(wsl.value).toFixed(2); }; wsl.onchange = () => this._send({ action: "wake_word_set_sensitivity", sensitivity: parseFloat(wsl.value) }); }

    this._bindSwitch("#swCustomAi", () => { const en = !this._state.customAiEnabled; this._state.customAiEnabled = en; this._send({ action: "custom_ai_set_enabled", enabled: en }); this._renderCustomAi(); });
    const vsel = this.querySelector("#voiceSel"); if (vsel) vsel.onchange = () => this._send({ action: "voice_id_set", voice_id: parseInt(vsel.value) });
    this._on("#btnVoicePv", () => { const vid = parseInt(this.querySelector("#voiceSel")?.value || 1); const a = new Audio(VBASE + (VFILES[vid] || 'ngocanh') + '.mp3'); a.play().catch(() => this._toast("Không phát được", "error")); });
    const l2d = this.querySelector("#live2dSel"); if (l2d) l2d.onchange = () => this._send({ action: "live2d_set_model", model: l2d.value });

    this._on("#btnAlarmAdd", () => this._showAlarmModal());
    this._on("#btnAlarmRefresh", () => this._send({ action: "alarm_list" }));
    this._renderAlarms();

    this._on("#chatSend", () => this._sendChat());
    const ci = this.querySelector("#chatInp"); if (ci) ci.onkeypress = e => { if (e.key === "Enter") this._sendChat(); };
    this._on("#btnSession", () => { this._send({ action: "chat_wake_up" }); });
    this._on("#btnTestMic", () => this._send({ action: "chat_test_mic" }));
    this._on("#btnChatClear", () => {
      this._state.chat = [];
      this._renderChatMsgs();
      this._toast("Đã xóa lịch sử chat", "success");
      this._send({ action: "chat_clear_history" });
    });
    this._on("#btnTikTok", () => { const v = !this._state.tiktokReply; this._state.tiktokReply = v; this._renderTikTok(); this._send({ action: "tiktok_reply_toggle", enabled: v }); });

    this._on("#btnMacGet", () => this._send({ action: "mac_get" }));
    this._on("#btnMacRandom", () => { if (confirm("⚠ Random MAC sẽ mất quyền. Tiếp tục?")) this._send({ action: "mac_random" }); });
    this._on("#btnMacReal", () => this._send({ action: "mac_clear" }));
    this._on("#btnOtaRefresh", () => this._send({ action: "ota_get" }));
    this._on("#btnOtaSave", () => { const v = this.querySelector("#otaSel")?.value; if (v) this._send({ action: "ota_set", ota_url: v }); });
    this._on("#btnHassSave", () => { this._send({ action: "hass_set", url: this.querySelector("#hassUrl")?.value?.trim() || "", agent_id: this.querySelector("#hassAgent")?.value?.trim() || "", api_key: this.querySelector("#hassKey")?.value?.trim() || undefined }); });
    this._on("#btnWifiScan", () => this._send({ action: "wifi_scan" }));
    this._on("#btnWifiSavedRef", () => this._send({ action: "wifi_get_saved" }));
  }

  _on(sel, fn, cb) { const el = this.querySelector(sel); if (!el) return; if (fn) el.onclick = fn; if (cb) cb(el); }
  _bindSwitch(sel, fn) { const el = this.querySelector(sel); if (el) el.onclick = fn; }
  _bindSlider(sliderId, valId, sendFn, fmtFn) {
    const s = this.querySelector(sliderId); if (!s) return;
    s.oninput = () => { const v = this.querySelector(valId); if (v && fmtFn) v.textContent = fmtFn(parseInt(s.value)); };
    if (sendFn) s.onchange = () => sendFn(parseInt(s.value));
  }
  _setSlider(sliderId, valId, rawVal, displayVal) {
    const s = this.querySelector(sliderId); if (s) s.value = rawVal;
    const v = this.querySelector(valId); if (v) v.textContent = displayVal !== undefined ? displayVal : rawVal;
  }

  _buildEqBands() {
    const c = this.querySelector("#eqBands"); if (!c) return;
    c.innerHTML = EQ_LABELS.map((f, i) => {
      const v = this._state.eqBands[i] || 0;
      const dv = v > 0 ? `+${v}` : `${v}`;
      return `<div class="eq-band"><div class="eq-band-val" id="eqVal${i}">${dv}</div><input type="range" min="-1500" max="1500" step="100" value="${v}" orient="vertical" data-band="${i}" /><label>${f}</label></div>`;
    }).join('');
    c.querySelectorAll("input").forEach(inp => { inp.oninput = () => {
      this._audioGuard = Date.now();
      const v = parseInt(inp.value);
      const vl = this.querySelector(`#eqVal${inp.dataset.band}`); if (vl) vl.textContent = v > 0 ? `+${v}` : `${v}`;
      this._sendSpk({ type: "set_eq_bandlevel", band: parseInt(inp.dataset.band), level: v });
    }; });
  }

  _doSearch() {
    const q = (this.querySelector("#searchInp")?.value || "").trim(); if (!q) return;
    const sr = this.querySelector("#searchResults");
    if (sr) sr.innerHTML = '<div style="text-align:center;padding:12px;color:rgba(226,232,240,.4);font-size:11px">Đang tìm...</div>';
    const tab = this._activeSearchTab;
    if (tab === "songs") this._send({ action: "search_songs", query: q });
    else if (tab === "zing") this._send({ action: "search_zing", query: q });
    else if (tab === "playlist") this._send({ action: "search_playlist", query: q });
    else this._send({ action: "search_songs", query: q });
  }

  _renderSearchResults(items, type = "youtube") {
    const el = this.querySelector("#searchResults"); if (!el) return;
    if (!items.length) { el.innerHTML = '<div style="text-align:center;padding:14px;color:rgba(226,232,240,.35);font-size:11px">Không có kết quả</div>'; return; }
    el.innerHTML = items.map((item, i) => {
      const title = item.title || item.name || "---";
      const sub = item.artist || item.channel || "";
      const thumb = item.thumbnail_url || "";
      const dur = item.duration_seconds ? this._fmtTime(item.duration_seconds) : (item.duration || "");
      return `<div class="result-item" data-idx="${i}">${thumb ? `<img class="result-thumb" src="${this._esc(thumb)}" onerror="this.style.display='none'" />` : '<div class="result-thumb">🎵</div>'}
<div class="result-info"><div class="result-title">${this._esc(title)}</div><div class="result-sub">${this._esc(sub)}${dur ? " · " + dur : ""}</div></div>
<div class="result-btns"><button class="rbtn rbtn-add" data-addidx="${i}" title="Thêm vào playlist">+</button><button class="rbtn rbtn-play" data-playidx="${i}">▶ Phát</button></div></div>`;
    }).join("");
    items.forEach((item, i) => {
      const playBtn = el.querySelector(`[data-playidx="${i}"]`);
      if (playBtn) playBtn.onclick = (e) => {
        e.stopPropagation();
        if (type === "playlist") this._send({ action: "playlist_play", playlist_id: item.playlist_id || item.id });
        else if (type === "zing") this._send({ action: "play_zing", song_id: item.song_id || item.id });
        else this._send({ action: "play_song", video_id: item.video_id || item.id });
        this._toast(`▶ ${item.title || ""}`, "success");
      };
      const addBtn = el.querySelector(`[data-addidx="${i}"]`);
      if (addBtn) addBtn.onclick = (e) => { e.stopPropagation(); this._toast(`TODO: Add to playlist`, "success"); };
    });
  }

  _renderPlaylistList(playlists) {
    this._state.playlists = playlists || [];
    const el = this.querySelector("#plList"); if (!el) return;
    if (!playlists.length) { el.innerHTML = '<div style="text-align:center;padding:12px;color:rgba(226,232,240,.35);font-size:11px">Chưa có playlist</div>'; return; }
    el.innerHTML = playlists.map((pl, i) => `<div class="pl-item"><span class="pl-name">${this._esc(pl.name || "Playlist")}</span>
<span class="pl-count">${pl.song_count || 0} bài</span><div class="pl-btns">
<button class="form-btn sm green" data-plplay="${i}">▶</button>
<button class="form-btn sm" data-plview="${i}">👁</button>
<button class="form-btn sm danger" data-pldel="${i}">✕</button></div></div>`).join("");
    playlists.forEach((pl, i) => {
      this._on(`[data-plplay="${i}"]`, () => { this._send({ action: "playlist_play", playlist_id: pl.id }); this._toast(`▶ ${pl.name}`, "success"); });
      this._on(`[data-plview="${i}"]`, () => this._send({ action: "playlist_get_songs", id: pl.id }));
      this._on(`[data-pldel="${i}"]`, () => { if (confirm(`Xóa "${pl.name}"?`)) this._send({ action: "playlist_delete", id: pl.id }); });
    });
  }

  _handleMsg(raw) {
    let d; try { d = JSON.parse(raw); } catch { return; }

    if (d.type === "chat_message") {
      const isUser = d.message_type === "user";
      this._addChatMsg(d.content || "", isUser ? "user" : "server");
      return;
    }
    if (d.type === "chat_state") {
      const st = d.state || "";
      this._state.chatSessionActive = ["connecting","listening","speaking","thinking"].includes(st);
      this._state.chatSpeaking = st === "speaking";
      if (d.button_text) this._state.chatBtnText = d.button_text;
      if (d.button_enabled !== undefined) this._state.chatBtnEnabled = d.button_enabled;
      this._renderSessionBtn();
      return;
    }
    if (d.type === "chat_history" && Array.isArray(d.messages)) {
      this._chatLoaded = true;
      if (this._state.chat.length === 0) {
        this._state.chat = d.messages.map(m => ({ type: m.type || m.message_type || "server", content: m.content || "", ts: m.ts || Date.now() }));
        this._renderChatMsgs();
      }
      return;
    }
    if (d.type === "chat_history_cleared" || d.type === "chat_clear_history_result") { this._state.chat = []; this._chatLoaded = true; this._renderChatMsgs(); return; }
    if (d.type === "chat_background" || d.type === "chat_background_result") { this._state.chatBg64 = d.image || d.base64 || ""; this._renderChatBg(); return; }
    if (d.type === "tiktok_reply_state" || d.type === "tiktok_reply_result") { this._state.tiktokReply = !!d.enabled; this._renderTikTok(); return; }
    if (d.type === "led_state" || d.type === "led_get_state_result" || d.type === "led_toggle_result") { if (d.enabled !== undefined) this._state.ledEnabled = !!d.enabled; this._renderControlToggles(); return; }
    if (d.type === "ota_config" || d.type === "ota_get_result" || d.type === "ota_set_result") { if (d.ota_url !== undefined) this._state.otaUrl = d.ota_url; if (Array.isArray(d.options)) this._state.otaOptions = d.options; this._renderOta(); return; }
    if (d.type === "hass_config" || d.type === "hass_get_result" || d.type === "hass_set_result") { this._state.hassUrl = d.url || ""; this._state.hassAgentId = d.agent_id || ""; this._state.hassConfigured = !!d.configured; if (d.api_key === "***") this._state.hassApiKeyMasked = true; this._renderHass(); return; }
    if (d.type === "wifi_scan_result") { this._state.wifiNetworks = d.networks || []; this._renderWifiScan(); return; }
    if (["wifi_status","wifi_get_status_result","wifi_status_result","wifi_info"].includes(d.type)) { this._state.wifiStatus = d; this._renderWifiStatus(); return; }
    if (d.type === "wifi_saved_result" || d.type === "wifi_saved_list") { this._state.wifiSaved = d.networks || []; this._renderWifiSaved(); return; }
    if (d.type === "search_result") { this._renderSearchResults(d.songs || d.results || [], "youtube"); return; }
    if (d.type === "zing_result") { this._renderSearchResults(d.songs || d.results || [], "zing"); return; }
    if (d.type === "playlist_result") { this._renderSearchResults(d.songs || d.playlists || d.results || [], "playlist"); return; }
    if (d.type === "playlist_list_result") { this._renderPlaylistList(d.playlists || []); return; }
    if (d.type === "playlist_songs_result") {
      this._state.playlistSongs = d.songs || [];
      const el = this.querySelector("#plSongs"); if (!el) return;
      el.classList.remove("hidden");
      el.innerHTML = `<div class="fx jcb aic mb6"><span style="font-size:10px;font-weight:700;color:rgba(226,232,240,.6)">Bài hát:</span><button class="form-btn sm" id="closePlSongs">✕</button></div>` +
        (d.songs?.length ? d.songs.map((s, i) => `<div class="result-item"><div class="result-info"><div class="result-title">${this._esc(s.title || "?")}</div></div><button class="form-btn sm danger" data-rmsong="${i}">✕</button></div>`).join("") : '<div style="text-align:center;padding:8px;font-size:10px;color:rgba(226,232,240,.4)">Trống</div>');
      this._on("#closePlSongs", () => el.classList.add("hidden"));
      return;
    }
    if (d.type === "wake_word_enabled_state" || d.type === "wake_word_get_enabled_result") { if (d.enabled !== undefined) this._state.wakeWordEnabled = !!d.enabled; this._renderWakeWord(); return; }
    if (d.type === "wake_word_sensitivity_state" || d.type === "wake_word_get_sensitivity_result") { if (d.sensitivity !== undefined) this._state.wakeWordSensitivity = Number(d.sensitivity); this._renderWakeWord(); return; }
    if (d.type === "custom_ai_state" || d.type === "custom_ai_enabled_state" || d.type === "custom_ai_get_enabled_result") { if (d.enabled !== undefined) this._state.customAiEnabled = !!d.enabled; this._renderCustomAi(); return; }
    if (d.type === "voice_id_state" || d.type === "voice_id_get_result") { if (d.voice_id !== undefined) this._state.voiceId = parseInt(d.voice_id); this._renderVoice(); return; }
    if (d.type === "live2d_model" || d.type === "live2d_get_model_result") { if (d.model) this._state.live2dModel = d.model; const sel = this.querySelector("#live2dSel"); if (sel && d.model) sel.value = d.model; return; }
    if (d.type === "alarm_list" || d.type === "alarm_list_result") { this._state.alarms = d.alarms || []; this._renderAlarms(); return; }
    if (d.type === "alarm_added") {
      if (d.alarm) { this._state.alarms.push(d.alarm); this._renderAlarms(); }
      else this._send({ action: "alarm_list" });
      this._toast(`✅ Đã thêm báo thức lúc ${d.alarm ? String(d.alarm.hour).padStart(2,'0')+':'+String(d.alarm.minute).padStart(2,'0') : ''}`, "success");
      return;
    }
    if (d.type === "alarm_edited") {
      if (d.alarm) {
        const idx = this._state.alarms.findIndex(a => a.id === d.alarm.id);
        if (idx >= 0) this._state.alarms[idx] = d.alarm; else this._state.alarms.push(d.alarm);
        this._renderAlarms();
      } else this._send({ action: "alarm_list" });
      this._toast(`✏️ Đã cập nhật báo thức #${d.alarm?.id ?? ''}`, "success");
      return;
    }
    if (d.type === "alarm_deleted") {
      const delId = d.id ?? d.alarm_id ?? this._pendingDeleteId;
      this._pendingDeleteId = null;
      if (delId !== undefined && delId !== null) {
        this._state.alarms = this._state.alarms.filter(a => a.id !== delId);
        this._renderAlarms();
      } else {
        this._send({ action: "alarm_list" });
      }
      this._toast(`🗑 Đã xóa báo thức`, "success");
      return;
    }
    if (d.type === "alarm_toggled") {
      if (d.alarm) {
        const idx = this._state.alarms.findIndex(a => a.id === d.alarm.id);
        if (idx >= 0) { this._state.alarms[idx].enabled = d.alarm.enabled; this._renderAlarms(); }
        else this._send({ action: "alarm_list" });
      } else {
        this._send({ action: "alarm_list" });
      }
      return;
    }
    if (d.type === "alarm_triggered") { this._toast("⏰ " + (d.message || "Báo thức!"), "success"); return; }
    if (["mac_get","mac_get_result","mac_random","mac_random_result","mac_clear","mac_clear_result","mac_result"].includes(d.type)) {
      if (d.mac_address || d.mac) {
        this._state.macAddress = d.mac_address || d.mac;
        this._state.macIsCustom = !!(d.is_custom ?? d.custom ?? d.is_spoofed ?? d.spoofed ?? (d.mac_type === "custom") ?? false);
      }
      const mv = this.querySelector("#macVal"); if (mv) mv.textContent = this._state.macAddress || "--";
      const mt = this.querySelector("#macType"); if (mt) { mt.textContent = this._state.macIsCustom ? "🔀 Custom" : "📡 Real"; mt.style.color = this._state.macIsCustom ? "#fbbf24" : "#86efac"; }
      return;
    }
    if (d.type === "premium_status") { this._state.premium = d.premium; if (d.qr_code_base64) this._state.premQrB64 = d.qr_code_base64; this._renderPremium(); return; }
    if (d.type === "playback_state") {
      const m = this._state.media;
      m.source = d.source || "youtube"; m.isPlaying = !!d.is_playing;
      m.title = d.title || "Không có nhạc"; m.artist = d.artist || d.channel || "---";
      m.thumb = d.thumbnail_url || ""; m.position = Number(d.position || 0); m.duration = Number(d.duration || 0);
      if (d.auto_next_enabled !== undefined) m.autoNext = !!d.auto_next_enabled;
      if (d.repeat_enabled !== undefined) m.repeat = !!d.repeat_enabled;
      if (d.shuffle_enabled !== undefined) m.shuffle = !!d.shuffle_enabled;
      if (d.volume !== undefined) this._state.volume = Number(d.volume);
      this._renderMedia(); this._renderVolume(); return;
    }
    if (d.type === "volume_state") { this._state.volume = Number(d.volume || 0); this._renderVolume(); return; }
    if (d.type === "get_info" && d.data) {
      const s = d.data; const ctrlOk = Date.now() - this._ctrlGuard > 3000;
      if (ctrlOk) {
        if (s.dlna_open !== undefined) this._state.dlnaOpen = !!s.dlna_open;
        if (s.airplay_open !== undefined) this._state.airplayOpen = !!s.airplay_open;
        if (s.device_state !== undefined) this._state.bluetoothOn = (s.device_state === 3);
        if (s.music_light_enable !== undefined) this._state.lightEnabled = !!s.music_light_enable;
        if (s.music_light_luma !== undefined) this._state.brightness = Math.max(1, Math.min(200, Math.round(s.music_light_luma)));
        if (s.music_light_chroma !== undefined) this._state.speed = Math.max(1, Math.min(100, Math.round(s.music_light_chroma)));
        this._renderControlToggles(); this._renderLight();
      }
      if (!this._volDragging) { if (s.volume !== undefined) this._state.volume = Number(s.volume); if (s.vol !== undefined) this._state.volume = Number(s.vol); this._renderVolume(); }
      return;
    }
    if (d.type === "system_stats" && typeof d.raw === "string") { this._parseProcStats(d.raw); this._renderSystem(); return; }
    if (d.type === "get_device_info" && d.data) {
      const dd = d.data;
      if (Array.isArray(dd.cpuinfo) && dd.cpuinfo.length > 2) this._state.sys.cpu = Math.round(dd.cpuinfo[2] * 100 * 10) / 10;
      if (typeof dd.meminfo === "string") {
        const mTotal = (dd.meminfo.match(/MemTotal:\s+(\d+)/) || [])[1];
        const mFree  = (dd.meminfo.match(/MemFree:\s+(\d+)/)  || [])[1];
        const mBuf   = (dd.meminfo.match(/Buffers:\s+(\d+)/)  || [])[1];
        const mCach  = (dd.meminfo.match(/\bCached:\s+(\d+)/) || [])[1];
        if (mTotal && mFree) {
          const used = parseInt(mTotal) - parseInt(mFree) - (parseInt(mBuf)||0) - (parseInt(mCach)||0);
          this._state.sys.ram = Math.round(used / parseInt(mTotal) * 100);
        }
      }
      this._renderSystem(); return;
    }
  }

  _updateProgressOnly() {
    const m = this._state.media;
    const p = this.querySelector("#posText"), dur = this.querySelector("#durText"), bar = this.querySelector("#seekBar");
    if (p) p.textContent = this._fmtTime(m.position);
    if (dur) dur.textContent = this._fmtTime(m.duration);
    const pct = m.duration > 0 ? Math.min(100, (m.position / m.duration) * 100) : 0;
    if (bar) bar.style.width = pct + "%";
    const thumb = this.querySelector("#seekThumb");
    if (thumb) thumb.style.setProperty("--spct", pct + "%");
  }

  _renderMedia() {
    const m = this._state.media;
    const src = this.querySelector("#mediaThumb"), fb = this.querySelector("#thumbFallback");
    if (src && fb) {
      if (m.thumb) { src.src = m.thumb; src.style.display = "block"; fb.style.display = "none"; src.classList.toggle("spin", m.isPlaying); }
      else { src.style.display = "none"; fb.style.display = "block"; }
    }
    const sl = this.querySelector("#sourceLabel"); if (sl) sl.textContent = (!m.isPlaying || !m.source) ? "IDLE" : m.source === "zing" ? "ZING MP3" : "YOUTUBE";
    const t = this.querySelector("#mediaTitle"); if (t) t.textContent = m.title;
    const a = this.querySelector("#mediaArtist"); if (a) a.textContent = m.artist;
    const pp = this.querySelector("#btnPlayPause"); if (pp) pp.textContent = m.isPlaying ? "⏸" : "▶";
    const rp = this.querySelector("#btnRepeat"); if (rp) rp.classList.toggle("active-btn", !!m.repeat);
    const sh = this.querySelector("#btnShuffle"); if (sh) sh.classList.toggle("active-btn", !!m.autoNext);
    const ww = this.querySelector("#waveformWrap");
    if (ww) {
      ww.style.display = m.isPlaying ? "flex" : "none";
      if (m.isPlaying) {
        const wv = this.querySelector('#waveform');
        if (wv) {
          this._waveBars  = wv.querySelectorAll('.wv-bar');
          this._waveBalls = wv.querySelectorAll('.wv-ball');
        }
      }
    }
    const styleBtn = this.querySelector('#btnWaveStyle');
    if (styleBtn) styleBtn.textContent = (this._waveStyle || 'ball') === 'classic' ? '≡' : '⚬';
    const mcBg = this.querySelector("#mcBg");
    if (mcBg) {
      if (m.thumb) { mcBg.style.backgroundImage = `url("${m.thumb}")`; mcBg.classList.add("show"); }
      else { mcBg.style.backgroundImage = ''; mcBg.classList.remove("show"); }
    }
    this._updateProgressOnly();
  }

  _renderVolume() {
    if (this._volDragging) return;
    const s = this.querySelector("#volSlider"), l = this.querySelector("#volLabel");
    if (s) s.value = this._state.volume; if (l) l.textContent = `Mức ${this._state.volume}`;
  }

  _renderControlToggles() {
    this._updateSwitch("#swLed", this._state.ledEnabled);
    this._updateSwitch("#swDlna", this._state.dlnaOpen);
    this._updateSwitch("#swAirplay", this._state.airplayOpen);
    this._updateSwitch("#swBt", this._state.bluetoothOn);
  }

  _renderLight() {
    this._updateSwitch("#swLight", this._state.lightEnabled);
    const b = this.querySelector("#brightSlider"), bv = this.querySelector("#brightVal");
    const s = this.querySelector("#speedSlider"), sv = this.querySelector("#speedVal");
    if (b) b.value = this._state.brightness; if (bv) bv.textContent = this._state.brightness;
    if (s) s.value = this._state.speed; if (sv) sv.textContent = this._state.speed;
  }

  _updateSwitch(sel, state) {
    const el = this.querySelector(sel); if (!el) return;
    if (state === null || state === undefined) { el.classList.remove("on"); el.classList.add("unknown"); }
    else { el.classList.remove("unknown"); el.classList.toggle("on", !!state); }
  }

  _renderWakeWord() {
    this._updateSwitch("#swWake", this._state.wakeWordEnabled);
    const row = this.querySelector("#wakeSensRow"); if (row) row.style.display = this._state.wakeWordEnabled ? "block" : "none";
    const sl = this.querySelector("#wakeSlider"), val = this.querySelector("#wakeVal");
    if (sl && this._state.wakeWordSensitivity !== null) { sl.value = this._state.wakeWordSensitivity; if (val) val.textContent = Number(this._state.wakeWordSensitivity).toFixed(2); }
  }

  _renderCustomAi() {
    this._updateSwitch("#swCustomAi", this._state.customAiEnabled);
    const isPrem = this._state.premium === 1;
    const show = isPrem || this._state.customAiEnabled !== null;
    const cr = this.querySelector("#customAiRow"); if (cr) cr.style.display = show ? "flex" : "none";
    const vr = this.querySelector("#voiceRow"); if (vr) vr.style.display = (show && this._state.customAiEnabled) ? "block" : "none";
    const lr = this.querySelector("#live2dRow"); if (lr) lr.style.display = isPrem ? "block" : "none";
  }

  _renderVoice() {
    const sel = this.querySelector("#voiceSel"); if (sel && this._state.voiceId) sel.value = this._state.voiceId;
  }

  _renderOta() {
    const sel = this.querySelector("#otaSel"); if (!sel) return;
    const nm = { 'https://api.tenclass.net/xiaozhi/ota/': 'Xiaozhi', 'https://ai-box.vn/ota/': 'AI-BOX.VN' };
    if (this._state.otaOptions) { sel.innerHTML = this._state.otaOptions.map(o => `<option value="${this._esc(o)}" ${o === this._state.otaUrl ? "selected" : ""}>${nm[o] || o}</option>`).join(""); }
    else if (this._state.otaUrl) { sel.innerHTML = `<option value="${this._esc(this._state.otaUrl)}" selected>${nm[this._state.otaUrl] || this._state.otaUrl}</option>`; }
  }

  _renderHass() {
    const u = this.querySelector("#hassUrl"), a = this.querySelector("#hassAgent"), k = this.querySelector("#hassKey");
    if (u) u.value = this._state.hassUrl; if (a) a.value = this._state.hassAgentId;
    if (k && this._state.hassApiKeyMasked) k.placeholder = "*** (đã lưu)";
  }

  _renderWifiStatus() {
    const el = this.querySelector("#wifiStatusArea"); if (!el) return;
    const w = this._state.wifiStatus;
    if (!w) { el.innerHTML = '<div class="sys-info-item"><div class="sys-value" style="color:rgba(226,232,240,.4)">Đang tải WiFi...</div></div>'; return; }
    const ssid = w.current_ssid || w.ssid || w.SSID || w.connected_ssid || "";
    const ip   = w.ip_address || w.ip || w.ipv4 || "---";
    const rssi = w.rssi || w.signal || "--";
    const connected = w.is_connected ?? (ssid !== "");
    el.innerHTML = `<div class="sys-info-item">
      <div class="sys-label">WiFi hiện tại</div>
      <div class="sys-value" style="color:${connected ? '#86efac' : 'rgba(226,232,240,.4)'}">${connected ? this._esc(ssid) : "Không có kết nối"}</div>
      <div style="font-size:10px;color:rgba(226,232,240,.5);margin-top:3px">${connected ? `IP: ${this._esc(ip)}${rssi !== "--" ? " | RSSI: " + rssi + " dBm" : ""}` : "WiFi chưa kết nối"}</div>
    </div>`;
  }

  _renderWifiSaved() {
    const el = this.querySelector("#wifiSavedArea"); if (!el || !this._state.wifiSaved.length) return;
    el.innerHTML = '<div style="font-size:10px;font-weight:700;color:rgba(226,232,240,.45);margin-bottom:4px">Đã lưu</div>' +
      this._state.wifiSaved.map((n, i) => { const ssid = n.ssid || n; return `<div class="wifi-item"><span class="wifi-ssid">📶 ${this._esc(ssid)}</span><button class="form-btn sm danger" data-wfdel="${i}">✕</button></div>`; }).join("");
    this._state.wifiSaved.forEach((n, i) => { this._on(`[data-wfdel="${i}"]`, () => this._send({ action: "wifi_delete_saved", ssid: n.ssid || n })); });
  }

  _renderWifiScan() {
    const el = this.querySelector("#wifiScanArea"); if (!el) return;
    el.innerHTML = this._state.wifiNetworks.map(n => `<div class="wifi-item" data-wfssid="${this._esc(n.ssid)}"><div><div class="wifi-ssid">📶 ${this._esc(n.ssid)}</div><div class="wifi-rssi">${n.rssi || ""} dBm ${n.secured ? "🔒" : ""}</div></div></div>`).join("");
    this._state.wifiNetworks.forEach(n => { const item = el.querySelector(`[data-wfssid="${this._esc(n.ssid)}"]`); if (item) item.onclick = () => { const pw = prompt(`Mật khẩu WiFi: ${n.ssid}`); if (pw !== null) this._send({ action: "wifi_connect", ssid: n.ssid, password: pw }); }; });
  }

  _renderChatMsgs(scroll = true) {
    const box = this.querySelector("#chatMsgs"); if (!box) return;
    if (!this._state.chat.length) { box.innerHTML = '<div style="text-align:center;padding:30px 0;color:rgba(226,232,240,.4);font-size:12px">Chưa có tin nhắn</div>'; return; }
    box.innerHTML = this._state.chat.map(m => `<div class="mrow ${m.type === "user" ? "user" : "server"}"><div class="bubble ${m.type === "user" ? "user" : "server"}">${this._esc(m.content)}</div></div>`).join("");
    if (scroll) box.scrollTop = box.scrollHeight;
  }

  _renderChatBg() {
    const img = this.querySelector("#chatBg"); if (!img) return;
    const b = (this._state.chatBg64 || "").trim();
    if (this._config.show_background && b) { img.src = "data:image/jpeg;base64," + b; img.style.display = "block"; }
    else { img.style.display = "none"; img.removeAttribute("src"); }
  }

  _renderTikTok() {
    const dot = this.querySelector("#tkDot"), txt = this.querySelector("#tkText");
    if (dot) dot.classList.toggle("on", !!this._state.tiktokReply);
    if (txt) txt.textContent = `TikTok Reply: ${this._state.tiktokReply ? "ON" : "OFF"}`;
  }

  _renderSessionBtn() {
    const btn = this.querySelector("#btnSession"); if (!btn) return;
    const active = this._state.chatSessionActive;
    const speaking = this._state.chatSpeaking;
    const serverText = this._state.chatBtnText || "";
    const serverEnabled = this._state.chatBtnEnabled;
    btn.classList.remove("session-active", "interrupt");
    if (serverText) { btn.textContent = serverText; }
    else if (!active) { btn.textContent = "🎤 Wake Up"; }
    else if (speaking) { btn.textContent = "⚡ Interrupt"; }
    else { btn.textContent = "🟡 End Session"; }
    if (speaking) { btn.classList.add("interrupt"); }
    else if (active) { btn.classList.add("session-active"); }
    if (serverEnabled !== undefined) btn.disabled = !serverEnabled;
  }

  _renderSystem() {
    const s = this._state.sys;
    const cv = this.querySelector("#cpuVal"), rv = this.querySelector("#ramVal");
    const cb = this.querySelector("#cpuBar"), rb = this.querySelector("#ramBar");
    if (cv) cv.textContent = (Number.isInteger(s.cpu) ? s.cpu : s.cpu.toFixed(1)) + "%"; if (rv) rv.textContent = s.ram + "%";
    if (cb) cb.style.width = s.cpu + "%"; if (rb) rb.style.width = s.ram + "%";
  }

  _renderEqBands() {
    this._state.eqBands.forEach((v, i) => {
      const inp = this.querySelector(`input[data-band="${i}"]`); if (inp) inp.value = v;
      const vl = this.querySelector(`#eqVal${i}`); if (vl) vl.textContent = v > 0 ? `+${v}` : `${v}`;
    });
  }

  _renderPremium() {
    this._renderCustomAi();
    const ver = this.querySelector(".version");
    if (ver && this._state.premium === 1) { ver.textContent = "👑 VIP"; ver.style.color = "#fbbf24"; ver.style.borderColor = "rgba(251,191,36,.3)"; }
  }

  _renderAlarms() {
    const el = this.querySelector("#alarmList"); if (!el) return;
    const als = this._state.alarms;
    if (!als.length) { el.innerHTML = '<div style="text-align:center;padding:12px;color:rgba(226,232,240,.4);font-size:11px">Chưa có báo thức</div>'; return; }

    const rpMap = { daily: 'Hàng ngày', weekly: 'Hàng tuần', none: 'Một lần' };
    const dayNames = {1:'CN',2:'T2',3:'T3',4:'T4',5:'T5',6:'T6',7:'T7'};

    el.innerHTML = als.map(a => {
      const t = `${String(a.hour).padStart(2,'0')}:${String(a.minute).padStart(2,'0')}`;
      const daysStr = Array.isArray(a.selected_days) && a.selected_days.length
        ? a.selected_days.sort((x,y)=>x-y).map(d=>dayNames[d]||d).join(' ')
        : '';
      return `<div class="alarm-item ${a.enabled ? '' : 'o5'}">
<div class="fx jcb aic">
  <div>
    <span class="alarm-time">${t}</span>
    <span style="font-size:9px;color:rgba(139,92,246,.7);margin-left:6px;font-family:monospace">#${a.id}</span>
    ${a.label ? `<span style="font-size:10px;color:rgba(226,232,240,.6);margin-left:5px;font-weight:700">${this._esc(a.label)}</span>` : ''}
  </div>
  <div class="alarm-actions">
    <button class="form-btn sm ${a.enabled ? 'green' : ''}" data-altog="${a.id}" title="${a.enabled ? 'Đang bật — nhấn để tắt' : 'Đang tắt — nhấn để bật'}">${a.enabled ? '🔔' : '🔕'}</button>
    <button class="form-btn sm" data-aledit="${a.id}" title="Chỉnh sửa">✏️</button>
    <button class="form-btn sm danger" data-aldel="${a.id}" title="Xóa">✕</button>
  </div>
</div>
<div class="alarm-meta">${rpMap[a.repeat] || 'Một lần'}${daysStr ? ' · ' + daysStr : ''} · Vol ${a.volume ?? 100}%${a.youtube_song_name ? ' · 🎵 ' + this._esc(a.youtube_song_name) : ''}</div>
</div>`;
    }).join("");

    if (!el._alarmDelegated) {
      el._alarmDelegated = true;
      el.addEventListener('click', (e) => {
        const tog  = e.target.closest('[data-altog]');
        const edit = e.target.closest('[data-aledit]');
        const del  = e.target.closest('[data-aldel]');
        if (tog) {
          const id = parseInt(tog.dataset.altog);
          this._send({ action: "alarm_toggle", alarm_id: id });
        }
        if (edit) {
          const id = parseInt(edit.dataset.aledit);
          const a  = this._state.alarms.find(x => x.id === id);
          if (a) this._showAlarmModal(a);
        }
        if (del) {
          const id = parseInt(del.dataset.aldel);
          const a  = this._state.alarms.find(x => x.id === id);
          if (!a) return;
          const t  = `${String(a.hour).padStart(2,'0')}:${String(a.minute).padStart(2,'0')}`;
          if (confirm(`Xóa báo thức #${a.id} lúc ${t}?`)) {
            this._pendingDeleteId = id;
            this._send({ action: "alarm_delete", alarm_id: id });
          }
        }
      });
    }
  }

  _parseProcStats(raw) {
    const lines = raw.split("\n"); let cpu = 0, ram = 0;
    for (const l of lines) {
      if (l.includes("cpu_usage")) { const m = l.match(/([\d.]+)/); if (m) cpu = Math.round(parseFloat(m[1])); }
      if (l.includes("mem_usage") || l.includes("ram_usage")) { const m = l.match(/([\d.]+)/); if (m) ram = Math.round(parseFloat(m[1])); }
    }
    this._state.sys = { cpu, ram };
  }

  _sendChat() {
    const inp = this.querySelector("#chatInp");
    const t = (inp?.value || "").trim();
    if (!t) return;
    this._send({ action: "chat_send_text", text: t });
    if (inp) inp.value = "";
  }

  _addChatMsg(content, type) {
    this._state.chat.push({ type, content, ts: Date.now() });
    if (this._state.chat.length > 200) this._state.chat = this._state.chat.slice(-200);
    this._renderChatMsgs(true);
  }

  _showAlarmModal(al = null) {
    const existing = this.querySelector("#alarmModal"); if (existing) existing.remove();
    const div = document.createElement("div"); div.id = "alarmModal"; div.className = "modal-overlay";
    const isEdit = !!al;
    div.innerHTML = `<div class="modal-box">
<div class="modal-head"><h3>${isEdit ? "Sửa" : "Thêm"} báo thức</h3><button class="modal-close" id="alClose">✕</button></div>
<div class="fx g8 aic mb8"><div class="form-row"><div class="form-label">Giờ</div><input class="form-inp" type="number" id="alH" min="0" max="23" value="${al?.hour ?? 7}" style="width:70px" /></div>
<span style="font-size:20px;color:#e2e8f0;font-weight:900">:</span>
<div class="form-row"><div class="form-label">Phút</div><input class="form-inp" type="number" id="alM" min="0" max="59" value="${al?.minute ?? 0}" style="width:70px" /></div></div>
<div class="form-row"><div class="form-label">Lặp lại</div><select class="form-inp" id="alRpt"><option value="none" ${al?.repeat==='none'||!al?.repeat?'selected':''}>Một lần</option><option value="daily" ${al?.repeat==='daily'?'selected':''}>Hàng ngày</option><option value="weekly" ${al?.repeat==='weekly'?'selected':''}>Hàng tuần</option></select></div>
<div id="alDaysWrap" class="${al?.repeat === 'weekly' ? '' : 'hidden'}"><div class="al-days">${['T2','T3','T4','T5','T6','T7','CN'].map((d, i) => { const v = i < 6 ? i + 2 : 1; return `<label><input type="checkbox" class="al-day-cb" value="${v}" ${al?.selected_days?.includes(v) ? 'checked' : ''}>${d}</label>`; }).join('')}</div></div>
<div class="form-row mt6"><div class="form-label">Tên</div><input class="form-inp" id="alLabel" placeholder="Sáng dậy" value="${this._esc(al?.label || '')}" /></div>
<div class="form-row"><div class="form-label">Volume: <span id="alVolD">${al?.volume ?? 100}</span>%</div><input type="range" id="alVol" min="0" max="100" value="${al?.volume ?? 100}" style="width:100%" /></div>
<div class="form-row"><div class="form-label">YouTube (tùy chọn)</div><input class="form-inp" id="alYt" placeholder="Tên bài hát" value="${this._esc(al?.youtube_song_name || '')}" /></div>
<div class="fx g4 mt8"><button class="form-btn" id="alCancel" style="flex:1">Hủy</button><button class="form-btn green" id="alSubmit" style="flex:1">${isEdit ? "Lưu" : "Thêm"}</button></div>
</div>`;
    this.appendChild(div);
    div.querySelector("#alClose").onclick = () => div.remove();
    div.querySelector("#alCancel").onclick = () => div.remove();
    div.querySelector("#alVol").oninput = function() { div.querySelector("#alVolD").textContent = this.value; };
    div.querySelector("#alRpt").onchange = function() { div.querySelector("#alDaysWrap").classList.toggle("hidden", this.value !== "weekly"); };
    div.querySelector("#alSubmit").onclick = () => {
      const h = parseInt(div.querySelector("#alH").value), m = parseInt(div.querySelector("#alM").value);
      if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) { this._toast("Giờ không hợp lệ", "error"); return; }
      const rpt = div.querySelector("#alRpt").value;
      const days = rpt === "weekly" ? Array.from(div.querySelectorAll(".al-day-cb:checked")).map(c => parseInt(c.value)) : undefined;
      const data = { action: isEdit ? "alarm_edit" : "alarm_add", hour: h, minute: m, repeat: rpt, label: div.querySelector("#alLabel").value.trim(), volume: parseInt(div.querySelector("#alVol").value) };
      if (isEdit) { data.alarm_id = al.id; data.enabled = al.enabled; }
      const yt = div.querySelector("#alYt").value.trim(); if (yt) data.youtube_song_name = yt;
      if (days) data.selected_days = days;
      this._send(data); div.remove();
    };
  }
}

customElements.define("aibox-webui-card", AiBoxCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "aibox-webui-card",
  name: "AI BOX WebUI Card",
  description: "Full-featured AI BOX control card",
  preview: false
});

console.log("%c AI BOX WebUI Card v6.3.1 loaded", "color:#a78bfa;font-weight:bold");
