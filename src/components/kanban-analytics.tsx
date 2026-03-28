"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  type PeriodId,
  type SnapshotRow,
  type AddressMetrics,
  computeMetricsForPeriod,
  buildTotalSeries,
} from "@/lib/kanban-analytics-metrics";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ChartTooltip,
  Legend
);

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

type SortKey = "label" | "current" | "delta" | "deltaPct" | "poly" | "usdc";

function formatUsd(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function deltaColor(delta: number | null): string {
  if (delta == null) return "text-[var(--text-secondary)]";
  if (delta > 0) return "text-[var(--accent-emerald)]";
  if (delta < 0) return "text-[var(--accent-red)]";
  return "text-[var(--text-secondary)]";
}

export function KanbanAnalytics({
  kanbanId,
  kanbanName,
  addresses,
}: {
  kanbanId: string;
  kanbanName: string;
  addresses: { id: string; label: string }[];
}) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodId>("7d");
  const [sortKey, setSortKey] = useState<SortKey>("delta");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchSnapshots = useCallback(() => {
    setLoading(true);
    fetch(`/api/kanbans/${kanbanId}/snapshots?days=90`)
      .then((r) => r.json())
      .then((data) => setSnapshots(Array.isArray(data) ? data : []))
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [kanbanId]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const { rows, totals } = useMemo(
    () => computeMetricsForPeriod(snapshots, addresses, period),
    [snapshots, addresses, period]
  );

  const series = useMemo(
    () => buildTotalSeries(snapshots, period),
    [snapshots, period]
  );

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const list = [...rows];
    list.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb) * dir;
      }
      return ((va as number) - (vb as number)) * dir;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  function sortValue(r: AddressMetrics, key: SortKey): string | number | null {
    switch (key) {
      case "label":
        return r.label.toLowerCase();
      case "current":
        return r.current;
      case "delta":
        return r.delta;
      case "deltaPct":
        return r.deltaPct;
      case "poly":
        return r.polyCurrent;
      case "usdc":
        return r.usdcCurrent;
      default:
        return null;
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "label" ? "asc" : "desc");
    }
  }

  const lineOptions = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#13171f",
          titleColor: "#f4f5f7",
          bodyColor: "#8b92a3",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) =>
              ctx.parsed.y != null
                ? `Total: $${Number(ctx.parsed.y).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : "",
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#5c6478", maxRotation: 45, font: { size: 10 } },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: {
            color: "#5c6478",
            font: { size: 11 },
            callback: (v: string | number) =>
              typeof v === "number" && v >= 1000
                ? `$${(v / 1000).toFixed(1)}k`
                : typeof v === "number"
                  ? `$${v}`
                  : v,
          },
        },
      },
      animation: false,
    }),
    []
  );

  const hasChartPoints = series.values.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-0 flex-1 flex-col gap-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/dashboard/kanbans/${kanbanId}`}
            className="text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-cyan)]"
          >
            ← Back
          </Link>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {kanbanName}
          </h1>
          <span className="text-sm text-[var(--text-muted)]">Analytics</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5">
            {PERIODS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriod(id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === id
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading snapshots…</p>
      ) : addresses.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          No addresses on this board. Add addresses from the board page.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
              <p className="text-xs text-[var(--text-muted)]">Total now</p>
              <p className="mt-1 font-mono-custom text-lg font-semibold text-[var(--accent-emerald)]">
                {formatUsd(totals.totalCurrent)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
              <p className="text-xs text-[var(--text-muted)]">
                Change ({period})
              </p>
              <p
                className={`mt-1 font-mono-custom text-lg font-semibold ${deltaColor(totals.totalDelta)}`}
              >
                {totals.totalDelta == null
                  ? "—"
                  : `${totals.totalDelta >= 0 ? "+" : ""}${totals.totalDelta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
              <p className="text-xs text-[var(--text-muted)]">Change %</p>
              <p
                className={`mt-1 font-mono-custom text-lg font-semibold ${deltaColor(totals.totalDelta)}`}
              >
                {formatPct(totals.totalDeltaPct)}
              </p>
              {totals.totalBaseline == null && totals.totalCurrent > 0 && (
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                  Incomplete: need a snapshot at or before the start of this
                  period for every address with data.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 lg:p-5">
            <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
              Total ({period})
            </h2>
            {hasChartPoints ? (
              <div className="h-[220px] sm:h-[260px]">
                <Line
                  data={{
                    labels: series.labels,
                    datasets: [
                      {
                        label: "Total",
                        data: series.values,
                        fill: true,
                        backgroundColor: "rgba(94, 234, 212, 0.08)",
                        borderColor: "rgba(94, 234, 212, 0.9)",
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        tension: 0.25,
                      },
                    ],
                  }}
                  options={lineOptions}
                />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                Not enough snapshot data in this period to plot a chart.
              </p>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
              By address
            </h2>
            <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <th className="px-3 py-2.5 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort("label")}
                        className="hover:text-[var(--text-secondary)]"
                      >
                        Label{" "}
                        {sortKey === "label" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort("current")}
                        className="hover:text-[var(--text-secondary)]"
                      >
                        Current{" "}
                        {sortKey === "current"
                          ? sortDir === "asc"
                            ? "↑"
                            : "↓"
                          : ""}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort("delta")}
                        className="hover:text-[var(--text-secondary)]"
                      >
                        Δ{" "}
                        {sortKey === "delta" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort("deltaPct")}
                        className="hover:text-[var(--text-secondary)]"
                      >
                        Δ %{" "}
                        {sortKey === "deltaPct"
                          ? sortDir === "asc"
                            ? "↑"
                            : "↓"
                          : ""}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort("poly")}
                        className="hover:text-[var(--text-secondary)]"
                      >
                        Position{" "}
                        {sortKey === "poly" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort("usdc")}
                        className="hover:text-[var(--text-secondary)]"
                      >
                        On-chain{" "}
                        {sortKey === "usdc" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => (
                    <tr
                      key={r.addressId}
                      className="border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">
                        {r.label}
                      </td>
                      <td className="px-3 py-2.5 font-mono-custom text-[var(--text-secondary)]">
                        {formatUsd(r.current)}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono-custom ${deltaColor(r.delta)}`}
                      >
                        {r.delta == null
                          ? "—"
                          : `${r.delta >= 0 ? "+" : ""}${r.delta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono-custom ${deltaColor(r.delta)}`}
                      >
                        {formatPct(r.deltaPct)}
                      </td>
                      <td className="px-3 py-2.5 font-mono-custom text-[var(--text-secondary)]">
                        {formatUsd(r.polyCurrent)}
                      </td>
                      <td className="px-3 py-2.5 font-mono-custom text-[var(--text-secondary)]">
                        {formatUsd(r.usdcCurrent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
