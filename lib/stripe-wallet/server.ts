import { PrivyClient } from "@privy-io/node";
import crypto from "crypto";
import canonicalize from "canonicalize";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || "";
const PRIVY_AUTHORIZATION_KEY = process.env.PRIVY_AUTHORIZATION_KEY || "";

let privyClient: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
      throw new Error("NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET are required for Rail 1");
    }
    privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  }
  return privyClient;
}

export function getAuthorizationSignature(url: string, body: object): string {
  if (!PRIVY_AUTHORIZATION_KEY) {
    throw new Error("PRIVY_AUTHORIZATION_KEY is required for wallet operations");
  }

  const payload = {
    version: 1,
    method: "POST",
    url,
    body,
    headers: { "privy-app-id": PRIVY_APP_ID },
  };

  const serializedPayload = canonicalize(payload) as string;
  const serializedPayloadBuffer = Buffer.from(serializedPayload);

  const privateKeyAsString = PRIVY_AUTHORIZATION_KEY.replace("wallet-auth:", "");
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
  const wallet = await privy.walletApi.create({ chainType: "ethereum" });
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
  const { signature } = await privy.walletApi.ethereum.signTypedData({
    walletId,
    typedData: typedData as any,
  });
  return signature;
}
