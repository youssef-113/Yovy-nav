// File shelf: files dropped on the island, kept as paths (nothing is copied).
const fs = require('fs');
const path = require('path');
const { app, shell, nativeImage } = require('electron');
const settings = require('./settings');

const MAX_ITEMS = 24;
let items = settings.load('shelf.json', []).filter((p) => typeof p === 'string' && fs.existsSync(p));
const icons = new Map();

async function iconFor(p) {
  if (!icons.has(p)) {
    let img = nativeImage.createEmpty();
    try {
      img = await app.getFileIcon(p, { size: 'large' });
    } catch {}
    icons.set(p, img);
  }
  return icons.get(p);
}

async function list() {
  items = items.filter((p) => fs.existsSync(p));
  return Promise.all(
    items.map(async (p) => {
      const img = await iconFor(p);
      return { path: p, name: path.basename(p) || p, icon: img.isEmpty() ? '' : img.toDataURL() };
    })
  );
}

function save() {
  settings.save('shelf.json', items);
}

function add(paths) {
  for (const p of paths) {
    if (typeof p !== 'string' || !p || !fs.existsSync(p)) continue;
    items = [p, ...items.filter((x) => x !== p)];
  }
  items = items.slice(0, MAX_ITEMS);
  save();
}

function remove(p) {
  items = items.filter((x) => x !== p);
  save();
}

function clear() {
  items = [];
  save();
}

function open(p) {
  if (items.includes(p)) shell.openPath(p);
}

function reveal(p) {
  if (items.includes(p)) shell.showItemInFolder(p);
}

function startDrag(webContents, p) {
  if (!items.includes(p)) return;
  let icon = icons.get(p);
  if (!icon || icon.isEmpty()) icon = nativeImage.createFromBitmap(Buffer.alloc(16 * 16 * 4, 255), { width: 16, height: 16 });
  webContents.startDrag({ file: p, icon });
}

module.exports = { list, add, remove, clear, open, reveal, startDrag };
