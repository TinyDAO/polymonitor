"use client";

import { useState } from "react";
import { KanbanList } from "./kanban-list";
import { CreateKanbanButton } from "./create-kanban-button";
import { motion } from "motion/react";

export function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-6xl space-y-10"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          My Kanbans
        </h1>
        <CreateKanbanButton onCreated={() => setRefreshKey((k) => k + 1)} />
      </div>
      <KanbanList refreshKey={refreshKey} />
    </motion.div>
  );
}
