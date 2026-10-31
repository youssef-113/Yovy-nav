// Updates from the GitHub releases (latest.yml): checked a minute after start and every 6 hours,
// downloaded in the background, then offered on the island ("Update ready · Restart"). An
// update that is never accepted is installed when the app quits. Only the installed app updates.
const { app } = require('electron');
const log = require('./log');

const FIRST_CHECK_MS = 60 * 1000;
const EVERY_MS = 6 * 60 * 60 * 1000;

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

function start(sendFn, on) {
  send = sendFn;
  if (!app.isPackaged) return;
  ({ autoUpdater: updater } = require('electron-updater'));
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = null;
  updater.on('update-available', (i) => log.info(`update ${i.version} available, downloading`));
  updater.on('update-downloaded', (i) => {
    ready = i.version;
    log.info(`update ${i.version} ready`);
    send('update', { version: ready });
  });
  updater.on('error', (err) => log.info(`update error: ${err.message}`));
  setEnabled(on);
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

module.exports = { start, setEnabled, install };
