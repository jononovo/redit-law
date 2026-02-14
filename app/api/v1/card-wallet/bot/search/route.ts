import { NextRequest, NextResponse } from "next/server";
import { authenticateBot } from "@/lib/bot-auth";
import { crossmintProductSearchSchema } from "@/shared/schema";

const CROSSMINT_API_BASE = "https://www.crossmint.com/api/unstable/ws/search";

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = crossmintProductSearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { product_url } = parsed.data;

    const apiKey = process.env.CROSSMINT_SERVER_API_KEY;
    if (!apiKey) {
      console.error("CROSSMINT_SERVER_API_KEY not configured");
      return NextResponse.json(
        { error: "Search service not configured" },
        { status: 503 },
      );
    }

    const res = await fetch(CROSSMINT_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ url: product_url }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      console.error(
        `CrossMint WS Search failed: ${res.status} ${errorText}`,
      );

      if (res.status === 404) {
        return NextResponse.json(
          {
            error: "product_not_found",
            message:
              "Could not find product variants. Ensure the URL is a valid Shopify product page.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          error: "search_failed",
          message:
            "Product search is temporarily unavailable. This API is in beta — please try again later.",
        },
        { status: 502 },
      );
    }

    const data = await res.json();

    const rawVariants = Array.isArray(data)
      ? data
      : Array.isArray(data.variants)
        ? data.variants
        : [];

    const variants = rawVariants
      .map((v: Record<string, unknown>) => ({
        variant_id: String(v.variantId || v.variant_id || v.id || ""),
        title: String(v.title || v.name || "Unknown"),
        price: v.price != null ? Number(v.price) : null,
        currency: String(v.currency || "USD"),
        available: Boolean(v.available ?? v.in_stock ?? true),
        options: (v.options || v.attributes || {}) as Record<string, unknown>,
      }))
      .filter(
        (v: { variant_id: string }) => v.variant_id && v.variant_id !== "",
      );

    if (variants.length === 0) {
      return NextResponse.json({
        product_url,
        product_name:
          data.title || data.name || data.product?.title || null,
        variants: [],
        warning:
          "No usable variants found. The product may be out of stock or the URL format may not be supported.",
      });
    }

    return NextResponse.json({
      product_url,
      product_name: data.title || data.name || data.product?.title || null,
      variants,
      locator_format:
        "shopify:{product_url}:{variant_id} — use this as merchant='shopify' and product_id='{product_url}:{variant_id}' in the purchase endpoint",
    });
  } catch (error) {
    console.error("POST /api/v1/card-wallet/bot/search error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const bot = await authenticateBot(request);
  if (!bot) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 },
    );
  }
  return handler(request);
}
