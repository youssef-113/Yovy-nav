// Shelf tab: files dropped on the island + quick sticky notes scratchpad.
(() => {
  const view = $('#v-shelf');
  const itemsEl = $('#shelf-items');
  const count = $('#shelf-count');
  const badge = $('#shelf-badge');

  // ---- files shelf ----
  function renderItems(items) {
    view.classList.toggle('empty-shelf', !items.length);
    badge.classList.toggle('on', items.length > 0);
    count.textContent = `${items.length} ${items.length === 1 ? 'file' : 'files'}`;
    itemsEl.innerHTML = '';
    for (const f of items) {
      const d = document.createElement('div');
      d.className = 'file';
      d.draggable = true;
      d.title = `${f.path}\nClick to open · Right-click to show in folder · Drag to use`;
      d.innerHTML =
        `${f.icon ? `<img src="${f.icon}" alt="">` : ''}` +
        `<span class="fname" dir="auto">${esc(f.name)}</span>` +
        `<button class="x" aria-label="Remove ${esc(f.name)}">${ICON_X}</button>`;
      d.addEventListener('click', (e) => {
        if (e.target.closest('.x')) bridge.shelf.remove(f.path);
        else bridge.shelf.open(f.path);
      });
      d.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        bridge.shelf.reveal(f.path);
      });
      d.addEventListener('dragstart', (e) => {
        e.preventDefault();
        internalDrag = true;
        bridge.shelf.startDrag(f.path);
      });
      itemsEl.append(d);
    }
  }

  itemsEl.addEventListener('wheel', (e) => {
    // vertical wheel scrolls the row horizontally
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) itemsEl.scrollLeft += e.deltaY;
  });

  $('#shelf-clear').addEventListener('click', () => bridge.shelf.clear());

  bridge.onShelf(renderItems);
  bridge.shelf.list().then(renderItems);

  // ---- quick sticky notes scratchpad (0.0% idle CPU) ----
  const noteEl = $('#shelf-note');
  const noteCount = $('#note-count');
  const noteStatus = $('#note-status');
  const noteCopy = $('#note-copy');
  const noteClear = $('#note-clear');
  let saveTimer = null;
  let statusTimer = null;

  function setStatus(text, ms = 1500) {
    clearTimeout(statusTimer);
    noteStatus.textContent = text;
    if (ms > 0) {
      statusTimer = setTimeout(() => { noteStatus.textContent = ''; }, ms);
    }
  }

  function updateCount() {
    const len = (noteEl.value || '').length;
    noteCount.textContent = `${len} ${len === 1 ? 'char' : 'chars'}`;
  }

  function queueSave() {
    clearTimeout(saveTimer);
    setStatus('Saving…', 0);
    saveTimer = setTimeout(() => {
      bridge.notes.save({ text: noteEl.value });
      setStatus('Saved', 1500);
    }, 350);
  }

  // Keyboard focus: the island window is normally non-focusable to not steal focus from
  // foreground windows; ask for input focus only while interacting with the scratchpad.
  noteEl.addEventListener('pointerdown', () => {
    bridge.focusInput(true);
    setTimeout(() => noteEl.focus(), 40);
  });
  noteEl.addEventListener('blur', () => {
    bridge.focusInput(false);
  });

  noteEl.addEventListener('input', () => {
    updateCount();
    queueSave();
  });

  noteCopy.addEventListener('click', async () => {
    const text = noteEl.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied!', 1500);
    } catch {
      setStatus('Copy failed', 1500);
    }
  });

  noteClear.addEventListener('click', () => {
    if (!noteEl.value) return;
    noteEl.value = '';
    updateCount();
    clearTimeout(saveTimer);
    bridge.notes.save({ text: '' });
    setStatus('Cleared', 1500);
  });

  // Load saved note on startup
  if (bridge.notes?.get) {
    bridge.notes.get().then((data) => {
      if (data && typeof data.text === 'string') {
        noteEl.value = data.text;
        updateCount();
      }
    }).catch(() => {});
  }
})();
