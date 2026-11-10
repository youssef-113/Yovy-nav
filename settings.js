// Upgraded JSON store with atomic writes and automatic backup recovery.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function file(name) {
  return path.join(app.getPath('userData'), name);
}

function load(name, fallback) {
  const filePath = file(name);
  const bakPath = file(`${name}.bak`);

  // 1. Try reading the primary file
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content && content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (err) {
    console.warn(`[settings] primary load failed for ${name}, attempting backup recovery:`, err.message);
  }

  // 2. Try reading the backup file if primary failed or was empty
  try {
    if (fs.existsSync(bakPath)) {
      const bakContent = fs.readFileSync(bakPath, 'utf8');
      if (bakContent && bakContent.trim()) {
        const recovered = JSON.parse(bakContent);
        console.info(`[settings] successfully recovered ${name} from backup!`);
        // Restore backup to primary
        try { fs.writeFileSync(filePath, bakContent, 'utf8'); } catch {}
        return recovered;
      }
    }
  } catch (bakErr) {
    console.error(`[settings] backup load also failed for ${name}:`, bakErr.message);
  }

  return fallback;
}

function save(name, data) {
  const dir = app.getPath('userData');
  const target = file(name);
  const temp = file(`${name}.tmp.${Date.now()}`);
  const bak = file(`${name}.bak`);

  try {
    fs.mkdirSync(dir, { recursive: true });
    const serialized = JSON.stringify(data, null, 2);

    // 1. Write to temporary file first
    fs.writeFileSync(temp, serialized, 'utf8');

    // 2. Backup existing file if it exists and has content
    if (fs.existsSync(target)) {
      try {
        fs.copyFileSync(target, bak);
      } catch {}
    }

    // 3. Atomically rename temporary file to target
    fs.renameSync(temp, target);
  } catch (err) {
    console.error(`[settings] save failed for ${name}:`, err.message);
    // Cleanup temporary file if left behind
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch {}
  }
}

module.exports = { load, save };
