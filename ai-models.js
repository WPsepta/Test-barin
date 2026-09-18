/* ═══════════════════════════════════════════════════════════════
   ai-models.js — Shared AI Model Picker
   Dipakai oleh: chat.html, anonymous.html, profile.html
   ═══════════════════════════════════════════════════════════════ */

/* ---------- DEFAULT MODEL (Brain Side / SpicyChat) ---------- */
export const DEFAULT_MODEL = {
  id: 'bs-default',
  name: 'Brain Side',
  description: 'Default · SpicyChat',
  isActive: true,
  order: 0,
  iconEmoji: '🎭',
  provider: 'spicychat',
  endpoint: 'https://prod.nd-api.com',
  apiKey: '',
  characterId: 'bfcbb334-183c-4c5e-9dde-c544a5a67795',
  modelName: 'default'
};

const STORAGE_KEY_MODELS = 'bs_ai_models_v1';
const STORAGE_KEY_ACTIVE = 'bs_ai_active_model_v1';

const _state = {
  models: [],
  activeModelId: null,
  storage: null,          // adapter { get, set } — opsional (Firestore)
  onChange: null,         // callback ketika ganti model
  mounted: false,
  openAnchor: null        // tombol .model-btn yang sedang membuka popover
};

/* ═══════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Init model picker.
 * @param {Object} opts
 * @param {Object} [opts.storage] - adapter { get: async()=>models[], set: async(models)=>void }
 * @param {Function} [opts.onChange] - callback(model) saat ganti model
 */
export async function initModelPicker(opts = {}) {
  _state.storage = opts.storage || null;
  _state.onChange = opts.onChange || null;

  _state.models = await loadModels();
  _state.activeModelId = getStoredActiveId() || DEFAULT_MODEL.id;

  injectStyles();
  injectDOM();
  attachEvents();

  renderAllModelBtns();
  _state.mounted = true;
}

export function getModels() {
  return _state.models.slice();
}

export function getActiveModelId() {
  return _state.activeModelId;
}

export function getActiveModel() {
  let id = _state.activeModelId;
  if (!id) id = DEFAULT_MODEL.id;
  let m = _state.models.find(x => x.id === id);
  if (!m) m = _state.models.find(x => x.isActive !== false) || _state.models[0] || DEFAULT_MODEL;
  return m;
}

export function renderAllModelBtns() {
  document.querySelectorAll('.model-btn').forEach(renderModelBtn);
}

/** Reload models dari storage (dipanggil kalau profile mengubah daftar) */
export async function refreshModels() {
  _state.models = await loadModels();
  renderAllModelBtns();
  const pop = document.getElementById('modelPopover');
  if (pop && pop.classList.contains('show')) renderSheetList();
}

/** Set model aktif. onChange callback dipanggil. */
export async function setActiveModel(id, opts = {}) {
  const model = _state.models.find(m => m.id === id);
  if (!model) return;
  _state.activeModelId = id;
  try { localStorage.setItem(STORAGE_KEY_ACTIVE, id); } catch (_) {}
  renderAllModelBtns();
  if (_state.onChange) { try { _state.onChange(model); } catch (_) {} }
  if (opts.onChange) { try { opts.onChange(model); } catch (_) {} }
}

/** Simpan daftar model (untuk dipakai profile.html) */
export async function saveModelsToStorage(models) {
  const normalized = normalizeModels(models);
  try { localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(normalized)); } catch (_) {}
  if (_state.storage && typeof _state.storage.set === 'function') {
    try { await _state.storage.set(normalized); } catch (_) {}
  }
  _state.models = normalized;
}

/* ═══════════════════════════════════════════════════════════════
   AI DISPATCHER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Panggil AI berdasarkan model yang dipilih.
 * @param {Object} model - model object
 * @param {String} message - pesan user
 * @param {String} conversationId - conv id (opsional)
 * @param {String} guestId - guest user id (untuk SpicyChat)
 * @returns {Promise<{reply: string, conversationId: string}>}
 */
export async function askAIDynamic(model, message, conversationId, guestId) {
  if (!model) model = getActiveModel();
  const provider = model.provider || 'spicychat';

  if (provider === 'spicychat') {
    return await askSpicyChat(model, message, conversationId, guestId);
  }

  throw new Error('Provider "' + provider + '" belum didukung di versi ini. Pakai SpicyChat dulu.');
}

