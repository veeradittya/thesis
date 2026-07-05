// US market-hours engine for the live "Market Hours" card. Pure + client-safe:
// computes the current trading session (pre/regular/after/closed), countdown to the
// next transition, per-venue open/closed state, and holiday awareness — all in ET,
// DST-correct via Intl. Logic verified against fixed instants (scratchpad/verify-hours).

const TZ = "America/New_York";

// NYSE/Nasdaq full closures (ISO date in ET). Through 2027.
const HOLIDAYS: Record<string, string> = {
  "2026-01-01": "New Year's Day", "2026-01-19": "MLK Jr. Day", "2026-02-16": "Presidents' Day",
  "2026-04-03": "Good Friday", "2026-05-25": "Memorial Day", "2026-06-19": "Juneteenth",
  "2026-07-03": "Independence Day", "2026-09-07": "Labor Day", "2026-11-26": "Thanksgiving", "2026-12-25": "Christmas",
  "2027-01-01": "New Year's Day", "2027-01-18": "MLK Jr. Day", "2027-02-15": "Presidents' Day",
  "2027-03-26": "Good Friday", "2027-05-31": "Memorial Day", "2027-06-18": "Juneteenth", "2027-07-05": "Independence Day",
  "2027-09-06": "Labor Day", "2027-11-25": "Thanksgiving", "2027-12-24": "Christmas",
};
// Early-close (1:00 PM ET) days.
const HALF_DAYS: Record<string, string> = {
  "2026-11-27": "Day after Thanksgiving", "2026-12-24": "Christmas Eve", "2027-11-26": "Day after Thanksgiving",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Session boundaries in minutes-from-midnight ET.
const PRE = 240, OPEN = 570, REG_CLOSE = 960, HALF_CLOSE = 780, AFTER = 1200, HALF_AFTER = 1020;

export type Phase = "pre" | "open" | "after" | "closed";
export interface MarketState {
  clock: string;
  phase: Phase;
  statusWord: string;
  countdownLabel: string;
  countdownText: string;
}

interface ET {
  year: number; month: number; day: number; iso: string;
  dow: number; weekday: string; monthShort: string;
  h: number; mi: number; s: number; minutes: number;
}

function etParts(d: Date): ET {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  let h = parseInt(p.hour, 10);
  if (h === 24) h = 0; // some engines emit "24" at midnight
  const month = +p.month;
  return {
    year: +p.year, month, day: +p.day, iso: `${p.year}-${p.month}-${p.day}`,
    dow: DOW[p.weekday], weekday: p.weekday, monthShort: MONTHS[month - 1],
    h, mi: +p.minute, s: +p.second, minutes: h * 60 + +p.minute,
  };
}

// ET wall-clock → epoch ms, using the current offset (DST-correct except across the
// ~2 overnight DST switches/yr, where a countdown may skew 1h — acceptable for a clock).
function etOffsetMin(d: Date): number {
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const et = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  return Math.round((et.getTime() - utc.getTime()) / 60000);
}
function etEpoch(y: number, mo: number, day: number, minutes: number, ref: Date): number {
  return Date.UTC(y, mo - 1, day, Math.floor(minutes / 60), minutes % 60, 0) - etOffsetMin(ref) * 60000;
}

const isTradingDay = (et: ET) => !(et.dow === 0 || et.dow === 6 || HOLIDAYS[et.iso]);

const fmtClock = (et: ET) => {
  const ap = et.h >= 12 ? "PM" : "AM";
  const h = et.h % 12 || 12;
  return `${h}:${String(et.mi).padStart(2, "0")}:${String(et.s).padStart(2, "0")} ${ap}`;
};
const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${ss}s` : `${ss}s`;
};

function nextTradingDay(now: Date): ET {
  for (let i = 1; i < 12; i++) {
    const et = etParts(new Date(now.getTime() + i * 86400000));
    if (isTradingDay(et)) return et;
  }
  return etParts(now);
}
export function computeMarketState(now: Date): MarketState {
  const et = etParts(now);
  const trading = isTradingDay(et);
  const half = !!HALF_DAYS[et.iso];
  const closeMin = half ? HALF_CLOSE : REG_CLOSE;
  const afterEnd = half ? HALF_AFTER : AFTER;

  let phase: Phase;
  if (!trading) phase = "closed";
  else if (et.minutes < PRE) phase = "closed";
  else if (et.minutes < OPEN) phase = "pre";
  else if (et.minutes < closeMin) phase = "open";
  else if (et.minutes < afterEnd) phase = "after";
  else phase = "closed";

  let countdownLabel: string, epoch: number;
  if (phase === "open") { countdownLabel = "Closes in"; epoch = etEpoch(et.year, et.month, et.day, closeMin, now); }
  else if (phase === "pre") { countdownLabel = "Opens in"; epoch = etEpoch(et.year, et.month, et.day, OPEN, now); }
  else if (phase === "after") { countdownLabel = "After-hrs ends in"; epoch = etEpoch(et.year, et.month, et.day, afterEnd, now); }
  else if (trading && et.minutes < PRE) { countdownLabel = "Pre-market in"; epoch = etEpoch(et.year, et.month, et.day, PRE, now); }
  else { countdownLabel = "Opens in"; const nd = nextTradingDay(now); epoch = etEpoch(nd.year, nd.month, nd.day, OPEN, now); }

  const statusWord = phase === "open" ? "Open" : phase === "pre" ? "Pre-Market" : phase === "after" ? "After-Hours" : "Closed";

  return {
    clock: fmtClock(et),
    phase, statusWord, countdownLabel, countdownText: fmtDur(epoch - now.getTime()),
  };
}
