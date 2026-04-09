"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Brain,
  Lightbulb,
  BarChart2,
  Map,
  List,
  GitCommit,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/focus", label: "Focus Mode", icon: Brain },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
  { href: "/srs", label: "SRS Review", icon: Brain },
  { href: "/analytics/mastery", label: "Analytics", icon: BarChart2 },
  { href: "/roadmap/neetcode150", label: "Roadmap", icon: Map },
  { href: "/submissions", label: "Submissions", icon: List },
  { href: "/commits", label: "Commits", icon: GitCommit },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex w-56 flex-col border-r bg-card px-3 py-4 shrink-0">
      <div className="px-2 mb-6">
        <span className="text-lg font-bold tracking-tight">Grindstone</span>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <Separator className="my-3" />

      <div className="space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
