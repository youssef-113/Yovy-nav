const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const api = window.prefs;

let features = {};

// ---- saved hint ----
let savedTimer = null;
function saved(text = 'Saved') {
  $('#saved').textContent = text;
  $('#saved').classList.add('on');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => $('#saved').classList.remove('on'), 1300);
}

function nope(el) {
  el.classList.remove('nope');
  void el.offsetWidth;
  el.classList.add('nope');
}

// ---- themes: a gallery of live previews (colors from ../themes.css) ----
const THEMES = [
  ['original', 'Original YOVY', 'Liquid glass'],
  ['bakka', 'Bakka', 'Deep green and gold'],
  ['outline', 'Outline', 'Glass with a clean line'],
  ['midnight', 'Midnight', 'Pure black'],
  ['forest', 'Forest', 'Pine green'],
  ['snow', 'Snow', 'Winter glass'],
  ['cat', 'Cat', 'Little ears, paws for eyes'],
  ['galaxy', 'Galaxy', 'Violet sky and stars'],
  ['aurora', 'Aurora', 'Northern lights'],
  ['ocean', 'Ocean', 'Deep blue waves'],
  ['nody', 'Nody', 'Sakura pink, flowers for eyes'],
  ['lava', 'Lava', 'Glowing embers'],
  ['retro', 'Retro', 'Pixel green'],
];
const GLASS_THEMES = ['original', 'outline', 'snow'];

const themesEl = $('#themes');
if (themesEl) {
  themesEl.innerHTML = THEMES.map(([id, name, desc]) => `
    <button class="th-card" role="radio" data-theme="${id}" aria-checked="false">
      <span class="th-stage">
        <span class="th-pill"><i class="th-ear l"></i><i class="th-ear r"></i><b>9:41</b><span>☀ 24°</span></span>
        <span class="th-pill wide"><i class="th-ear l"></i><i class="th-ear r"></i><i class="th-art"></i><span class="th-song">Golden Hour</span><i class="th-eq"><i></i><i></i><i></i><i></i></i></span>
        <i class="th-check" aria-hidden="true"></i>
      </span>
      <span class="th-meta"><b>${name}</b><small>${desc}</small>${GLASS_THEMES.includes(id) ? '' : '<em>Lighter</em>'}</span>
    </button>`).join('');

  themesEl.addEventListener('click', (e) => {
    const card = e.target.closest('.th-card');
    if (!card || card.getAttribute('aria-checked') === 'true') return;
    $$('.th-card').forEach((c) => c.setAttribute('aria-checked', String(c === card)));
    api.setFeatures({ theme: card.dataset.theme });
    document.body.dataset.theme = card.dataset.theme;
    saved(`${card.querySelector('b').textContent} theme`);
  });
}

// ---- feature switches ----
function showFeatures(f) {
  features = f;
  $$('.th-card').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.theme === (f.theme || 'original'))));
  document.body.dataset.theme = f.theme || 'original';
  $$('[data-feature]').forEach((el) => { el.checked = !!f[el.dataset.feature]; });
  $$('[data-feature-text]').forEach((el) => { el.value = f[el.dataset.featureText] || ''; });
  // child settings show only while every switch they depend on is on
  $$('[data-needs]').forEach((el) => el.classList.toggle('off', !el.dataset.needs.split(' ').every((k) => f[k])));
  showSteppers();
}

$$('[data-feature]').forEach((el) => el.addEventListener('change', () => {
  const key = el.dataset.feature;
  // at least one reminder kind stays on
  if (el.hasAttribute('data-kind') && !el.checked && ![...$$('[data-kind]')].some((k) => k.checked)) {
    el.checked = true;
    nope(el);
    return;
  }
  if (el.hasAttribute('data-tab') && !el.checked && ![...$$('[data-tab]')].some((t) => t.checked)) {
    el.checked = true;
    nope(el.closest('.chip'));
    $('#tabs-warn').hidden = false;
    setTimeout(() => { $('#tabs-warn').hidden = true; }, 2600);
    return;
  }
  api.setFeatures({ [key]: el.checked });
  saved();
}));

