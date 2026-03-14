"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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

  async function handleDeleteAddress(addrId: string) {
    if (!confirm("Remove this address?")) return;
    const res = await fetch(`/api/addresses/${addrId}`, { method: "DELETE" });
    if (res.ok) window.location.reload();
  }

  async function handleDeleteKanban() {
    if (!confirm("Delete this kanban and all its addresses?")) return;
    const res = await fetch(`/api/kanbans/${kanban.id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/dashboard";
  }

  const addressMap = Object.fromEntries(
    kanban.addresses.map((a) => [a.id, a.label])
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
      return {
        date: d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
        }),
        sortKey: hour,
        ...values,
      };
    });

  const latestByAddress = snapshots.reduce<Record<string, Snapshot>>(
    (acc, s) => {
      const prev = acc[s.addressId];
      if (!prev || new Date(s.createdAt) > new Date(prev.createdAt)) {
        acc[s.addressId] = s;
      }
      return acc;
    },
    {}
  );

  const totalValue = Object.values(latestByAddress).reduce(
    (sum, s) => sum + parseFloat(s.totalValue),
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-zinc-400 hover:text-zinc-100"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-bold">{kanban.name}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={refreshing || kanban.addresses.length === 0}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            title="Refresh balances"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            + Add Address
          </button>
          <button
            onClick={handleDeleteKanban}
            className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            Delete Kanban
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold">Total Value</h2>
        <p className="mt-2 text-3xl font-bold text-emerald-400">
          ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        <p className="mt-1 text-sm text-zinc-500">USDC</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Addresses</h2>
        {kanban.addresses.length === 0 ? (
          <p className="text-zinc-500">No addresses yet. Add one to monitor.</p>
        ) : (
          <div className="space-y-2">
            {kanban.addresses.map((addr) => {
              const snap = latestByAddress[addr.id];
              const totalVal = snap ? parseFloat(snap.totalValue) : 0;
              const usdcVal = snap ? parseFloat(snap.usdcBalance) : 0;
              const polyVal = snap ? parseFloat(snap.polymarketValue) : 0;
              return (
                <div
                  key={addr.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/50 p-4"
                >
                  <div>
                    <p className="font-medium">{addr.label}</p>
                    <p className="text-sm text-zinc-500 font-mono">
                      {addr.address.slice(0, 10)}...{addr.address.slice(-8)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-emerald-400 font-mono">
                        ${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <div className="text-xs text-zinc-500">
                        <span>Poly: ${polyVal.toFixed(2)}</span>
                        <span className="mx-2">|</span>
                        <span>USDC: ${usdcVal.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://polymarket.com/profile/${addr.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:border-emerald-500 hover:text-emerald-400"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Value Over Time (hourly, 30 days)
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="date"
                  stroke="#71717a"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#71717a" tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => [value != null ? `$${Number(value).toFixed(2)}` : "", ""]}
                />
                <Legend />
                {Object.keys(addressMap).map((addrId, i) => {
                  const label = addressMap[addrId];
                  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];
                  return (
                    <Line
                      key={addrId}
                      type="monotone"
                      dataKey={label}
                      stroke={colors[i % colors.length]}
                      dot={false}
                      strokeWidth={2}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg bg-zinc-900 p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Add Address</h2>
            <form onSubmit={handleAddAddress} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Polymarket profile address (from polymarket.com/profile/0x...)
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 font-mono text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Main Account"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg px-4 py-2 text-zinc-400 hover:text-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newAddress.trim() || !newLabel.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