async function askSpicyChat(model, message, conversationId, guestId) {
  const endpoint = (model.endpoint || DEFAULT_MODEL.endpoint).replace(/\/+$/, '');
  const charId = model.characterId || DEFAULT_MODEL.characterId;

  const headers = {
    "x-platform": "WEB",
    "x-platform-os": "ANDROID",
    "x-guest-userid": guestId || '',
    "x-app-id": "spicychat",
    "x-app-version": "2.44.0",
    "x-country": "ID",
    "content-type": "application/json",
    "accept": "application/json, text/plain, */*",
    "origin": "https://spicychat.ai",
    "referer": "https://spicychat.ai/"
  };
  if (model.apiKey) headers["authorization"] = "Bearer " + model.apiKey;

  const body = {
    conversation_id: conversationId || null,
    character_id: charId,
    language: "id",
    inference_model: model.modelName || "default",
    inference_settings: { max_new_tokens: 180, temperature: 0.7, top_p: 0.7, top_k: 90 },
    autopilot: false,
    continue_chat: false,
    message
  };

  const res = await fetch(endpoint + '/chat', {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error('HTTP ' + res.status);

  const convId = data?.conversation_id ?? data?.conversationId ?? data?.conversation?.id ?? data?.data?.conversation_id;
  let reply = "Gagal memuat pesan";
  if (typeof data === "string") reply = data;
  else if (data?.content) reply = data.content;
  else if (data?.reply) reply = typeof data.reply === "string" ? data.reply : (data.reply.content || data.reply.text || JSON.stringify(data.reply));
  else if (data?.message) reply = typeof data.message === "string" ? data.message : (data.message.content || data.message.text || JSON.stringify(data.message));
  else if (data?.data) reply = typeof data.data === "string" ? data.data : (data.data.content || data.data.reply || data.data.message?.content || JSON.stringify(data.data));
  else reply = JSON.stringify(data);

  return { reply, conversationId: convId };
}

/* ═══════════════════════════════════════════════════════════════
   STORAGE
   ═══════════════════════════════════════════════════════════════ */

async function loadModels() {
  // 1. dari storage adapter (mis. Firestore)
  if (_state.storage && typeof _state.storage.get === 'function') {
    try {
      const arr = await _state.storage.get();
      if (Array.isArray(arr) && arr.length) return normalizeModels(arr);
    } catch (_) {}
  }

  // 2. dari localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MODELS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return normalizeModels(arr);
    }
  } catch (_) {}

  // 3. default
  const d = normalizeModels([DEFAULT_MODEL]);
  try { localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(d)); } catch (_) {}
  if (_state.storage && typeof _state.storage.set === 'function') {
    try { await _state.storage.set(d); } catch (_) {}
  }
  return d;
}

function normalizeModels(arr) {
  return arr.map((m, i) => ({
    id: m.id || ('m_' + i + '_' + Date.now()),
    name: m.name || ('Model ' + (i + 1)),
    description: m.description || '',
    isActive: m.isActive !== false,
    order: typeof m.order === 'number' ? m.order : i,
    iconEmoji: m.iconEmoji || '🤖',
    provider: m.provider || 'spicychat',
    endpoint: m.endpoint || '',
    apiKey: m.apiKey || '',
    characterId: m.characterId || '',
    modelName: m.modelName || 'default'
  }));
}

function getStoredActiveId() {
  try { return localStorage.getItem(STORAGE_KEY_ACTIVE) || null; } catch (_) { return null; }
}

/* ═══════════════════════════════════════════════════════════════
   UI — inject CSS + DOM + events
   ═══════════════════════════════════════════════════════════════ */

