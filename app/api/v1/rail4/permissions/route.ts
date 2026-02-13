import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { profilePermissionSchema } from "@/shared/schema";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const botId = request.nextUrl.searchParams.get("bot_id");
  if (!botId) {
    return NextResponse.json({ error: "missing_bot_id" }, { status: 400 });
  }

  const bot = await storage.getBotByBotId(botId);
  if (!bot || bot.ownerUid !== user.uid) {
    return NextResponse.json({ error: "bot_not_found" }, { status: 404 });
  }

  const card = await storage.getRail4CardByBotId(botId);
  if (!card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }

  const allPerms = card.profilePermissions ? JSON.parse(card.profilePermissions) : [];
  const realPerm = allPerms.find((p: { profile_index: number }) => p.profile_index === card.realProfileIndex);

  return NextResponse.json({
    permissions: realPerm || {
      profile_index: card.realProfileIndex,
      allowance_duration: "month",
      allowance_value: 500,
      confirmation_exempt_limit: 50,
      human_permission_required: "above_exempt",
    },
  });
}

export async function PATCH(request: NextRequest) {
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

  const { bot_id, permissions } = body;
  if (!bot_id || !permissions) {
    return NextResponse.json({ error: "missing_fields", message: "bot_id and permissions are required." }, { status: 400 });
  }

  const parsed = profilePermissionSchema.safeParse(permissions);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const bot = await storage.getBotByBotId(bot_id);
  if (!bot || bot.ownerUid !== user.uid) {
    return NextResponse.json({ error: "bot_not_found" }, { status: 404 });
  }

  const card = await storage.getRail4CardByBotId(bot_id);
  if (!card) {
    return NextResponse.json({ error: "card_not_found", message: "No self-hosted card configured for this bot." }, { status: 404 });
  }

  if (parsed.data.profile_index !== card.realProfileIndex) {
    return NextResponse.json({ error: "wrong_profile", message: "You can only update permissions for the real profile." }, { status: 400 });
  }

  const existingPerms = card.profilePermissions ? JSON.parse(card.profilePermissions) : [];
  const updatedPerms = existingPerms.map((p: { profile_index: number }) =>
    p.profile_index === card.realProfileIndex ? parsed.data : p
  );

  const hasRealProfile = updatedPerms.some((p: { profile_index: number }) => p.profile_index === card.realProfileIndex);
  if (!hasRealProfile) {
    updatedPerms.push(parsed.data);
  }

  await storage.updateRail4Card(bot_id, {
    profilePermissions: JSON.stringify(updatedPerms),
  } as any);

  return NextResponse.json({
    updated: true,
    permissions: parsed.data,
  });
}
