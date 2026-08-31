const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7, no DST
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export interface Period {
  start: Date; // UTC instant of 00:00:00 or 12:00:00 Asia/Jakarta
  end: Date; // UTC instant of the next boundary (exclusive)
}

/**
 * §1.2 — two 12h periods per day, Asia/Jakarta local time:
 * Period A 00:00:00-11:59:59, Period B 12:00:00-23:59:59.
 * Pure function of the instant given; never reads the system clock.
 */
export function periodFor(instant: Date): Period {
  const localMs = instant.getTime() + JAKARTA_OFFSET_MS;
  const local = new Date(localMs);
  const dayStartLocalMs = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  const hoursIntoDayMs = localMs - dayStartLocalMs;
  const isPeriodA = hoursIntoDayMs < TWELVE_HOURS_MS;
  const periodStartLocalMs = dayStartLocalMs + (isPeriodA ? 0 : TWELVE_HOURS_MS);
  const periodEndLocalMs = periodStartLocalMs + TWELVE_HOURS_MS;

  return {
    start: new Date(periodStartLocalMs - JAKARTA_OFFSET_MS),
    end: new Date(periodEndLocalMs - JAKARTA_OFFSET_MS),
  };
}

export function nextPeriod(period: Period): Period {
  return { start: period.end, end: new Date(period.end.getTime() + TWELVE_HOURS_MS) };
}
