import { notFound } from "next/navigation";
import { getUserIdByWallet, getKanbanWithAddresses } from "@/lib/db/queries";
import { getSession } from "@/lib/auth";
import { canAccessKanban } from "@/lib/kanban-auth";
import { KanbanAnalytics } from "@/components/kanban-analytics";

export default async function KanbanAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session.walletAddress) notFound();

  const userId = await getUserIdByWallet(session.walletAddress);
  if (!userId) notFound();

  const { id } = await params;
  const kanban = await getKanbanWithAddresses(id);
  if (!kanban || !(await canAccessKanban(id, userId))) notFound();

  return (
    <KanbanAnalytics
      kanbanId={kanban.id}
      kanbanName={kanban.name}
      addresses={kanban.addresses.map((a) => ({ id: a.id, label: a.label }))}
    />
  );
}
