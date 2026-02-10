import { NextRequest, NextResponse } from "next/server";
import { tickAllActiveBots } from "@/lib/obfuscation-engine/scheduler";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const results = await tickAllActiveBots();

    const totalCreated = results.reduce((sum, r) => sum + r.eventsCreated, 0);

    return NextResponse.json({
      processed: results.length,
      events_created: totalCreated,
      details: results,
    });
  } catch (error) {
    console.error("Obfuscation tick error:", error);
    return NextResponse.json(
      { error: "Tick processing failed" },
      { status: 500 }
    );
  }
}
