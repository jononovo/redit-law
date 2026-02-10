import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { initializeRail4Schema } from "@/shared/schema";
import { generateRail4Setup } from "@/lib/rail4";

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

    const parsed = initializeRail4Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { bot_id } = parsed.data;

    const bot = await storage.getBotByBotId(bot_id);
    if (!bot || bot.ownerUid !== user.uid) {
      return NextResponse.json({ error: "not_found", message: "Bot not found or not owned by you" }, { status: 404 });
    }

    const existing = await storage.getRail4CardByBotId(bot_id);
    if (existing && existing.status === "active") {
      return NextResponse.json(
        { error: "already_active", message: "Rail 4 card is already active for this bot. Delete it first to re-initialize." },
        { status: 409 }
      );
    }

    if (existing && existing.status === "pending_setup") {
      await storage.deleteRail4Card(bot_id);
    }

    const setup = generateRail4Setup();

    await storage.createRail4Card({
      botId: bot_id,
      decoyFilename: setup.decoyFilename,
      realProfileIndex: setup.realProfileIndex,
      missingDigitPositions: setup.missingDigitPositions,
      fakeProfilesJson: JSON.stringify(setup.fakeProfiles),
      status: "pending_setup",
    });

    return NextResponse.json({
      status: "pending_setup",
      decoy_filename: setup.decoyFilename,
      real_profile_index: setup.realProfileIndex,
      missing_digit_positions: setup.missingDigitPositions,
      decoy_file_content: setup.decoyFileContent,
      message: `Fill in your real card details in Profile #${setup.realProfileIndex}, leaving positions ${setup.missingDigitPositions.join(", ")} as XXX. Do not include the expiry date. Then submit the missing digits and expiry separately.`,
    });
  } catch (error) {
    console.error("Rail 4 initialize error:", error);
    return NextResponse.json({ error: "Failed to initialize Rail 4 card setup" }, { status: 500 });
  }
}
