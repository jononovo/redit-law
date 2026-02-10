export interface FakeMerchant {
  name: string;
  slug: string;
  category: string;
  products: FakeProduct[];
}

export interface FakeProduct {
  name: string;
  minCents: number;
  maxCents: number;
}

export const FAKE_MERCHANTS: FakeMerchant[] = [
  {
    name: "The Real Etsy Checkout",
    slug: "real-etsy-checkout",
    category: "marketplace",
    products: [
      { name: "Handmade Ceramic Mug", minCents: 1200, maxCents: 3500 },
      { name: "Custom Embroidered Patch", minCents: 450, maxCents: 1800 },
      { name: "Vintage Brass Candleholder", minCents: 2200, maxCents: 5500 },
      { name: "Personalized Leather Keychain", minCents: 800, maxCents: 2400 },
    ],
  },
  {
    name: "Amazon Verified Merchant",
    slug: "amazon-verified",
    category: "retail",
    products: [
      { name: "Wireless Bluetooth Earbuds", minCents: 1999, maxCents: 4999 },
      { name: "USB-C Charging Cable 3-Pack", minCents: 699, maxCents: 1499 },
      { name: "Stainless Steel Water Bottle", minCents: 1200, maxCents: 2899 },
      { name: "LED Desk Lamp with USB Port", minCents: 2499, maxCents: 4499 },
    ],
  },
  {
    name: "Official PayPal Purchase",
    slug: "official-paypal",
    category: "payments",
    products: [
      { name: "Digital Service Credit", minCents: 500, maxCents: 2500 },
      { name: "Subscription Renewal", minCents: 999, maxCents: 2999 },
      { name: "Platform Fee Payment", minCents: 200, maxCents: 1500 },
    ],
  },
  {
    name: "Stripe Direct Payments",
    slug: "stripe-direct",
    category: "payments",
    products: [
      { name: "API Usage Credit", minCents: 500, maxCents: 5000 },
      { name: "Developer Plan Monthly", minCents: 2000, maxCents: 4900 },
      { name: "Webhook Relay Service", minCents: 300, maxCents: 1200 },
    ],
  },
  {
    name: "CloudServe Pro",
    slug: "cloudserve-pro",
    category: "saas",
    products: [
      { name: "Compute Instance (Hourly)", minCents: 150, maxCents: 800 },
      { name: "Storage Expansion 50GB", minCents: 499, maxCents: 1499 },
      { name: "CDN Bandwidth Pack", minCents: 999, maxCents: 3999 },
      { name: "SSL Certificate Renewal", minCents: 799, maxCents: 2499 },
    ],
  },
  {
    name: "Verified Google Services",
    slug: "verified-google",
    category: "saas",
    products: [
      { name: "Workspace Seat License", minCents: 600, maxCents: 1800 },
      { name: "Cloud API Credits", minCents: 1000, maxCents: 5000 },
      { name: "Domain Registration", minCents: 1200, maxCents: 3500 },
    ],
  },
  {
    name: "SpicyThai Kitchen",
    slug: "spicythai-kitchen",
    category: "food",
    products: [
      { name: "Spicy Coconut PadThai Dish", minCents: 1299, maxCents: 1899 },
      { name: "Green Curry Bowl", minCents: 1499, maxCents: 2199 },
      { name: "Mango Sticky Rice", minCents: 699, maxCents: 999 },
      { name: "Tom Yum Soup Large", minCents: 899, maxCents: 1599 },
    ],
  },
  {
    name: "DigitalOcean Marketplace",
    slug: "digitalocean-market",
    category: "saas",
    products: [
      { name: "Droplet Credit Pack", minCents: 500, maxCents: 2500 },
      { name: "Managed Database Addon", minCents: 1500, maxCents: 4900 },
      { name: "Load Balancer Monthly", minCents: 1000, maxCents: 2000 },
    ],
  },
  {
    name: "Authentic Shopify Store",
    slug: "authentic-shopify",
    category: "marketplace",
    products: [
      { name: "Organic Cotton T-Shirt", minCents: 2499, maxCents: 4999 },
      { name: "Bamboo Phone Case", minCents: 1299, maxCents: 2499 },
      { name: "Eco-Friendly Tote Bag", minCents: 1899, maxCents: 3499 },
    ],
  },
  {
    name: "Norton Security Direct",
    slug: "norton-security",
    category: "software",
    products: [
      { name: "Antivirus Annual License", minCents: 2999, maxCents: 5999 },
      { name: "VPN Monthly Subscription", minCents: 499, maxCents: 1299 },
      { name: "Password Manager Pro", minCents: 399, maxCents: 999 },
    ],
  },
  {
    name: "Adobe Creative Hub",
    slug: "adobe-creative",
    category: "software",
    products: [
      { name: "Stock Photo Pack (10)", minCents: 2999, maxCents: 4999 },
      { name: "Font License Extended", minCents: 1499, maxCents: 3999 },
      { name: "Cloud Storage Upgrade", minCents: 999, maxCents: 2499 },
    ],
  },
  {
    name: "FreshMart Grocery",
    slug: "freshmart-grocery",
    category: "food",
    products: [
      { name: "Organic Produce Box", minCents: 2499, maxCents: 4599 },
      { name: "Artisan Bread Loaf", minCents: 599, maxCents: 899 },
      { name: "Cold-Pressed Juice 6-Pack", minCents: 1899, maxCents: 3299 },
      { name: "Free-Range Eggs Dozen", minCents: 499, maxCents: 799 },
    ],
  },
];

export function getMerchantBySlug(slug: string): FakeMerchant | undefined {
  return FAKE_MERCHANTS.find((m) => m.slug === slug);
}

export function getAllMerchantSlugs(): string[] {
  return FAKE_MERCHANTS.map((m) => m.slug);
}
