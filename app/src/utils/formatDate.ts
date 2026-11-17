/**
 * Parses a `YYYY-MM-DD` local-calendar-date string (as returned by
 * localDate fields across this app, e.g. DailyHoroscope.localDate) into a
 * real local Date object.
 *
 * Deliberately NOT `new Date(localDateString)` - that parses the string as
 * UTC midnight, which then renders as the PREVIOUS calendar day in any
 * timezone behind UTC (e.g. "2026-11-10" becomes Nov 9 for a US user) -
 * exactly the "yesterday's guidance shown with today's date" bug this
 * needs to avoid. Splitting the components and using the local Date
 * constructor keeps the calendar date exactly as given, in the device's
 * own local timezone.
 */
export function parseLocalDateString(localDate: string): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formats a local-calendar date as "Tuesday, 10 November 2026" - the
 * elegant long form used for the Home screen's date header and the Daily
 * Guidance card's date label. Accepts either a real Date (e.g. `new
 * Date()` for "today") or a `YYYY-MM-DD` string (e.g. a DailyHoroscope's
 * own localDate, so the label always reflects the date content was
 * actually generated for, not just whatever "today" happens to be when
 * the card is opened).
 */
export function formatLongDate(localDate: string | Date): string {
  const date = typeof localDate === 'string' ? parseLocalDateString(localDate) : localDate;
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
