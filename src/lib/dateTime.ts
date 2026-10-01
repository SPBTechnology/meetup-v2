/**
 * Combines a date (from a date picker) with a time (from a separate time
 * picker) into one Date. Needed because Android's DateTimePicker only
 * supports a single mode ('date' or 'time') at once — the time picker's own
 * Date carries today's date, not the day chosen in the first step.
 */
export function combineDateAndTime(date: Date, time: Date): Date {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}
