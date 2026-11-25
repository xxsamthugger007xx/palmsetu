import { appLocale } from './locale';
/** Shared "Today, 1:14 PM" / "Yesterday, 3:02 PM" / "Nov 1, 1:14 PM" style
import { appLocale } from './locale';
 * formatter used by the assistant chat screen and its history list, so a
 * message's saved time reads consistently in both places. */
export function formatChatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(appLocale(), { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  const date = d.toLocaleDateString(appLocale(), {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
  return `${date}, ${time}`;
}
