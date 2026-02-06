"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8 animate-fade-in-up max-w-2xl">
      
      <div>
        <h2 className="text-lg font-bold text-neutral-900 mb-1">Account Settings</h2>
        <p className="text-neutral-500 text-sm">Manage your account preferences and notifications.</p>
      </div>

      <Separator />

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="display-name">Display Name</Label>
          <Input id="display-name" defaultValue="OpenClaw Agent" className="max-w-sm" data-testid="input-display-name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" defaultValue="agent@openclaw.ai" className="max-w-sm" data-testid="input-email" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-md font-bold text-neutral-900 mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between max-w-sm">
            <div>
              <p className="text-sm font-medium text-neutral-900">Transaction Alerts</p>
              <p className="text-xs text-neutral-500">Get notified for every transaction</p>
            </div>
            <Switch defaultChecked data-testid="switch-transaction-alerts" />
          </div>
          <div className="flex items-center justify-between max-w-sm">
            <div>
              <p className="text-sm font-medium text-neutral-900">Budget Warnings</p>
              <p className="text-xs text-neutral-500">Alert when 80% of budget is spent</p>
            </div>
            <Switch defaultChecked data-testid="switch-budget-warnings" />
          </div>
          <div className="flex items-center justify-between max-w-sm">
            <div>
              <p className="text-sm font-medium text-neutral-900">Weekly Summary</p>
              <p className="text-xs text-neutral-500">Receive a weekly spending report</p>
            </div>
            <Switch data-testid="switch-weekly-summary" />
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex gap-3">
        <Button className="bg-primary hover:bg-primary/90" data-testid="button-save-settings">Save Changes</Button>
        <Button variant="outline" data-testid="button-cancel-settings">Cancel</Button>
      </div>
    </div>
  );
}
