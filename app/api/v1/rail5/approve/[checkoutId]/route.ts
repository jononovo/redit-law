import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { createHmac } from "crypto";

const CONFIRMATION_SECRET = process.env.CONFIRMATION_HMAC_SECRET || process.env.CRON_SECRET;
if (!CONFIRMATION_SECRET) {
  console.error("CRITICAL: CONFIRMATION_HMAC_SECRET or CRON_SECRET must be set for Rail 5 approval link security.");
}
const APPROVAL_TTL_MS = 15 * 60 * 1000;

function verifyHmac(checkoutId: string, token: string): boolean {
  if (!CONFIRMATION_SECRET) return false;
  const expected = createHmac("sha256", CONFIRMATION_SECRET)
    .update(`rail5:${checkoutId}`)
    .digest("hex");
  return token === expected;
}

export function generateRail5ApprovalToken(checkoutId: string): string {
  if (!CONFIRMATION_SECRET) throw new Error("CONFIRMATION_HMAC_SECRET not configured");
  return createHmac("sha256", CONFIRMATION_SECRET)
    .update(`rail5:${checkoutId}`)
    .digest("hex");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ checkoutId: string }> }
) {
  const { checkoutId } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token || !verifyHmac(checkoutId, token)) {
    return new NextResponse(renderPage("Invalid Link", "This approval link is invalid or has been tampered with."), {
      status: 403,
      headers: { "Content-Type": "text/html" },
    });
  }

  const checkout = await storage.getRail5CheckoutById(checkoutId);
  if (!checkout) {
    return new NextResponse(renderPage("Not Found", "This approval request was not found."), {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (checkout.status !== "pending_approval") {
    const statusMsg = checkout.status === "approved" ? "This purchase was already approved."
      : checkout.status === "completed" ? "This purchase was already completed."
      : "This purchase was already decided.";
    return new NextResponse(renderPage("Already Decided", statusMsg), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  const elapsed = Date.now() - new Date(checkout.createdAt).getTime();
  if (elapsed > APPROVAL_TTL_MS) {
    await storage.updateRail5Checkout(checkoutId, { status: "expired" });
    return new NextResponse(renderPage("Expired", "This approval request has expired. The purchase was not completed."), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  const bot = await storage.getBotByBotId(checkout.botId);
  const botName = bot?.botName || checkout.botId;

  return new NextResponse(renderApprovalPage(checkout, botName, token), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ checkoutId: string }> }
) {
  const { checkoutId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { action, token } = body;
  if (!token || !verifyHmac(checkoutId, token)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 403 });
  }

  if (!action || !["approve", "deny"].includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const checkout = await storage.getRail5CheckoutById(checkoutId);
  if (!checkout) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (checkout.status !== "pending_approval") {
    return NextResponse.json({ error: "already_decided", status: checkout.status }, { status: 409 });
  }

  const elapsed = Date.now() - new Date(checkout.createdAt).getTime();
  if (elapsed > APPROVAL_TTL_MS) {
    await storage.updateRail5Checkout(checkoutId, { status: "expired" });
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (action === "approve") {
    await storage.updateRail5Checkout(checkoutId, { status: "approved", confirmedAt: new Date() });

    const bot = await storage.getBotByBotId(checkout.botId);
    if (bot) {
      const { fireWebhook } = await import("@/lib/webhooks");
      fireWebhook(bot, "rail5.checkout.completed" as any, {
        checkout_id: checkoutId,
        status: "approved",
        merchant: checkout.merchantName,
        item: checkout.itemName,
        amount_cents: checkout.amountCents,
        message: "Owner approved. Proceed with key retrieval.",
      }).catch(() => {});
    }

    return NextResponse.json({
      status: "approved",
      message: "Purchase approved. The bot can now proceed with checkout.",
    });
  } else {
    await storage.updateRail5Checkout(checkoutId, { status: "denied", confirmedAt: new Date() });

    const bot = await storage.getBotByBotId(checkout.botId);
    if (bot) {
      const { fireWebhook } = await import("@/lib/webhooks");
      fireWebhook(bot, "rail5.checkout.failed" as any, {
        checkout_id: checkoutId,
        status: "denied",
        merchant: checkout.merchantName,
        item: checkout.itemName,
        amount_cents: checkout.amountCents,
        reason: "Owner denied the purchase",
      }).catch(() => {});
    }

    return NextResponse.json({
      status: "denied",
      message: "Purchase denied. The bot has been notified.",
    });
  }
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — CreditClaw</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: #f8f6f4; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .card { background: white; border-radius: 1rem; padding: 2rem; max-width: 480px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; }
    h1 { font-size: 1.5rem; color: #1a1a2e; margin-bottom: 0.75rem; }
    p { color: #666; line-height: 1.6; }
    .logo { font-size: 2rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🦞</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

function renderApprovalPage(checkout: any, botName: string, token: string): string {
  const amountUsd = (checkout.amountCents / 100).toFixed(2);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approve Purchase — CreditClaw</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: #f8f6f4; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .card { background: white; border-radius: 1rem; padding: 2rem; max-width: 480px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .logo { text-align: center; font-size: 2rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; color: #1a1a2e; margin-bottom: 1rem; text-align: center; }
    .badge { display: inline-block; background: #dbeafe; color: #1e40af; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 999px; margin-bottom: 1rem; }
    .details { background: #f8f6f4; border-radius: 0.75rem; padding: 1rem; margin-bottom: 1.5rem; }
    .row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e8e4e0; }
    .row:last-child { border-bottom: none; }
    .label { color: #888; font-size: 0.875rem; }
    .value { color: #1a1a2e; font-weight: 600; font-size: 0.875rem; }
    .amount { font-size: 1.5rem; text-align: center; color: #1a1a2e; font-weight: 700; margin: 1rem 0; }
    .buttons { display: flex; gap: 0.75rem; }
    button { flex: 1; padding: 0.875rem; border: none; border-radius: 0.75rem; font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    button:hover { opacity: 0.85; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .approve { background: #22c55e; color: white; }
    .deny { background: #ef4444; color: white; }
    .result { text-align: center; padding: 1rem; margin-top: 1rem; border-radius: 0.75rem; display: none; }
    .result.success { background: #f0fdf4; color: #166534; display: block; }
    .result.error { background: #fef2f2; color: #991b1b; display: block; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🦞</div>
    <h1>Sub-Agent Card Approval</h1>
    <div style="text-align: center;"><span class="badge">Rail 5 • Encrypted Card</span></div>
    <div class="amount">$${amountUsd}</div>
    <div class="details">
      <div class="row"><span class="label">Bot</span><span class="value">${botName}</span></div>
      <div class="row"><span class="label">Merchant</span><span class="value">${checkout.merchantName}</span></div>
      <div class="row"><span class="label">Item</span><span class="value">${checkout.itemName}</span></div>
      ${checkout.category ? `<div class="row"><span class="label">Category</span><span class="value">${checkout.category}</span></div>` : ""}
    </div>
    <p style="font-size: 0.8rem; color: #888; text-align: center; margin-bottom: 1rem;">
      Approving will allow the bot to spawn a sub-agent that decrypts and uses the card. The sub-agent is deleted after checkout.
    </p>
    <div class="buttons" id="buttons">
      <button class="deny" onclick="decide('deny')">Deny</button>
      <button class="approve" onclick="decide('approve')">Approve</button>
    </div>
    <div id="result"></div>
  </div>
  <script>
    async function decide(action) {
      const buttons = document.querySelectorAll('button');
      buttons.forEach(b => b.disabled = true);
      try {
        const res = await fetch(window.location.pathname, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, token: '${token}' }),
        });
        const data = await res.json();
        const el = document.getElementById('result');
        document.getElementById('buttons').style.display = 'none';
        if (res.ok) {
          el.className = 'result success';
          el.textContent = data.message;
        } else {
          el.className = 'result error';
          el.textContent = data.error === 'expired' ? 'This request has expired.' : (data.message || data.error);
        }
      } catch (e) {
        const el = document.getElementById('result');
        el.className = 'result error';
        el.textContent = 'Something went wrong. Please try again.';
        buttons.forEach(b => b.disabled = false);
      }
    }
  </script>
</body>
</html>`;
}
