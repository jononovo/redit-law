import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { rail4InitializeSchema } from "@/shared/schema";
import { generateRail4Setup } from "@/lib/rail4";

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

  const parsed = rail4InitializeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { bot_id } = parsed.data;

  const bot = await storage.getBotByBotId(bot_id);
  if (!bot || bot.ownerUid !== user.uid) {
    return NextResponse.json({ error: "bot_not_found" }, { status: 404 });
  }

  const existing = await storage.getRail4CardByBotId(bot_id);
  if (existing?.status === "active") {
    return NextResponse.json({ error: "already_active", message: "Rail 4 is already active for this bot. Delete it first to reconfigure." }, { status: 409 });
  }

  if (existing?.status === "pending_setup") {
    await storage.deleteRail4Card(bot_id);
  }

  const setup = generateRail4Setup();

  const card = await storage.createRail4Card({
    botId: bot_id,
    decoyFilename: setup.decoyFilename,
    realProfileIndex: setup.realProfileIndex,
    missingDigitPositions: setup.missingDigitPositions,
    missingDigitsValue: "000",
    status: "pending_setup",
    fakeProfilesJson: JSON.stringify(setup.fakeProfiles),
    profilePermissions: JSON.stringify(setup.profilePermissions),
  });

  return NextResponse.json({
    bot_id,
    decoy_filename: setup.decoyFilename,
    real_profile_index: setup.realProfileIndex,
    missing_digit_positions: setup.missingDigitPositions,
    decoy_file_content: setup.decoyFileContent,
    instructions: `Download this file as "${setup.decoyFilename}". Fill in your real card details for Profile #${setup.realProfileIndex}. Leave the 3 digits at positions ${setup.missingDigitPositions.map(p => p + 1).join(", ")} as "xxx". Then submit your missing digits and expiry via the next step.`,
  });
}
