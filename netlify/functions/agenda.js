/* Relais Agenda sur Netlify (remplace le robot GitHub).
   L'appli envoie ses liens d'agenda (POST, en HTTPS, jamais dans l'adresse) ; la fonction les lit côté serveur
   (Google bloque la lecture directe depuis un navigateur), lit aussi les jours fériés publics, et renvoie les événements.
   Rien n'est gardé ni écrit nulle part. Seuls les liens d'agenda Google sont acceptés. */
const TZ = "Europe/Paris";
const PUBLIC = [
  "https://calendar.google.com/calendar/ical/fr.islamic%23holiday%40group.v.calendar.google.com/public/basic.ics",
  "https://calendar.google.com/calendar/ical/fr.french%23holiday%40group.v.calendar.google.com/public/basic.ics",
];
const DAY = 864e5;
const pad = n => String(n).padStart(2, "0");

/* ---------- fuseaux horaires ---------- */
const fmtCache = {};
function fmt(tz) {
  return fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
}
function wallOf(ms, tz) { // instant -> composantes locales
  const p = {}; for (const x of fmt(tz).formatToParts(new Date(ms))) p[x.type] = +x.value;
  return { y: p.year, m: p.month, d: p.day, H: p.hour, M: p.minute, S: p.second };
}
function tzOffset(ms, tz) { const w = wallOf(ms, tz); return Date.UTC(w.y, w.m - 1, w.d, w.H, w.M, w.S) - Math.floor(ms / 1000) * 1000; }
function instantOf(w, tz) { // composantes locales -> instant
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.H, w.M, w.S);
  if (tz === "UTC") return guess;
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz);
  return t;
}
const safeTz = tz => { try { fmt(tz); return tz; } catch { return TZ; } };

/* ---------- lecture du fichier .ics ---------- */
function unfold(text) { return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/); }
function unesc(s) { return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\"); }
function parseLine(l) {
  const i = (() => { let q = false; for (let k = 0; k < l.length; k++) { if (l[k] === '"') q = !q; else if (l[k] === ":" && !q) return k; } return -1; })();
  if (i < 0) return null;
  const head = l.slice(0, i).split(";"), params = {};
  for (const p of head.slice(1)) { const [k, ...v] = p.split("="); params[k.toUpperCase()] = v.join("=").replace(/"/g, ""); }
  return { name: head[0].toUpperCase(), params, value: l.slice(i + 1) };
}
function parseDt(prop) { // -> { allDay, w:{y,m,d,H,M,S}, tz }
  if (!prop) return null;
  const v = prop.value.trim(), m = /^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)?(Z)?)?$/.exec(v);
  if (!m) return null;
  const allDay = m[4] === undefined || prop.params.VALUE === "DATE";
  return { allDay, w: { y: +m[1], m: +m[2], d: +m[3], H: +(m[4] || 0), M: +(m[5] || 0), S: +(m[6] || 0) }, tz: m[7] ? "UTC" : safeTz(prop.params.TZID || TZ) };
}
function readCalendar(text) {
  const lines = unfold(text); let name = "", ev = null; const events = [];
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") { ev = { props: [] }; continue; }
    if (l === "END:VEVENT") { if (ev) events.push(ev); ev = null; continue; }
    const p = parseLine(l); if (!p) continue;
    if (ev) ev.props.push(p); else if (p.name === "X-WR-CALNAME") name = unesc(p.value);
  }
  return { name, events };
}

