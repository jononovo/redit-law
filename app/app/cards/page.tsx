"use client";

import { CardVisual } from "@/components/dashboard/card-visual";
import { Button } from "@/components/ui/button";
import { Plus, Shield, MoreHorizontal, Snowflake } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CardsPage() {
  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      
      <div className="flex justify-between items-center">
          <p className="text-neutral-500">Manage your virtual and physical cards.</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="rounded-full bg-primary hover:bg-primary/90 gap-2" data-testid="button-create-card">
                  <Plus className="w-4 h-4" />
                  Create New Card
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue New Card</DialogTitle>
                <DialogDescription>
                  Create a new virtual card for an agent or specific purpose.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Card Name
                  </Label>
                  <Input id="name" placeholder="e.g. AWS Billing" className="col-span-3" data-testid="input-card-name" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="limit" className="text-right">
                    Limit ($)
                  </Label>
                  <Input id="limit" placeholder="1000" className="col-span-3" data-testid="input-card-limit" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" data-testid="button-submit-card">Create Card</Button>
              </div>
            </DialogContent>
          </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="flex flex-col gap-4">
              <CardVisual color="primary" balance="$1,240.50" last4="4242" holder="MAIN AGENT" />
              <div className="bg-white rounded-xl border border-neutral-100 p-2 flex justify-between">
                  <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600">
                      <Shield className="w-4 h-4" /> Limits
                  </Button>
                  <div className="w-px bg-neutral-100 my-1" />
                  <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600">
                      <Snowflake className="w-4 h-4" /> Freeze
                  </Button>
                  <div className="w-px bg-neutral-100 my-1" />
                  <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600">
                      <MoreHorizontal className="w-4 h-4" />
                  </Button>
              </div>
          </div>

          <div className="flex flex-col gap-4">
              <CardVisual color="blue" balance="$850.00" last4="8821" holder="DEV OPS BOT" />
              <div className="bg-white rounded-xl border border-neutral-100 p-2 flex justify-between">
                  <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600">
                      <Shield className="w-4 h-4" /> Limits
                  </Button>
                  <div className="w-px bg-neutral-100 my-1" />
                  <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600">
                      <Snowflake className="w-4 h-4" /> Freeze
                  </Button>
                  <div className="w-px bg-neutral-100 my-1" />
                  <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600">
                      <MoreHorizontal className="w-4 h-4" />
                  </Button>
              </div>
          </div>

          <div className="flex flex-col gap-4">
              <CardVisual color="purple" balance="$200.00" last4="1234" holder="MARKETING AI" />
              <div className="bg-white rounded-xl border border-neutral-100 p-2 flex justify-between">
                  <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600">
                      <Shield className="w-4 h-4" /> Limits
                  </Button>
                  <div className="w-px bg-neutral-100 my-1" />
                  <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600">
                      <Snowflake className="w-4 h-4" /> Freeze
                  </Button>
                  <div className="w-px bg-neutral-100 my-1" />
                  <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600">
                      <MoreHorizontal className="w-4 h-4" />
                  </Button>
              </div>
          </div>

      </div>

    </div>
  );
}
