import { NextResponse } from "next/server";
import { tickAllActiveBots } from "@/lib/obfuscation-engine/scheduler";

export async function POST() {
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
