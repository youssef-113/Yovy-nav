// The companion: notices when you come back, greets the day, and minds your breaks.
//   - back after away / sleep / screen-off / app start: "Welcome back, [Name]"
//   - first time at the computer each day: a morning (or evening) card: weather, next prayer,
//     today's meetings, Hijri date
//   - 50 min of continuous use: a gentle break card (stand up / water / rest your eyes)
(() => {
  const AWAY_S = 5 * 60; // this long without input = away
  const WORK_MS = 50 * 60e3;
  const BRIEF_KEY = 'Yovy-brief-day';
  const CARE = [
    ['Stand up and move', '50 minutes at the screen. Two minutes of moving wakes up body and mind.'],
    ['Rest your eyes', 'Look at something 20 feet away for 20 seconds — the 20-20-20 rule.'],
    ['Take a deep breath', 'In for 4, hold for 4, out for 4. Three times.'],
  ];

  let awayFrom = 0; // when the current absence started
  let activeSince = Date.now();
  let careIdx = 0;
  let pending = null; // a card waiting for a calm moment
  let lastWakeGreet = 0;

  const today = () => new Date().toDateString();
  const briefDone = () => { try { return localStorage.getItem(BRIEF_KEY) === today(); } catch { return false; } };
  const markBrief = () => { try { localStorage.setItem(BRIEF_KEY, today()); } catch {} };
  const mins = (ms) => {
    const m = Math.round(ms / 60000);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
  };
  const line = (icon, html) => `<span class="ln">${icon} ${html}</span>`;
  // Arabic words (prayer names, Hijri date) keep their own direction inside the English lines
  const ar = (t) => `<bdi lang="ar">${t}</bdi>`;

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  function getUserName() {
    return (state.features?.userName || '').trim();
  }

  function formatGreeting(prefix) {
    const name = getUserName();
    return name ? `${prefix}, ${esc(name)}` : prefix;
  }

  async function brief() {
    markBrief();
    const lines = [];
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    const hijri = $('#pr-hijri')?.textContent || '';
    lines.push(line('📆', `<b>${esc(date)}</b>${hijri ? ` · ${ar(esc(hijri))}` : ''}`));
    try {
      const w = (await bridge.system.snapshot())?.weather;
      if (w) lines.push(line('🌤️', `<b>${w.temp}°</b> in ${esc(w.city || 'your city')} · H ${w.hi}° L ${w.lo}°`));
    } catch {}
    const pr = window.nextPrayerText?.();
    if (pr && feat('tabPrayer')) {
      const [name, ...time] = pr.split(' ');
      lines.push(line('🕌', `Next prayer: <b>${ar(esc(name))}</b> ${esc(time.join(' '))}`));
    }
    const meets = window.meetingsToday?.() || [];
    if (meets.length) {
      const first = meets[0];
      const t = new Date(first.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      lines.push(line('📅', `${meets.length === 1 ? '1 meeting' : `${meets.length} meetings`} today · first: <b>${esc(first.title)}</b> ${t}`));
    }
    const head = formatGreeting(greeting());
    queue({ kind: 'brief', badge: greeting(), html: `<span class="big">${head} 👋</span>${lines.join('')}`, ref: '', ms: 14000 });
  }

  function welcome(awayMs = 0, reason = '') {
    const since = Date.now() - (awayMs || 0);
    const news = (window.happenings || []).filter((h) => h.at >= since);
    const isWakeOrStartup = reason === 'startup' || reason === 'preview' || reason === 'resume' || reason === 'unlock-screen' || reason === 'screen-on';
    if (!isWakeOrStartup && !news.length && awayMs < 15 * 60e3) return;

    const lines = [];
    if (awayMs && awayMs >= 60000) {
      lines.push(line('⏱️', `Away for ${mins(awayMs)}`));
    }

    news.slice(-3).forEach((h) => lines.push(line(h.icon, esc(h.text))));
    if (news.length > 3) lines.push(line('…', `and ${news.length - 3} more`));

    if (!news.length) {
      const pr = window.nextPrayerText?.();
      if (pr && feat('tabPrayer')) {
        const [pName, ...pTime] = pr.split(' ');
        lines.push(line('🕌', `Next prayer: <b>${ar(esc(pName))}</b> ${esc(pTime.join(' '))}`));
      } else {
        lines.push(line('✨', 'All quiet and running smoothly.'));
      }
    }

    const title = formatGreeting('Welcome back');
    queue({
      kind: 'welcome',
      badge: 'Welcome back',
      html: `<span class="big">${title} 👋</span>${lines.join('')}`,
      ref: '',
      ms: 10000
    });
  }


  const CHEER_MS = 60 * 60e3; // 1 hour of active computer time
  let lastCheerAt = Date.now();
  let lastRecordedHour = new Date().getHours();
  let cheerIdx = 0;

  const CHEERS = [
    {
      title: (name) => name ? `Good job, ${name}! 👏` : 'Good job! 👏',
      msg: 'Another productive hour completed. Keep up the great momentum!',
      badge: 'Keep Going 🚀',
    },
    {
      title: (name) => name ? `Keep going, ${name}! 🚀` : 'Keep going! 🚀',
      msg: "You're making steady progress. Stay focused and keep crushing it!",
      badge: 'Motivation 🔥',
    },
    {
      title: (name) => name ? `You're doing great, ${name}! ⭐` : "You're doing great! ⭐",
      msg: 'Consistency is key. Every bit of focused work brings you closer to your goals.',
      badge: 'Proud of you 🌟',
    },
    {
      title: (name) => name ? `Proud of your work, ${name}! 💪` : 'Proud of your work! 💪',
      msg: "You've been putting in great effort this hour. Stay energized and keep pushing!",
      badge: 'Focus Boost ⚡',
    },
    {
      title: (name) => name ? `Awesome progress, ${name}! ✨` : 'Awesome progress! ✨',
      msg: 'Step by step, hour by hour. Excellence is built through daily dedication.',
      badge: 'Keep Shining ✨',
    },
    {
      title: (name) => name ? `Stay focused, ${name}! 🔥` : 'Stay focused! 🔥',
      msg: "You have what it takes to finish today strong. Let's make this next hour count!",
      badge: 'Stay Sharp 🎯',
    },
    {
      title: (name) => name ? `You got this, ${name}! 🎯` : 'You got this! 🎯',
      msg: 'Deep focus leads to extraordinary results. Keep that winning streak going!',
      badge: 'Determination 🏆',
    },
  ];

  function quiet() {
    const f = state.features;
    if (!f.quietHours) return false;
    const d = new Date();
    const m = d.getHours() * 60 + d.getMinutes();
    const from = f.quietFrom ?? 1380;
    const to = f.quietTo ?? 420;
    return from <= to ? m >= from && m < to : m >= from || m < to;
  }

  function cheer() {
    const name = getUserName();
    const item = CHEERS[cheerIdx++ % CHEERS.length];
    const title = item.title(name);
    queue({
      kind: 'cheer',
      badge: item.badge,
      html: `<span class="big">${esc(title)}</span><span class="ln">${esc(item.msg)}</span>`,
      ref: '',
      ms: 9000,
    });
    if (feat('celebrate') && typeof window.celebrate === 'function') {
      window.celebrate(['#ff9f0a', '#ffd479', '#30d158', '#64d2ff']);
    }
  }

  function care() {
    const [title, text] = CARE[careIdx++ % CARE.length];
    queue({ kind: 'care', badge: 'Break', html: `<span class="big">${title} 🌿</span><span class="ln">${text}</span>`, ref: '', ms: 15000 });
  }

  // cards wait while the island is open, hidden, showing another card or a toast
  function queue(card) { pending = card; flush(); }
  function flush() {
    if (!pending) return;
    const now = Date.now();
    if (!state.visible || lastMode === 'expanded' || cardShowing() || window.sceneShowing?.() || (state.toast && now < state.toastUntil)) return;
    const c = pending;
    pending = null;
    showCard(c);
  }
  setInterval(flush, 1000);

  function onPowerWake(data) {
    if (!feat('welcomeBack')) return;
    const now = Date.now();
    // 35s cooldown so screen-on + unlock-screen don't double trigger
    if (now - lastWakeGreet < 35000) return;
    lastWakeGreet = now;

    const duration = data?.awayMs || (awayFrom ? now - awayFrom : 0);
    awayFrom = 0;
    activeSince = now;

    setTimeout(() => {
      if (feat('morningBrief') && !briefDone() && new Date().getHours() >= 4) {
        brief();
      } else if (feat('welcomeBack')) {
        welcome(duration, data?.event || 'wake');
      }
    }, 1200);
  }

  bridge.onPowerSleep?.((data) => {
    if (!awayFrom) awayFrom = data?.time || Date.now();
  });

  bridge.onPowerWake?.(onPowerWake);
  bridge.onGreetingNow?.(() => {
    welcome(0, 'preview');
  });
  bridge.onCheerNow?.(() => {
    cheer();
  });

  bridge.onMedia((m) => {
    if (typeof m.idle !== 'number') return;
    const now = Date.now();
    if (m.idle >= AWAY_S) {
      if (!awayFrom) awayFrom = now - m.idle * 1000;
      return;
    }
    if (awayFrom && m.idle < 5) {
      // back at the computer
      const awayMs = now - awayFrom;
      awayFrom = 0;
      activeSince = now; // that was a real break
      if (now - lastWakeGreet < 35000) return;
      lastWakeGreet = now;
      if (feat('morningBrief') && !briefDone() && new Date().getHours() >= 4) brief();
      else if (feat('welcomeBack')) welcome(awayMs, 'idle-return');
      return;
    }
    // minding breaks: long continuous use, never during focus, quiet hours or fullscreen
    if (feat('wellbeing') && now - activeSince >= WORK_MS && state.visible && !focusing() && !quiet()) {
      activeSince = now;
      care();
      return;
    }
    // hourly encouragement: every 60 min of active use or on the hour
    if (feat('hourlyCheer') && state.visible && !focusing() && !quiet()) {
      const curHour = new Date().getHours();
      const hourPassed = now - lastCheerAt >= CHEER_MS;
      const hourChanged = curHour !== lastRecordedHour && now - lastCheerAt >= 40 * 60e3;
      if (hourPassed || hourChanged) {
        lastRecordedHour = curHour;
        lastCheerAt = now;
        cheer();
      }
    }
  });

  // Startup greeting: greet once the island has settled (~2.5s)
  setTimeout(() => {
    if (feat('morningBrief') && !briefDone() && new Date().getHours() >= 4) {
      brief();
    } else if (feat('welcomeBack')) {
      welcome(0, 'startup');
    }
  }, 2500);
})();
