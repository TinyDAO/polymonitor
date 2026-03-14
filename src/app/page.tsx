import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginPage } from "@/components/login-page";

export default async function HomePage() {
  const session = await getSession();
  if (session.walletAddress) {
    redirect("/dashboard");
  }
  return <LoginPage />;
}
