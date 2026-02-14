const CROSSMINT_API_BASE = process.env.CROSSMINT_ENV === "staging"
  ? "https://staging.crossmint.com/api/2022-06-09"
  : "https://www.crossmint.com/api/2022-06-09";

function getServerApiKey(): string {
  const key = process.env.CROSSMINT_SERVER_API_KEY;
  if (!key) throw new Error("CROSSMINT_SERVER_API_KEY is required for Rail 2");
  return key;
}

async function crossmintFetch(path: string, options: RequestInit = {}): Promise<Response> {
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
      type: "evm-smart-wallet",
      config: {
        adminSigner: { type: "evm-fireblocks-custodial" },
      },
      linkedUser: `userId:${ownerUid}`,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[CrossMint] Wallet creation failed:", data);
    throw new Error(data.message || data.error || "Failed to create CrossMint wallet");
  }

  console.log("[CrossMint] Wallet created:", { type: data.type, address: data.address });

  return {
    walletId: data.locator || data.id || data.address,
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

  const usdcBalance = data?.balances?.find(
    (b: { token: string; chain: string }) => b.token === "usdc" && b.chain === "base"
  );

  return usdcBalance ? Math.round(parseFloat(usdcBalance.balance) * 1_000_000) : 0;
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
