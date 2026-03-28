export type SnapshotRow = {
  id: string;
  addressId: string;
  polymarketValue: string;
  usdcBalance: string;
  totalValue: string;
  createdAt: string;
};

export type PeriodId = "24h" | "7d" | "30d";

export const PERIOD_MS: Record<PeriodId, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Local timezone bucket key; align with kanban-detail chart bucketing */
function bucketKeyLocal(date: Date, intervalHours: number): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const dayStr = `${y}-${m}-${day}`;
  const hour = date.getHours();
  if (intervalHours === 24) return dayStr;
  if (intervalHours === 1) return `${dayStr}T${pad2(hour)}`;
  const bucket = Math.floor(hour / intervalHours) * intervalHours;
  return `${dayStr}T${pad2(bucket)}`;
}

function formatBucketLabel(k: string, intervalHours: number): string {
  if (intervalHours === 1 && k.length > 10) {
    const d = new Date(`${k.slice(0, 10)}T${k.slice(11, 13)}:00:00`);
    return Number.isNaN(d.getTime())
      ? k
      : d.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
        });
  }
  const d = new Date(`${k}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? k
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type BucketMap = Map<string, Map<string, SnapshotRow>>;

/**
 * One snapshot per (bucket, address): latest in that bucket.
 * Used by board total series.
 */
function aggregateBuckets(
  snapshots: SnapshotRow[],
  period: PeriodId,
  endTime: Date
): {
  intervalHours: number;
  keys: string[];
  labels: string[];
  bucketMap: BucketMap;
} {
  const periodMs = PERIOD_MS[period];
  const start = new Date(endTime.getTime() - periodMs);
  const intervalHours = period === "24h" ? 1 : 24;

  const inWindow = snapshots.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return t >= start.getTime() && t <= endTime.getTime();
  });

  const byBucket: BucketMap = new Map();
  for (const s of inWindow) {
    const key = bucketKeyLocal(new Date(s.createdAt), intervalHours);
    if (!byBucket.has(key)) byBucket.set(key, new Map());
    const perAddr = byBucket.get(key)!;
    const prev = perAddr.get(s.addressId);
    if (
      !prev ||
      new Date(s.createdAt).getTime() > new Date(prev.createdAt).getTime()
    ) {
      perAddr.set(s.addressId, s);
    }
  }

  const keys = [...byBucket.keys()].sort((a, b) => a.localeCompare(b));
  const labels = keys.map((k) => formatBucketLabel(k, intervalHours));
  return { intervalHours, keys, labels, bucketMap: byBucket };
}

function sortAsc(snaps: SnapshotRow[]): SnapshotRow[] {
  return [...snaps].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function valueAtOrBefore(sortedAsc: SnapshotRow[], cutoff: Date): number | null {
  let best: SnapshotRow | null = null;
  const t = cutoff.getTime();
  for (const s of sortedAsc) {
    if (new Date(s.createdAt).getTime() <= t) best = s;
    else break;
  }
  return best ? parseFloat(best.totalValue) : null;
}

function latestValue(sortedAsc: SnapshotRow[]): number | null {
  if (sortedAsc.length === 0) return null;
  return parseFloat(sortedAsc[sortedAsc.length - 1].totalValue);
}

export type AddressMetrics = {
  addressId: string;
  label: string;
  current: number | null;
  baseline: number | null;
  delta: number | null;
  deltaPct: number | null;
  polyCurrent: number | null;
  usdcCurrent: number | null;
};

export type BoardTotals = {
  totalCurrent: number;
  totalBaseline: number | null;
  totalDelta: number | null;
  totalDeltaPct: number | null;
};

export function computeMetricsForPeriod(
  snapshots: SnapshotRow[],
  addresses: { id: string; label: string }[],
  period: PeriodId,
  endTime: Date = new Date()
): { rows: AddressMetrics[]; totals: BoardTotals } {
  const periodMs = PERIOD_MS[period];
  const startCutoff = new Date(endTime.getTime() - periodMs);

  const byAddress = new Map<string, SnapshotRow[]>();
  for (const a of addresses) {
    byAddress.set(a.id, []);
  }
  for (const s of snapshots) {
    const arr = byAddress.get(s.addressId);
    if (arr) arr.push(s);
  }

  const rows: AddressMetrics[] = [];

  for (const a of addresses) {
    const sorted = sortAsc(byAddress.get(a.id) ?? []);
    const current = latestValue(sorted);
    const baseline = valueAtOrBefore(sorted, startCutoff);

    let polyCurrent: number | null = null;
    let usdcCurrent: number | null = null;
    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1];
      polyCurrent = parseFloat(last.polymarketValue);
      usdcCurrent = parseFloat(last.usdcBalance);
    }

    let delta: number | null = null;
    let deltaPct: number | null = null;
    if (current != null && baseline != null) {
      delta = current - baseline;
      deltaPct = baseline !== 0 ? (delta / baseline) * 100 : null;
    }

    rows.push({
      addressId: a.id,
      label: a.label,
      current,
      baseline,
      delta,
      deltaPct,
      polyCurrent,
      usdcCurrent,
    });
  }

  const contributing = rows.filter((r) => r.current != null);
  const totalCurrent = contributing.reduce((s, r) => s + (r.current ?? 0), 0);
  const allHaveBaseline =
    contributing.length > 0 &&
    contributing.every((r) => r.baseline != null);

  let totalBaseline: number | null = null;
  let totalDelta: number | null = null;
  let totalDeltaPct: number | null = null;

  if (allHaveBaseline) {
    totalBaseline = contributing.reduce((s, r) => s + (r.baseline ?? 0), 0);
    totalDelta = totalCurrent - totalBaseline;
    totalDeltaPct =
      totalBaseline !== 0 ? (totalDelta / totalBaseline) * 100 : null;
  }

  return {
    rows,
    totals: {
      totalCurrent,
      totalBaseline,
      totalDelta,
      totalDeltaPct,
    },
  };
}

/** Sum of totalValue per time bucket for portfolio trend in the window */
export function buildTotalSeries(
  snapshots: SnapshotRow[],
  period: PeriodId,
  endTime: Date = new Date()
): { labels: string[]; values: number[] } {
  const { keys, labels, bucketMap } = aggregateBuckets(
    snapshots,
    period,
    endTime
  );

  const values = keys.map((key) => {
    const perAddr = bucketMap.get(key);
    if (!perAddr) return 0;
    let sum = 0;
    for (const row of perAddr.values()) {
      sum += parseFloat(row.totalValue);
    }
    return sum;
  });

  return { labels, values };
}

/**
 * Maximum drawdown over the series (board total per bucket), as a positive percentage.
 * At each step uses running peak-to-current: max over time of (peak − value) / peak.
 * Returns null if there is no positive peak in the window (e.g. all zeros).
 */
export function computeMaxDrawdownPct(values: number[]): number | null {
  if (values.length === 0) return null;
  let peak = -Infinity;
  let maxDd = 0;
  let hasPositivePeak = false;
  for (const raw of values) {
    if (!Number.isFinite(raw)) continue;
    const v = Number(raw);
    peak = Math.max(peak, v);
    if (peak > 0) {
      hasPositivePeak = true;
      const dd = (peak - v) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  if (!hasPositivePeak) return null;
  return maxDd * 100;
}

export type RiskMetricsFromSeries = {
  /** Sharpe-style ratio, annualized (rf=0); from bucket returns */
  sharpeAnnualized: number | null;
  /** Annualized volatility of bucket returns, as % (e.g. 45 = 45%) */
  volatilityAnnualizedPct: number | null;
  /** Share of bucket returns that are strictly positive */
  winRatePct: number | null;
};

function bucketReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const cur = values[i];
    if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue;
    if (prev <= 0) continue;
    out.push((cur - prev) / prev);
  }
  return out;
}

function sampleStd(arr: number[]): number | null {
  if (arr.length < 2) return null;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

/** Aligns with buildTotalSeries: 24h → hourly buckets, else daily */
function annualizationFactor(period: PeriodId): number {
  return period === "24h" ? Math.sqrt(365 * 24) : Math.sqrt(365);
}

/**
 * Sharpe-like (rf=0), annualized σ, and win rate from board-total series.
 * Uses simple returns between consecutive buckets; annualization matches bucket width.
 */
export function computeRiskMetricsFromSeries(
  values: number[],
  period: PeriodId
): RiskMetricsFromSeries {
  const returns = bucketReturns(values);
  if (returns.length === 0) {
    return {
      sharpeAnnualized: null,
      volatilityAnnualizedPct: null,
      winRatePct: null,
    };
  }

  const wins = returns.filter((r) => r > 0).length;
  const winRatePct = (wins / returns.length) * 100;

  const std = sampleStd(returns);
  const ann = annualizationFactor(period);

  if (std == null) {
    return {
      sharpeAnnualized: null,
      volatilityAnnualizedPct: null,
      winRatePct,
    };
  }

  if (std === 0) {
    return {
      sharpeAnnualized: null,
      volatilityAnnualizedPct: 0,
      winRatePct,
    };
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const volatilityAnnualizedPct = std * ann * 100;
  const sharpeAnnualized = (mean / std) * ann;

  return {
    sharpeAnnualized,
    volatilityAnnualizedPct,
    winRatePct,
  };
}
