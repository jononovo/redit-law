"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Store, Check, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface SellerProfileData {
  id?: number;
  business_name: string | null;
  logo_url: string | null;
  contact_email: string | null;
  website_url: string | null;
  description: string | null;
}

export default function SellerSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    business_name: "",
    logo_url: "",
    contact_email: "",
    website_url: "",
    description: "",
  });

  const { data, isLoading } = useQuery<{ profile: SellerProfileData | null }>({
    queryKey: ["seller-profile"],
    queryFn: async () => {
      const res = await fetch("/api/v1/seller-profile");
      if (!res.ok) throw new Error("Failed to load seller profile");
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.profile) {
      setForm({
        business_name: data.profile.business_name || "",
        logo_url: data.profile.logo_url || "",
        contact_email: data.profile.contact_email || "",
        website_url: data.profile.website_url || "",
        description: data.profile.description || "",
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await fetch("/api/v1/seller-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: payload.business_name || null,
          logo_url: payload.logo_url || null,
          contact_email: payload.contact_email || null,
          website_url: payload.website_url || null,
          description: payload.description || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save seller profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up max-w-2xl">
      <div>
        <Link href="/app/settings" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 mb-4" data-testid="link-back-settings">
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-emerald-600" />
          <div>
            <h2 className="text-lg font-bold text-neutral-900" data-testid="text-seller-profile-title">Seller Profile</h2>
            <p className="text-neutral-500 text-sm">Set your business details for checkout pages and invoices.</p>
          </div>
        </div>
      </div>

      <Separator />

      {isLoading ? (
        <div className="flex items-center gap-2 text-neutral-400 text-sm py-8" data-testid="status-loading">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading seller profile...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name</Label>
            <Input
              id="business-name"
              placeholder="Your Company Name"
              value={form.business_name}
              onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
              className="max-w-md"
              data-testid="input-business-name"
            />
            <p className="text-xs text-neutral-400">Displayed on checkout pages and invoices</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-url">Logo URL</Label>
            <Input
              id="logo-url"
              type="url"
              placeholder="https://example.com/logo.png"
              value={form.logo_url}
              onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
              className="max-w-md"
              data-testid="input-logo-url"
            />
            <p className="text-xs text-neutral-400">Direct URL to your business logo (square image recommended)</p>
            {form.logo_url && (
              <div className="mt-2 p-3 bg-neutral-50 rounded-lg inline-block">
                <img
                  src={form.logo_url}
                  alt="Logo preview"
                  className="w-16 h-16 object-contain rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                  data-testid="img-logo-preview"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email">Contact Email</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder={user?.email || "you@example.com"}
              value={form.contact_email}
              onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
              className="max-w-md"
              data-testid="input-contact-email"
            />
            <p className="text-xs text-neutral-400">Shown to buyers on checkout pages</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website-url">Website</Label>
            <Input
              id="website-url"
              type="url"
              placeholder="https://example.com"
              value={form.website_url}
              onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
              className="max-w-md"
              data-testid="input-website-url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="A short description of your business..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="max-w-md resize-none"
              rows={3}
              data-testid="input-description"
            />
          </div>

          <Separator />

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={mutation.isPending}
              data-testid="button-save-seller-profile"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : saved ? (
                <Check className="w-4 h-4 mr-2" />
              ) : null}
              {saved ? "Saved" : "Save Profile"}
            </Button>
            {mutation.isError && (
              <p className="text-sm text-red-500" data-testid="text-save-error">Failed to save. Please try again.</p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
