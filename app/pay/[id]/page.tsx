"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Lock, CreditCard, Loader2, AlertCircle, Clock, Ban, Mail, FileText, Calendar, Users } from "lucide-react";
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
  seller_name: string | null;
  seller_logo_url: string | null;
  seller_email: string | null;
  page_type: "product" | "event";
  collect_buyer_name: boolean;
}

interface InvoiceData {
  reference_number: string;
  recipient_name: string | null;
  recipient_email: string | null;
  line_items: Array<{
    description: string;
    quantity: number;
    unitPriceUsd: number;
    amountUsd: number;
  }>;
  subtotal_usd: number;
  tax_usd: number;
  total_usd: number;
  due_date: string | null;
  status: string;
  checkout_page_id: string;
}

type PageState = "loading" | "ready" | "not_found" | "expired" | "error";

export default function PublicCheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const invoiceRef = searchParams.get("ref");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [checkout, setCheckout] = useState<CheckoutPageData | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerCount, setBuyerCount] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [onrampOpen, setOnrampOpen] = useState(false);
  const [onrampLoading, setOnrampLoading] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      try {
        const res = await fetch(`/api/v1/checkout/${id}/public`);
        if (res.status === 404) { setPageState("not_found"); return; }
        if (res.status === 410) { setPageState("expired"); return; }
        if (!res.ok) { setPageState("error"); return; }

        const data = await res.json();
        setCheckout(data);

        if (invoiceRef) {
          try {
            const invRes = await fetch(`/api/v1/invoices/by-ref/${encodeURIComponent(invoiceRef)}`);
            if (invRes.ok) {
              const invData = await invRes.json();
              if (invData.checkout_page_id === data.checkout_page_id && invData.status !== "paid" && invData.status !== "cancelled") {
                setInvoice(invData);
              }
            }
          } catch {}
        }

        if (data.page_type === "event") {
          try {
            const buyersRes = await fetch(`/api/v1/checkout/${id}/buyers`);
            if (buyersRes.ok) {
              const buyersData = await buyersRes.json();
              setBuyerCount(buyersData.buyer_count);
            }
          } catch {}
        }

        setPageState("ready");
      } catch {
        setPageState("error");
      }
    };

    loadData();
  }, [id, invoiceRef]);

  const effectiveAmountUsd = invoice
    ? invoice.total_usd
    : (checkout?.amount_locked && checkout?.amount_usdc)
      ? checkout.amount_usdc / 1_000_000
      : null;

  const displayAmount = effectiveAmountUsd ? effectiveAmountUsd.toFixed(2) : null;

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

    const isOpenAmount = !invoice && (!checkout.amount_locked || !checkout.amount_usdc);
    const amountUsd = isOpenAmount ? parseFloat(customAmount) : undefined;

    if (isOpenAmount && (!amountUsd || amountUsd < 1 || amountUsd > 10000)) {
      toast({ title: "Invalid amount", description: "Please enter an amount between $1 and $10,000", variant: "destructive" });
      return;
    }

    setPaying(true);

    try {
      const body: Record<string, unknown> = {};
      if (amountUsd) body.amount_usd = amountUsd;
      if (invoice) body.invoice_ref = invoice.reference_number;
      if (buyerName.trim()) body.buyer_name = buyerName.trim();

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

  const renderLeftPanel = () => {
    if (invoice) {
      return (
        <div className="bg-neutral-900 text-white flex flex-col justify-between p-6 md:p-10 lg:p-14" data-testid="checkout-invoice-panel">
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-8">
              {checkout.seller_logo_url ? (
                <Image src={checkout.seller_logo_url} alt={checkout.seller_name || "Seller"} width={48} height={48} className="rounded-lg object-contain" data-testid="img-seller-logo" />
              ) : (
                <Image src="/images/logo-claw-chip.png" alt="CreditClaw" width={48} height={48} data-testid="img-checkout-logo" />
              )}
            </div>

            {checkout.seller_name && (
              <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-1" data-testid="text-seller-name">
                {checkout.seller_name}
              </p>
            )}
            {checkout.seller_email && (
              <p className="text-xs text-white/40 mb-4">{checkout.seller_email}</p>
            )}

            <div className="border-t border-white/10 pt-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-white/40" />
                <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Invoice</span>
              </div>
              <p className="text-lg font-bold text-white" data-testid="text-invoice-ref">{invoice.reference_number}</p>
            </div>

            {(invoice.recipient_name || invoice.recipient_email) && (
              <div className="mb-4">
                <span className="text-xs font-semibold text-white/40 uppercase tracking-wider block mb-1">Bill To</span>
                {invoice.recipient_name && (
                  <p className="text-sm font-medium text-white" data-testid="text-invoice-recipient">{invoice.recipient_name}</p>
                )}
                {invoice.recipient_email && (
                  <p className="text-xs text-white/50">{invoice.recipient_email}</p>
                )}
              </div>
            )}

            <div className="border-t border-white/10 pt-3 mb-3">
              {invoice.line_items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1" data-testid={`invoice-line-item-${i}`}>
                  <span className="text-white/70">
                    {item.description}
                    {item.quantity > 1 && <span className="text-white/40 ml-1">x{item.quantity}</span>}
                  </span>
                  <span className="text-white font-medium">${item.amountUsd.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Subtotal</span>
                <span className="text-white/70">${invoice.subtotal_usd.toFixed(2)}</span>
              </div>
              {invoice.tax_usd > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Tax</span>
                  <span className="text-white/70">${invoice.tax_usd.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1">
                <span className="text-white">Total</span>
                <span className="text-white" data-testid="text-invoice-total">${invoice.total_usd.toFixed(2)}</span>
              </div>
            </div>

            {invoice.due_date && (
              <div className="mt-4 flex items-center gap-2 text-white/40">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium" data-testid="text-invoice-due">
                  Due: {new Date(invoice.due_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-white/30 font-medium" data-testid="text-checkout-footer">
              Powered by CreditClaw &middot; Payments settle as USDC on Base
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-neutral-900 text-white flex flex-col justify-between p-6 md:p-10 lg:p-14">
        <div className="flex-1 flex flex-col justify-center">
          <div className="mb-8">
            {checkout.seller_logo_url ? (
              <Image src={checkout.seller_logo_url} alt={checkout.seller_name || "Seller"} width={48} height={48} className="rounded-lg object-contain" data-testid="img-seller-logo" />
            ) : (
              <Image src="/images/logo-claw-chip.png" alt="CreditClaw" width={48} height={48} data-testid="img-checkout-logo" />
            )}
          </div>

          {checkout.seller_name && (
            <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2" data-testid="text-seller-name">
              {checkout.seller_name}
            </p>
          )}

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-3" data-testid="text-checkout-title">
            {checkout.title}
          </h1>

          {checkout.description && (
            <p className="text-white/60 font-medium text-sm md:text-base leading-relaxed mb-6" data-testid="text-checkout-description">
              {checkout.description}
            </p>
          )}

          <div className="mt-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Amount</label>
            {displayAmount ? (
              <div className="flex items-center gap-3" data-testid="display-locked-amount">
                <Lock className="w-5 h-5 text-white/40 flex-shrink-0" />
                <span className="text-4xl md:text-5xl font-bold text-white">${displayAmount}</span>
                <span className="text-sm text-white/40 font-medium self-end mb-1">USD</span>
              </div>
            ) : (
              <p className="text-lg text-white/60 font-medium" data-testid="text-open-amount">
                Enter your amount on the right &rarr;
              </p>
            )}
          </div>

          {checkout.seller_email && (
            <div className="mt-8 flex items-center gap-2 text-white/40" data-testid="text-seller-email">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{checkout.seller_email}</span>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-xs text-white/30 font-medium" data-testid="text-checkout-footer">
            Powered by CreditClaw &middot; Payments settle as USDC on Base
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2" data-testid="checkout-page">
      {renderLeftPanel()}

      <div className="bg-white flex flex-col justify-center p-6 md:p-10 lg:p-14">
        {onrampOpen ? (
          <div className="flex flex-col h-full" data-testid="checkout-onramp">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-neutral-900 text-lg">Complete Payment</span>
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
            <div className="flex-1 relative min-h-[500px]">
              {onrampLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-sm text-neutral-500">Loading payment...</p>
                  </div>
                </div>
              )}
              <div ref={mountRef} className="w-full min-h-[500px]" data-testid="container-checkout-onramp" />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm mx-auto">
            <h2 className="text-xl font-bold text-neutral-900 mb-6" data-testid="text-payment-heading">
              {invoice ? `Pay Invoice ${invoice.reference_number}` : "Payment Details"}
            </h2>

            <div className="space-y-6">
              {!displayAmount && (
                <div>
                  <label className="text-sm font-semibold text-neutral-700 mb-2 block">Amount</label>
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
                </div>
              )}

              {displayAmount && (
                <div className="bg-neutral-50 rounded-xl px-4 py-3 border border-neutral-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-500">Total</span>
                    <span className="text-2xl font-bold text-neutral-900" data-testid="text-payment-total">${displayAmount} USD</span>
                  </div>
                </div>
              )}

              {checkout.collect_buyer_name && (
                <div>
                  <label className="text-sm font-semibold text-neutral-700 mb-2 block">Your Name</label>
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="rounded-xl"
                    data-testid="input-buyer-name"
                  />
                </div>
              )}

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

              {checkout.page_type === "event" && buyerCount !== null && buyerCount > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-neutral-400" data-testid="text-event-buyer-count">
                  <Users className="w-4 h-4" />
                  <span>{buyerCount} {buyerCount === 1 ? "person" : "people"} bought this</span>
                </div>
              )}

              <p className="text-center text-xs text-neutral-400 font-medium">
                Secure payment powered by Stripe
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
