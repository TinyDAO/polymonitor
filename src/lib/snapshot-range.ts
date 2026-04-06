/** Snapshot history window for API `days` and chart bucketing */

export type SnapshotRangeId = "14d" | "30d" | "6m" | "1y";

export const SNAPSHOT_RANGE_DAYS: Record<SnapshotRangeId, number> = {
  "14d": 14,
  "30d": 30,
  "6m": 180,
  "1y": 365,
};

export const SNAPSHOT_RANGE_ORDER: SnapshotRangeId[] = [
  "14d",
  "30d",
  "6m",
  "1y",
];

export const SNAPSHOT_RANGE_LABEL: Record<SnapshotRangeId, string> = {
  "14d": "2w",
  "30d": "1mo",
  "6m": "6mo",
  "1y": "1y",
};

/** Allowed chart bucket widths (hours) per range */
export function allowedBucketHours(range: SnapshotRangeId): number[] {
  switch (range) {
    case "14d":
      return [1, 4, 6, 12, 24];
    case "30d":
      return [6, 12, 24];
    case "6m":
    case "1y":
      return [24];
  }
}

export function defaultBucketHours(range: SnapshotRangeId): number {
  switch (range) {
    case "14d":
      return 4;
    case "30d":
      return 12;
    case "6m":
    case "1y":
      return 24;
  }
}

export function clampBucketHours(
  range: SnapshotRangeId,
  hours: number
): number {
  const allowed = allowedBucketHours(range);
  if (allowed.includes(hours)) return hours;
  return defaultBucketHours(range);
}
