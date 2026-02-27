"use client";

import { Eye, Snowflake, Play, Plus, Bot, Copy, Unlink } from "lucide-react";
import { WalletActionBar, type ActionItem, type BadgeItem, type MenuItem } from "./wallet-action-bar";

export interface CreditCardActionBarProps {
  cardId: string;
  cardName?: string;
  status: string;
  botId: string | null;
  botName: string | null;
  onManage: () => void;
  onFreeze: () => void;
  onAddAgent?: () => void;
  onLinkAgent?: () => void;
  onUnlinkBot?: () => void;
  onCopyCardId: () => void;
  onViewDetails?: () => void;
  testIdPrefix?: string;
  showFreezeWhenStatuses?: string[];
}

export function CreditCardActionBar({
  cardId,
  status,
  botId,
  botName,
  onManage,
  onFreeze,
  onAddAgent,
  onLinkAgent,
  onUnlinkBot,
  onCopyCardId,
  onViewDetails,
  testIdPrefix = "r5",
  showFreezeWhenStatuses,
}: CreditCardActionBarProps) {
  const isFrozen = status === "frozen";
  const hiddenStatuses = showFreezeWhenStatuses
    ? undefined
    : ["pending_setup"];

  const shouldShowFreeze = showFreezeWhenStatuses
    ? showFreezeWhenStatuses.includes(status)
    : !hiddenStatuses?.includes(status);

  const actions: ActionItem[] = [
    {
      icon: Eye,
      label: "Manage",
      onClick: onManage,
      "data-testid": `button-${testIdPrefix}-manage-${cardId}`,
    },
    {
      icon: isFrozen ? Play : Snowflake,
      label: isFrozen ? "Unfreeze" : "Freeze",
      onClick: onFreeze,
      className: `flex-1 text-xs gap-2 cursor-pointer hover:bg-neutral-100 rounded-lg transition-colors ${isFrozen ? "text-blue-600" : "text-neutral-600"}`,
      "data-testid": `button-${testIdPrefix}-freeze-${cardId}`,
      hidden: !shouldShowFreeze,
    },
  ];

  if (!botId && onAddAgent) {
    actions.push({
      icon: Plus,
      label: "Add Agent",
      onClick: onAddAgent,
      className: "flex-1 text-xs gap-2 text-emerald-600 font-semibold cursor-pointer hover:bg-emerald-50 rounded-lg transition-colors",
      "data-testid": `button-${testIdPrefix}-add-agent-${cardId}`,
    });
  }

  const badge: BadgeItem | null = botId
    ? {
        icon: Bot,
        label: botName || "Linked",
        "data-testid": `badge-${testIdPrefix}-bot-link-${cardId}`,
      }
    : null;

  const menuItems: MenuItem[] = [];

  if (!botId && onLinkAgent) {
    menuItems.push({
      icon: Plus,
      label: "Link Agent",
      onClick: onLinkAgent,
      "data-testid": `menu-${testIdPrefix}-link-${cardId}`,
    });
  }

  if (botId && onUnlinkBot) {
    menuItems.push({
      icon: Unlink,
      label: "Unlink Bot",
      onClick: onUnlinkBot,
      "data-testid": `menu-${testIdPrefix}-unlink-${cardId}`,
    });
  }

  menuItems.push({
    icon: Copy,
    label: "Copy Card ID",
    onClick: onCopyCardId,
    "data-testid": `menu-${testIdPrefix}-copy-${cardId}`,
  });

  if (onViewDetails) {
    menuItems.push({
      icon: Eye,
      label: "View Details",
      onClick: onViewDetails,
      "data-testid": `menu-${testIdPrefix}-details-${cardId}`,
    });
  }

  return (
    <WalletActionBar
      actions={actions}
      badge={badge}
      menuItems={menuItems}
      menuTestId={`button-${testIdPrefix}-more-${cardId}`}
    />
  );
}
