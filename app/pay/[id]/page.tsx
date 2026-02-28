"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, CreditCard, Loader2, AlertCircle, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface CheckoutPageData {
  checkout_page_id: string;
  title: string;
  description: string | null;
  amount_usdc: number | null;
  amount_locked: boolean;
  allowed_methods: string[];
  success_url: string | null;
  success_message: string | null;
  wallet_address: string;
}

type PageState = "loading" | "ready" | "not_found" | "expired" | "error";

export default function PublicCheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [checkout, setCheckout] = useState<CheckoutPageData | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [onrampOpen, setOnrampOpen] = useState(false);
  const [onrampLoading, setOnrampLoading] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/checkout/${id}/public`)
      .then(async (res) => {
        if (res.status === 404) {
          setPageState("not_found");
          return;
        }
        if (res.status === 410) {
          setPageState("expired");
          return;
        }
        if (!res.ok) {
          setPageState("error");
          return;
        }
        const data = await res.json();
        setCheckout(data);
        setPageState("ready");
      })
      .catch(() => setPageState("error"));
  }, [id]);

  const displayAmount = checkout?.amount_locked && checkout?.amount_usdc
    ? (checkout.amount_usdc / 1_000_000).toFixed(2)
    : null;

  const loadScript = useCallback((src: string) => {
    return new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }, []);

  const handlePay = async () => {
    if (!checkout) return;

    const isOpenAmount = !checkout.amount_locked || !checkout.amount_usdc;
    const amountUsd = isOpenAmount ? parseFloat(customAmount) : undefined;

    if (isOpenAmount && (!amountUsd || amountUsd < 1 || amountUsd > 10000)) {
      toast({ title: "Invalid amount", description: "Please enter an amount between $1 and $10,000", variant: "destructive" });
      return;
    }

    setPaying(true);

    try {
      const body: Record<string, unknown> = {};
      if (amountUsd) body.amount_usd = amountUsd;

      const res = await fetch(`/api/v1/checkout/${id}/pay/stripe-onramp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Payment error", description: err.error || "Failed to initiate payment", variant: "destructive" });
        setPaying(false);
        return;
      }

      const data = await res.json();
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      const isInIframe = window.self !== window.top;

      if (publishableKey && !isInIframe) {
        setOnrampOpen(true);
        setOnrampLoading(true);

        try {
          await loadScript("https://js.stripe.com/clover/stripe.js");
          await loadScript("https://crypto-js.stripe.com/crypto-onramp-outer.js");

          const StripeOnramp = (window as any).StripeOnramp;
          if (!StripeOnramp) throw new Error("SDK not loaded");

          const stripeOnramp = StripeOnramp(publishableKey);
          const session = stripeOnramp.createSession({
            clientSecret: data.client_secret,
          });

          sessionRef.current = session;

          session.addEventListener("onramp_ui_loaded", () => {
            setOnrampLoading(false);
          });

          session.addEventListener("onramp_session_updated", (e: any) => {
            const status = e?.payload?.session?.status;
            if (status === "fulfillment_complete") {
              toast({ title: "Payment successful!", description: "Your payment has been processed." });
              setTimeout(() => {
                router.push(`/pay/${id}/success`);
              }, 1500);
            }
          });

          setTimeout(() => {
            if (mountRef.current) {
              session.mount(mountRef.current);
            }
            setOnrampLoading(false);
          }, 100);
        } catch {
          setOnrampOpen(false);
          if (data.redirect_url) {
            window.open(data.redirect_url, "_blank");
            toast({ title: "Opening Stripe", description: "Payment opened in a new tab." });
          } else {
            toast({ title: "Error", description: "Failed to load payment widget", variant: "destructive" });
          }
        }
      } else if (data.redirect_url) {
        window.open(data.redirect_url, "_blank");
        toast({ title: "Opening Stripe", description: "Payment opened in a new tab." });
      } else {
        toast({ title: "Error", description: "Payment method unavailable", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to initiate payment", variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3" data-testid="loading-checkout">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
          <p className="text-sm text-neutral-500 font-medium">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (pageState === "not_found") {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-6" data-testid="checkout-not-found">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
            <Ban className="w-8 h-8 text-neutral-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Checkout Not Found</h1>
          <p className="text-neutral-500 font-medium">This checkout page doesn&apos;t exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-6" data-testid="checkout-expired">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Checkout Expired</h1>
          <p className="text-neutral-500 font-medium">This checkout page has expired and is no longer accepting payments.</p>
        </div>
      </div>
    );
  }

  if (pageState === "error" || !checkout) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-6" data-testid="checkout-error">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Something went wrong</h1>
          <p className="text-neutral-500 font-medium">We couldn&apos;t load this checkout page. Please try again later.</p>
        </div>
      </div>
    );
  }

  if (onrampOpen) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col" data-testid="checkout-onramp">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 bg-white">
          <div className="flex items-center gap-3">
            <Image src="/images/logo-claw-chip.png" alt="CreditClaw" width={28} height={28} />
            <span className="font-bold text-neutral-900">Payment</span>
          </div>
          <button
            onClick={() => {
              if (sessionRef.current) {
                try { sessionRef.current.destroy?.(); } catch {}
                sessionRef.current = null;
              }
              setOnrampOpen(false);
            }}
            className="text-sm text-neutral-500 hover:text-neutral-700 font-medium cursor-pointer"
            data-testid="button-cancel-payment"
          >
            Cancel
          </button>
        </div>
        <div className="flex-1 relative">
          {onrampLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-neutral-500">Loading payment...</p>
              </div>
            </div>
          )}
          <div ref={mountRef} className="w-full min-h-[500px] flex justify-center" data-testid="container-checkout-onramp" />
        </div>
        <footer className="p-4 border-t border-neutral-200 bg-white text-center">
          <p className="text-xs text-neutral-400 font-medium" data-testid="text-checkout-footer">
            Powered by CreditClaw &middot; Payments settle as USDC on Base
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col" data-testid="checkout-page">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            <Image src="/images/logo-claw-chip.png" alt="CreditClaw" width={40} height={40} data-testid="img-checkout-logo" />
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-100">
              <h1 className="text-2xl font-bold text-neutral-900 mb-1" data-testid="text-checkout-title">
                {checkout.title}
              </h1>
              {checkout.description && (
                <p className="text-neutral-500 font-medium text-sm leading-relaxed" data-testid="text-checkout-description">
                  {checkout.description}
                </p>
              )}
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="text-sm font-semibold text-neutral-700 mb-2 block">Amount</label>
                {displayAmount ? (
                  <div className="flex items-center gap-2 bg-neutral-50 rounded-xl px-4 py-3 border border-neutral-200" data-testid="display-locked-amount">
                    <Lock className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <span className="text-2xl font-bold text-neutral-900">${displayAmount}</span>
                    <span className="text-sm text-neutral-400 font-medium">USD</span>
                  </div>
                ) : (
                  <div className="relative" data-testid="input-custom-amount-wrapper">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-neutral-400">$</span>
                    <Input
                      type="number"
                      min="1"
                      max="10000"
                      step="0.01"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="pl-8 text-2xl font-bold h-14 rounded-xl"
                      data-testid="input-custom-amount"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-400 font-medium">USD</span>
                  </div>
                )}
              </div>

              <Button
                onClick={handlePay}
                disabled={paying || (!displayAmount && !customAmount)}
                className="w-full h-12 text-base font-bold rounded-xl cursor-pointer"
                data-testid="button-pay"
              >
                {paying ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    {displayAmount ? `Pay $${displayAmount}` : customAmount ? `Pay $${parseFloat(customAmount).toFixed(2)}` : "Pay"}
                    <span className="ml-2 text-xs font-medium opacity-70">Card / Bank</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-neutral-400 font-medium mt-6" data-testid="text-checkout-footer">
            Powered by CreditClaw &middot; Payments settle as USDC on Base
          </p>
        </div>
      </div>
    </div>
  );
}
