import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { generateVendorSkill } from "@/lib/procurement-skills/generator";
import type { VendorSkill } from "@/lib/procurement-skills/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const draftId = parseInt(id, 10);
    if (isNaN(draftId)) {
      return NextResponse.json({ error: "invalid_id", message: "Draft ID must be a number" }, { status: 400 });
    }

    const draft = await storage.getSkillDraft(draftId);
    if (!draft) {
      return NextResponse.json({ error: "not_found", message: `Draft ${draftId} not found` }, { status: 404 });
    }

    if (draft.status === "published") {
      return NextResponse.json({ error: "already_published", message: "This draft is already published" }, { status: 400 });
    }

    const vendorData = draft.vendorData as Record<string, unknown>;

    const requiredFields = ["slug", "name", "category", "url", "checkoutMethods", "capabilities"];
    const missing = requiredFields.filter(f => !vendorData[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "incomplete_draft", message: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    let skillMd: string;
    try {
      skillMd = generateVendorSkill(vendorData as unknown as VendorSkill);
    } catch (genError: unknown) {
      const genMessage = genError instanceof Error ? genError.message : "Unknown error";
      return NextResponse.json(
        { error: "generation_failed", message: `SKILL.md generation failed: ${genMessage}` },
        { status: 400 }
      );
    }

    const updated = await storage.updateSkillDraft(draftId, { status: "published" });

    if (draft.submitterUid && draft.submissionSource === "community") {
      await storage.incrementSubmitterStat(draft.submitterUid, "skillsPublished");
    }

    return NextResponse.json({
      id: updated!.id,
      status: "published",
      vendorSlug: updated!.vendorSlug,
      skillMd,
      submitterType: draft.submitterType,
      submitterName: draft.submitterName,
      message: "Draft published successfully. To add this vendor to the live registry, add it to lib/procurement-skills/registry.ts.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "publish_failed", message }, { status: 500 });
  }
}
