/** Parse ?start= / ?end= query values safely (seconds). */
export function parseTimestampParam(raw: string | null): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Normalize start/end pair from URL params. */
export function parseTimestampRange(
  startRaw: string | null,
  endRaw: string | null,
): { start: number | null; end: number | null } {
  const start = parseTimestampParam(startRaw);
  let end = parseTimestampParam(endRaw);
  if (start != null && end != null && end < start) {
    end = start;
  }
  return { start, end };
}
