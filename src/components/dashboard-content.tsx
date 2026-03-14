"use client";

import { useState } from "react";
import { KanbanList } from "./kanban-list";
import { CreateKanbanButton } from "./create-kanban-button";

export function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Kanbans</h1>
        <CreateKanbanButton onCreated={() => setRefreshKey((k) => k + 1)} />
      </div>
      <KanbanList refreshKey={refreshKey} />
    </div>
  );
}
