import { useState } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

const PAYMENT_API_URL = (import.meta.env.VITE_PAYMENT_API_URL || 'http://localhost:8000').replace(/\/$/, '');

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

export function RazorpayCheckout() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function pay() {
    setBusy(true);
    setMessage(undefined);

    try {
      const orderResponse = await fetch(`${PAYMENT_API_URL}/api/payments/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: "starter", purchase_type: "subscription" }),
      });

      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.detail ?? "Unable to create order.");

      await loadRazorpay();
      const Razorpay = window.Razorpay;
      if (!Razorpay) throw new Error("Razorpay Checkout is unavailable.");

      const checkout = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Your Company",
        description: "Premium plan",
        order_id: order.orderId,
        prefill: {
          name: "Test Customer",
          email: "test@example.com",
          contact: "9999999999",
        },
        theme: { color: "#0F766E" },
        handler: async (response: RazorpayResponse) => {
          try {
            const verification = await fetch(`${PAYMENT_API_URL}/api/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const result = await verification.json();

            if (!verification.ok) {
              throw new Error(result.detail ?? "Payment verification failed.");
            }
            setMessage("Payment verified successfully.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Verification failed.");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setMessage("Checkout closed. Your order remains pending.");
          },
        },
      });

      checkout.open();
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Payment could not start.");
    }
  }

  return (
    <section>
      <button disabled={busy} onClick={pay}>
        {busy ? "Processing…" : "Pay ₹499"}
      </button>
      {message && <p>{message}</p>}
    </section>
  );
}
