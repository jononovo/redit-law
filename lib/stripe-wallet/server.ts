import { PrivyClient } from "@privy-io/node";
import crypto from "crypto";
import canonicalize from "canonicalize";
import { encodeFunctionData, erc20Abi } from "viem";

function getPrivyAppId(): string {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID || "";
}

function getPrivyAppSecret(): string {
  return process.env.PRIVY_APP_SECRET || "";
}

function getPrivyAuthKey(): string {
  return process.env.PRIVY_AUTHORIZATION_KEY || "";
}

let privyClient: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const appId = getPrivyAppId();
    const appSecret = getPrivyAppSecret();
    if (!appId || !appSecret) {
      throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET are required for Rail 1");
    }
    privyClient = new PrivyClient({ appId, appSecret });
  }
  return privyClient;
}

export function getAuthorizationSignature(url: string, body: object): string {
  const authKey = getPrivyAuthKey();
  if (!authKey) {
    throw new Error("PRIVY_AUTHORIZATION_KEY is required for wallet operations");
  }

  const payload = {
    version: 1,
    method: "POST",
    url,
    body,
    headers: { "privy-app-id": getPrivyAppId() },
  };

  const serializedPayload = canonicalize(payload) as string;
  const serializedPayloadBuffer = Buffer.from(serializedPayload);

  const privateKeyAsString = authKey.replace("wallet-auth:", "");
  const privateKeyAsPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyAsString}\n-----END PRIVATE KEY-----`;
  const privateKey = crypto.createPrivateKey({
    key: privateKeyAsPem,
    format: "pem",
  });

  const signature = crypto.sign(null, serializedPayloadBuffer, privateKey);
  return signature.toString("base64");
}

export async function createServerWallet(): Promise<{
  id: string;
  address: string;
  chainType: string;
}> {
  const privy = getPrivyClient();
  const wallet = await (privy as any).walletsService.create({ chain_type: "ethereum" });
  return {
    id: wallet.id,
    address: wallet.address,
    chainType: wallet.chainType,
  };
}

export async function signTypedData(
  walletId: string,
  typedData: object
): Promise<string> {
  const privy = getPrivyClient();
  const ethService = (privy as any).walletsService.ethereum();
  const result = await ethService.signTypedData(walletId, {
    typedData: typedData as any,
  });
  return result.signature;
}

const BASE_USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CAIP2 = "eip155:8453";

export async function sendUsdcTransfer(
  privyWalletId: string,
  recipientAddress: string,
  amountMicroUsdc: number
): Promise<{ hash: string }> {
  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipientAddress as `0x${string}`, BigInt(amountMicroUsdc)],
  });

  const url = `https://api.privy.io/v1/wallets/${privyWalletId}/rpc`;
  const body = {
    method: "eth_sendTransaction",
    caip2: BASE_CAIP2,
    params: {
      transaction: {
        to: BASE_USDC_CONTRACT,
        data: calldata,
        value: "0x0",
      },
    },
  };

  const appId = getPrivyAppId();
  const appSecret = getPrivyAppSecret();
  const authSignature = getAuthorizationSignature(url, body);
  const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "privy-app-id": appId,
      Authorization: `Basic ${basicAuth}`,
      "privy-authorization-signature": authSignature,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[Privy] Transfer failed:", data);
    throw new Error(data.message || data.error || "Privy transfer failed");
  }

  console.log("[Privy] Transfer sent:", { hash: data.data?.hash || data.hash });

  return { hash: data.data?.hash || data.hash };
}
