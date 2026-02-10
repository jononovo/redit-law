"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { FAKE_MERCHANTS } from "@/lib/obfuscation-merchants/catalog";

export default function FakeMerchantPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [merchant, setMerchant] = useState<typeof FAKE_MERCHANTS[0] | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [step, setStep] = useState<"browse" | "checkout" | "confirmation">("browse");
  const [cardNumber, setCardNumber] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [zip, setZip] = useState("");

  useEffect(() => {
    const found = FAKE_MERCHANTS.find((m) => m.slug === slug);
    setMerchant(found || null);
  }, [slug]);

  if (!merchant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Merchant Not Found</h1>
          <p className="text-gray-600 mt-2">The requested merchant page could not be found.</p>
        </div>
      </div>
    );
  }

  const selectedProductData = merchant.products.find((p) => p.name === selectedProduct);

  if (step === "confirmation") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Order Confirmed</h2>
          <p className="text-gray-600 mt-2">Your purchase from {merchant.name} has been processed.</p>
          <div className="mt-4 p-4 bg-gray-50 rounded-xl text-sm text-left">
            <div className="flex justify-between">
              <span className="text-gray-500">Item</span>
              <span className="font-medium">{selectedProduct}</span>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-gray-500">Merchant</span>
              <span className="font-medium">{merchant.name}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "checkout" && selectedProductData) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h1 className="text-xl font-bold text-gray-900">{merchant.name}</h1>
            <p className="text-gray-500 text-sm mt-1">Secure Checkout</p>

            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="font-medium">{selectedProductData.name}</span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Name on card"
                  data-testid="input-cardholder-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  data-testid="input-card-number"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="123"
                    maxLength={4}
                    data-testid="input-cvv"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Zip</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12345"
                    maxLength={10}
                    data-testid="input-billing-zip"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep("confirmation")}
              className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              data-testid="button-complete-purchase"
            >
              Complete Purchase
            </button>

            <button
              onClick={() => { setStep("browse"); setSelectedProduct(null); }}
              className="w-full mt-2 text-gray-500 text-sm hover:text-gray-700"
              data-testid="button-back-to-products"
            >
              Back to products
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900">{merchant.name}</h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">{merchant.category}</p>

          <div className="mt-8 grid gap-4">
            {merchant.products.map((product) => (
              <div
                key={product.name}
                className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedProduct(product.name);
                  setStep("checkout");
                }}
                data-testid={`product-${product.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      ${(product.minCents / 100).toFixed(2)} – ${(product.maxCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                    data-testid={`button-buy-${product.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