// ---- number steppers (fixed list of sensible values) ----
const TIME_STEPS = Array.from({ length: 48 }, (_, i) => i * 30);
const stepsOf = (st) => (st.dataset.steps === 'time' ? TIME_STEPS : st.dataset.steps.split(',').map(Number));
function unitText(n, unit) {
  if (unit === 'glass') return `${n} glasses`;
  if (unit === 'day') return n === 0 ? 'None' : `${n > 0 ? '+' : '−'}${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`;
  if (unit === 'time') {
    const d = new Date(2000, 0, 1, Math.floor(n / 60), n % 60);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (unit === 'min') return n >= 60 && n % 60 === 0 ? `${n / 60} h` : `${n} min`;
  return `${n} s`;
}
function showSteppers() {
  $$('.stepper').forEach((st) => {
    const v = features[st.dataset.num];
    st.querySelector('output').textContent = unitText(v, st.dataset.unit);
    const steps = stepsOf(st);
    const wraps = st.dataset.steps === 'time';
    st.querySelector('[data-dir="-1"]').disabled = !wraps && v <= steps[0];
    st.querySelector('[data-dir="1"]').disabled = !wraps && v >= steps[steps.length - 1];
  });
}
$$('.stepper').forEach((st) => st.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const steps = stepsOf(st);
  const v = features[st.dataset.num];
  let next = b.dataset.dir === '1' ? steps.find((s) => s > v) : [...steps].reverse().find((s) => s < v);
  // clock times go round the day
  if (next == null && st.dataset.steps === 'time') next = b.dataset.dir === '1' ? steps[0] : steps[steps.length - 1];
  if (next == null) return;
  features[st.dataset.num] = next;
  showSteppers();
  api.setFeatures({ [st.dataset.num]: next });
  saved();
}));
$('#rm-preview').addEventListener('click', () => api.previewReminder());

// ---- feature text inputs (e.g. userName) ----
let nameDebounce = null;
$$('[data-feature-text]').forEach((el) => {
  const save = () => {
    clearTimeout(nameDebounce);
    const key = el.dataset.featureText;
    const val = el.value.trim();
    if (features[key] === val) return;
    features[key] = val;
    api.setFeatures({ [key]: val });
    saved();
  };
  el.addEventListener('input', () => {
    clearTimeout(nameDebounce);
    nameDebounce = setTimeout(save, 500);
  });
  el.addEventListener('change', save);
  el.addEventListener('blur', save);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      save();
      el.blur();
    }
  });
});
$('#greet-preview')?.addEventListener('click', () => api.previewGreeting?.());
$('#cheer-preview')?.addEventListener('click', () => api.previewCheer?.());

// ---- general (lives in the main process) ----
function showGeneral(g) {
  $$('[data-general]').forEach((el) => { el.checked = !!g[el.dataset.general]; });
  $$('[data-orient]').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.orient === 'v') === !!g.vertical)));
  $$('[data-pos-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.posMode === g.positionMode)));
  if (g.version) $('#version').textContent = `Version ${g.version}`;
}
$$('[data-support]').forEach((b) => b.addEventListener('click', () => api.openSupport(b.dataset.support)));
$$('[data-general]').forEach((el) => el.addEventListener('change', () => {
  api.setGeneral(el.dataset.general, el.checked);
  saved();
}));
$$('[data-orient]').forEach((b) => b.addEventListener('click', () => {
  api.setGeneral('vertical', b.dataset.orient === 'v');
  saved();
}));
$$('[data-pos-mode]').forEach((b) => b.addEventListener('click', () => {
  api.setGeneral('positionMode', b.dataset.posMode);
  saved();
}));
$$('[data-general-action]').forEach((b) => b.addEventListener('click', () => {
  api.setGeneral(b.dataset.generalAction, true);
  saved('Done');
}));

