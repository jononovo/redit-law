"use client";

import { cn } from "@/lib/utils";
import { Wallet, Copy, RefreshCw, ExternalLink, Send, Snowflake, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";

export interface CryptoMenuItem {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  "data-testid"?: string;
}

interface CryptoCardVisualProps {
  color?: "primary" | "dark" | "blue" | "purple";
  botName: string;
  address: string;
  balance: string;
  chain: string;
  status: string;
  frozen?: boolean;
  className?: string;
  onCopyAddress?: () => void;
  onSyncBalance?: () => void;
  syncingBalance?: boolean;
  basescanUrl?: string;
  onTransfer?: () => void;
  guardrailLines?: { label: string; value: string }[];
  menuItems?: CryptoMenuItem[];
}

export function CryptoCardVisual({
  color = "blue",
  botName,
  address,
  balance,
  chain,
  status,
  frozen = false,
  className,
  onCopyAddress,
  onSyncBalance,
  syncingBalance,
  basescanUrl,
  onTransfer,
  guardrailLines = [],
  menuItems = [],
}: CryptoCardVisualProps) {
  const gradients = {
    primary: "bg-gradient-to-br from-primary to-orange-600",
    dark: "bg-gradient-to-br from-neutral-900 to-neutral-800",
    blue: "bg-gradient-to-br from-blue-500 to-purple-600",
    purple: "bg-gradient-to-br from-purple-500 to-purple-700",
  };

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-100 border-emerald-300/30",
    pending_setup: "bg-amber-500/20 text-amber-100 border-amber-300/30",
    awaiting_bot: "bg-violet-500/20 text-violet-100 border-violet-300/30",
    frozen: "bg-blue-500/20 text-blue-100 border-blue-300/30",
    paused: "bg-blue-500/20 text-blue-100 border-blue-300/30",
  };

  const statusLabels: Record<string, string> = {
    active: "active",
    pending_setup: "pending",
    awaiting_bot: "awaiting bot",
    frozen: "frozen",
    paused: "paused",
  };

  const displayStatus = frozen ? "frozen" : status;
  const statusStyle = statusColors[displayStatus] || "bg-white/20 text-white/90 border-white/30";
  const statusLabel = statusLabels[displayStatus] || displayStatus;

  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div
      className={cn(
        "relative rounded-2xl p-6 text-white shadow-xl overflow-hidden flex flex-col gap-4 select-none transition-all",
        gradients[color],
        frozen && "grayscale opacity-70",
        !frozen && "hover:scale-[1.01]",
        className
      )}
      data-testid="crypto-card-visual"
    >
      <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay pointer-events-none" />
      <div className="absolute -top-[60%] -right-[30%] w-[80%] h-[80%] rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -bottom-[40%] -left-[20%] w-[60%] h-[60%] rounded-full bg-white/5 pointer-events-none" />

      {frozen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 bg-white/90 text-neutral-800 px-4 py-2 rounded-full shadow-lg font-bold text-sm">
            <Snowflake className="w-4 h-4 text-blue-500" />
            FROZEN
          </div>
        </div>
      )}

      <div className="relative z-10 flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white/90" />
          </div>
          <div>
            <span className="text-sm font-semibold block" data-testid="text-wallet-bot-name">{botName}</span>
            <div className="flex items-center gap-1.5">
              <code className="text-xs text-white/60 font-mono" data-testid="text-wallet-address">{truncatedAddress}</code>
              {onCopyAddress && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCopyAddress(); }}
                  className="text-white/50 hover:text-white/90 transition-colors"
                  data-testid="button-copy-address"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[11px] font-medium tracking-wide px-3 py-1 rounded-full border backdrop-blur-sm",
              statusStyle
            )}
            data-testid="text-wallet-status"
          >
            {statusLabel}
          </span>
          {menuItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-white/60 hover:text-white/90 transition-colors p-1"
                  data-testid="button-wallet-card-menu"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {menuItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={idx} onClick={item.onClick} data-testid={item["data-testid"]}>
                      <Icon className="w-4 h-4 mr-2" /> {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="relative z-10">
        <span className="text-3xl font-bold font-mono tracking-tight block" data-testid="text-wallet-balance">{balance}</span>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-medium text-white/70 uppercase tracking-wider" data-testid="text-wallet-chain-label">
            USDC on {chain}
          </span>
          <div className="flex items-center gap-1.5">
            {onSyncBalance && (
              <button
                onClick={(e) => { e.stopPropagation(); onSyncBalance(); }}
                className="text-white/50 hover:text-white/90 transition-colors"
                title="Sync balance"
                data-testid="button-sync-balance"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", syncingBalance && "animate-spin")} />
              </button>
            )}
            {basescanUrl && (
              <button
                onClick={(e) => { e.stopPropagation(); window.open(basescanUrl, "_blank"); }}
                className="text-white/50 hover:text-white/90 transition-colors"
                title="View on Basescan"
                data-testid="button-basescan"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            {onTransfer && (
              <button
                onClick={(e) => { e.stopPropagation(); onTransfer(); }}
                className="text-white/50 hover:text-white/90 transition-colors"
                title="Transfer"
                data-testid="button-transfer-inline"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {guardrailLines.length > 0 && (
        <div className="relative z-10 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-4 py-3 space-y-1.5" data-testid="wallet-guardrails-panel">
          {guardrailLines.map((line, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-sm text-white/80">{line.label}</span>
              <span className="text-sm font-semibold text-white/95 font-mono">{line.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
