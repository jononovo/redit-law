export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "jcb" | "diners" | "unknown";

export function detectCardBrand(number: string): CardBrand {
  const n = number.replace(/\s/g, "");
  if (!n) return "unknown";

  if (n.startsWith("4")) return "visa";

  const two = parseInt(n.slice(0, 2), 10);
  const four = parseInt(n.slice(0, 4), 10);

  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return "mastercard";

  if (n.startsWith("34") || n.startsWith("37")) return "amex";

  if (
    n.startsWith("6011") ||
    n.startsWith("65") ||
    (two >= 64 && two <= 65) ||
    (parseInt(n.slice(0, 3), 10) >= 644 && parseInt(n.slice(0, 3), 10) <= 649)
  ) return "discover";

  if (n.startsWith("35")) return "jcb";

  if (n.startsWith("30") || n.startsWith("36") || n.startsWith("38")) return "diners";

  return "unknown";
}

export const BRAND_DISPLAY_NAMES: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  jcb: "JCB",
  diners: "Diners Club",
  unknown: "Card",
};

export type ApiBrand = "visa" | "mastercard" | "amex" | "discover" | "jcb" | "diners";

export function brandToApiValue(brand: CardBrand): ApiBrand {
  if (brand === "unknown") return "visa";
  return brand;
}
