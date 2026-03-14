"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3 text-[var(--text-secondary)]"
      >
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-cyan)] border-t-transparent" />
        Loading kanbans...
      </motion.div>
    );
  }

  if (kanbans.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-card)]/50 p-16 text-center"
      >
        <p className="text-[var(--text-secondary)]">
          No kanbans yet. Create one to start monitoring addresses.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {kanbans.map((k, i) => (
          <motion.div
            key={k.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: i * 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Link
              href={`/dashboard/kanbans/${k.id}`}
              className="card-glow group block rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 transition-all duration-300"
            >
              <h3 className="font-display text-lg font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-cyan)]">
                {k.name}
              </h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Created {new Date(k.createdAt).toLocaleDateString()}
              </p>
            </Link>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
