// Updates from the GitHub releases (latest.yml): checked shortly after start and every 2 hours,
// downloaded automatically in the background, then offered on the island ("Update ready · Restart").
// If not explicitly restarted, it installs silently and automatically when the app quits.
const { app } = require('electron');
const log = require('./log');

const FIRST_CHECK_MS = 15 * 1000;
const EVERY_MS = 2 * 60 * 60 * 1000;

let updater = null;
let enabled = false;
let ready = null; // version downloaded and waiting for a restart
let timer = null;
let send = () => {};

function check() {
  if (!enabled || !updater) return;
  // a ready update is offered again on every check until it is installed
  if (ready) {
    send('update', { version: ready });
    return;
  }
  updater.checkForUpdates().catch((err) => log.info(`update check failed: ${err.message}`));
}

function checkManual() {
  if (!updater) return Promise.resolve({ status: 'unsupported', message: 'Only packaged app can update' });
  if (ready) {
    send('update', { version: ready });
    return Promise.resolve({ status: 'ready', version: ready });
  }
  return updater.checkForUpdates()
    .then((res) => {
      const isAvailable = res?.updateInfo?.version && res.updateInfo.version !== app.getVersion();
      return { status: isAvailable ? 'downloading' : 'latest', version: res?.updateInfo?.version || app.getVersion() };
    })
    .catch((err) => {
      log.info(`manual update check failed: ${err.message}`);
      return { status: 'error', message: err.message };
    });
}

function start(sendFn, on) {
  send = sendFn;
  if (!app.isPackaged) return;
  try {
    ({ autoUpdater: updater } = require('electron-updater'));
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.logger = null;
    updater.on('update-available', (i) => {
      log.info(`update ${i.version} available, downloading in background`);
    });
    updater.on('update-downloaded', (i) => {
      ready = i.version;
      log.info(`update ${i.version} ready, ready to install`);
      send('update', { version: ready });
    });
    updater.on('error', (err) => log.info(`update error: ${err.message}`));
    setEnabled(on);
  } catch (err) {
    log.info(`failed to initialize autoUpdater: ${err.message}`);
  }
}

function setEnabled(on) {
  enabled = !!on;
  if (updater) updater.autoInstallOnAppQuit = enabled;
  clearTimeout(timer);
  clearInterval(timer);
  if (!enabled || !updater) return;
  timer = setTimeout(() => {
    check();
    timer = setInterval(check, EVERY_MS);
  }, FIRST_CHECK_MS);
}

// restart into the downloaded version (silent install, then the app starts again)
function install() {
  if (ready && updater) updater.quitAndInstall(true, true);
}

module.exports = { start, setEnabled, install, checkManual };