// ---- location ----
function showLocation(info) {
  const manual = info?.mode === 'manual';
  $('#loc-now').textContent = manual
    ? `${info.name}${info.country ? `, ${info.country}` : ''}`
    : `Auto${info?.name ? ` · ${info.name}` : ''}`;
  $('#loc-auto').hidden = !manual;
}
async function searchCity() {
  const q = $('#loc-q').value.trim();
  const box = $('#loc-results');
  if (q.length < 2) return;
  box.hidden = false;
  box.innerHTML = '<div class="none">Searching…</div>';
  const res = await api.searchCity(q);
  if (!res) {
    box.innerHTML = '<div class="none">Search failed. Check your connection.</div>';
    return;
  }
  if (!res.length) {
    box.innerHTML = '<div class="none">No results</div>';
    return;
  }
  box.innerHTML = '';
  res.forEach((r) => {
    const b = document.createElement('button');
    b.innerHTML = '<b></b><span></span>';
    b.querySelector('b').textContent = r.name;
    b.querySelector('span').textContent = [r.admin, r.country].filter(Boolean).join(', ');
    b.addEventListener('click', () => {
      api.setLocation(r);
      box.hidden = true;
      $('#loc-q').value = '';
      saved();
    });
    box.append(b);
  });
}
$('#loc-go').addEventListener('click', searchCity);
$('#loc-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchCity(); });
$('#loc-auto').addEventListener('click', () => {
  api.setLocation(null);
  saved();
});
api.onLocation(showLocation);
api.location().then(showLocation);

// ---- calendar ----
function showCalendar(c) {
  const el = $('#cal-status');
  if (!c?.hasUrl && !c?.updated && !c?.error) {
    el.textContent = 'Not linked';
    return;
  }
  if (c.error) {
    el.textContent = `Can't read it (${c.error})`;
    return;
  }
  const next = c.events?.find((e) => e.end > Date.now());
  el.textContent = next
    ? `Linked · next: ${next.title} ${new Date(next.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : 'Linked · nothing in the next 24 h';
}
$('#cal-save').addEventListener('click', async () => {
  const res = await api.setCalendar($('#cal-url').value);
  if (!res?.ok) {
    $('#cal-status').textContent = 'Use an https:// or webcal:// link';
    return;
  }
  $('#cal-url').value = '';
  $('#cal-status').textContent = 'Connecting…';
  saved();
});
api.onCalendar((c) => showCalendar({ ...c, hasUrl: true }));
api.calendar().then(showCalendar);

// ---- media bridge health ----
async function showBridge() {
  const s = await api.bridgeStatus();
  const el = $('#bridge-state');
  el.className = `status ${s.state}`;
  el.textContent = s.state === 'ok' ? 'Running' : s.state === 'starting' ? 'Starting…' : 'Stopped';
  const detail = $('#bridge-detail');
  detail.hidden = s.state !== 'failed';
  detail.textContent = 'Allow YOVY-NAV in your antivirus, then restart it';
}
showBridge();
setInterval(showBridge, 4000);

$('#open-log').addEventListener('click', () => api.openLog());
$('#copy-report').addEventListener('click', async () => {
  await api.copyReport();
  saved('Report copied');
});

$('#reset-all').addEventListener('click', () => {
  api.resetFeatures();
  saved('Reset to defaults');
});

// ---- window buttons ----
$$('[data-win]').forEach((b) => b.addEventListener('click', () => api.window(b.dataset.win)));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($('#find').value) clearSearch();
  else api.window('close');
});

// ---- pages: one at a time, the last one opened is remembered ----
const PAGE_KEY = 'prefs-page';
function remembered() {
  try { return localStorage.getItem(PAGE_KEY) || 'general'; } catch { return 'general'; }
}
const links = [...$$('.side a')];
function showPage(id) {
  if (!document.getElementById(id)) id = 'general';
  $$('.page').forEach((p) => p.classList.toggle('on', p.id === id));
  links.forEach((a) => a.classList.toggle('on', a.dataset.page === id));
  $('#content').scrollTop = 0;
  try { localStorage.setItem(PAGE_KEY, id); } catch {}
}
links.forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  clearSearch();
  showPage(a.dataset.page);
}));
showPage(remembered());

// ---- search: rows from every page whose title matches ----
// rows without a title (the city and calendar link fields) stay on their own page
const items = [...$$('.row, .chip, .prefs-task-row')];
const title = (el) => el.querySelector('b')?.textContent.toLowerCase() || el.querySelector('.prefs-task-text')?.textContent.toLowerCase() || '';
function search(q) {
  q = q.trim().toLowerCase();
  document.body.classList.toggle('searching', !!q);
  links.forEach((a) => a.classList.toggle('on', !q && a.dataset.page === remembered()));
  if (!q) {
    $$('.miss, .empty').forEach((el) => el.classList.remove('miss', 'empty'));
    $('#no-results').hidden = true;
    showPage(remembered());
    return;
  }
  for (const el of items) el.classList.toggle('miss', !title(el).includes(q));
  // a group's own heading matches too
  $$('.group').forEach((g) => {
    const head = g.querySelector('h2')?.textContent.toLowerCase().includes(q);
    if (head) g.querySelectorAll('.miss').forEach((el) => { if (title(el)) el.classList.remove('miss'); });
    g.classList.toggle('empty', !g.querySelector('.row:not(.miss):not(.off), .chip:not(.miss), .prefs-task-row:not(.miss)'));
  });
  let any = false;
  $$('.page').forEach((p) => {
    const empty = !p.querySelector('.row:not(.miss):not(.off), .chip:not(.miss), .prefs-task-row:not(.miss)');
    p.classList.toggle('empty', empty);
    any ||= !empty;
  });
  $('#no-results').hidden = any;
}
function clearSearch() {
  if (!$('#find').value) return;
  $('#find').value = '';
  search('');
}
$('#find').addEventListener('input', (e) => search(e.target.value));

api.onFeatures(showFeatures);
api.onGeneral(showGeneral);
api.features().then(showFeatures);
api.general().then(showGeneral);

// ---- tasks management ----
let tasks = [];
const pad = (n) => String(n).padStart(2, '0');

// --- Task Management (12-Hour Time & Day Selection) ---

let selectedDayMode = 'today'; // 'today', 'tomorrow', 'custom'
let selectedCustomDate = '';    // 'YYYY-MM-DD'

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Format 12-hour time and validate strictly (Hours: 1-12, Minutes: 00-59)
function validate12hTime(raw, currentAmpm = 'AM') {
  let str = String(raw || '').trim();
  let ampm = currentAmpm === 'PM' ? 'PM' : 'AM';
  
  if (/pm$/i.test(str)) { ampm = 'PM'; str = str.replace(/pm$/i, '').trim(); }
  else if (/am$/i.test(str)) { ampm = 'AM'; str = str.replace(/am$/i, '').trim(); }
  
  let h = 9, m = 30;
  if (str.includes(':')) {
    const parts = str.split(':');
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  } else if (/^\d{3,4}$/.test(str)) {
    if (str.length === 3) {
      h = parseInt(str.slice(0, 1), 10);
      m = parseInt(str.slice(1), 10);
    } else {
      h = parseInt(str.slice(0, 2), 10);
      m = parseInt(str.slice(2), 10);
    }
  } else if (/^\d{1,2}$/.test(str)) {
    h = parseInt(str, 10);
    m = 0;
  }
  
  if (!Number.isFinite(h)) h = 9;
  if (!Number.isFinite(m)) m = 0;
  
  // Intelligent 24-to-12 conversion if user typed 24h format e.g. 14:00
  if (h > 12 && h <= 23) {
    h -= 12;
    ampm = 'PM';
  } else if (h > 12) {
    h = 12;
  } else if (h < 1) {
    h = 12;
  }
  
  if (m < 0) m = 0;
  if (m > 59) m = 59;
  
  const hour24 = ampm === 'PM' ? (h < 12 ? h + 12 : 12) : (h === 12 ? 0 : h);
  
  return {
    h,
    m,
    ampm,
    formatted: `${pad(h)}:${pad(m)}`,
    hour24,
  };
}

function updateSchedulePreview() {
  const badge = $('#prefs-schedule-badge');
  if (!badge) return;
  
  const timeInput = $('#prefs-task-time-input');
  const ampmSelect = $('#prefs-task-time-ampm');
  const timeInfo = validate12hTime(timeInput ? timeInput.value : '09:30', ampmSelect ? ampmSelect.value : 'AM');
  
  let dayLabel = 'Today';
  if (selectedDayMode === 'tomorrow') {
    dayLabel = 'Tomorrow';
  } else if (selectedDayMode === 'custom' && selectedCustomDate) {
    const [y, mo, da] = selectedCustomDate.split('-').map(Number);
    const d = new Date(y, mo - 1, da);
    dayLabel = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  
  badge.textContent = `${dayLabel} at ${timeInfo.formatted} ${timeInfo.ampm}`;
}

function selectDay(mode, customDate = '') {
  selectedDayMode = mode;
  const todayBtn = $('#prefs-day-today');
  const tomorrowBtn = $('#prefs-day-tomorrow');
  const pickBtn = $('#prefs-day-pick-btn');
  const pickLabel = $('#prefs-day-pick-label');
  const dateInput = $('#prefs-task-date-input');
  
  todayBtn?.classList.toggle('active', mode === 'today');
  tomorrowBtn?.classList.toggle('active', mode === 'tomorrow');
  pickBtn?.classList.toggle('active', mode === 'custom');
  
  if (mode === 'custom' && customDate) {
    selectedCustomDate = customDate;
    if (dateInput) dateInput.value = customDate;
    const [y, mo, da] = customDate.split('-').map(Number);
    const d = new Date(y, mo - 1, da);
    if (pickLabel) pickLabel.textContent = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else if (mode !== 'custom') {
    selectedCustomDate = '';
    if (pickLabel) pickLabel.textContent = 'Pick date';
  }
  
  updateSchedulePreview();
}

function initDaySelection() {
  const todayBtn = $('#prefs-day-today');
  const tomorrowBtn = $('#prefs-day-tomorrow');
  const pickBtn = $('#prefs-day-pick-btn');
  const dateInput = $('#prefs-task-date-input');
  const timeInput = $('#prefs-task-time-input');
  const ampmSelect = $('#prefs-task-time-ampm');
  
  if (dateInput) {
    dateInput.min = getTodayStr();
  }
  
  todayBtn?.addEventListener('click', () => selectDay('today'));
  tomorrowBtn?.addEventListener('click', () => selectDay('tomorrow'));
  
  pickBtn?.addEventListener('click', () => {
    if (dateInput) {
      if (typeof dateInput.showPicker === 'function') {
        dateInput.showPicker();
      } else {
        dateInput.click();
      }
    }
  });
  
  dateInput?.addEventListener('change', () => {
    if (dateInput.value) {
      selectDay('custom', dateInput.value);
    }
  });
  
  timeInput?.addEventListener('input', () => {
    updateSchedulePreview();
  });
  
  timeInput?.addEventListener('blur', () => {
    const val = validate12hTime(timeInput.value, ampmSelect?.value || 'AM');
    timeInput.value = val.formatted;
    if (ampmSelect) ampmSelect.value = val.ampm;
    updateSchedulePreview();
  });
  
  ampmSelect?.addEventListener('change', () => {
    updateSchedulePreview();
  });
}

function isToday(ts) {
  if (!Number.isFinite(ts)) return false;
  const d = new Date(ts);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isTomorrow(ts) {
  if (!Number.isFinite(ts)) return false;
  const d = new Date(ts);
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  return d.toDateString() === tom.toDateString();
}

function formatDue(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return '—';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday(ts)) return `Today ${timeStr}`;
    if (isTomorrow(ts)) return `Tomorrow ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
  } catch {
    return '—';
  }
}

