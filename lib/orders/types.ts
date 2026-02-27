export interface OrderInput {
  ownerUid: string;
  rail: "rail1" | "rail2" | "rail4" | "rail5";
  botId?: string | null;
  botName?: string | null;
  walletId?: number | null;
  cardId?: string | null;
  transactionId?: number | null;
  externalOrderId?: string | null;
  status?: string;
  vendor?: string | null;
  vendorDetails?: Record<string, any> | null;
  productName?: string | null;
  productImageUrl?: string | null;
  productUrl?: string | null;
  productShortDescription?: string | null;
  sku?: string | null;
  quantity?: number;
  priceCents?: number | null;
  priceCurrency?: string;
  taxesCents?: number | null;
  shippingPriceCents?: number | null;
  shippingType?: string | null;
  shippingNote?: string | null;
  shippingAddress?: Record<string, any> | null;
  trackingInfo?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}
