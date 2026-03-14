"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export function CreateKanbanButton({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/kanbans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        toast.success("Kanban created");
        setName("");
        setOpen(false);
        onCreated?.();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create kanban");
      }
    } catch {
      toast.error("Failed to create kanban");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(true)}
        className="rounded-xl bg-[var(--accent-cyan)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-base)] shadow-[0_0_24px_-4px_var(--accent-cyan-dim)] transition-colors hover:bg-[#00b8e6]"
      >
        + New Kanban
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-2xl"
            >
              <h2 className="mb-4 font-display text-lg font-semibold">
                Create Kanban
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Kanban name"
                  className="focus-ring w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-cyan)] focus:outline-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-2.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="rounded-lg bg-[var(--accent-cyan)] px-4 py-2.5 text-sm font-semibold text-[var(--bg-base)] transition-opacity disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
