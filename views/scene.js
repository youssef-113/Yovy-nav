// Scenes: for a moment the island itself becomes a character (Yovy, or the Drop) with a card
// beside it — the adhan, a glass of water, a focus session. The island's own morph (size and
// place) does the transformation; the skin, face, limbs and props fade in after it.
(() => {
  const card = $('#scene-card');
  const face = $('.sc-face');
  const bar = $('.sc-bar b');
  const PROPS = ['cap', 'rug', 'band', 'laptop', 'glass'];
  let total = 0;
  let current = null;
  let hardEndAt = 0;
  let fallbackTimer = null;
  let blinkTimer = null;

  function classes(on, s) {
    island.classList.toggle('sc-Yovy', on && s?.who !== 'drop');
    island.classList.toggle('sc-drop', on && s?.who === 'drop');
    for (const p of PROPS) island.classList.toggle(`p-${p}`, on && s?.props?.includes(p));
    for (const a of ['rest', 'fold', 'type', 'hold']) island.classList.toggle(`arms-${a}`, on && (s?.arms || 'rest') === a);
    island.classList.toggle('glow-gold', on && s?.tone === 'gold');
  }

  function end(how = 'closed') {
    bridge.suppressHover?.();
    if (!current) return;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (blinkTimer) {
      clearTimeout(blinkTimer);
      blinkTimer = null;
    }
    if (how !== 'button') current.onClose?.();
    state.sceneUntil = 0;
    card.classList.remove('on');
    card.style.display = 'none'; // Force hide immediately!
    const s = current;
    current = null;
    classes(false, s);
    // Force reset hover and mode so island does not spring open to 'expanded'
    state.hover = false;
    state.pinned = false;
    island.classList.remove('scene', 'sc-Yovy', 'sc-drop', 'glow-gold');
    render();
    if (typeof reportRect === 'function') reportRect(true);
  }

  window.playScene = (s) => {
    if (anchor.vertical) return false; // no room beside a side-docked island
    current = s;
    classes(true, s);
    card.style.display = ''; // Re-enable display
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

    total = Math.min(s.ms || 7000, 8000);
    const now = Date.now();
    state.sceneUntil = now + total;
    hardEndAt = now + total + 500;

    if (fallbackTimer) clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      if (current) end('timeout');
    }, total + 600);

    bar.style.width = '100%';
    state.hover = false;
    render();
    positionIsland();
    if (typeof reportRect === 'function') reportRect(true);
    requestAnimationFrame(() => card.classList.add('on'));
    startBlink();
    return true;
  };
  window.sceneShowing = () => !!current;
  window.endScene = end;

  // Dismiss on close button (instant first-click response on pointerdown & click)
  const doCloseScene = (e) => {
    e.preventDefault();
    e.stopPropagation();
    end('close-btn');
  };
  const scCloseBtn = $('#sc-close');
  if (scCloseBtn) {
    scCloseBtn.addEventListener('pointerdown', doCloseScene);
    scCloseBtn.addEventListener('click', doCloseScene);
  } end('close-btn'); });

  // Action button
  $('#sc-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const fn = current?.button?.onClick;
    end('button');
    fn?.();
  });

  // Clicking anywhere on the scene card or on the character immediately dismisses it
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#sc-btn') || e.target.closest('#sc-close')) return;
    end('card-click');
  });
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

  // countdown tick
  setInterval(() => {
    if (!current) return;
    const now = Date.now();
    if (now >= state.sceneUntil || now >= hardEndAt) return end('timed-out');
    bar.style.width = `${Math.max(0, (state.sceneUntil - now) / total) * 100}%`;
  }, 250);

  function startBlink() {
    if (!current) return;
    face.classList.add('blink');
    setTimeout(() => face.classList.remove('blink'), 130);
    blinkTimer = setTimeout(startBlink, 3000 + Math.random() * 2000);
  }
})();
