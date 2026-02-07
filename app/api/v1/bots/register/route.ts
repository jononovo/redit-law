import { NextRequest, NextResponse } from "next/server";
import { registerBotRequestSchema } from "@/shared/schema";
import { storage } from "@/server/storage";
import { generateBotId, generateApiKey, generateClaimToken, hashApiKey, getApiKeyPrefix } from "@/lib/crypto";
import { sendOwnerRegistrationEmail } from "@/lib/email";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many registrations. Try again later.", retry_after_seconds: 3600 },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "invalid_json", message: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const parsed = registerBotRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { bot_name, owner_email, description, callback_url } = parsed.data;

    const isDuplicate = await storage.checkDuplicateRegistration(bot_name, owner_email);
    if (isDuplicate) {
      return NextResponse.json(
        { error: "duplicate_registration", message: `A bot named "${bot_name}" is already registered with this email.` },
        { status: 409 }
      );
    }

    const botId = generateBotId();
    const apiKey = generateApiKey();
    const claimToken = generateClaimToken();
    const apiKeyHash = await hashApiKey(apiKey);
    const apiKeyPrefix = getApiKeyPrefix(apiKey);

    await storage.createBot({
      botId,
      botName: bot_name,
      description: description || null,
      ownerEmail: owner_email,
      apiKeyHash,
      apiKeyPrefix,
      claimToken,
      walletStatus: "pending",
      callbackUrl: callback_url || null,
      claimedAt: null,
    });

    sendOwnerRegistrationEmail({
      ownerEmail: owner_email,
      botName: bot_name,
      claimToken,
      description,
    }).catch((err) => {
      console.error("Failed to send owner email:", err);
    });

    return NextResponse.json(
      {
        bot_id: botId,
        api_key: apiKey,
        claim_token: claimToken,
        status: "pending_owner_verification",
        owner_verification_url: `https://creditclaw.com/claim?token=${claimToken}`,
        important: "Save your api_key now — it cannot be retrieved later. Give the claim_token to your human so they can activate your wallet.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Bot registration failed:", error?.message || error);
    return NextResponse.json(
      { error: "internal_error", message: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
