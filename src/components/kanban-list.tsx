"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Kanban = {
  id: string;
  name: string;
  createdAt: string;
};

export function KanbanList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [kanbans, setKanbans] = useState<Kanban[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/kanbans")
      .then((r) => r.json())
      .then((data) => {
        setKanbans(Array.isArray(data) ? data : []);
      })
      .catch(() => setKanbans([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="text-zinc-400">Loading kanbans...</div>
    );
  }

  if (kanbans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-700 p-12 text-center text-zinc-500">
        No kanbans yet. Create one to start monitoring addresses.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {kanbans.map((k) => (
        <Link
          key={k.id}
          href={`/dashboard/kanbans/${k.id}`}
          className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-6 transition hover:border-zinc-600 hover:bg-zinc-900"
        >
          <h3 className="font-semibold">{k.name}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Created {new Date(k.createdAt).toLocaleDateString()}
          </p>
        </Link>
      ))}
    </div>
  );
}
