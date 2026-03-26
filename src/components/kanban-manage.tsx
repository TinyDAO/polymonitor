"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "motion/react";

type Member = {
  userId: string;
  role: string;
  walletAddress: string;
};

const INVITE_DURATIONS = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
] as const;

type KanbanManageProps = {
  kanbanId: string;
  kanbanName: string;
  creatorUserId: string;
  isCreator: boolean;
};

export function KanbanManage({
  kanbanId,
  kanbanName,
  creatorUserId,
  isCreator,
}: KanbanManageProps) {
  const [inviteDuration, setInviteDuration] = useState(24);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteCreating, setInviteCreating] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/kanbans/${kanbanId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : []);
      } else {
        setMembers([]);
      }
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [kanbanId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleCreateInvite() {
    setInviteCreating(true);
    setInviteUrl(null);
    try {
      const res = await fetch(`/api/kanbans/${kanbanId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInHours: inviteDuration }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteUrl(data.url);
        toast.success("Invite link created");
      } else {
        toast.error(data.error || "Failed to create invite");
      }
    } catch {
      toast.error("Failed to create invite");
    } finally {
      setInviteCreating(false);
    }
  }

  async function handleCopyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm("Remove this member from the board?")) return;
    setRemovingUserId(userId);
    try {
      const res = await fetch(
        `/api/kanbans/${kanbanId}/members?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Member removed");
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove member");
      }
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingUserId(null);
    }
  }

  async function handleDeleteKanban() {
    if (!confirm("Delete this kanban and all its addresses?")) return;
    const res = await fetch(`/api/kanbans/${kanbanId}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/dashboard";
  }

  const boardHref = `/dashboard/kanbans/${kanbanId}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 pb-12 lg:gap-10 lg:pb-16 xl:gap-12"
    >
      {/* Sticky back — 长列表滚动时也能返回看板 */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Link
          href={boardHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-cyan)]"
        >
          <span aria-hidden className="text-lg leading-none">
            ←
          </span>
          <span>返回看板</span>
          <span className="hidden font-normal text-[var(--text-muted)] sm:inline">
            · Back to board
          </span>
        </Link>
      </div>

      <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] pb-8 lg:pb-10">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
          Manage board
        </h1>
        <p className="max-w-3xl text-base text-[var(--text-secondary)] lg:text-lg">
          {kanbanName}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:gap-8 xl:gap-10">
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 sm:p-8 lg:rounded-2xl lg:p-10">
        <h2 className="font-display text-xl font-semibold lg:text-2xl">
          Invite people
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)] lg:text-base">
          Generate a link others can use to join this board.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">
              Link validity
            </label>
            <div className="flex flex-wrap gap-2 lg:gap-3">
              {INVITE_DURATIONS.map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  onClick={() => setInviteDuration(d.hours)}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors lg:px-5 lg:py-3 lg:text-base ${
                    inviteDuration === d.hours
                      ? "border-[var(--accent-cyan)] bg-[var(--accent-cyan-dim)] text-[var(--accent-cyan)]"
                      : "border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          {inviteUrl ? (
            <div className="space-y-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="focus-ring min-h-[48px] w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-xs text-[var(--text-primary)] sm:flex-1 lg:text-sm"
                />
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="shrink-0 rounded-lg bg-[var(--accent-cyan)] px-6 py-3 text-sm font-semibold text-[var(--bg-base)] sm:self-stretch lg:text-base"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Share this link. It expires in{" "}
                {INVITE_DURATIONS.find((d) => d.hours === inviteDuration)
                  ?.label ?? "24 hours"}
                .
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCreateInvite}
              disabled={inviteCreating}
              className="rounded-lg bg-[var(--accent-cyan)] px-6 py-3 text-sm font-semibold text-[var(--bg-base)] transition-opacity disabled:opacity-50 lg:text-base"
            >
              {inviteCreating ? "Creating..." : "Generate invite link"}
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 sm:p-8 lg:rounded-2xl lg:p-10">
        <div>
          <h2 className="font-display text-xl font-semibold lg:text-2xl">
            Members
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)] lg:text-base">
            Full wallet address per row. Many members? The table scrolls
            sideways on narrow screens.
          </p>
        </div>
        {membersLoading ? (
          <div className="flex justify-center py-16 lg:py-20">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent-cyan)] border-t-transparent" />
          </div>
        ) : members.length === 0 ? (
          <p className="mt-6 py-12 text-center text-sm text-[var(--text-muted)] lg:mt-8 lg:text-base">
            No members yet besides you.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto lg:mt-8">
            <table className="w-full min-w-[600px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="pb-3 pr-4 sm:pb-4">Wallet</th>
                  <th className="w-28 pb-3 pr-4 sm:w-32 sm:pb-4">Role</th>
                  <th className="w-24 pb-3 text-right sm:w-28 sm:pb-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isRowCreator = m.userId === creatorUserId;
                  const addr = m.walletAddress ?? "";
                  return (
                    <tr
                      key={m.userId}
                      className="border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <td className="max-w-0 py-4 pr-4 align-middle">
                        <span
                          className="block break-all font-mono text-xs leading-relaxed text-[var(--text-primary)] sm:text-sm"
                          title={addr}
                        >
                          {addr || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4 align-middle text-sm text-[var(--text-secondary)]">
                        {m.role === "admin" ? "Admin" : "Member"}
                      </td>
                      <td className="py-4 text-right align-middle">
                        {!isRowCreator ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.userId)}
                            disabled={removingUserId === m.userId}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--accent-red)] transition-colors hover:bg-[var(--accent-red-dim)] disabled:opacity-50"
                          >
                            {removingUserId === m.userId ? "..." : "Remove"}
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">
                            Owner
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>

      {isCreator && (
        <section className="rounded-xl border border-[var(--border-subtle)] border-[var(--accent-red)]/30 bg-[var(--bg-card)] p-6 sm:p-8 lg:rounded-2xl lg:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-xl font-semibold text-[var(--accent-red)] lg:text-2xl">
                Danger zone
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)] lg:text-base">
                Delete this board permanently. This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeleteKanban}
              className="shrink-0 self-start rounded-lg border border-[var(--accent-red)] px-6 py-3 text-sm font-medium text-[var(--accent-red)] transition-colors hover:bg-[var(--accent-red-dim)] lg:self-center lg:px-8 lg:text-base"
            >
              Delete board
            </button>
          </div>
        </section>
      )}
    </motion.div>
  );
}