/* ---------- répétitions (RRULE) ---------- */
const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function parseRule(v) { const r = {}; for (const part of v.split(";")) { const [k, val] = part.split("="); r[k.toUpperCase()] = val; } return r; }
function nthWeekday(y, m, wd, n) { // n>0 : n-ième ; n<0 : en partant de la fin
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = []; for (let d = 1; d <= last; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === wd) days.push(d);
  return n > 0 ? days[n - 1] : days[days.length + n];
}
/* Génère les dates locales (y,m,d) des occurrences, à partir du début, jusqu'à `limitMs` (en temps « mural ») */
function* occurrences(start, rule, limitMs) {
  const freq = rule.FREQ, interval = Math.max(1, +rule.INTERVAL || 1);
  const byday = rule.BYDAY ? rule.BYDAY.split(",").map(x => { const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(x); return m ? { n: m[1] ? +m[1] : 0, wd: WD[m[2]] } : null; }).filter(Boolean) : [];
  const bymd = rule.BYMONTHDAY ? rule.BYMONTHDAY.split(",").map(Number) : [];
  const bymo = rule.BYMONTH ? rule.BYMONTH.split(",").map(Number) : [];
  const s0 = Date.UTC(start.y, start.m - 1, start.d), startWd = new Date(s0).getUTCDay();
  const out = d => ({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
  let guard = 0;
  if (freq === "DAILY") {
    for (let t = s0; t <= limitMs && guard++ < 6000; t += interval * DAY) {
      const d = new Date(t);
      if (bymo.length && !bymo.includes(d.getUTCMonth() + 1)) continue;
      if (byday.length && !byday.some(b => b.wd === d.getUTCDay())) continue;
      yield out(d);
    }
  } else if (freq === "WEEKLY") {
    const wkst = rule.WKST ? WD[rule.WKST] : 1, days = byday.length ? byday.map(b => b.wd) : [startWd];
    const shift = (startWd - wkst + 7) % 7, weekStart = s0 - shift * DAY;
    for (let w = weekStart; w <= limitMs && guard++ < 3000; w += interval * 7 * DAY) {
      const list = days.map(wd => w + ((wd - wkst + 7) % 7) * DAY).sort((a, b) => a - b);
      for (const t of list) if (t >= s0 && t <= limitMs) { const d = new Date(t); if (!bymo.length || bymo.includes(d.getUTCMonth() + 1)) yield out(d); }
    }
  } else if (freq === "MONTHLY" || freq === "YEARLY") {
    const yearly = freq === "YEARLY";
    for (let k = 0; guard++ < 1500; k++) {
      let y = start.y, m = start.m;
      if (yearly) y += k * interval; else { const idx = start.m - 1 + k * interval; y += Math.floor(idx / 12); m = (idx % 12) + 1; }
      if (Date.UTC(y, m - 1, 1) > limitMs) return;
      const months = yearly ? (bymo.length ? bymo : [start.m]) : [m];
      for (const mo of months) {
        let ds = [];
        if (byday.length) ds = byday.map(b => b.n ? nthWeekday(y, mo, b.wd, b.n) : null).filter(Boolean);
        else ds = (bymd.length ? bymd : [start.d]).map(x => x < 0 ? new Date(Date.UTC(y, mo, 0)).getUTCDate() + 1 + x : x);
        for (const d of ds.sort((a, b) => a - b)) {
          const t = Date.UTC(y, mo - 1, d), dt = new Date(t);
          if (dt.getUTCMonth() !== mo - 1 || t < s0 || t > limitMs) continue;
          yield out(dt);
        }
      }
    }
  }
}

/* ---------- événements du jour ---------- */
function expand(cal, winStart, winEnd) { // winStart / winEnd : instants (ms)
  const res = [], overrides = new Map(), keep = [];
  for (const e of cal.events) {
    const P = {}; for (const p of e.props) (P[p.name] = P[p.name] || []).push(p);
    e.P = P; e.uid = (P.UID && P.UID[0].value) || Math.random() + "";
    if (P["RECURRENCE-ID"]) { const r = parseDt(P["RECURRENCE-ID"][0]); if (r) { const s = overrides.get(e.uid) || new Set(); s.add(r.allDay ? "d" + r.w.y + pad(r.w.m) + pad(r.w.d) : instantOf(r.w, r.tz)); overrides.set(e.uid, s); } }
  }
  for (const e of cal.events) {
    const P = e.P, st = parseDt(P.DTSTART && P.DTSTART[0]);
    if (!st) continue;
    if ((P.STATUS && P.STATUS[0].value.toUpperCase() === "CANCELLED")) continue;
    const en = parseDt(P.DTEND && P.DTEND[0]);
    const durMs = st.allDay ? ((en ? Date.UTC(en.w.y, en.w.m - 1, en.w.d) - Date.UTC(st.w.y, st.w.m - 1, st.w.d) : DAY)) : (en && !en.allDay ? instantOf(en.w, en.tz) - instantOf(st.w, st.tz) : 0);
    const info = {
      t: P.SUMMARY ? unesc(P.SUMMARY[0].value) : "Rendez-vous",
      p: P.LOCATION ? unesc(P.LOCATION[0].value).split("\n")[0] : "",
      x: P.SUMMARY && /point du soir/i.test(P.SUMMARY[0].value) && P.DESCRIPTION ? unesc(P.DESCRIPTION[0].value).slice(0, 1500) : "",
    };
    const place = (startInstant, startWall) => { // ajoute une occurrence si elle touche la fenêtre
      if (st.allDay) {
        const s = Date.UTC(startWall.y, startWall.m - 1, startWall.d), f = s + durMs;
        if (f <= winStart || s > winEnd) return;
        const d = new Date(s), z = durMs > DAY ? new Date(f - DAY) : null, ymd = x => `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
        res.push({ ...info, d: ymd(d), h: "", f: "", z: z ? ymd(z) : "" });
      } else {
        if (startInstant + durMs < winStart || startInstant > winEnd) return;
        const a = wallOf(startInstant, TZ), b = durMs ? wallOf(startInstant + durMs, TZ) : null;
        res.push({ ...info, d: `${a.y}-${pad(a.m)}-${pad(a.d)}`, h: `${pad(a.H)}:${pad(a.M)}`, f: b ? `${pad(b.H)}:${pad(b.M)}` : "", z: "" });
      }
    };
    const rr = P.RRULE && P.RRULE[0].value;
    if (!rr) { place(st.allDay ? 0 : instantOf(st.w, st.tz), st.w); continue; }
    const rule = parseRule(rr), ex = new Set();
    for (const p of P.EXDATE || []) for (const v of p.value.split(",")) { const x = parseDt({ value: v, params: p.params }); if (x) ex.add(x.allDay ? "d" + x.w.y + pad(x.w.m) + pad(x.w.d) : instantOf(x.w, x.tz)); }
    const ov = overrides.get(e.uid) || new Set(), until = rule.UNTIL ? parseDt({ value: rule.UNTIL, params: {} }) : null;
    const untilMs = until ? (until.allDay ? Date.UTC(until.w.y, until.w.m - 1, until.w.d, 23, 59, 59) : instantOf(until.w, until.tz)) : Infinity;
    const count = rule.COUNT ? +rule.COUNT : Infinity;
    let n = 0;
    for (const d of occurrences(st.w, rule, winEnd + 2 * DAY)) {
      if (n >= count) break;
      const wall = { ...d, H: st.w.H, M: st.w.M, S: st.w.S }, inst = st.allDay ? 0 : instantOf(wall, st.tz);
      if ((st.allDay ? Date.UTC(d.y, d.m - 1, d.d, 12) : inst) > untilMs) break;
      n++;
      const key = st.allDay ? "d" + d.y + pad(d.m) + pad(d.d) : inst;
      if (ex.has(key) || ov.has(key)) continue;
      place(inst, wall);
    }
  }
  return res.sort((a, b) => (a.d + a.h < b.d + b.h ? -1 : 1));
}

/* ---------- lecture réseau ---------- */
async function readLink(link) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(link, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctl.signal });
    if (!r.ok) throw new Error("http " + r.status);
    return readCalendar(await r.text());
  } finally { clearTimeout(timer); }
}
const OK_LINK = /^https:\/\/calendar\.google\.com\/calendar\/ical\//;

async function build(links, now = Date.now()) {
  const winStart = now - 2 * DAY, winEnd = now + 200 * DAY;
  const run = async link => { try { const c = await readLink(link); return { n: c.name, e: expand(c, winStart, winEnd) }; } catch { return null; } };
  const mine = links.filter(l => OK_LINK.test(l)).slice(0, 30);
  const [cals, pub] = await Promise.all([Promise.all(mine.map(run)), Promise.all(PUBLIC.map(run))]);
  return { u: new Date(now).toISOString().slice(0, 16), cals: cals.filter(Boolean), bad: links.length - cals.filter(Boolean).length, pub: pub.filter(Boolean) };
}

exports.handler = async event => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "POST seulement" }) };
  let links = [];
  try { links = (JSON.parse(event.body || "{}").links || []).filter(x => typeof x === "string").map(x => x.trim()); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "requête illisible" }) }; }
  try { return { statusCode: 200, headers, body: JSON.stringify(await build(links)) }; }
  catch { return { statusCode: 500, headers, body: JSON.stringify({ error: "lecture impossible" }) }; }
};
exports._test = { readCalendar, expand };
