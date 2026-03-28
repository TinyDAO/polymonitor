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
export function bucketKeyLocal(date: Date, intervalHours: number): string {
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
  const periodMs = PERIOD_MS[period];
  const start = new Date(endTime.getTime() - periodMs);
  const intervalHours = period === "24h" ? 1 : 24;

  const inWindow = snapshots.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return t >= start.getTime() && t <= endTime.getTime();
  });

  const byBucket = new Map<string, number>();
  for (const s of inWindow) {
    const key = bucketKeyLocal(new Date(s.createdAt), intervalHours);
    const v = parseFloat(s.totalValue);
    byBucket.set(key, (byBucket.get(key) ?? 0) + v);
  }

  const keys = [...byBucket.keys()].sort((a, b) => a.localeCompare(b));
  const values = keys.map((k) => byBucket.get(k) ?? 0);

  const labels = keys.map((k) => {
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
  });

  return { labels, values };
}
