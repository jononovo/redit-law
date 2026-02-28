import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { upsertSellerProfileSchema } from "@/shared/schema";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const profile = await storage.getSellerProfileByOwnerUid(user.uid);
    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        business_name: profile.businessName,
        logo_url: profile.logoUrl,
        contact_email: profile.contactEmail,
        website_url: profile.websiteUrl,
        description: profile.description,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/seller-profile error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = upsertSellerProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
    }

    const profile = await storage.upsertSellerProfile(user.uid, {
      businessName: parsed.data.business_name ?? undefined,
      logoUrl: parsed.data.logo_url ?? undefined,
      contactEmail: parsed.data.contact_email ?? undefined,
      websiteUrl: parsed.data.website_url ?? undefined,
      description: parsed.data.description ?? undefined,
    });

    return NextResponse.json({
      profile: {
        id: profile.id,
        business_name: profile.businessName,
        logo_url: profile.logoUrl,
        contact_email: profile.contactEmail,
        website_url: profile.websiteUrl,
        description: profile.description,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error("PUT /api/v1/seller-profile error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
