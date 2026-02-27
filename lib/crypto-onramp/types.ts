export type OnrampProvider = "stripe" | "crossmint";

export interface WalletTarget {
  address: string;
  rail: "rail1" | "rail2";
  walletId: number;
  ownerUid: string;
}

export interface OnrampSessionResult {
  provider: OnrampProvider;
  clientSecret: string;
  sessionId: string;
  redirectUrl: string | null;
}

export interface OnrampWebhookEvent {
  provider: OnrampProvider;
  walletAddress: string;
  amountUsdc: number;
  sessionId: string;
  metadata?: Record<string, unknown>;
}
