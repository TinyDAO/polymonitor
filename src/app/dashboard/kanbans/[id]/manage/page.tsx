import { notFound } from "next/navigation";
import { getUserIdByWallet, getKanbanWithAddresses } from "@/lib/db/queries";
import { getSession } from "@/lib/auth";
import { canAccessKanban, isKanbanAdmin } from "@/lib/kanban-auth";
import { KanbanManage } from "@/components/kanban-manage";

export default async function KanbanManagePage({
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

  const isAdmin = await isKanbanAdmin(id, userId);
  if (!isAdmin) notFound();

  const isCreator = kanban.userId === userId;

  return (
    <KanbanManage
      kanbanId={kanban.id}
      kanbanName={kanban.name}
      creatorUserId={kanban.userId}
      isCreator={isCreator}
    />
  );
}
