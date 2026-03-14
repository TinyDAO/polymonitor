import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.walletAddress) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-grid-pattern bg-noise">
      <DashboardNav />
      <main className="relative z-10 min-h-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
