export interface CardData {
  number: string;
  cvv: string;
  exp_month: number;
  exp_year: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface EncryptionResult {
  keyHex: string;
  ivHex: string;
  tagHex: string;
  ciphertextBytes: Uint8Array;
}

export function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function encryptCardDetails(cardData: CardData): Promise<EncryptionResult> {
  const cardJson = JSON.stringify(cardData);

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(cardJson)
  );

  const rawKey = await crypto.subtle.exportKey("raw", key);
  const ciphertextBytes = new Uint8Array(ciphertext);
  const tagBytes = ciphertextBytes.slice(-16);

  const keyHex = bufToHex(rawKey);
  const ivHex = bufToHex(iv);
  const tagHex = bufToHex(tagBytes);

  return { keyHex, ivHex, tagHex, ciphertextBytes };
}

export function buildEncryptedCardFile(ciphertextBytes: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...ciphertextBytes));
  return `# CreditClaw Encrypted Card\n\nThis file contains your encrypted card details for Rail 5 sub-agent checkout.\nDo not edit or share this file. Place it in your bot's OpenClaw workspace.\n\n\`\`\`\n${b64}\n\`\`\`\n`;
}

export function downloadEncryptedFile(mdContent: string, filename: string): void {
  const blob = new Blob([mdContent], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
