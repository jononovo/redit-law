"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  CreditCard, 
  Activity, 
  Settings, 
  LogOut,
  Plus,
  Shield,
  Wallet,
  ShoppingCart
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NewCardModal } from "@/components/dashboard/new-card-modal";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/app" },
  { icon: Wallet, label: "Stripe Wallet", href: "/app/stripe-wallet" },
  { icon: ShoppingCart, label: "Card Wallet", href: "/app/card-wallet" },
  { icon: Shield, label: "Self-Hosted", href: "/app/self-hosted" },
  { icon: Activity, label: "Transactions", href: "/app/transactions" },
  { icon: Settings, label: "Settings", href: "/app/settings" },
  { icon: CreditCard, label: "Virtual Cards", href: "/app/cards", inactive: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [newCardModalOpen, setNewCardModalOpen] = useState(false);

  return (
    <aside className="w-64 bg-white border-r border-neutral-100 h-screen fixed left-0 top-0 flex flex-col z-50">
      <div className="p-6 flex items-center gap-3">
        <Image src="/images/logo-claw-chip.png" alt="CreditClaw" width={32} height={32} className="object-contain" />
        <span className="font-bold text-lg tracking-tight text-neutral-900">CreditClaw</span>
      </div>

      <div className="px-4 mb-6">
        <Button
          onClick={() => setNewCardModalOpen(true)}
          className="w-full justify-start gap-2 rounded-xl bg-primary hover:bg-primary/90 shadow-md shadow-primary/20"
          data-testid="button-new-card"
        >
            <Plus className="w-4 h-4" />
            <span>New Card</span>
        </Button>
      </div>

      <NewCardModal open={newCardModalOpen} onOpenChange={setNewCardModalOpen} />

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isInactive = "inactive" in item && item.inactive;
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer",
                isInactive
                  ? "text-neutral-300 hover:bg-neutral-50 hover:text-neutral-400 opacity-60"
                  : isActive 
                    ? "bg-neutral-900 text-white shadow-md shadow-neutral-900/10" 
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              )}>
                <item.icon className={cn("w-5 h-5", isInactive ? "text-neutral-300" : isActive ? "text-white" : "text-neutral-400")} />
                {item.label}
                {isInactive && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                    Inactive
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-neutral-100">
        {user && (
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                {user.displayName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{user.displayName || "User"}</p>
              <p className="text-xs text-neutral-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-50 cursor-pointer transition-colors group w-full"
          data-testid="button-logout"
        >
          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 group-hover:bg-white group-hover:shadow-sm">
            <LogOut className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-neutral-900 truncate">Log Out</p>
          </div>
        </button>
      </div>
    </aside>
  );
}
