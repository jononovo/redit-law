"use client";

import { useState } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { PaymentHandlerProps } from "../types";

type HandlerState = "form" | "submitting" | "success" | "error";

export function TestingHandler({ context, onSuccess, onError, onCancel }: PaymentHandlerProps) {
  const { toast } = useToast();
  const [state, setState] = useState<HandlerState>("form");

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [billingCountry, setBillingCountry] = useState("");

  const handleSubmit = async () => {
    setState("submitting");

    try {
      const res = await fetch(`/api/v1/checkout/${context.checkoutPageId}/pay/testing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: cardNumber,
          card_expiry: cardExpiry,
          card_cvv: cardCvv,
          cardholder_name: cardholderName,
          billing_address: billingAddress,
          billing_city: billingCity,
          billing_state: billingState,
          billing_zip: billingZip,
          billing_country: billingCountry,
          buyer_name: context.buyerName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Test payment failed");
      }

      const data = await res.json();

      setState("success");
      toast({
        title: "Test payment recorded",
        description: "Card details have been captured successfully.",
      });

      setTimeout(() => {
        onSuccess({
          method: "testing",
          status: "completed",
          saleId: data.sale_id,
        });
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test payment failed";
      setState("error");
      onError(message);
    }
  };

  if (state === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4" data-testid="testing-handler-success">
        <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
        <p className="text-lg font-semibold text-neutral-900">Test payment recorded</p>
        <p className="text-sm text-neutral-500 mt-1">Card details captured successfully</p>
      </div>
    );
  }

  if (state === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4" data-testid="testing-handler-submitting">
        <Loader2 className="w-10 h-10 animate-spin text-neutral-600 mb-4" />
        <p className="text-lg font-semibold text-neutral-900">Recording test payment...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto" data-testid="testing-handler-form">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-lg">🧪</span>
        <h3 className="text-lg font-bold text-neutral-900">Test Card Payment</h3>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
        <p className="text-xs text-amber-700 font-medium">
          Testing mode — no real payment will be processed. Card details will be recorded for verification.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1 block">Card Number</label>
          <Input
            type="text"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            className="font-mono"
            data-testid="input-test-card-number"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Expiry</label>
            <Input
              type="text"
              placeholder="MM/YY"
              value={cardExpiry}
              onChange={(e) => setCardExpiry(e.target.value)}
              className="font-mono"
              data-testid="input-test-card-expiry"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">CVV</label>
            <Input
              type="text"
              placeholder="123"
              value={cardCvv}
              onChange={(e) => setCardCvv(e.target.value)}
              className="font-mono"
              data-testid="input-test-card-cvv"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1 block">Cardholder Name</label>
          <Input
            type="text"
            placeholder="John Doe"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            data-testid="input-test-cardholder-name"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1 block">Billing Address</label>
          <Input
            type="text"
            placeholder="123 Main St"
            value={billingAddress}
            onChange={(e) => setBillingAddress(e.target.value)}
            data-testid="input-test-billing-address"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">City</label>
            <Input
              type="text"
              placeholder="New York"
              value={billingCity}
              onChange={(e) => setBillingCity(e.target.value)}
              data-testid="input-test-billing-city"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">State</label>
            <Input
              type="text"
              placeholder="NY"
              value={billingState}
              onChange={(e) => setBillingState(e.target.value)}
              data-testid="input-test-billing-state"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">ZIP Code</label>
            <Input
              type="text"
              placeholder="10001"
              value={billingZip}
              onChange={(e) => setBillingZip(e.target.value)}
              data-testid="input-test-billing-zip"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Country</label>
            <Input
              type="text"
              placeholder="US"
              value={billingCountry}
              onChange={(e) => setBillingCountry(e.target.value)}
              data-testid="input-test-billing-country"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full h-12 flex items-center justify-center gap-2 text-base font-bold rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-all cursor-pointer"
          data-testid="button-test-pay"
        >
          <span>🧪</span>
          Submit Test Payment
        </button>

        <button
          onClick={onCancel}
          className="w-full text-sm font-medium text-neutral-500 hover:text-neutral-700 cursor-pointer py-2"
          data-testid="button-test-cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
