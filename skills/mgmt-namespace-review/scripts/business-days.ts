/**
 * Business day calculator for the MGMT Namespace Review skill
 *
 * Calculates business days excluding:
 * - Weekends (Saturday and Sunday)
 * - US Federal Holidays
 * - Microsoft-specific holidays
 */

import { US_FEDERAL_HOLIDAYS, MICROSOFT_HOLIDAYS } from "./constants.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface FixedHoliday {
  month: number;
  day: number;
  name: string;
}

interface FloatingHoliday {
  month: number;
  weekday: number; // 0 = Sunday, 1 = Monday, etc.
  occurrence: number; // 1 = first, 2 = second, -1 = last
  name: string;
}

// -----------------------------------------------------------------------------
// Holiday Calculations
// -----------------------------------------------------------------------------

/**
 * Get the Nth occurrence of a weekday in a month
 * @param year - Year
 * @param month - Month (1-12)
 * @param weekday - Day of week (0=Sunday, 1=Monday, etc.)
 * @param occurrence - Which occurrence (1=first, 2=second, -1=last)
 * @returns Date of the occurrence
 */
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  occurrence: number
): Date {
  if (occurrence === -1) {
    // Last occurrence of weekday in month
    const lastDay = new Date(year, month, 0); // Last day of month
    const diff = (lastDay.getDay() - weekday + 7) % 7;
    return new Date(year, month - 1, lastDay.getDate() - diff);
  }

  // First day of month
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay();

  // Days until first occurrence of target weekday
  const daysUntilFirst = (weekday - firstWeekday + 7) % 7;

  // Date of Nth occurrence
  const day = 1 + daysUntilFirst + (occurrence - 1) * 7;
  return new Date(year, month - 1, day);
}

/**
 * Get Thanksgiving date for a given year
 * @param year - Year
 * @returns Date of Thanksgiving (4th Thursday of November)
 */
function getThanksgiving(year: number): Date {
  return getNthWeekdayOfMonth(year, 11, 4, 4);
}

/**
 * Check if a date is observed as a holiday
 * When a holiday falls on Saturday, it's observed on Friday
 * When a holiday falls on Sunday, it's observed on Monday
 * @param date - Date to check
 * @param holidayDate - Actual holiday date
 * @returns true if the date is the observed holiday
 */
export function isObservedHoliday(date: Date, holidayDate: Date): boolean {
  const dateStr = formatDateKey(date);
  const holidayStr = formatDateKey(holidayDate);

  if (dateStr === holidayStr) return true;

  const holidayDay = holidayDate.getDay();
  if (holidayDay === 6) {
    // Saturday - observed on Friday
    const friday = new Date(holidayDate);
    friday.setDate(friday.getDate() - 1);
    return formatDateKey(friday) === dateStr;
  }
  if (holidayDay === 0) {
    // Sunday - observed on Monday
    const monday = new Date(holidayDate);
    monday.setDate(monday.getDate() + 1);
    return formatDateKey(monday) === dateStr;
  }

  return false;
}

/**
 * Format date as YYYY-MM-DD for comparison
 */
function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Get all holidays for a given year
 * @param year - Year to get holidays for
 * @returns Set of date strings (YYYY-MM-DD) that are holidays
 */
