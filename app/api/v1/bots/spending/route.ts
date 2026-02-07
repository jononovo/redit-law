import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { updateSpendingPermissionsSchema } from "@/shared/schema";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const botId = searchParams.get("bot_id");
    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 });
    }

    const bot = await storage.getBotByBotId(botId);
    if (!bot || bot.ownerUid !== session.uid) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const permissions = await storage.getSpendingPermissions(botId);

    if (!permissions) {
      return NextResponse.json({
        bot_id: botId,
        approval_mode: "ask_for_everything",
        per_transaction_usd: 25.0,
        daily_usd: 50.0,
        monthly_usd: 500.0,
        ask_approval_above_usd: 10.0,
        approved_categories: [],
        blocked_categories: ["gambling", "adult_content", "cryptocurrency", "cash_advances"],
        recurring_allowed: false,
        notes: null,
      });
    }

    return NextResponse.json({
      bot_id: botId,
      approval_mode: permissions.approvalMode,
      per_transaction_usd: permissions.perTransactionCents / 100,
      daily_usd: permissions.dailyCents / 100,
      monthly_usd: permissions.monthlyCents / 100,
      ask_approval_above_usd: permissions.askApprovalAboveCents / 100,
      approved_categories: permissions.approvedCategories,
      blocked_categories: permissions.blockedCategories.length > 0
        ? permissions.blockedCategories
        : ["gambling", "adult_content", "cryptocurrency", "cash_advances"],
      recurring_allowed: permissions.recurringAllowed,
      notes: permissions.notes,
    });
  } catch (error: any) {
    console.error("Get spending permissions failed:", error?.message || error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const botId = body.bot_id;
    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 });
    }

    const bot = await storage.getBotByBotId(botId);
    if (!bot || bot.ownerUid !== session.uid) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const parsed = updateSpendingPermissionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, any> = {};

    if (data.approval_mode !== undefined) updateData.approvalMode = data.approval_mode;
    if (data.per_transaction_usd !== undefined) updateData.perTransactionCents = Math.round(data.per_transaction_usd * 100);
    if (data.daily_usd !== undefined) updateData.dailyCents = Math.round(data.daily_usd * 100);
    if (data.monthly_usd !== undefined) updateData.monthlyCents = Math.round(data.monthly_usd * 100);
    if (data.ask_approval_above_usd !== undefined) updateData.askApprovalAboveCents = Math.round(data.ask_approval_above_usd * 100);
    if (data.approved_categories !== undefined) updateData.approvedCategories = data.approved_categories;
    if (data.blocked_categories !== undefined) updateData.blockedCategories = data.blocked_categories;
    if (data.recurring_allowed !== undefined) updateData.recurringAllowed = data.recurring_allowed;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await storage.upsertSpendingPermissions(botId, updateData);

    return NextResponse.json({
      bot_id: botId,
      approval_mode: updated.approvalMode,
      per_transaction_usd: updated.perTransactionCents / 100,
      daily_usd: updated.dailyCents / 100,
      monthly_usd: updated.monthlyCents / 100,
      ask_approval_above_usd: updated.askApprovalAboveCents / 100,
      approved_categories: updated.approvedCategories,
      blocked_categories: updated.blockedCategories,
      recurring_allowed: updated.recurringAllowed,
      notes: updated.notes,
    });
  } catch (error: any) {
    console.error("Update spending permissions failed:", error?.message || error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
