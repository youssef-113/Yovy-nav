// Scenes: for a moment the island itself becomes a character (Yovy, or the Drop) with a card
// beside it — the adhan, a glass of water, a focus session. The island's own morph (size and
// place) does the transformation; the skin, face, limbs and props fade in after it.
//
//   playScene({ who: 'Yovy' | 'drop', props: ['cap', 'rug', 'band', 'laptop', 'glass'],
//               arms: 'rest' | 'fold' | 'type' | 'hold', tone: 'gold' | 'water' | 'focus',
//               badge, title, quran, sub (html), button: { label, onClick }, ms,
//               lang: 'ar' (right-to-left card; English otherwise),
//               onClose (closed with × or timed out, not by the button) })
(() => {
  const card = $('#scene-card');
  const face = $('.sc-face');
  const bar = $('.sc-bar b');
  const PROPS = ['cap', 'rug', 'band', 'laptop', 'glass'];
  let total = 0;
  let current = null;
  let lastTick = Date.now();
  let hardEndAt = 0;
  let fallbackTimer = null;

  function classes(on, s) {
    island.classList.toggle('sc-Yovy', on && s?.who !== 'drop');
    island.classList.toggle('sc-drop', on && s?.who === 'drop');
    for (const p of PROPS) island.classList.toggle(`p-${p}`, on && s?.props?.includes(p));
    for (const a of ['rest', 'fold', 'type', 'hold']) island.classList.toggle(`arms-${a}`, on && (s?.arms || 'rest') === a);
    island.classList.toggle('glow-gold', on && s?.tone === 'gold');
  }

  function end(how = 'closed') {
    if (!current) return;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (how !== 'button') current.onClose?.();
    state.sceneUntil = 0;
    card.classList.remove('on');
    render();
    const s = current;
    current = null;
    // let the island morph back before the skin and props go
    setTimeout(() => { if (!current) classes(false, s); }, 420);
  }

  window.playScene = (s) => {
    if (anchor.vertical) return false; // no room beside a side-docked island
    current = s;
    classes(true, s);
    card.className = `scene-card ${s.tone || 'gold'}`;
    card.lang = s.lang || 'en';
    card.dir = s.lang === 'ar' ? 'rtl' : 'ltr';
    $('#sc-badge').textContent = s.badge || '';
    const title = $('#sc-title');
    title.textContent = s.title || '';
    title.classList.toggle('quran', !!s.quran);
    $('#sc-sub').innerHTML = s.sub || '';
    const btn = $('#sc-btn');
    btn.hidden = !s.button;
    if (s.button) btn.textContent = s.button.label;

    total = s.ms || 8000;
    const now = Date.now();
    state.sceneUntil = now + total;
    // Maximum guaranteed lifetime on screen, preventing hover from pausing it forever
    hardEndAt = now + Math.min(total + 3500, total * 1.35);

    if (fallbackTimer) clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      if (current) end('timeout');
    }, Math.max(total + 1000, hardEndAt - now + 500));

    bar.style.width = '100%';
    state.hover = false;
    render();
    positionIsland();
    requestAnimationFrame(() => card.classList.add('on'));
    return true;
  };
  window.sceneShowing = () => !!current;
  window.endScene = end;

  // Dismiss on close button
  $('#sc-close').addEventListener('click', (e) => { e.stopPropagation(); end(); });

  // Action button
  $('#sc-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const fn = current?.button?.onClick;
    end('button');
    fn?.();
  });

  // Clicking anywhere on the scene card or on the character immediately dismisses it
  card.addEventListener('click', (e) => {
    if (e.target.closest('#sc-btn') || e.target.closest('#sc-close')) return;
    end('card-click');
  });
  island.addEventListener('click', () => {
    if (current) end('island-click');
  });

  // Pressing Escape dismisses active scene
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) end('escape');
  });

  // countdown (paused slightly while mouse is on it, but capped at hardEndAt)
  setInterval(() => {
    const now = Date.now();
    const dt = now - lastTick;
    lastTick = now;
    if (!current) return;
    if (state.hover && state.sceneUntil < hardEndAt) {
      state.sceneUntil = Math.min(hardEndAt, state.sceneUntil + dt * 0.4);
    }
    if (now >= state.sceneUntil || now >= hardEndAt) return end();
    bar.style.width = `${Math.max(0, (state.sceneUntil - now) / total) * 100}%`;
  }, 250);

  (function blink() {
    if (current) {
      face.classList.add('blink');
      setTimeout(() => face.classList.remove('blink'), 130);
    }
    setTimeout(blink, 2600 + Math.random() * 3200);
  })();
})();