export function getHolidaysForYear(year: number): Set<string> {
  const holidays = new Set<string>();

  // Fixed holidays
  for (const holiday of US_FEDERAL_HOLIDAYS.fixed as FixedHoliday[]) {
    const date = new Date(year, holiday.month - 1, holiday.day);
    holidays.add(formatDateKey(date));

    // Add observed date if on weekend
    if (date.getDay() === 6) {
      // Saturday - Friday observed
      const observed = new Date(date);
      observed.setDate(observed.getDate() - 1);
      holidays.add(formatDateKey(observed));
    } else if (date.getDay() === 0) {
      // Sunday - Monday observed
      const observed = new Date(date);
      observed.setDate(observed.getDate() + 1);
      holidays.add(formatDateKey(observed));
    }
  }

  // Floating holidays
  for (const holiday of US_FEDERAL_HOLIDAYS.floating as FloatingHoliday[]) {
    const date = getNthWeekdayOfMonth(
      year,
      holiday.month,
      holiday.weekday,
      holiday.occurrence
    );
    holidays.add(formatDateKey(date));
  }

  // Microsoft-specific holidays
  if (MICROSOFT_HOLIDAYS.thanksgivingFriday) {
    const thanksgiving = getThanksgiving(year);
    const friday = new Date(thanksgiving);
    friday.setDate(friday.getDate() + 1);
    holidays.add(formatDateKey(friday));
  }

  if (MICROSOFT_HOLIDAYS.christmasEve) {
    // Christmas Eve (Dec 24)
    holidays.add(`${year}-12-24`);
  }

  if (MICROSOFT_HOLIDAYS.yearEndWeek) {
    // Dec 26-31
    for (let day = 26; day <= 31; day++) {
      holidays.add(`${year}-12-${day.toString().padStart(2, "0")}`);
    }
  }

  return holidays;
}

/**
 * Check if a date is a business day
 * @param date - Date to check
 * @param holidays - Set of holiday date strings
 * @returns true if the date is a business day
 */
export function isBusinessDay(date: Date, holidays?: Set<string>): boolean {
  const day = date.getDay();

  // Weekend check
  if (day === 0 || day === 6) {
    return false;
  }

  // Holiday check
  if (holidays) {
    const dateStr = formatDateKey(date);
    if (holidays.has(dateStr)) {
      return false;
    }
  } else {
    // Get holidays for this year if not provided
    const yearHolidays = getHolidaysForYear(date.getFullYear());
    const dateStr = formatDateKey(date);
    if (yearHolidays.has(dateStr)) {
      return false;
    }
  }

  return true;
}

/**
 * Add business days to a date
 * @param startDate - Starting date
 * @param days - Number of business days to add
 * @returns Date after adding business days
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let addedDays = 0;

  // Pre-compute holidays for the year range we might need
  const startYear = result.getFullYear();
  const holidays = new Set<string>();
  for (let year = startYear; year <= startYear + 1; year++) {
    for (const h of getHolidaysForYear(year)) {
      holidays.add(h);
    }
  }

  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result, holidays)) {
      addedDays++;
    }
  }

  return result;
}

/**
 * Count business days between two dates
 * @param startDate - Start date (exclusive)
 * @param endDate - End date (inclusive)
 * @returns Number of business days
 */
export function countBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);

  // Pre-compute holidays for the year range
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const holidays = new Set<string>();
  for (let year = startYear; year <= endYear; year++) {
    for (const h of getHolidaysForYear(year)) {
      holidays.add(h);
    }
  }

  while (current < endDate) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current, holidays)) {
      count++;
    }
  }

  return count;
}

/**
 * Get the deadline date for architect review (EOB after N business days)
 * @param sentDate - Date the architect email was sent
 * @param businessDays - Number of business days (default: 3)
 * @returns Deadline date
 */
export function getArchitectReviewDeadline(
  sentDate: Date,
  businessDays: number = 3
): Date {
  return addBusinessDays(sentDate, businessDays);
}

/**
 * Check if the architect review period has passed
 * @param sentDate - Date the architect email was sent
 * @param businessDays - Number of business days (default: 3)
 * @returns true if the review period has passed
 */
export function hasArchitectReviewPeriodPassed(
  sentDate: Date,
  businessDays: number = 3
): boolean {
  const deadline = addBusinessDays(sentDate, businessDays);
  const now = new Date();
  // Reset time to compare dates only
  now.setHours(23, 59, 59, 999);
  return now > deadline;
}

/**
 * Format deadline for display
 * @param sentDate - Date the architect email was sent
 * @param businessDays - Number of business days (default: 3)
 * @returns Formatted deadline string (e.g., "2/7/2026")
 */
export function formatDeadline(
  sentDate: Date,
  businessDays: number = 3
): string {
  const deadline = addBusinessDays(sentDate, businessDays);
  return `${deadline.getMonth() + 1}/${deadline.getDate()}/${deadline.getFullYear()}`;
}
