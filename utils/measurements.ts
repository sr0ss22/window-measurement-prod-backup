// Format a measurement to 2 decimal places and remove trailing zeros
export function formatMeasurement(value: number | null | undefined): string {
  // If value is null, undefined, or not a finite number, return "0"
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0";
  }

  // If value is exactly 0, return "0"
  if (value === 0) return "0";

  // Round to the nearest 1/8" (0.125)
  const roundedValue = roundToNearest(value, 0.125);

  // Convert to string with up to 3 decimal places
  let formatted = roundedValue.toFixed(3);

  // Remove trailing zeros and decimal point if it's a whole number (e.g., "1.000" -> "1")
  if (formatted.endsWith(".000")) {
    return formatted.slice(0, -4);
  }
  // Remove trailing zeros if they are after the decimal point (e.g., "1.500" -> "1.5", "1.250" -> "1.25")
  while (formatted.endsWith("0") && formatted.includes(".")) {
    formatted = formatted.slice(0, -1);
  }
  // If it ends with a decimal point (e.g., "1."), remove it
  if (formatted.endsWith(".")) {
    formatted = formatted.slice(0, -1);
  }

  return formatted;
}

/**
 * Rounds a number down to the nearest specified increment.
 * Useful for rounding measurements to the nearest 1/16th, 1/32nd, etc.
 * @param value The number to round.
 * @param increment The increment to round to (e.g., 0.0625 for 1/16th, 0.03125 for 1/32nd).
 * @returns The rounded number.
 */
export function roundToNearest(value: number | null | undefined, increment: number = 0.0625): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  // Use Math.round to round to the nearest increment
  return Math.round(value / increment) * increment;
}