"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { PaymentSetup } from "@/components/dashboard/payment-setup";
import { useAuth } from "@/lib/auth/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface Preferences {
  transaction_alerts: boolean;
  budget_warnings: boolean;
  weekly_summary: boolean;
  purchase_over_threshold_usd: number;
  balance_low_usd: number;
  email_enabled: boolean;
  in_app_enabled: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ preferences: Preferences }>({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/v1/notifications/preferences");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (update: Partial<Record<string, unknown>>) => {
      const res = await fetch("/api/v1/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["notification-preferences"], result);
    },
  });

  const prefs = data?.preferences;

  const toggle = (key: string, value: boolean) => {
    mutation.mutate({ [key]: value });
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up max-w-2xl">
      
      <div>
        <h2 className="text-lg font-bold text-neutral-900 mb-1">Account Settings</h2>
        <p className="text-neutral-500 text-sm">Manage your account preferences and billing.</p>
      </div>

      <Separator />

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="display-name">Display Name</Label>
          <Input id="display-name" defaultValue={user?.displayName || ""} className="max-w-sm" data-testid="input-display-name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" defaultValue={user?.email || ""} className="max-w-sm" disabled data-testid="input-email" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-md font-bold text-neutral-900 mb-1">Payment Method</h3>
        <p className="text-sm text-neutral-500 mb-4">Add a card to fund your bot&apos;s wallet.</p>
        <PaymentSetup />
      </div>

      <Separator />

      <div>
        <h3 className="text-md font-bold text-neutral-900 mb-4">Notifications</h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-neutral-400 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading preferences...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between max-w-sm">
              <div>
                <p className="text-sm font-medium text-neutral-900">In-App Notifications</p>
                <p className="text-xs text-neutral-500">Show notifications in the bell menu</p>
              </div>
              <Switch
                checked={prefs?.in_app_enabled ?? true}
                onCheckedChange={(v) => toggle("in_app_enabled", v)}
                data-testid="switch-in-app-enabled"
              />
            </div>
            <div className="flex items-center justify-between max-w-sm">
              <div>
                <p className="text-sm font-medium text-neutral-900">Email Notifications</p>
                <p className="text-xs text-neutral-500">Receive alerts via email</p>
              </div>
              <Switch
                checked={prefs?.email_enabled ?? true}
                onCheckedChange={(v) => toggle("email_enabled", v)}
                data-testid="switch-email-enabled"
              />
            </div>

            <Separator className="my-2" />

            <div className="flex items-center justify-between max-w-sm">
              <div>
                <p className="text-sm font-medium text-neutral-900">Transaction Alerts</p>
                <p className="text-xs text-neutral-500">Get notified for every transaction</p>
              </div>
              <Switch
                checked={prefs?.transaction_alerts ?? true}
                onCheckedChange={(v) => toggle("transaction_alerts", v)}
                data-testid="switch-transaction-alerts"
              />
            </div>
            <div className="flex items-center justify-between max-w-sm">
              <div>
                <p className="text-sm font-medium text-neutral-900">Budget Warnings</p>
                <p className="text-xs text-neutral-500">Alert when balance drops below threshold</p>
              </div>
              <Switch
                checked={prefs?.budget_warnings ?? true}
                onCheckedChange={(v) => toggle("budget_warnings", v)}
                data-testid="switch-budget-warnings"
              />
            </div>
            <div className="flex items-center justify-between max-w-sm">
              <div>
                <p className="text-sm font-medium text-neutral-900">Weekly Summary</p>
                <p className="text-xs text-neutral-500">Receive a weekly spending report</p>
              </div>
              <Switch
                checked={prefs?.weekly_summary ?? false}
                onCheckedChange={(v) => toggle("weekly_summary", v)}
                data-testid="switch-weekly-summary"
              />
            </div>

            <Separator className="my-2" />

            <div className="space-y-3 max-w-sm">
              <div className="space-y-1.5">
                <Label htmlFor="threshold" className="text-sm font-medium">Email alert for purchases over ($)</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={prefs?.purchase_over_threshold_usd ?? 50}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 1) {
                      mutation.mutate({ purchase_over_threshold_usd: val });
                    }
                  }}
                  className="max-w-32"
                  data-testid="input-purchase-threshold"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="low-balance" className="text-sm font-medium">Low balance warning at ($)</Label>
                <Input
                  id="low-balance"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={prefs?.balance_low_usd ?? 5}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 1) {
                      mutation.mutate({ balance_low_usd: val });
                    }
                  }}
                  className="max-w-32"
                  data-testid="input-balance-low"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