function injectStyles() {
  if (document.getElementById('aiModelsStyles')) return;
  const s = document.createElement('style');
  s.id = 'aiModelsStyles';
  s.textContent = `
/* model button */
.model-btn{
  height:32px;padding:0 10px;border-radius:16px;
  display:flex;align-items:center;gap:6px;
  color:var(--text-secondary);background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.14);cursor:pointer;
  font-family:inherit;font-size:12px;font-weight:700;
  flex-shrink:0;max-width:150px;
  transition:background .2s,color .2s,transform .3s cubic-bezier(.34,1.4,.5,1);
  -webkit-tap-highlight-color:transparent;
}
.model-btn:hover{color:var(--accent);background:rgba(0,122,255,.14);border-color:rgba(0,122,255,.3);transform:scale(1.03)}
.model-btn:active{transform:scale(.95)}
.model-btn .model-btn-icon{font-size:15px;line-height:1;flex-shrink:0}
.model-btn .model-btn-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.model-btn .model-btn-caret{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;opacity:.7}
@media (max-width:400px){.model-btn{max-width:110px;padding:0 8px;font-size:11px}}

/* popover kaca mengambang — gaya sama persis dengan .attach-menu, tanpa dim/backdrop gelap */
.model-popover{
  position:fixed;z-index:1500;min-width:220px;max-width:280px;
  padding:6px;border-radius:18px;
  background:linear-gradient(135deg,rgba(48,52,66,.98) 0%,rgba(38,42,55,.98) 100%);
  backdrop-filter:blur(40px) saturate(200%) brightness(1.05);
  -webkit-backdrop-filter:blur(40px) saturate(200%) brightness(1.05);
  border:1px solid rgba(255,255,255,.16);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.18),inset 0 -1px 1px rgba(255,255,255,.04),0 16px 48px rgba(0,0,0,.75),0 4px 12px rgba(0,0,0,.5);
  opacity:0;transform:translateY(12px) scale(.92);transform-origin:bottom left;
  filter:blur(8px);pointer-events:none;
  transition:opacity .28s,transform .36s cubic-bezier(.34,1.4,.5,1),filter .32s;
  max-height:min(60vh,420px);display:flex;flex-direction:column;overflow:hidden;
}
:root[data-theme="light"] .model-popover{
  background:linear-gradient(135deg,rgba(255,255,255,.98) 0%,rgba(245,248,252,.98) 100%);
  border-color:rgba(0,0,0,.06);
}
.model-popover.show{opacity:1;transform:translateY(0) scale(1);filter:blur(0);pointer-events:auto}
.model-popover-list{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:2px}
.model-item{
  display:flex;align-items:center;gap:10px;
  padding:10px 10px;border-radius:14px;cursor:pointer;
  background:transparent;border:1px solid transparent;
  width:100%;text-align:left;font-family:inherit;
  transition:background .15s ease;-webkit-tap-highlight-color:transparent;
  margin-bottom:2px;
}
.model-item:hover{background:rgba(255,255,255,.1)}
:root[data-theme="light"] .model-item:hover{background:rgba(0,0,0,.05)}
.model-item.active{background:rgba(0,122,255,.14);border-color:rgba(0,122,255,.32)}
.model-item-icon{
  width:34px;height:34px;border-radius:10px;
  display:grid;place-items:center;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);
  flex-shrink:0;font-size:18px;line-height:1;
}
.model-item-body{flex:1;min-width:0}
.model-item-name{font-size:13.5px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.model-item-desc{font-size:11px;color:var(--text-tertiary);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.model-item-check{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;color:var(--accent);opacity:0;transition:opacity .15s}
.model-item.active .model-item-check{opacity:1}
.model-item-check svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.model-popover-footer{padding-top:4px;margin-top:2px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0}
:root[data-theme="light"] .model-popover-footer{border-top-color:rgba(0,0,0,.06)}
.model-popover-manage{
  display:flex;align-items:center;justify-content:center;gap:8px;
  width:100%;padding:10px;border-radius:14px;margin-top:4px;
  font-size:12.5px;font-weight:700;color:var(--accent);
  background:rgba(0,122,255,.10);border:1px solid rgba(0,122,255,.24);
  cursor:pointer;font-family:inherit;text-decoration:none;
  -webkit-tap-highlight-color:transparent;
  transition:background .2s,transform .2s;
}
.model-popover-manage:hover{background:rgba(0,122,255,.18);transform:translateY(-1px)}
.model-popover-manage svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
`;
  document.head.appendChild(s);
}

