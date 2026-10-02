"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  Flame,
  GitFork,
  Settings,
  ShieldAlert,
  LogOut,
  ExternalLink,
} from "lucide-react";

interface SidebarProps {
  user?: {
    name?: string | null;
    image?: string | null;
    username?: string | null;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      name: "APIs",
      href: "/apis",
      icon: Radio,
      active: pathname?.startsWith("/apis"),
    },
    {
      name: "Incidents",
      href: "/incidents",
      icon: Flame,
      active: pathname?.startsWith("/incidents"),
    },
    {
      name: "Repositories",
      href: "/repositories",
      icon: GitFork,
      active: pathname?.startsWith("/repositories"),
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      active: pathname?.startsWith("/settings"),
    },
  ];

  return (
    <aside className="w-64 border-r border-[#1a1e29] bg-[#0c0e14] flex flex-col justify-between shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-[#1a1e29]">
          <div className="w-8 h-8 rounded bg-rose-950/70 border border-rose-600/40 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="font-mono text-sm tracking-wider font-bold text-slate-100 flex items-center gap-2">
              API AUTOPSY
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-mono">
                POC
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">Forensic API Monitor</p>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                  item.active
                    ? "bg-[#161a26] text-slate-100 border border-[#23293d]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#12151f]"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${item.active ? "text-rose-400" : "text-slate-500"}`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-[#1a1e29] bg-[#090b10]">
        <div className="flex items-center justify-between p-2 rounded-md bg-[#11141c] border border-[#1d2230]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || "GitHub User"}
                className="w-7 h-7 rounded-full border border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono text-slate-300 shrink-0">
                GH
              </div>
            )}
            <div className="truncate">
              <p className="text-xs font-medium text-slate-200 truncate">
                {user?.name || user?.username || "Connected Dev"}
              </p>
              <p className="text-[10px] text-slate-500 font-mono truncate">GitHub Authenticated</p>
            </div>
          </div>
          <Link
            href="/login"
            onClick={async (e) => {
              e.preventDefault();
              const { signOut } = await import("next-auth/react");
              await signOut({ callbackUrl: "/login" });
            }}
            title="Sign Out"
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-[#181c28] rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
