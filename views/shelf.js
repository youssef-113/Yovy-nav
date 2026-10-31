// Shelf tab: files dropped on the island. Click opens, right-click reveals, drag out to use.
(() => {
  const view = $('#v-shelf');
  const itemsEl = $('#shelf-items');
  const count = $('#shelf-count');
  const badge = $('#shelf-badge');

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
})();
