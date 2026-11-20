// Water: the Drop reminds you to drink. Doctors' usual advice is ~2–2.5 L a day for an adult,
// sipped through the day rather than at once, so by default: a glass (~250 ml) every 60 minutes
// you are at the computer, aiming at 8 glasses. Both are adjustable in Settings.
// Only time at the computer counts; a long absence starts the count again. It waits during a
// focus session, quiet hours, fullscreen, or while the island is busy.
(() => {
  const KEY = 'Yovy-water';
  const AWAY_RESET_S = 20 * 60; // away this long: start counting again
  const SNOOZE_MS = 15 * 60e3; // closed without drinking: ask again sooner
  let activeMs = 0;
  let last = Date.now();
  let idle = 0;

  const today = () => new Date().toDateString();
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && v.day === today()) return v.n;
    } catch {}
    return 0;
  }
  function save(n) {
    try { localStorage.setItem(KEY, JSON.stringify({ day: today(), n })); } catch {}
  }
  const everyMs = () => (state.features.waterEvery || 60) * 60e3;
  const goal = () => state.features.waterGoal || 8;

  function quiet() {
    const f = state.features;
    if (!f.quietHours) return false;
    const d = new Date();
    const m = d.getHours() * 60 + d.getMinutes();
    const from = f.quietFrom ?? 1380;
    const to = f.quietTo ?? 420;
    return from <= to ? m >= from && m < to : m >= from || m < to;
  }

  function remind(forced = false) {
    const n = load();
    const g = goal();
    const sub = n >= g
      ? `Daily goal reached (${g} glasses) 🎉 — one more won't hurt`
      : `<b>${n}</b> of ${g} glasses today`;

    // 1. Try character scene first (plays in both horizontal & vertical modes with Drop pet!)
    const played = (typeof window.playScene === 'function') && window.playScene({
      who: 'drop', props: ['glass'], arms: 'hold', tone: 'water', badge: '💧 Water',
      title: 'Drink a glass of water', sub, ms: 30000,
      button: { label: 'I drank ✓', onClick: drank },
      onClose: () => { activeMs = Math.max(0, everyMs() - SNOOZE_MS); },
    });

    if (played) return true;

    // 2. Fallback: expanded island card (works across horizontal AND vertical modes!)
    if (typeof window.showCard === 'function') {
      window.showCard({
        kind: 'water',
        badge: '💧 Water',
        html: `<span class="big">Drink a glass of water 💧</span><span class="ln">${sub}</span><div style="margin-top:8px"><button id="rm-water-drank" class="btn accent" style="padding:6px 16px;font-size:13px;border-radius:14px;cursor:pointer;background:#38bdf8;color:#05192d;font-weight:700;border:none;pointer-events:auto;" onclick="if(window.logWater){window.logWater();window.hideCard?.();}event.stopPropagation();">I drank ✓</button></div>`,
        ref: n >= g ? 'Goal reached 🎉' : `${n} / ${g} glasses`,
        ms: 20000,
      });
      const bindBtn = () => {
        const btn = document.getElementById('rm-water-drank');
        if (btn) {
          const onDrank = (e) => {
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            drank();
            if (typeof window.hideCard === 'function') window.hideCard();
          };
          btn.addEventListener('pointerdown', (e) => e.stopPropagation());
          btn.addEventListener('mousedown', (e) => e.stopPropagation());
          btn.addEventListener('click', onDrank);
        }
      };
      bindBtn();
      setTimeout(bindBtn, 50);
      return true;
    }

    // 3. Fallback: toast notification
    if (typeof showToast === 'function') {
      showToast('water', '💧 Drink a glass of water', n >= g ? 'Goal reached 🎉' : `${n}/${g} glasses`, 0, 10000);
      if (typeof state !== 'undefined' && state) {
        state.toastAction = () => { drank(); };
      }
      return true;
    }

    return false;
  }

  function drank() {
    const n = load() + 1;
    save(n);
    activeMs = 0;
    const g = goal();
    if (typeof showToast === 'function') showToast('done', n >= g ? 'Water goal reached!' : 'Glass of water ✓', `${n} / ${g}`, 0, 2400);
    if (n === g && typeof celebrate === 'function') celebrate(['#38bdf8', '#a5f3fc', '#ffd479']);
  }
  window.logWater = drank;
  window.remindWater = (forced = true) => remind(forced);
  window.getWaterStatus = () => ({ activeMs, everyMs: everyMs(), goal: goal(), count: load() });

  bridge.onMedia((m) => { if (typeof m.idle === 'number') idle = m.idle; });
  bridge.onWaterNow?.(() => { remind(true); });

  setInterval(() => {
    const now = Date.now();
    const dt = now - last;
    last = now;
    if (typeof feat === 'function' && !feat('water')) return;
    if (idle >= AWAY_RESET_S) { activeMs = 0; return; }
    if (idle < 120) activeMs += dt; // at the computer
    if (activeMs < everyMs()) return;
    // a calm moment only
    const isFocusing = typeof focusing === 'function' ? focusing() : false;
    const isScene = typeof window.sceneShowing === 'function' ? window.sceneShowing() : false;
    const isCard = typeof window.cardShowing === 'function' ? window.cardShowing() : false;
    if (!state.visible || isFocusing || quiet() || isScene || isCard || lastMode === 'expanded') return;
    if (state.toast && now < state.toastUntil) return;
    if (remind()) activeMs = 0;
  }, 5000);
})();
