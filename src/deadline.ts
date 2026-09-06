export const DEFAULT_DEADLINE_HORIZON_DAYS = 90;

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
