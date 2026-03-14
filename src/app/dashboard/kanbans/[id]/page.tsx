import { notFound } from "next/navigation";
import { getUserIdByWallet, getKanbanWithAddresses } from "@/lib/db/queries";
import { getSession } from "@/lib/auth";
import { KanbanDetail } from "@/components/kanban-detail";

export default async function KanbanDetailPage({
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
  if (!kanban || kanban.userId !== userId) notFound();

  return <KanbanDetail kanban={kanban} />;
}
