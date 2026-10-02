import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { SocketProvider } from "@/components/socket-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <SocketProvider>
      <div className="flex min-h-screen bg-[#07080a]">
        <Sidebar user={session?.user} />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
          {children}
        </main>
      </div>
    </SocketProvider>
  );
}
