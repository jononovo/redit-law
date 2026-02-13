import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { createHmac } from "crypto";

const CONFIRMATION_SECRET = process.env.CONFIRMATION_HMAC_SECRET || process.env.CRON_SECRET;
if (!CONFIRMATION_SECRET) {
  console.error("CRITICAL: CONFIRMATION_HMAC_SECRET or CRON_SECRET must be set for approval link security.");
}
const CONFIRMATION_TTL_MS = 15 * 60 * 1000;

function verifyHmac(confirmationId: string, token: string): boolean {
  if (!CONFIRMATION_SECRET) return false;
  const expected = createHmac("sha256", CONFIRMATION_SECRET)
    .update(confirmationId)
    .digest("hex");
  return token === expected;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ confirmationId: string }> }
) {
  const { confirmationId } = await params;

  const token = request.nextUrl.searchParams.get("token");
  if (!token || !verifyHmac(confirmationId, token)) {
    return new NextResponse(renderPage("Invalid Link", "This approval link is invalid or has been tampered with.", null, null), {
      status: 403,
      headers: { "Content-Type": "text/html" },
    });
  }

  const conf = await storage.getCheckoutConfirmation(confirmationId);
  if (!conf) {
    return new NextResponse(renderPage("Not Found", "This approval request was not found.", null, null), {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (conf.status !== "pending") {
    const statusMsg = conf.status === "approved" ? "This purchase was already approved." : "This purchase was already denied.";
    return new NextResponse(renderPage("Already Decided", statusMsg, null, null), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (conf.expiresAt && new Date() > conf.expiresAt) {
    await storage.updateCheckoutConfirmationStatus(confirmationId, "expired");
    return new NextResponse(renderPage("Expired", "This approval request has expired. The purchase was not completed.", null, null), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  const bot = await storage.getBotByBotId(conf.botId);
  const botName = bot?.botName || conf.botId;

  return new NextResponse(renderApprovalPage(conf, botName, token), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ confirmationId: string }> }
) {
  const { confirmationId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { action, token } = body;
  if (!token || !verifyHmac(confirmationId, token)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 403 });
  }

  if (!action || !["approve", "deny"].includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const conf = await storage.getCheckoutConfirmation(confirmationId);
  if (!conf) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (conf.status !== "pending") {
    return NextResponse.json({ error: "already_decided", status: conf.status }, { status: 409 });
  }

  if (conf.expiresAt && new Date() > conf.expiresAt) {
    await storage.updateCheckoutConfirmationStatus(confirmationId, "expired");
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (action === "approve") {
    return handleApproval(conf);
  } else {
    return handleDenial(conf);
  }
}

async function handleApproval(conf: any) {
  const bot = await storage.getBotByBotId(conf.botId);
  if (!bot) {
    return NextResponse.json({ error: "bot_not_found" }, { status: 404 });
  }

  const wallet = await storage.getWalletByBotId(conf.botId);
  if (!wallet) {
    await storage.updateCheckoutConfirmationStatus(conf.confirmationId, "denied");
    return NextResponse.json({ error: "no_wallet" }, { status: 404 });
  }

  if (wallet.isFrozen) {
    await storage.updateCheckoutConfirmationStatus(conf.confirmationId, "denied");
    return NextResponse.json({ error: "wallet_frozen", message: "Cannot approve — wallet is frozen." }, { status: 403 });
  }

  if (wallet.balanceCents < conf.amountCents) {
    await storage.updateCheckoutConfirmationStatus(conf.confirmationId, "denied");
    return NextResponse.json({ error: "insufficient_funds", message: "Cannot approve — insufficient balance." }, { status: 402 });
  }

  const updated = await storage.debitWallet(wallet.id, conf.amountCents);
  if (!updated) {
    return NextResponse.json({ error: "debit_failed" }, { status: 409 });
  }

  await storage.createTransaction({
    walletId: wallet.id,
    type: "purchase",
    amountCents: conf.amountCents,
    description: `${conf.merchantName}: ${conf.itemName} (approved)`,
  });

  await storage.updateCheckoutConfirmationStatus(conf.confirmationId, "approved");

  const card = await storage.getRail4CardByBotId(conf.botId);

  if (card) {
    const { getWindowStart } = await import("@/lib/rail4");
    const permissions = card.profilePermissions ? JSON.parse(card.profilePermissions) : [];
    const profilePerm = permissions.find((p: { profile_index: number }) => p.profile_index === conf.profileIndex);
    if (profilePerm) {
      const windowStart = getWindowStart(profilePerm.allowance_duration);
      await storage.upsertProfileAllowanceUsage(
        conf.botId,
        conf.profileIndex,
        windowStart,
        conf.amountCents,
        false,
      );
    }
  }

  const { fireWebhook } = await import("@/lib/webhooks");
  fireWebhook(bot, "rail4.checkout.approved" as any, {
    confirmation_id: conf.confirmationId,
    amount_usd: conf.amountCents / 100,
    merchant: conf.merchantName,
    item: conf.itemName,
    missing_digits: card?.missingDigitsValue || null,
    expiry_month: card?.expiryMonth || null,
    expiry_year: card?.expiryYear || null,
    new_balance_usd: updated.balanceCents / 100,
  }).catch(() => {});

  const { recordOrganicEvent } = await import("@/lib/obfuscation-engine/state-machine");
  recordOrganicEvent(conf.botId).catch(() => {});

  return NextResponse.json({
    status: "approved",
    message: "Purchase approved. The bot has been notified with the card details.",
  });
}

async function handleDenial(conf: any) {
  await storage.updateCheckoutConfirmationStatus(conf.confirmationId, "denied");

  const bot = await storage.getBotByBotId(conf.botId);
  if (bot) {
    const { fireWebhook } = await import("@/lib/webhooks");
    fireWebhook(bot, "rail4.checkout.denied" as any, {
      confirmation_id: conf.confirmationId,
      amount_usd: conf.amountCents / 100,
      merchant: conf.merchantName,
      item: conf.itemName,
    }).catch(() => {});
  }

  return NextResponse.json({
    status: "denied",
    message: "Purchase denied. The bot has been notified.",
  });
}

function renderPage(title: string, message: string, _: any, __: any): string {
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

function renderApprovalPage(conf: any, botName: string, token: string): string {
  const amountUsd = (conf.amountCents / 100).toFixed(2);
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
    <h1>Purchase Approval Request</h1>
    <div class="amount">$${amountUsd}</div>
    <div class="details">
      <div class="row"><span class="label">Bot</span><span class="value">${botName}</span></div>
      <div class="row"><span class="label">Merchant</span><span class="value">${conf.merchantName}</span></div>
      <div class="row"><span class="label">Item</span><span class="value">${conf.itemName}</span></div>
      ${conf.category ? `<div class="row"><span class="label">Category</span><span class="value">${conf.category}</span></div>` : ""}
    </div>
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
