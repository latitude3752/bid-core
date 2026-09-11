export const DEFAULT_DEADLINE_HORIZON_DAYS = 90;

/** SAM.gov's responseDeadLine is a full ISO timestamp with a UTC offset
 * (e.g. "2026-09-17T20:00:00.000Z"), but pipeline and detail pages only
 * ever showed the date, silently dropping the time and timezone a
 * subscriber needs to actually hit the deadline. Renders in Eastern time,
 * which is the timezone SAM.gov itself operates and publishes deadlines
 * in, so this converts rather than guesses. */
export function formatDeadlineWithZone(iso: string | null | undefined): string {
  if (!iso) return "no deadline listed";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "no deadline listed";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/New_York",
  });
}

export function deadlineHorizonEnd(
  now = new Date(),
  days = DEFAULT_DEADLINE_HORIZON_DAYS
): Date {
  const end = new Date(now.getTime());
  end.setUTCDate(end.getUTCDate() + days);
  return end;
}

/** True if the notice is due on or before now+horizonDays. Missing/unparseable
 * deadlines are kept (Sources Sought often have none). */
export function isWithinDeadlineHorizon(
  deadline: string | null | undefined,
  now = new Date(),
  days = DEFAULT_DEADLINE_HORIZON_DAYS
): boolean {
  if (!deadline) return true;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return true;
  return t <= deadlineHorizonEnd(now, days).getTime();
}
