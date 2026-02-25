"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  CreditCard, 
  Activity, 
  Plus,
  Shield,
  Wallet,
  ShoppingCart,
  Sparkles,
  Send,
  Lock,
  Info
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NewCardModal } from "@/components/dashboard/new-card-modal";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const mainNavItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/app" },
  { icon: Wallet, label: "Stripe Wallet", href: "/app/stripe-wallet", tag: "beta", tooltip: "USDC wallet x402 purchases. Fund with Stripe/Link." },
  { icon: ShoppingCart, label: "Shopping Wallet", href: "/app/card-wallet", tag: "soon", tooltip: "USDC wallet for Shopping at Amazon/Shopify." },
  { icon: Shield, label: "Self-Hosted", href: "/app/self-hosted", tag: "legacy", tooltip: "Self-hosted: Agent uses your card. Secured with: Obfuscation & Split-Knowledge." },
  { icon: Lock, label: "Sub-Agent Cards", href: "/app/sub-agent-cards", tag: "beta", tooltip: "Self-hosted: Agent uses your card. Secured with: Encryption & Ephemeral Sub-Agent." },
  { icon: Activity, label: "Transactions", href: "/app/transactions" },
  { icon: CreditCard, label: "Virtual Cards", href: "/app/cards", inactive: true },
];

const procurementNavItems = [
  { icon: Send, label: "Submit Supplier", href: "/app/skills/submit" },
  { icon: Sparkles, label: "Skill Builder", href: "/app/skills/review" },
];

export function Sidebar() {
  const pathname = usePathname();
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
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href;
          const isInactive = "inactive" in item && item.inactive;
          const hasTooltip = "tooltip" in item && item.tooltip;
          const navLink = (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer",
                isInactive
                  ? "text-neutral-300 hover:bg-neutral-50 hover:text-neutral-400 opacity-60"
                  : isActive 
                    ? "bg-neutral-900 text-white shadow-md shadow-neutral-900/10" 
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              )}>
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isInactive ? "text-neutral-300" : isActive ? "text-white" : "text-neutral-400")} />
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5">
                    {item.label}
                    {hasTooltip && (
                      <span className={cn(
                        "inline-flex transition-colors",
                        isActive ? "text-white/40" : "text-neutral-300"
                      )}>
                        <Info className="w-3 h-3" />
                      </span>
                    )}
                  </span>
                  {("tag" in item && item.tag) && (
                    <span className={cn(
                      "text-[9px] font-semibold uppercase tracking-wider leading-none mt-1 px-1.5 py-0.5 rounded-sm w-fit transition-colors",
                      isActive
                        ? "text-white/60 bg-white/10 hover:bg-white/20"
                        : item.tag === "beta"
                          ? "text-blue-500 bg-blue-50 hover:bg-blue-100"
                          : "text-neutral-400 bg-neutral-100 hover:bg-neutral-200"
                    )}>
                      {item.tag}
                    </span>
                  )}
                  {isInactive && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider leading-none mt-1 px-1.5 py-0.5 rounded-sm w-fit text-neutral-400 bg-neutral-100 hover:bg-neutral-200 transition-colors">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
          if (hasTooltip) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  {navLink}
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px] text-xs leading-relaxed bg-white text-neutral-700 border border-neutral-200 shadow-md">
                  {item.tooltip}
                </TooltipContent>
              </Tooltip>
            );
          }
          return navLink;
        })}

        <div className="pt-4 pb-1 px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Procurement
          </p>
        </div>

        {procurementNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer",
                isActive 
                  ? "bg-neutral-900 text-white shadow-md shadow-neutral-900/10" 
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              )}>
                <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-neutral-400")} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
