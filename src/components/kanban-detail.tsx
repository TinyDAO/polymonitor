"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  ChartTooltip,
  Legend
);

type Address = {
  id: string;
  address: string;
  label: string;
};

type Snapshot = {
  id: string;
  addressId: string;
  polymarketValue: string;
  usdcBalance: string;
  totalValue: string;
  createdAt: string;
};

type Kanban = {
  id: string;
  name: string;
  addresses: Address[];
};

type SortMode = "default" | "amount";

// 3 色相（青/橙/紫），交错深浅，相邻线条颜色差异大
const CHART_COLOR_BASES = [
  ["#67e8f9", "#22d3ee", "#06b6d4"], // cyan
  ["#fcd34d", "#fbbf24", "#f59e0b"], // amber
  ["#c4b5fd", "#a78bfa", "#8b5cf6"], // violet
];

function getChartColor(index: number): string {
  const base = index % 3;
  const shade = Math.floor(index / 3) % 3;
  return CHART_COLOR_BASES[base][shade];
}

export function KanbanDetail({ kanban }: { kanban: Kanban }) {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshotRefreshKey, setSnapshotRefreshKey] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());
  const [hoveredAddrId, setHoveredAddrId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSnapshots = useCallback(() => {
    setLoading(true);
    fetch(`/api/kanbans/${kanban.id}/snapshots?days=30`)
      .then((r) => r.json())
      .then((data) => setSnapshots(Array.isArray(data) ? data : []))
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [kanban.id]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots, snapshotRefreshKey]);

  async function handleSync() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/kanbans/${kanban.id}/sync`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.errors?.length) {
          toast.error(data.errors[0]);
        } else {
          toast.success(`Synced ${data.synced} address(es)`);
        }
        fetchSnapshots();
      } else {
        toast.error("Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddress.trim() || !newLabel.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/kanbans/${kanban.id}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: newAddress.trim(),
          label: newLabel.trim(),
        }),
      });
      if (res.ok) {
        toast.success("Address added");
        setNewAddress("");
        setNewLabel("");
        setShowAddForm(false);
        router.refresh();
        await handleSync();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add address");
      }
    } catch {
      toast.error("Failed to add address");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleRemove(addrId: string) {
    setToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(addrId)) next.delete(addrId);
      else next.add(addrId);
      return next;
    });
  }

  async function handleBatchRemove() {
    if (toRemove.size === 0) {
      setEditMode(false);
      return;
    }
    if (!confirm(`Remove ${toRemove.size} address(es)?`)) return;
    try {
      await Promise.all(
        Array.from(toRemove).map((id) =>
          fetch(`/api/addresses/${id}`, { method: "DELETE" })
        )
      );
      toast.success(`Removed ${toRemove.size} address(es)`);
      setToRemove(new Set());
      setEditMode(false);
      window.location.reload();
    } catch {
      toast.error("Failed to remove addresses");
    }
  }

  async function handleDeleteKanban() {
    if (!confirm("Delete this kanban and all its addresses?")) return;
    const res = await fetch(`/api/kanbans/${kanban.id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/dashboard";
  }

  const addressMap = Object.fromEntries(
    kanban.addresses.map((a) => [a.id, a.label])
  );

  const latestByAddress = useMemo(
    () =>
      snapshots.reduce<Record<string, Snapshot>>((acc, s) => {
        const prev = acc[s.addressId];
        if (!prev || new Date(s.createdAt) > new Date(prev.createdAt)) {
          acc[s.addressId] = s;
        }
        return acc;
      }, {}),
    [snapshots]
  );

  const sortedAddresses = useMemo(() => {
    const addrs = [...kanban.addresses];
    if (sortMode === "amount") {
      addrs.sort((a, b) => {
        const valA = latestByAddress[a.id]
          ? parseFloat(latestByAddress[a.id].totalValue)
          : 0;
        const valB = latestByAddress[b.id]
          ? parseFloat(latestByAddress[b.id].totalValue)
          : 0;
        return valB - valA;
      });
    }
    return addrs;
  }, [kanban.addresses, sortMode, latestByAddress]);

  const totalValue = Object.values(latestByAddress).reduce(
    (sum, s) => sum + parseFloat(s.totalValue),
    0
  );

  const byHour = snapshots
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .reduce<Record<string, Record<string, number>>>((acc, s) => {
      const d = new Date(s.createdAt).toISOString().slice(0, 13);
      if (!acc[d]) acc[d] = {};
      const label = addressMap[s.addressId] || s.addressId.slice(0, 8);
      if (!(label in acc[d])) acc[d][label] = parseFloat(s.totalValue);
      return acc;
    }, {});

  const chartData = Object.entries(byHour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, values]) => {
      const d = new Date(hour + ":00:00Z");
      const total = Object.values(values).reduce((s, v) => s + v, 0);
      return {
        date: d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
        }),
        sortKey: hour,
        total,
        ...values,
      };
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-cyan)]"
          >
            ← Back
          </Link>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {kanban.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSync}
            disabled={refreshing || kanban.addresses.length === 0}
            className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
            title="Refresh balances"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddForm(true)}
            className="rounded-lg bg-[var(--accent-cyan)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)]"
          >
            + Add Address
          </motion.button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className={`rounded-lg border px-3 py-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] ${
                menuOpen
                  ? "border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-primary)]"
                  : "border-[var(--border-default)] hover:bg-[var(--bg-hover)]"
              }`}
              aria-label="More options"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-50 mt-1.5 min-w-[160px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleDeleteKanban();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--accent-red)] transition-colors hover:bg-[var(--accent-red-dim)]"
                  >
                    Delete Kanban
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Total Value */}
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-[var(--text-muted)]">Total</span>
        <span className="font-mono-custom text-xl font-semibold text-[var(--accent-emerald)] sm:text-2xl">
          ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
        <span className="text-xs text-[var(--text-muted)]">USDC</span>
      </div>

      {/* Left-Right Layout: Chart | Addresses */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Left: Chart */}
        <div className="flex min-h-0 flex-1 flex-col">
          {chartData.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex min-h-0 flex-1 flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 lg:p-5"
            >
              <h2 className="mb-3 shrink-0 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                30 days
              </h2>
              <div className="h-[280px] min-h-0 flex-1 sm:h-[320px]">
                <Line
                  data={{
                    labels: chartData.map((d) => d.date),
                    datasets: [
                      {
                        label: "Total",
                        data: chartData.map((d) => d.total),
                        fill: true,
                        backgroundColor: "rgba(94, 234, 212, 0.06)",
                        borderColor: "transparent",
                        borderWidth: 0,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointBackgroundColor: "rgba(94, 234, 212, 0.5)",
                        pointBorderWidth: 0,
                        yAxisID: "y1",
                      },
                      ...Object.keys(addressMap).map((addrId, i) => {
                        const label = addressMap[addrId];
                        const color = getChartColor(i);
                        return {
                          label,
                          data: chartData.map((d) => {
                            const v = (d as Record<string, unknown>)[label];
                            return typeof v === "number" ? v : 0;
                          }),
                          fill: false,
                          borderColor: color,
                          borderWidth: 2.5,
                          pointRadius: 2,
                          pointHoverRadius: 5,
                          pointHoverBorderWidth: 2,
                          pointBackgroundColor: color,
                          pointBorderWidth: 0,
                          tension: 0.3,
                          yAxisID: "y",
                        };
                      }),
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: "index", intersect: false },
                    plugins: {
                      legend: {
                        position: "top",
                        labels: {
                          font: { size: 12 },
                          color: "#8b92a3",
                          usePointStyle: true,
                          pointStyle: "circle",
                        },
                      },
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
                              ? `${ctx.dataset.label}: $${Number(ctx.parsed.y).toFixed(2)}`
                              : "",
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: {
                          color: "#5c6478",
                          font: { size: 11 },
                          maxRotation: 0,
                        },
                      },
                      y: {
                        position: "left",
                        grid: {
                          color: "rgba(255,255,255,0.06)",
                          drawTicks: false,
                        },
                        ticks: {
                          color: "#5c6478",
                          font: { size: 11 },
                          callback: (v) =>
                            typeof v === "number"
                              ? v >= 1000
                                ? `$${(v / 1000).toFixed(1)}k`
                                : `$${v}`
                              : v,
                        },
                      },
                      y1: {
                        position: "right",
                        grid: { drawOnChartArea: false },
                        ticks: {
                          color: "#5c6478",
                          font: { size: 11 },
                          callback: (v) =>
                            typeof v === "number"
                              ? v >= 1000
                                ? `$${(v / 1000).toFixed(1)}k`
                                : `$${v}`
                              : v,
                        },
                      },
                    },
                    animation: false,
                  }}
                />
              </div>
            </motion.div>
          ) : (
            <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/30">
              <p className="text-[var(--text-muted)]">
                Add addresses and sync to see the chart
              </p>
            </div>
          )}
        </div>

        {/* Right: Addresses */}
        <div className="flex w-full shrink-0 flex-col lg:w-[320px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-[var(--text-secondary)]">
              Addresses({kanban.addresses.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (editMode) setToRemove(new Set());
                  setEditMode((e) => !e);
                }}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  editMode
                    ? "bg-[var(--accent-cyan-dim)] text-[var(--accent-cyan)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {editMode ? "Cancel" : "Edit"}
              </button>
              <div className="flex rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5">
                <button
                  onClick={() => setSortMode("default")}
                  className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    sortMode === "default"
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  Order
                </button>
                <button
                  onClick={() => setSortMode("amount")}
                  className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    sortMode === "amount"
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  Amount
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {kanban.addresses.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                No addresses yet. Add one to monitor.
              </p>
            ) : (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                <AnimatePresence mode="popLayout">
                  {sortedAddresses.map((addr, i) => {
                    const snap = latestByAddress[addr.id];
                    const totalVal = snap ? parseFloat(snap.totalValue) : 0;
                    const usdcVal = snap ? parseFloat(snap.usdcBalance) : 0;
                    const polyVal = snap ? parseFloat(snap.polymarketValue) : 0;
                    const isLast = i === sortedAddresses.length - 1;
                    return (
                      <motion.div
                        key={addr.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: i * 0.02,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        onMouseEnter={() => setHoveredAddrId(addr.id)}
                        onMouseLeave={() => setHoveredAddrId(null)}
                        className={`flex items-start justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)] ${
                          !isLast ? "border-b border-[var(--border-subtle)]" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{addr.label}</p>
                            <a
                              href={`https://polymarket.com/profile/${addr.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-cyan)]"
                            >
                              View
                            </a>
                          </div>
                          <p className="font-mono-custom mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                            {addr.address.slice(0, 8)}…{addr.address.slice(-6)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                          <div className="flex flex-col items-end gap-0.5">
                            <span
                              className={`font-mono-custom font-medium text-[var(--accent-emerald)] transition-all duration-200 ${
                                hoveredAddrId === addr.id ? "text-xs" : "text-sm"
                              }`}
                            >
                              ${totalVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            <motion.div
                              initial={false}
                              animate={{
                                opacity: hoveredAddrId === addr.id ? 1 : 0,
                                height: hoveredAddrId === addr.id ? 16 : 0,
                              }}
                              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden text-[10px] pt-[5px] leading-tight text-[var(--text-muted)]"
                            >
                              onchain: ${usdcVal.toFixed(2)}  position: ${polyVal.toFixed(2)}
                            </motion.div>
                          </div>
                          {editMode && (
                            <button
                              onClick={() => toggleRemove(addr.id)}
                              className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                                toRemove.has(addr.id)
                                  ? "bg-[var(--accent-red-dim)] text-[var(--accent-red)]"
                                  : "text-[var(--text-muted)] hover:bg-[var(--accent-red-dim)] hover:text-[var(--accent-red)]"
                              }`}
                            >
                              {toRemove.has(addr.id) ? "✓" : "×"}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
          {editMode && kanban.addresses.length > 0 && (
            <div className="mt-3 flex justify-end border-t border-[var(--border-subtle)] pt-3">
              <button
                onClick={handleBatchRemove}
                disabled={toRemove.size === 0}
                className="rounded px-3 py-1.5 text-xs font-medium text-[var(--accent-red)] transition-opacity hover:bg-[var(--accent-red-dim)] disabled:opacity-50"
              >
                Remove {toRemove.size > 0 ? toRemove.size : ""} selected
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddForm(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-2xl"
            >
              <h2 className="mb-4 font-display text-lg font-semibold">
                Add Address
              </h2>
              <form onSubmit={handleAddAddress} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">
                    Polymarket profile address (from polymarket.com/profile/0x...)
                  </label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="0x..."
                    className="focus-ring w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2.5 font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">
                    Label
                  </label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Main Account"
                    className="focus-ring w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="rounded-lg px-4 py-2.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submitting || !newAddress.trim() || !newLabel.trim()
                    }
                    className="rounded-lg bg-[var(--accent-cyan)] px-4 py-2.5 text-sm font-semibold text-[var(--bg-base)] transition-opacity disabled:opacity-50"
                  >
                    {submitting ? "Adding..." : "Add"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
