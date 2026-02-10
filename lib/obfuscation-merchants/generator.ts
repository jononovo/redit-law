import { FAKE_MERCHANTS, type FakeMerchant, type FakeProduct } from "./catalog";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmountInRange(minCents: number, maxCents: number): number {
  const range = maxCents - minCents;
  return minCents + Math.floor(Math.random() * (range + 1));
}

export interface ObfuscationPurchase {
  merchantName: string;
  merchantSlug: string;
  itemName: string;
  amountCents: number;
}

export function generateObfuscationPurchase(excludeSlugs?: string[]): ObfuscationPurchase {
  let availableMerchants = FAKE_MERCHANTS;
  if (excludeSlugs && excludeSlugs.length > 0) {
    const filtered = availableMerchants.filter((m) => !excludeSlugs.includes(m.slug));
    if (filtered.length > 0) {
      availableMerchants = filtered;
    }
  }

  const merchant = pickRandom(availableMerchants);
  const product = pickRandom(merchant.products);
  const amountCents = randomAmountInRange(product.minCents, product.maxCents);

  return {
    merchantName: merchant.name,
    merchantSlug: merchant.slug,
    itemName: product.name,
    amountCents,
  };
}

export function generateMultiplePurchases(count: number): ObfuscationPurchase[] {
  const purchases: ObfuscationPurchase[] = [];
  const usedSlugs: string[] = [];

  for (let i = 0; i < count; i++) {
    const purchase = generateObfuscationPurchase(usedSlugs.length < FAKE_MERCHANTS.length ? usedSlugs : undefined);
    purchases.push(purchase);
    usedSlugs.push(purchase.merchantSlug);
  }

  return purchases;
}

export function pickRandomProfileIndex(realProfileIndex: number): number {
  const fakeIndices = [1, 2, 3, 4, 5, 6].filter((i) => i !== realProfileIndex);
  return pickRandom(fakeIndices);
}
