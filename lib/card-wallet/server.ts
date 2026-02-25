const CROSSMINT_API_BASE = process.env.CROSSMINT_ENV === "staging"
  ? "https://staging.crossmint.com/api/2025-06-09"
  : "https://www.crossmint.com/api/2025-06-09";

export function getServerApiKey(): string {
  const key = process.env.CROSSMINT_SERVER_API_KEY;
  if (!key) throw new Error("CROSSMINT_SERVER_API_KEY is required for Rail 2");
  return key;
}

export async function crossmintFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${CROSSMINT_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "X-API-KEY": getServerApiKey(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return response;
}

export async function createSmartWallet(ownerUid: string): Promise<{
  walletId: string;
  address: string;
  type: string;
}> {
  const response = await crossmintFetch("/wallets", {
    method: "POST",
    body: JSON.stringify({
      chainType: "evm",
      type: "smart",
      config: {
        adminSigner: { type: "evm-fireblocks-custodial" },
      },
      owner: `userId:${ownerUid}`,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[CrossMint] Wallet creation failed:", data);
    throw new Error(data.message || data.error || "Failed to create CrossMint wallet");
  }

  console.log("[CrossMint] Wallet created:", { type: data.type, address: data.address, chainType: data.chainType });

  return {
    walletId: data.config?.adminSigner?.locator || data.locator || data.id || data.address,
    address: data.address,
    type: data.type,
  };
}

export async function getWalletBalance(walletAddress: string): Promise<number> {
  const locator = `evm-smart-wallet:${walletAddress}`;
  const response = await crossmintFetch(
    `/wallets/${encodeURIComponent(locator)}/balances?tokens=usdc&chains=base`
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("[CrossMint] Balance query failed:", data);
    throw new Error(data.message || "Failed to query wallet balance");
  }

  const balances = Array.isArray(data) ? data : data?.balances || [];

  const usdcEntry = balances.find(
    (b: { symbol?: string; token?: string }) =>
      (b.symbol && b.symbol.toUpperCase() === "USDC") ||
      (b.token && b.token === "usdc")
  );

  if (!usdcEntry) return 0;

  const baseChain = usdcEntry.chains?.base;
  if (baseChain?.rawAmount) {
    return Number(baseChain.rawAmount);
  }

  const amount = baseChain?.amount || usdcEntry.amount || usdcEntry.balance;
  return amount ? Math.round(parseFloat(String(amount)) * 1_000_000) : 0;
}

export async function sendUsdcTransfer(
  walletAddress: string,
  recipientAddress: string,
  amountMicroUsdc: number
): Promise<{ transferId: string; txHash: string | null; status: string }> {
  const locator = `evm-smart-wallet:${walletAddress}`;
  const humanAmount = (amountMicroUsdc / 1_000_000).toFixed(6);

  const response = await crossmintFetch(
    `/wallets/${encodeURIComponent(locator)}/tokens/base:usdc/transfers`,
    {
      method: "POST",
      body: JSON.stringify({
        to: recipientAddress,
        amount: humanAmount,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("[CrossMint] Transfer failed:", data);
    throw new Error(data.message || data.error || "CrossMint transfer failed");
  }

  console.log("[CrossMint] Transfer initiated:", {
    id: data.id,
    status: data.status,
    txHash: data.onChain?.txId || null,
  });

  return {
    transferId: data.id || data.actionId || "unknown",
    txHash: data.onChain?.txId || data.txHash || null,
    status: data.status || "pending",
  };
}

export function formatUsdc(microUsdc: number): string {
  return `$${(microUsdc / 1_000_000).toFixed(2)}`;
}

export function usdToMicroUsdc(usd: number): number {
  return Math.round(usd * 1_000_000);
}

export function microUsdcToUsd(microUsdc: number): number {
  return microUsdc / 1_000_000;
}
