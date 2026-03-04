import { getCurrentUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !user.flags?.includes("admin")) {
    notFound();
  }
  return <>{children}</>;
}
