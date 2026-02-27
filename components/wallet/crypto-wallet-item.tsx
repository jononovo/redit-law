"use client";

import { CardVisual } from "./card-visual";
import { CryptoActionBar } from "./crypto-action-bar";
import type { Rail1WalletInfo, Rail2WalletInfo } from "./types";

type CryptoWallet = Rail1WalletInfo | Rail2WalletInfo;

interface CryptoWalletItemProps {
  wallet: CryptoWallet;
  color?: "primary" | "dark" | "blue" | "purple";
  onFund: () => void;
  onFreeze: () => void;
  onGuardrails: () => void;
  onActivity: () => void;
  onAddAgent?: () => void;
  onUnlinkBot?: () => void;
  onCopyAddress: () => void;
  onSyncBalance?: () => void;
  onTransfer?: () => void;
  syncingBalance?: boolean;
  fundLabel?: string;
  testIdPrefix?: string;
  basescanUrl?: string;
}

export function CryptoWalletItem({
  wallet,
  color = "blue",
  onFund,
  onFreeze,
  onGuardrails,
  onActivity,
  onAddAgent,
  onUnlinkBot,
  onCopyAddress,
  onSyncBalance,
  onTransfer,
  syncingBalance,
  fundLabel,
  testIdPrefix = "stripe",
  basescanUrl,
}: CryptoWalletItemProps) {
  const isFrozen = wallet.status === "paused" || wallet.status === "frozen";
  const chain = "chain" in wallet ? wallet.chain : "Base";

  const guardrailLines: { label: string; value: string }[] = [];
  if (wallet.guardrails) {
    guardrailLines.push({ label: "Per-tx", value: `$${wallet.guardrails.max_per_tx_usdc}` });
    guardrailLines.push({ label: "Daily", value: `$${wallet.guardrails.daily_budget_usdc}` });
  }

  return (
    <div className="flex flex-col gap-4 min-w-[320px]" data-testid={`card-${testIdPrefix}-wallet-${wallet.id}`}>
      <CardVisual
        color={color}
        balance={wallet.balance_display}
        balanceLabel={`USDC on ${chain}`}
        last4={wallet.address.slice(-4)}
        holder={wallet.bot_name || "Unlinked Wallet"}
        holderLabel="Bot"
        frozen={isFrozen}
        status={wallet.status}
        line1={guardrailLines[0] ? `${guardrailLines[0].label}: ${guardrailLines[0].value}` : undefined}
        line2={guardrailLines[1] ? `${guardrailLines[1].label}: ${guardrailLines[1].value}` : undefined}
        bottomRightLabel="Chain"
        bottomRightValue={chain}
        brand="USDC"
      />

      <CryptoActionBar
        walletId={wallet.id}
        status={wallet.status}
        onFund={onFund}
        onFreeze={onFreeze}
        onGuardrails={onGuardrails}
        onActivity={onActivity}
        onAddAgent={!wallet.bot_id ? onAddAgent : undefined}
        onUnlinkBot={wallet.bot_id ? onUnlinkBot : undefined}
        onCopyAddress={onCopyAddress}
        onSyncBalance={onSyncBalance}
        onTransfer={wallet.status === "active" ? onTransfer : undefined}
        syncingBalance={syncingBalance}
        fundLabel={fundLabel}
        testIdPrefix={testIdPrefix}
        basescanUrl={basescanUrl}
        botName={wallet.bot_name || undefined}
      />
    </div>
  );
}
