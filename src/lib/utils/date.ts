/**
 * Standard Indian Standard Time (IST - Asia/Kolkata) Date & Time Utilities
 */

export function getIndianDateString(d: Date = new Date()): string {
  // Returns 'YYYY-MM-DD' strictly in Asia/Kolkata time zone
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function getIndianTimeString(d: Date = new Date()): string {
  // Returns '12-hour formatted time with IST suffix'
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d) + ' IST'
  );
}

export function formatIndianDateTime(isoOrDateString?: string | null): string {
  if (!isoOrDateString) return '—';
  const d = new Date(isoOrDateString);
  if (isNaN(d.getTime())) return String(isoOrDateString);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatIndianDateOnly(isoOrDateString?: string | null): string {
  if (!isoOrDateString) return '—';
  const d = new Date(isoOrDateString);
  if (isNaN(d.getTime())) return String(isoOrDateString);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function countInclusiveIstDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00+05:30`);
  const end = new Date(`${endDate}T00:00:00+05:30`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}
