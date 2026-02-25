import { NextRequest, NextResponse } from "next/server";
import { sendCheckoutApprovalEmail } from "@/lib/email";
import { getSessionUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const email = body.email;
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const result = await sendCheckoutApprovalEmail({
      ownerEmail: email,
      botName: "bennie",
      merchantName: "Amazon",
      itemName: "USB-C Hub Adapter (7-in-1)",
      amountUsd: 34.99,
      confirmationId: "test-preview-" + Date.now(),
      hmacToken: "test-preview-token",
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Test email error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
