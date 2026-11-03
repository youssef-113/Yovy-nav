// Tasks / Task Reminder tab:
// - Simple, normal time input and today/tomorrow toggle (no native popups to prevent lag).
// - Shows upcoming task and remaining time in the carousel (idle slide).
// - Reminders persist until the task is clicked finish.
// - Finished tasks table with "Well done 🎉" celebration.
(() => {
  const view = $('#v-tasks');
  if (!view) return;

  // View switch elements
  const tabActiveBtn = $('#task-tab-active-btn');
  const tabFinishedBtn = $('#task-tab-finished-btn');
  const paneActive = $('#task-pane-active');
  const paneFinished = $('#task-pane-finished');
  const badgeActiveCount = $('#badge-active-count');
  const badgeFinishedCount = $('#badge-finished-count');

  // Input elements
  const inputEl = $('#task-input-text');
  const timeEl = $('#task-input-time');
  const remindEl = $('#task-input-remind');
  const addBtn = $('#task-add-btn');
  const dayTodayBtn = $('#task-day-today');
  const dayTomorrowBtn = $('#task-day-tomorrow');

  // Active list elements
  const listEl = $('#task-list');
  const emptyActiveEl = $('#task-empty');
  const pendingSummaryEl = $('#task-pending-summary');

  // Finished table elements
  const doneTbody = $('#task-done-tbody');
  const emptyDoneEl = $('#task-done-empty');
  const doneSummaryEl = $('#task-done-summary');
  const clearDoneBtn = $('#task-clear-done');

  // Showcase elements (left card)
  const eyebrowEl = $('#task-next-eyebrow');
  const nextNameEl = $('#task-next-name');
  const nextCountEl = $('#task-next-count');
  const nextTimeEl = $('#task-next-time');
  const statsEl = $('#task-stats-text');
  const bell = $('#task-alerts-btn');
  const badgeEl = $('#tasks-badge');

  // Carousel slide elements
  const slideEl = $('.task-slide');
  const slideTitle = $('#i-task-title');
  const slideStatus = $('#i-task-status');
  const slideLeft = $('#i-task-left');

  // Vertical pill elements
  const vTaskItem = $('#v-task-item');
  const vTaskName = $('#v-task-name');
  const vTaskLeft = $('#v-task-left');

  let tasks = [];
  let selectedDayOffset = 0; // 0 = today, 1 = tomorrow
  
  // Get reminder interval from features (default 5 minutes)
  function getRemindInterval() {
    const minutes = state.features.taskRemindEvery || 5;
    return minutes * 60000;
  }

  // Alerts switch (shared with features.taskAlerts)
  let alertsOn = true;
  const showBell = () => bell?.classList.toggle('on', alertsOn);
  showBell();

  window.addEventListener('island:features', (e) => {
    alertsOn = e.detail?.taskAlerts !== false;
    showBell();
    tick();
  });

  bell?.addEventListener('click', () => {
    alertsOn = !alertsOn;
    showBell();
    bridge.setFeatures({ taskAlerts: alertsOn });
  });

  const pad = (n) => String(n).padStart(2, '0');

  // Populate time dropdown with 12-hour format options
  function populateTimeDropdown() {
    if (!timeEl) return;
    timeEl.innerHTML = '<option value="">--:--</option>';
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const value = `${displayHour}:${pad(min)} ${ampm}`;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        timeEl.appendChild(option);
      }
    }
  }

  const left = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  };

  const shortLeft = (ms) => {
    const m = Math.max(0, Math.ceil(ms / 60000));
    return m >= 60 ? `${Math.floor(m / 60)}:${pad(m % 60)}` : `${m}m`;
  };

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

  function formatDateTime(ts) {
    if (!Number.isFinite(ts) || ts <= 0) return '—';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '—';
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } catch {
      return '—';
    }
  }

  // Pre-fill time input (default to +15 min) in 12-hour format
  function setDefaultTime(addMin = 15) {
    if (!timeEl) return;
    const d = new Date(Date.now() + addMin * 60000);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // Convert 0 to 12
    // Round to nearest 30 minutes
    const roundedMin = m < 15 ? 0 : m < 45 ? 30 : 0;
    const finalHour = roundedMin === 0 && m >= 45 ? (h === 12 ? 1 : h + 1) : h;
    const finalAmpm = roundedMin === 0 && m >= 45 ? (ampm === 'AM' ? 'PM' : 'AM') : ampm;
    timeEl.value = `${finalHour}:${pad(roundedMin)} ${finalAmpm}`;
  }
  populateTimeDropdown();
  setDefaultTime(15);

  // Day toggle buttons (Today / Tomorrow)
  dayTodayBtn?.addEventListener('click', () => {
    selectedDayOffset = 0;
    dayTodayBtn.classList.add('active');
    dayTomorrowBtn?.classList.remove('active');
  });

  dayTomorrowBtn?.addEventListener('click', () => {
    selectedDayOffset = 1;
    dayTomorrowBtn.classList.add('active');
    dayTodayBtn?.classList.remove('active');
  });

  // Preset buttons (+10m, +30m, +1h, +3h)
  $$('.task-preset[data-add-min]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mins = Number(btn.dataset.addMin || 15);
      selectedDayOffset = 0;
      dayTodayBtn?.classList.add('active');
      dayTomorrowBtn?.classList.remove('active');
      setDefaultTime(mins);
      // Set the dropdown value
      if (timeEl) {
        const d = new Date(Date.now() + mins * 60000);
        let h = d.getHours();
        const m = d.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        const roundedMin = m < 15 ? 0 : m < 45 ? 30 : 0;
        const finalHour = roundedMin === 0 && m >= 45 ? (h === 12 ? 1 : h + 1) : h;
        const finalAmpm = roundedMin === 0 && m >= 45 ? (ampm === 'AM' ? 'PM' : 'AM') : ampm;
        timeEl.value = `${finalHour}:${pad(roundedMin)} ${finalAmpm}`;
      }
    });
  });

  // Switch between Active Tasks view and Finished Tasks Table
  function switchTab(showFinished) {
    tabActiveBtn?.classList.toggle('active', !showFinished);
    tabFinishedBtn?.classList.toggle('active', showFinished);
    if (paneActive) {
      paneActive.classList.toggle('active', !showFinished);
      paneActive.hidden = showFinished;
    }
    if (paneFinished) {
      paneFinished.classList.toggle('active', showFinished);
      paneFinished.hidden = !showFinished;
    }
  }
  tabActiveBtn?.addEventListener('click', () => switchTab(false));
  tabFinishedBtn?.addEventListener('click', () => switchTab(true));

  // Focus tracking for island overlay
  [inputEl].forEach((el) => {
    if (!el) return;
    el.addEventListener('pointerdown', () => {
      bridge.focusInput(true);
      setTimeout(() => el.focus(), 40);
    });
    el.addEventListener('blur', () => {
      bridge.focusInput(false);
    });
  });
  timeEl?.addEventListener('focus', () => bridge.focusInput(true));
  timeEl?.addEventListener('blur', () => bridge.focusInput(false));

  function saveTasks() {
    try {
      localStorage.setItem('yovy-tasks', JSON.stringify(tasks));
    } catch {}
    bridge.tasks?.save(tasks);
  }

  async function loadTasks() {
    try {
      let loaded = null;
      try {
        loaded = await bridge.tasks?.get();
      } catch {}
      if (!Array.isArray(loaded) || !loaded.length) {
        const stored = localStorage.getItem('yovy-tasks');
        if (stored) loaded = JSON.parse(stored);
      }
      // Sanitize: filter out any corrupted or NaN tasks
      tasks = (Array.isArray(loaded) ? loaded : []).filter((t) =>
        t && typeof t === 'object' && t.id && typeof t.text === 'string' && Number.isFinite(t.dueTime) && t.dueTime > 0
      ).map((t) => ({
        ...t,
        remindInterval: t.remindInterval && Number.isFinite(t.remindInterval) ? t.remindInterval : null,
      }));
    } catch {
      tasks = [];
    }
    render();
    tick();
  }

  // Parse time input string cleanly without throwing or NaN (supports 12-hour AM/PM format)
  function parseTimeInput(str) {
    if (!str) return null;
    const clean = String(str).trim();
    if (!clean) return null;
    
    // Check for AM/PM suffix
    const isPM = /pm$/i.test(clean);
    const isAM = /am$/i.test(clean);
    const timePart = clean.replace(/(am|pm)$/i, '').trim();
    
    const parts = timePart.split(':').map((p) => parseInt(p, 10));
    let h = parts[0];
    let m = parts.length > 1 ? parts[1] : 0;
    
    if (!Number.isFinite(h) || h < 0 || h > 12) h = new Date().getHours();
    if (!Number.isFinite(m) || m < 0 || m > 59) m = 0;
    
    // Convert 12-hour to 24-hour format
    if (isPM && h < 12) {
      h += 12;
    } else if (isAM && h === 12) {
      h = 0;
    }
    
    return { h, m };
  }

  function calculateDueTimestamp(dayOffset, timeStr) {
    const parsed = parseTimeInput(timeStr);
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    if (parsed) {
      d.setHours(parsed.h, parsed.m, 0, 0);
      // If today and time already passed, automatically push to tomorrow
      if (dayOffset === 0 && d.getTime() <= Date.now()) {
        d.setDate(d.getDate() + 1);
      }
    } else {
      d.setTime(Date.now() + 15 * 60000);
    }
    const val = d.getTime();
    return Number.isFinite(val) ? val : Date.now() + 15 * 60000;
  }

  function addTask() {
    const text = (inputEl?.value || '').trim();
    if (!text) {
      inputEl?.focus();
      return;
    }
    const dueTime = calculateDueTimestamp(selectedDayOffset, timeEl?.value);
    const remindValue = remindEl?.value || 'default';
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
      remindInterval, // Per-task reminder interval in milliseconds (null = use global setting)
    };
    tasks.unshift(newTask);
    saveTasks();
    if (inputEl) inputEl.value = '';
    if (timeEl) timeEl.value = '';
    if (remindEl) remindEl.value = 'default';
    selectedDayOffset = 0;
    dayTodayBtn?.classList.add('active');
    dayTomorrowBtn?.classList.remove('active');
    setDefaultTime(15);
    render();
    tick();
  }

  addBtn?.addEventListener('click', addTask);
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTask();
    }
  });

  // Finish a task action with celebration
  function finishTask(task) {
    task.completed = true;
    task.finishedAt = Date.now();
    saveTasks();

    // 1. Play completion chime with more notes
    playTones([[0, 659], [0.15, 880], [0.35, 1046], [0.5, 1318]], { peak: 0.25, attack: 0.02, decay: 1.0 });

    // 2. Enhanced sparkles animation with more particles and colors
    if (feat('celebrate')) {
      celebrate(['#ffd479', '#ff9f0a', '#30d158', '#8ab4ff', '#ff6b9d', '#ff375f', '#bf5af2', '#64d2ff']);
      // Trigger a second wave of sparkles after a short delay
      setTimeout(() => {
        celebrate(['#ffd479', '#ff9f0a', '#30d158', '#8ab4ff', '#ff6b9d', '#ff375f', '#bf5af2', '#64d2ff']);
      }, 300);
    }

    // 3. Toast with celebration
    showToast('done', '🎉 Amazing! 🎉 Well done!', esc(task.text), 0, 4000);
    note('🎉', `🎉 Well done! Finished task: ${task.text}`);

    // 4. Character scene with enhanced celebration
    window.playScene?.({
      who: 'Yovy', props: [], arms: 'fold', tone: 'gold', badge: '🎉 Amazing! 🎉',
      title: '🎉 Amazing! 🎉', sub: `You completed the task: <b>${esc(task.text)}</b>`, ms: 4000,
    });

    render();
    tick();
  }

  // Restore task
  function restoreTask(task) {
    task.completed = false;
    task.finishedAt = 0;
    task.fired = false;
    task.lastRemind = 0;
    saveTasks();
    showToast('done', 'Task restored', esc(task.text), 0, 2500);
    render();
    tick();
  }

  // Delete task
  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
    tick();
  }

  clearDoneBtn?.addEventListener('click', () => {
    tasks = tasks.filter((t) => !t.completed);
    saveTasks();
    render();
    tick();
  });

  function render() {
    renderActiveList();
    renderFinishedTable();
  }

  function renderActiveList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    const now = Date.now();
    const active = tasks.filter((t) => !t.completed && Number.isFinite(t.dueTime));

    if (badgeActiveCount) badgeActiveCount.textContent = active.length;
    if (statsEl) statsEl.textContent = `${active.length} active tasks`;
    if (pendingSummaryEl) {
      pendingSummaryEl.textContent = `${active.length} ${active.length === 1 ? 'task remaining' : 'tasks remaining'}`;
    }
    badgeEl?.classList.toggle('on', active.length > 0);
    if (emptyActiveEl) emptyActiveEl.hidden = active.length > 0;

    if (!active.length) return;

    // Grouping
    const overdue = active.filter((t) => t.dueTime <= now).sort((a, b) => a.dueTime - b.dueTime);
    const today = active.filter((t) => isToday(t.dueTime) && t.dueTime > now).sort((a, b) => a.dueTime - b.dueTime);
    const tomorrow = active.filter((t) => isTomorrow(t.dueTime)).sort((a, b) => a.dueTime - b.dueTime);
    const later = active.filter((t) => !isToday(t.dueTime) && !isTomorrow(t.dueTime) && t.dueTime > now).sort((a, b) => a.dueTime - b.dueTime);

    const groups = [
      { key: 'overdue', label: '⚠️ Due now! (Click finish)', items: overdue, isOverdue: true },
      { key: 'today', label: '📅 Today\'s tasks', items: today },
      { key: 'tomorrow', label: '🌅 Tomorrow\'s tasks', items: tomorrow },
      { key: 'later', label: '🗓️ Upcoming tasks', items: later },
    ].filter((g) => g.items.length > 0);

    const showGroupHeaders = groups.length > 1;

    for (const g of groups) {
      if (showGroupHeaders) {
        const header = document.createElement('div');
        header.className = `task-group-header ${g.isOverdue ? 'overdue' : ''}`;
        header.innerHTML = `<span>${g.label}</span><b class="group-count">${g.items.length}</b>`;
        listEl.append(header);
      }

      for (const t of g.items) {
        const row = document.createElement('div');
        const isPast = now >= t.dueTime;
        row.className = `task-row ${isPast ? 'timed-out' : ''}`;

        const msLeft = t.dueTime - now;
        let badgeHtml = '';
        if (isPast) {
          badgeHtml = `<span class="task-badge alert">⚠️ Overdue ${shortLeft(now - t.dueTime)}</span>`;
        } else {
          badgeHtml = `<span class="task-badge pending" dir="ltr">${shortLeft(msLeft)}</span>`;
        }

        row.innerHTML = `
          <button class="task-check-circle" title="Finish task">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>
          </button>
          <div class="task-info">
            <span class="task-title" dir="auto">${esc(t.text)}</span>
            <span class="task-time-label">${formatDue(t.dueTime)}</span>
          </div>
          <div class="task-trailing">
            ${badgeHtml}
            <button class="task-finish-btn" title="Finish task and add to table">
              <span>Finish 🎉</span>
            </button>
            <button class="task-del" title="Delete task">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        `;

        row.querySelector('.task-check-circle')?.addEventListener('click', () => finishTask(t));
        row.querySelector('.task-finish-btn')?.addEventListener('click', () => finishTask(t));
        row.querySelector('.task-del')?.addEventListener('click', () => deleteTask(t.id));

        listEl.append(row);
      }
    }
  }

  function renderFinishedTable() {
    if (!doneTbody) return;
    doneTbody.innerHTML = '';
    const finished = tasks.filter((t) => t.completed).sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));

    if (badgeFinishedCount) badgeFinishedCount.textContent = finished.length;
    if (doneSummaryEl) doneSummaryEl.textContent = `${finished.length} completed tasks`;
    if (emptyDoneEl) emptyDoneEl.hidden = finished.length > 0;

    for (const t of finished) {
      const tr = document.createElement('tr');
      tr.className = 'done-row';
      tr.innerHTML = `
        <td class="td-title" dir="auto"><b>${esc(t.text)}</b></td>
        <td class="td-due">${formatDue(t.dueTime)}</td>
        <td class="td-time">${formatDateTime(t.finishedAt)}</td>
        <td class="td-status"><span class="badge-done">Well done 🎉</span></td>
        <td class="td-actions">
          <button class="btn-action-restore" title="Restore to task list">↺</button>
          <button class="btn-action-del" title="Delete permanently">✕</button>
        </td>
      `;

      tr.querySelector('.btn-action-restore')?.addEventListener('click', () => restoreTask(t));
      tr.querySelector('.btn-action-del')?.addEventListener('click', () => deleteTask(t.id));

      doneTbody.append(tr);
    }
  }

  // Periodic tick (wrapped in try/catch to ensure zero crashes)
  function tick() {
    try {
      const now = Date.now();
      const active = tasks.filter((t) => !t.completed && Number.isFinite(t.dueTime));

      // Reminders & Overdue check
      for (const t of active) {
        if (now >= t.dueTime) {
          const needsInitial = !t.fired;
          // Use per-task interval if set, otherwise use global setting
          const taskRemindInterval = t.remindInterval || getRemindInterval();
          const needsRepeat = !needsInitial && (now - (t.lastRemind || 0) >= taskRemindInterval);

          if (needsInitial || needsRepeat) {
            t.fired = true;
            t.lastRemind = now;
            saveTasks();

            if (alertsOn && feat('taskAlerts')) {
              playTones([[0, 523], [0.15, 659], [0.3, 784], [0.45, 1046]], { peak: 0.22, attack: 0.02, decay: 1.2 });
              island.classList.add('task-alert');
              showToast('task-alert', t.text, needsInitial ? 'Due now!' : 'Task reminder', 0, 8000);
              setTimeout(() => island.classList.remove('task-alert'), 8200);
              note('⏰', `Task reminder: ${t.text}`);
            }
            renderActiveList();
          }
        }
      }

      // Overdue & Upcoming sorting
      const overdue = active.filter((t) => t.dueTime <= now).sort((a, b) => a.dueTime - b.dueTime);
      const upcoming = active.filter((t) => t.dueTime > now).sort((a, b) => a.dueTime - b.dueTime);

      // Showcase card on the left
      if (overdue.length > 0) {
        const topOverdue = overdue[0];
        if (eyebrowEl) {
          eyebrowEl.textContent = overdue.length > 1 ? `⚠️ Overdue (${overdue.length} tasks)` : '⚠️ Due now!';
          eyebrowEl.classList.add('alert');
        }
        if (nextNameEl) nextNameEl.textContent = topOverdue.text || 'Task';
        if (nextCountEl) {
          nextCountEl.textContent = 'Click finish 🎉';
          nextCountEl.classList.add('alert');
        }
        if (nextTimeEl) nextTimeEl.textContent = `Due: ${formatDue(topOverdue.dueTime)}`;
      } else if (upcoming.length > 0) {
        const nextUp = upcoming[0];
        if (eyebrowEl) {
          eyebrowEl.textContent = 'Next reminder';
          eyebrowEl.classList.remove('alert');
        }
        if (nextNameEl) nextNameEl.textContent = nextUp.text || 'Task';
        if (nextCountEl) {
          nextCountEl.textContent = left(nextUp.dueTime - now);
          nextCountEl.classList.remove('alert');
        }
        if (nextTimeEl) nextTimeEl.textContent = formatDue(nextUp.dueTime);
      } else {
        if (eyebrowEl) {
          eyebrowEl.textContent = 'Next reminder';
          eyebrowEl.classList.remove('alert');
        }
        if (nextNameEl) nextNameEl.textContent = 'No active tasks';
        if (nextCountEl) {
          nextCountEl.textContent = '--:--:--';
          nextCountEl.classList.remove('alert');
        }
        if (nextTimeEl) nextTimeEl.textContent = 'Add a task and set its time';
      }

      // Carousel Slide ("corssol") - smoothly shows the task and how much is left
      const onSlide = feat('slideTasks');
      if (slideEl) {
        if (active.length > 0 && onSlide) {
          slideEl.hidden = false;
          const multi = active.length > 1 ? ` (${active.length})` : '';

          if (overdue.length > 0) {
            const top = overdue[0];
            if (slideTitle) slideTitle.textContent = top.text || 'Task';
            if (slideStatus) slideStatus.textContent = 'Overdue';
            if (slideLeft) slideLeft.textContent = `Due now!${multi}`;
          } else if (upcoming.length > 0) {
            const next = upcoming[0];
            if (slideTitle) slideTitle.textContent = next.text || 'Task';
            if (slideStatus) slideStatus.textContent = 'Remaining';
            if (slideLeft) slideLeft.textContent = `${shortLeft(next.dueTime - now)}${multi}`;
          }
        } else {
          slideEl.hidden = true;
        }
      }

      // Vertical pill item
      if (vTaskItem) {
        if (active.length > 0 && onSlide) {
          vTaskItem.hidden = false;
          const top = overdue[0] || upcoming[0];
          if (vTaskName) vTaskName.textContent = top ? top.text : '';
          if (vTaskLeft) vTaskLeft.textContent = overdue.length > 0 ? 'Overdue' : shortLeft(top.dueTime - now);
        } else {
          vTaskItem.hidden = true;
        }
      }
    } catch (err) {
      console.error('[tasks-tick-safe]', err);
    }
  }

  // Morning brief / companion hook
  window.nextTaskText = () => {
    const now = Date.now();
    const up = tasks.filter((t) => !t.completed && Number.isFinite(t.dueTime) && t.dueTime > now).sort((a, b) => a.dueTime - b.dueTime)[0];
    return up ? `${up.text} (${formatDue(up.dueTime)})` : '';
  };

  loadTasks();
  setInterval(tick, 1000);
})();