function calculateDueTimestamp() {
  const timeInput = $('#prefs-task-time-input');
  const ampmSelect = $('#prefs-task-time-ampm');
  const timeInfo = validate12hTime(timeInput ? timeInput.value : '09:30', ampmSelect ? ampmSelect.value : 'AM');
  
  let targetYear, targetMonth, targetDay;
  const now = new Date();
  
  if (selectedDayMode === 'tomorrow') {
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    targetYear = tom.getFullYear();
    targetMonth = tom.getMonth();
    targetDay = tom.getDate();
  } else if (selectedDayMode === 'custom' && selectedCustomDate) {
    const [y, mo, da] = selectedCustomDate.split('-').map(Number);
    targetYear = y;
    targetMonth = mo - 1;
    targetDay = da;
  } else {
    // Today
    targetYear = now.getFullYear();
    targetMonth = now.getMonth();
    targetDay = now.getDate();
  }
  
  const targetDate = new Date(targetYear, targetMonth, targetDay, timeInfo.hour24, timeInfo.m, 0, 0);
  
  // If today was selected and time already passed, automatically schedule for tomorrow
  if (selectedDayMode === 'today' && targetDate.getTime() <= Date.now()) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  
  return targetDate.getTime();
}

function setDefaultTime() {
  const d = new Date(Date.now() + 15 * 60000);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  
  const roundedMin = m < 15 ? 0 : m < 45 ? 30 : 0;
  const finalHour = roundedMin === 0 && m >= 45 ? (h === 12 ? 1 : h + 1) : h;
  const finalAmpm = roundedMin === 0 && m >= 45 ? (ampm === 'AM' ? 'PM' : 'AM') : ampm;
  
  const timeInput = $('#prefs-task-time-input');
  const ampmSelect = $('#prefs-task-time-ampm');
  if (timeInput) timeInput.value = `${pad(finalHour)}:${pad(roundedMin)}`;
  if (ampmSelect) ampmSelect.value = finalAmpm;
  
  selectDay('today');
}

