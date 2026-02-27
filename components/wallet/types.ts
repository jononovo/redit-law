export type RailType = "rail1" | "rail2" | "rail4" | "rail5";

export type WalletStatus = "active" | "paused" | "frozen" | "pending" | "pending_setup" | "awaiting_bot";

export interface BotInfo {
  bot_id: string;
  bot_name: string;
}

export interface CryptoWalletGuardrails {
  max_per_tx_usdc: number;
  daily_budget_usdc: number;
  monthly_budget_usdc: number;
  require_approval_above: number | null;
}

export interface CardWalletGuardrails extends CryptoWalletGuardrails {
  allowlisted_merchants: string[] | null;
  blocklisted_merchants: string[] | null;
  auto_pause_on_zero: boolean;
}

export interface Rail1WalletInfo {
  id: number;
  bot_id: string;
  bot_name: string;
  address: string;
  balance_usdc: number;
  balance_display: string;
  status: string;
  guardrails: CryptoWalletGuardrails | null;
  created_at: string;
}

export interface Rail2WalletInfo {
  id: number;
  bot_id: string;
  bot_name: string;
  address: string;
  balance_usdc: number;
  balance_display: string;
  chain: string;
  status: string;
  guardrails: CardWalletGuardrails | null;
  created_at: string;
}

export type CryptoWalletInfo = Rail1WalletInfo | Rail2WalletInfo;

export interface Rail4CardInfo {
  card_id: string;
  card_name: string;
  use_case: string | null;
  status: string;
  bot_id: string | null;
  created_at: string;
  allowance: AllowanceInfo | null;
}

export interface AllowanceInfo {
  value: number;
  currency: string;
  duration: string;
  spent_cents: number;
  remaining_cents: number;
  resets_at: string;
}

export interface Rail5CardInfo {
  card_id: string;
  card_name: string;
  card_brand: string;
  card_last4: string;
  status: string;
  bot_id: string | null;
  bot_name: string | null;
  spending_limit_cents: number;
  daily_limit_cents: number;
  monthly_limit_cents: number;
  human_approval_above_cents: number;
  created_at: string;
}

export type CreditCardInfo = Rail4CardInfo | Rail5CardInfo;

export interface Rail1TransactionInfo {
  id: number;
  type: string;
  amount_usdc: number;
  amount_display: string;
  balance_after: number | null;
  balance_after_display: string | null;
  recipient_address: string | null;
  resource_url: string | null;
  tx_hash: string | null;
  status: string;
  created_at: string;
  metadata?: {
    direction?: "inbound" | "outbound";
    counterparty_address?: string;
    transfer_tier?: string;
    [key: string]: any;
  };
}

export interface Rail2TransactionInfo {
  id: number;
  type: string;
  amount_usdc: number;
  amount_display: string;
  balance_after: number | null;
  balance_after_display: string | null;
  product_locator: string | null;
  product_name: string | null;
  quantity: number;
  order_status: string | null;
  status: string;
  crossmint_order_id: string | null;
  shipping_address: Record<string, string> | null;
  tracking_info: Record<string, string> | null;
  metadata?: {
    direction?: "inbound" | "outbound";
    counterparty_address?: string;
    counterparty_wallet_id?: number;
    counterparty_rail?: string;
    tx_hash?: string;
    transfer_tier?: string;
    [key: string]: any;
  } | null;
  created_at: string;
}

export type TransactionInfo = Rail1TransactionInfo | Rail2TransactionInfo;

export interface Rail1ApprovalInfo {
  id: number;
  wallet_id: number;
  amount_usdc: number;
  amount_display: string;
  resource_url: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface Rail2ApprovalInfo {
  id: number;
  wallet_id: number;
  amount_usdc: number;
  amount_display: string;
  product_locator: string;
  product_name: string;
  shipping_address: Record<string, string> | null;
  status: string;
  expires_at: string;
  created_at: string;
  bot_name: string;
  wallet_balance_display: string;
}

export type ApprovalInfo = Rail1ApprovalInfo | Rail2ApprovalInfo;

export interface TransferDestinationWallet {
  id: number;
  rail: "privy" | "crossmint";
  address: string;
  label: string;
}

export function microUsdcToDisplay(microUsdc: number): string {
  return `$${(microUsdc / 1_000_000).toFixed(2)}`;
}

export function formatCentsToUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatAllowanceLabel(a: AllowanceInfo): string {
  const durationMap: Record<string, string> = { day: "Daily", week: "Weekly", month: "Monthly" };
  const durLabel = durationMap[a.duration] || a.duration;
  return `Allowance: $${a.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${a.currency} | ${durLabel}`;
}

export function formatResetsLabel(a: AllowanceInfo): string {
  const d = new Date(a.resets_at);
  return `Resets: ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export const CARD_COLORS: ("primary" | "blue" | "purple" | "dark")[] = ["purple", "dark", "blue", "primary"];

export const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
};
