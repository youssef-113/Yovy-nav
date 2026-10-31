// Prayer times from the AlAdhan API (no key). The calculation method is picked by AlAdhan
// from the location (e.g. Egyptian General Authority of Survey in Egypt). Today's and
// tomorrow's times are cached so the island keeps working offline for the day.
const settings = require('./settings');
const features = require('./features');

const KEYS = ['Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

let send = () => {};
let getLocation = null;
let data = settings.load('prayer-cache.json', null);
let midnightTimer = null;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dmy = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

const get = async (url) => (await fetch(url, { signal: AbortSignal.timeout(10000) })).json();

async function fetchDay(date, loc) {
  const f = features.get();
  const url = `https://api.aladhan.com/v1/timings/${dmy(date)}?latitude=${loc.lat}&longitude=${loc.lon}&school=${f.asrHanafi ? 1 : 0}`;
  const j = await get(url);
  if (j.code !== 200 || !j.data?.timings) throw new Error(`aladhan: ${j.status || j.code}`);
  const t = j.data.timings;
  let h = j.data.date?.hijri;
  // a moon-sighting adjustment: the Hijri date of the shifted day
  if (f.hijriAdjust) {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + f.hijriAdjust);
    try {
      const g = await get(`https://api.aladhan.com/v1/gToH/${dmy(shifted)}`);
      if (g.code === 200 && g.data?.hijri) h = g.data.hijri;
    } catch {}
  }
  return {
    date: ymd(date),
    // values look like "04:35" or "04:35 (EET)"
    times: Object.fromEntries(KEYS.map((k) => [k.toLowerCase(), String(t[k]).slice(0, 5)])),
    hijri: h ? `${Number(h.day)} ${h.month?.ar || h.month?.en || ''} ${h.year}` : '',
    hijriMonth: Number(h?.month?.number) || 0, // 9 = Ramadan
    method: j.data.meta?.method?.name || '',
    // times are wall-clock times in this zone, which may differ from the PC's
    tz: j.data.meta?.timezone || '',
  };
}

async function refresh() {
  clearTimeout(midnightTimer);
  try {
    const loc = await getLocation();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const [a, b] = await Promise.all([fetchDay(today, loc), fetchDay(tomorrow, loc)]);
    data = { city: loc.city || '', today: a, tomorrow: b };
    settings.save('prayer-cache.json', data);
    send('prayer', data);
    // next refresh just after local midnight
    const next = new Date();
    next.setHours(24, 1, 0, 0);
    midnightTimer = setTimeout(refresh, next - Date.now());
  } catch (err) {
    console.error('[prayer]', err.message);
    midnightTimer = setTimeout(refresh, 5 * 60 * 1000);
  }
}

function start(sender, locate) {
  send = sender;
  getLocation = locate;
  refresh();
}

function snapshot() {
  return data;
}

module.exports = { start, snapshot, refresh };
