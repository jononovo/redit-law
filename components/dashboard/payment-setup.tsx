"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, CheckCircle, Trash2, AlertCircle } from "lucide-react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentMethodInfo {
  card_last4: string | null;
  card_brand: string | null;
  created_at: string;
}

function SetupForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message || "Setup failed");
      setLoading(false);
      return;
    }

    if (result.setupIntent?.payment_method) {
      const pmId = typeof result.setupIntent.payment_method === "string"
        ? result.setupIntent.payment_method
        : result.setupIntent.payment_method.id;

      const res = await fetch("/api/v1/billing/payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method_id: pmId,
          customer_id: (result.setupIntent as any).customer || "",
        }),
      });

      if (!res.ok) {
        setError("Failed to save payment method");
        setLoading(false);
        return;
      }

      onSuccess();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full rounded-xl bg-primary hover:bg-primary/90 gap-2"
        data-testid="button-save-card"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
        Save Card
      </Button>
    </form>
  );
}

export function PaymentSetup() {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  async function fetchPaymentMethod() {
    try {
      const res = await fetch("/api/v1/billing/payment-method");
      if (res.ok) {
        const data = await res.json();
        setPaymentMethod(data.payment_method);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPaymentMethod();
  }, []);

  async function startSetup() {
    setSetupMode(true);
    try {
      const res = await fetch("/api/v1/billing/setup-intent", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setClientSecret(data.client_secret);
        setCustomerId(data.customer_id);
      }
    } catch {}
  }

  async function removeCard() {
    setRemoving(true);
    try {
      await fetch("/api/v1/billing/payment-method", { method: "DELETE" });
      setPaymentMethod(null);
    } catch {} finally {
      setRemoving(false);
    }
  }

  function handleSuccess() {
    setSetupMode(false);
    setClientSecret(null);
    setLoading(true);
    fetchPaymentMethod();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (paymentMethod) {
    return (
      <div className="space-y-4">
        <div className="bg-neutral-50 rounded-xl p-4 flex items-center justify-between" data-testid="card-on-file">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-neutral-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900">
                {paymentMethod.card_brand ? paymentMethod.card_brand.charAt(0).toUpperCase() + paymentMethod.card_brand.slice(1) : "Card"} ending in {paymentMethod.card_last4 || "****"}
              </p>
              <p className="text-xs text-neutral-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                Active payment method
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeCard}
            disabled={removing}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            data-testid="button-remove-card"
          >
            {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={startSetup}
          className="rounded-xl gap-2 text-sm"
          data-testid="button-update-card"
        >
          <CreditCard className="w-4 h-4" />
          Update Card
        </Button>
      </div>
    );
  }

  if (setupMode && clientSecret) {
    return (
      <div className="space-y-4">
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
          <SetupForm onSuccess={handleSuccess} />
        </Elements>
        <Button
          variant="ghost"
          onClick={() => { setSetupMode(false); setClientSecret(null); }}
          className="text-sm text-neutral-500"
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-neutral-50 rounded-xl p-6 text-center" data-testid="no-payment-method">
        <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
          <CreditCard className="w-6 h-6 text-neutral-400" />
        </div>
        <p className="text-sm text-neutral-500 mb-4">No payment method on file. Add a card to fund your bot&apos;s wallet.</p>
        <Button
          onClick={startSetup}
          className="rounded-xl bg-primary hover:bg-primary/90 gap-2"
          data-testid="button-add-card"
        >
          <CreditCard className="w-4 h-4" />
          Add Payment Method
        </Button>
      </div>
    </div>
  );
}