async function loadTasks() {
  try {
    tasks = await api.tasks() || [];
    if (!Array.isArray(tasks)) tasks = [];
    tasks = tasks.filter((t) =>
      t && typeof t === 'object' && t.id && typeof t.text === 'string' && Number.isFinite(t.dueTime) && t.dueTime > 0
    );
  } catch {
    tasks = [];
  }
  renderTasks();
}

function renderTasks() {
  const list = $('#prefs-task-list');
  const empty = $('#prefs-task-empty');
  if (!list) return;
  
  list.innerHTML = '';
  const sorted = [...tasks].sort((a, b) => a.dueTime - b.dueTime);
  
  if (sorted.length === 0) {
    empty.hidden = false;
    return;
  }
  
  empty.hidden = true;
  
  sorted.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'prefs-task-row';
    row.innerHTML = `
      <div class="prefs-task-info">
        <span class="prefs-task-text">${t.text}</span>
        <span class="prefs-task-time">${formatDue(t.dueTime)}</span>
      </div>
      <div class="prefs-task-actions">
        <button class="btn-icon" data-action="edit" title="Edit task">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" data-action="delete" title="Delete task">
          <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
    
    row.querySelector('[data-action="edit"]')?.addEventListener('click', () => editTask(t));
    row.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteTask(t.id));
    
    list.append(row);
  });
}

function addTask() {
  const text = $('#prefs-task-text').value.trim();
  const remindValue = $('#prefs-task-remind')?.value || 'default';
  
  if (!text) {
    $('#prefs-task-text').focus();
    return;
  }
  
  const dueTime = calculateDueTimestamp();
  const remindInterval = remindValue === 'default' ? null : parseInt(remindValue, 10) * 60000;
  const newTask = {
    id: String(Date.now() + Math.random().toString(36).slice(2, 6)),
    text,
    dueTime,
    completed: false,
    fired: false,
    lastRemind: 0,
    createdAt: Date.now(),
    finishedAt: 0,
    remindInterval,
  };
  
  tasks.push(newTask);
  api.saveTasks(tasks);
  $('#prefs-task-text').value = '';
  if ($('#prefs-task-remind')) $('#prefs-task-remind').value = 'default';
  setDefaultTime();
  renderTasks();
  saved('Task added');
}

function editTask(task) {
  $('#prefs-task-text').value = task.text;
  const d = new Date(task.dueTime);
  
  // 1. Day selection
  const now = new Date();
  const tom = new Date(now);
  tom.setDate(tom.getDate() + 1);
  
  if (d.toDateString() === now.toDateString()) {
    selectDay('today');
  } else if (d.toDateString() === tom.toDateString()) {
    selectDay('tomorrow');
  } else {
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    selectDay('custom', `${yyyy}-${mm}-${dd}`);
  }
  
  // 2. 12-hour Time & AM/PM
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  
  const timeInput = $('#prefs-task-time-input');
  const ampmSelect = $('#prefs-task-time-ampm');
  if (timeInput) timeInput.value = `${pad(h)}:${pad(m)}`;
  if (ampmSelect) ampmSelect.value = ampm;
  
  // 3. Remind interval
  if (task.remindInterval && $('#prefs-task-remind')) {
    const minutes = task.remindInterval / 60000;
    $('#prefs-task-remind').value = String(minutes);
  } else if ($('#prefs-task-remind')) {
    $('#prefs-task-remind').value = 'default';
  }
  
  updateSchedulePreview();
  
  $('#prefs-task-add').textContent = 'Update Task';
  $('#prefs-task-add').dataset.editId = task.id;
  $('#prefs-task-text').focus();
}

function updateTask() {
  const editId = $('#prefs-task-add').dataset.editId;
  if (!editId) {
    addTask();
    return;
  }
  
  const text = $('#prefs-task-text').value.trim();
  const remindValue = $('#prefs-task-remind')?.value || 'default';
  
  if (!text) {
    $('#prefs-task-text').focus();
    return;
  }
  
  const taskIndex = tasks.findIndex((t) => t.id === editId);
  if (taskIndex === -1) {
    delete $('#prefs-task-add').dataset.editId;
    $('#prefs-task-add').textContent = 'Add Task';
    return;
  }
  
  tasks[taskIndex].text = text;
  tasks[taskIndex].dueTime = calculateDueTimestamp();
  tasks[taskIndex].remindInterval = remindValue === 'default' ? null : parseInt(remindValue, 10) * 60000;
  
  api.saveTasks(tasks);
  $('#prefs-task-text').value = '';
  if ($('#prefs-task-remind')) $('#prefs-task-remind').value = 'default';
  setDefaultTime();
  delete $('#prefs-task-add').dataset.editId;
  $('#prefs-task-add').textContent = 'Add Task';
  renderTasks();
  saved('Task updated');
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  api.saveTasks(tasks);
  renderTasks();
  saved('Task deleted');
}

$('#prefs-task-add')?.addEventListener('click', () => {
  if ($('#prefs-task-add').dataset.editId) {
    updateTask();
  } else {
    addTask();
  }
});

$('#prefs-task-text')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if ($('#prefs-task-add').dataset.editId) {
      updateTask();
    } else {
      addTask();
    }
  }
});

initDaySelection();
setDefaultTime();
loadTasks();
