import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { submitRail4OwnerDataSchema } from "@/shared/schema";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json", message: "Request body must be valid JSON" }, { status: 400 });
    }

    const parsed = submitRail4OwnerDataSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { bot_id, missing_digits, expiry_month, expiry_year, owner_name, owner_zip } = parsed.data;

    const bot = await storage.getBotByBotId(bot_id);
    if (!bot || bot.ownerUid !== user.uid) {
      return NextResponse.json({ error: "not_found", message: "Bot not found or not owned by you" }, { status: 404 });
    }

    const rail4Card = await storage.getRail4CardByBotId(bot_id);
    if (!rail4Card) {
      return NextResponse.json(
        { error: "not_initialized", message: "Rail 4 has not been initialized for this bot. Call initialize first." },
        { status: 404 }
      );
    }

    if (rail4Card.status === "active") {
      return NextResponse.json(
        { error: "already_active", message: "Rail 4 card is already active. Delete it first to reconfigure." },
        { status: 409 }
      );
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";

    const updated = await storage.updateRail4Card(bot_id, {
      missingDigitsValue: missing_digits,
      expiryMonth: expiry_month,
      expiryYear: expiry_year,
      ownerName: owner_name,
      ownerZip: owner_zip,
      ownerIp: ip,
      status: "active",
    });

    if (!updated) {
      return NextResponse.json({ error: "update_failed", message: "Failed to save owner data" }, { status: 500 });
    }

    return NextResponse.json({
      status: "active",
      message: "Rail 4 card setup complete. Save the completed decoy file to your bot's system. Your bot can now request the missing card data at checkout time.",
    });
  } catch (error) {
    console.error("Rail 4 submit owner data error:", error);
    return NextResponse.json({ error: "Failed to submit Rail 4 owner data" }, { status: 500 });
  }
}