function injectDOM() {
  if (document.getElementById('modelPopover')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="model-popover" id="modelPopover">' +
      '<div class="model-popover-list" id="modelPopoverList"></div>' +
      '<div class="model-popover-footer">' +
        '<a class="model-popover-manage" href="profile.html#ai-models">' +
          '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
          'Kelola Model di Profile' +
        '</a>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap.firstElementChild);
}

function attachEvents() {
  const pop = document.getElementById('modelPopover');
  if (!pop) return;
  pop.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', e => {
    if (!pop.classList.contains('show')) return;
    if (pop.contains(e.target) || e.target.closest('.model-btn')) return;
    closeModelSheet();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pop.classList.contains('show')) closeModelSheet();
  });
  window.addEventListener('scroll', () => { if (pop.classList.contains('show')) closeModelSheet(); }, true);
  window.addEventListener('resize', () => { if (pop.classList.contains('show')) closeModelSheet(); });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.model-btn');
    if (!btn) return;
    e.stopPropagation();
    if (pop.classList.contains('show') && _state.openAnchor === btn) { closeModelSheet(); return; }
    openModelSheet(btn);
  }, true);
}

function renderModelBtn(btn) {
  const m = getActiveModel();
  const icon = btn.querySelector('.model-btn-icon');
  const name = btn.querySelector('.model-btn-name');
  if (icon) icon.textContent = m.iconEmoji || '🤖';
  if (name) name.textContent = m.name || 'Model';
}

function renderSheetList() {
  const list = document.getElementById('modelPopoverList');
  if (!list) return;
  list.innerHTML = '';
  const active = getActiveModel();
  const models = _state.models
    .filter(m => m.isActive !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (!models.length) {
    list.innerHTML = '<div style="padding:20px 10px;text-align:center;color:var(--text-tertiary);font-size:12.5px">Belum ada model aktif</div>';
    return;
  }
  models.forEach(m => {
    const item = document.createElement('button');
    item.className = 'model-item' + (m.id === active.id ? ' active' : '');
    item.type = 'button';
    item.innerHTML =
      '<div class="model-item-icon">' + escapeHTML(m.iconEmoji || '🤖') + '</div>' +
      '<div class="model-item-body">' +
        '<div class="model-item-name">' + escapeHTML(m.name || 'Model') + '</div>' +
        '<div class="model-item-desc">' + escapeHTML(m.description || (m.provider || '')) + '</div>' +
      '</div>' +
      '<div class="model-item-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>';
    item.addEventListener('click', () => {
      setActiveModel(m.id);
      closeModelSheet();
    });
    list.appendChild(item);
  });
}

/** Cari tombol .model-btn yang sedang terlihat di layar (fallback kalau anchor tidak dikirim). */
function getVisibleModelBtn() {
  const btns = document.querySelectorAll('.model-btn');
  for (const b of btns) { if (b.offsetParent !== null) return b; }
  return btns[0] || null;
}

function positionPopover(pop, anchor) {
  if (!anchor) { pop.style.left = '16px'; pop.style.right = 'auto'; pop.style.bottom = '80px'; pop.style.top = 'auto'; return; }
  const r = anchor.getBoundingClientRect();
  const margin = 12;
  const pw = Math.min(280, Math.max(220, pop.offsetWidth || 240));
  let left = r.left;
  if (left + pw > window.innerWidth - margin) left = window.innerWidth - pw - margin;
  if (left < margin) left = margin;
  const bottom = Math.max(margin, window.innerHeight - r.top + margin);
  pop.style.left = left + 'px';
  pop.style.right = 'auto';
  pop.style.bottom = bottom + 'px';
  pop.style.top = 'auto';
}

/** Buka popover model, mengambang dekat tombol (persis gaya menu attach, tanpa dim). */
export function openModelSheet(anchorEl) {
  renderSheetList();
  const pop = document.getElementById('modelPopover');
  if (!pop) return;
  const anchor = anchorEl || getVisibleModelBtn();
  pop.classList.add('show');
  positionPopover(pop, anchor);
  _state.openAnchor = anchor || null;
}

export function closeModelSheet() {
  const pop = document.getElementById('modelPopover');
  if (pop) pop.classList.remove('show');
  _state.openAnchor = null;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}