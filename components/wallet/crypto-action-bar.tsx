"use client";

import { DollarSign, Snowflake, Play, Settings2, ArrowUpRight, Copy, RefreshCw, ExternalLink, Send, Plus, Unlink, Bot } from "lucide-react";
import { WalletActionBar, type ActionItem, type MenuItem, type BadgeItem } from "./wallet-action-bar";

export interface CryptoActionBarProps {
  walletId: number;
  status: string;
  onFund: () => void;
  onFreeze: () => void;
  onGuardrails: () => void;
  onActivity: () => void;
  onAddAgent?: () => void;
  onUnlinkBot?: () => void;
  onCopyAddress?: () => void;
  onSyncBalance?: () => void;
  onTransfer?: () => void;
  syncingBalance?: boolean;
  fundLabel?: string;
  testIdPrefix?: string;
  basescanUrl?: string;
  botName?: string;
}

export function CryptoActionBar({
  walletId,
  status,
  onFund,
  onFreeze,
  onGuardrails,
  onActivity,
  onAddAgent,
  onUnlinkBot,
  onCopyAddress,
  onSyncBalance,
  onTransfer,
  fundLabel = "Fund",
  testIdPrefix = "stripe",
  basescanUrl,
  botName,
}: CryptoActionBarProps) {
  const isActive = status === "active";

  const actions: ActionItem[] = [
    {
      icon: DollarSign,
      label: fundLabel,
      onClick: onFund,
      className: "flex-1 text-xs gap-2 text-emerald-600 font-semibold cursor-pointer hover:bg-emerald-50 rounded-lg transition-colors",
      "data-testid": `button-fund-${walletId}`,
    },
    {
      icon: isActive ? Snowflake : Play,
      label: isActive ? "Pause" : "Activate",
      onClick: onFreeze,
      className: "flex-1 text-xs gap-2 text-neutral-600 cursor-pointer hover:bg-neutral-100 rounded-lg transition-colors",
      "data-testid": `button-freeze-${walletId}`,
    },
    {
      icon: Settings2,
      label: "Guardrails",
      onClick: onGuardrails,
      className: "flex-1 text-xs gap-2 text-neutral-600 cursor-pointer hover:bg-neutral-100 rounded-lg transition-colors",
      "data-testid": `button-guardrails-${walletId}`,
    },
    {
      icon: ArrowUpRight,
      label: "Activity",
      onClick: onActivity,
      className: "flex-1 text-xs gap-2 text-neutral-600 cursor-pointer hover:bg-neutral-100 rounded-lg transition-colors",
      "data-testid": `button-activity-${walletId}`,
    },
  ];

  let badge: BadgeItem | undefined;
  if (onAddAgent) {
    actions.push({
      icon: Plus,
      label: "Add Agent",
      onClick: onAddAgent,
      className: "flex-1 text-xs gap-2 text-emerald-600 font-semibold cursor-pointer hover:bg-emerald-50 rounded-lg transition-colors",
      "data-testid": `button-add-agent-${walletId}`,
    });
  } else if (botName) {
    badge = {
      icon: Bot,
      label: botName,
      className: "flex-1 flex items-center justify-center gap-2 text-xs text-blue-600 font-medium",
      "data-testid": `badge-bot-${walletId}`,
    };
  }

  const menuItems: MenuItem[] = [];

  if (onCopyAddress) {
    menuItems.push({
      icon: Copy,
      label: "Copy Address",
      onClick: onCopyAddress,
      "data-testid": `menu-copy-address-${walletId}`,
    });
  }

  if (onSyncBalance) {
    menuItems.push({
      icon: RefreshCw,
      label: "Sync Balance",
      onClick: onSyncBalance,
      "data-testid": `menu-sync-balance-${walletId}`,
    });
  }

  if (basescanUrl) {
    menuItems.push({
      icon: ExternalLink,
      label: "View on Basescan",
      onClick: () => window.open(basescanUrl, "_blank"),
      "data-testid": `menu-basescan-${walletId}`,
    });
  }

  if (onTransfer) {
    menuItems.push({
      icon: Send,
      label: "Transfer USDC",
      onClick: onTransfer,
      "data-testid": `menu-transfer-${walletId}`,
    });
  }

  if (onUnlinkBot) {
    menuItems.push({
      icon: Unlink,
      label: "Unlink Bot",
      onClick: onUnlinkBot,
      "data-testid": `menu-unlink-bot-${walletId}`,
    });
  }

  return (
    <WalletActionBar
      actions={actions}
      badge={badge}
      menuItems={menuItems}
      menuTestId={`button-wallet-menu-${walletId}`}
    />
  );
}
