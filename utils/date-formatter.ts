import { format, parseISO, formatDistanceToNow } from "date-fns";

/**
 * Format a date string into a readable format (MM/DD/YYYY).
 * Handles 'YYYY-MM-DD' strings as local dates to prevent timezone shifts.
 * @param dateString ISO date string or 'YYYY-MM-DD' string
 * @returns Formatted date string
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";

  try {
    let date: Date;
    // If it's a simple 'YYYY-MM-DD' string, parse it as a local date
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      // Construct date in local timezone to avoid UTC interpretation
      date = new Date(year, month - 1, day);
    } else {
      // For other formats (e.g., ISO with time/timezone), use parseISO
      date = parseISO(dateString);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    // Format: MM/DD/YYYY
    return format(date, "MM/dd/yyyy");
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Error";
  }
}

/**
 * Formats a date string into a relative time string (e.g., "about 2 hours ago").
 * @param dateString ISO date string
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error("Error formatting relative time:", error);
    return "Error";
  }
}

/**
 * Formats a date with an ordinal suffix (e.g., "July 31st").
 * @param date The date to format.
 * @returns The formatted date string.
 */
export function formatWithOrdinal(date: Date): string {
  const day = format(date, "d");
  const dayNum = parseInt(day);
  let suffix = 'th';
  if (dayNum <= 31 && dayNum >= 1) {
    if (dayNum > 3 && dayNum < 21) {
      // th for 11-13
    } else {
      switch (dayNum % 10) {
        case 1:
          suffix = 'st';
          break;
        case 2:
          suffix = 'nd';
          break;
        case 3:
          suffix = 'rd';
          break;
      }
    }
  }
  return format(date, `MMMM d'${suffix}'`);
}