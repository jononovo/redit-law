import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { rail4SubmitOwnerDataSchema } from "@/shared/schema";
import { initializeState } from "@/lib/obfuscation-engine/state-machine";

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = rail4SubmitOwnerDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { bot_id, missing_digits, expiry_month, expiry_year, owner_name, owner_zip, profile_permissions } = parsed.data;

  const bot = await storage.getBotByBotId(bot_id);
  if (!bot || bot.ownerUid !== user.uid) {
    return NextResponse.json({ error: "bot_not_found" }, { status: 404 });
  }

  const card = await storage.getRail4CardByBotId(bot_id);
  if (!card) {
    return NextResponse.json({ error: "not_initialized", message: "Run initialize first." }, { status: 400 });
  }
  if (card.status === "active") {
    return NextResponse.json({ error: "already_active" }, { status: 409 });
  }

  const ownerIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  const updateData: Record<string, unknown> = {
    missingDigitsValue: missing_digits,
    expiryMonth: expiry_month,
    expiryYear: expiry_year,
    ownerName: owner_name,
    ownerZip: owner_zip,
    ownerIp: ownerIp,
    status: "active",
  };

  if (profile_permissions) {
    const existingPerms = card.profilePermissions ? JSON.parse(card.profilePermissions) : [];
    const updatedPerms = existingPerms.map((p: { profile_index: number }) =>
      p.profile_index === card.realProfileIndex ? { ...profile_permissions, profile_index: card.realProfileIndex } : p
    );
    updateData.profilePermissions = JSON.stringify(updatedPerms);
  }

  await storage.updateRail4Card(bot_id, updateData as any);

  initializeState(bot_id).catch(err => {
    console.error("Failed to initialize obfuscation state:", err);
  });

  return NextResponse.json({
    status: "active",
    message: "Self-hosted card is now active. The obfuscation engine will begin generating decoy transactions.",
  });
}
