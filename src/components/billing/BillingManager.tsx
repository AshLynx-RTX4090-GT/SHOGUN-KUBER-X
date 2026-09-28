import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Check,
  CreditCard,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface Plan {
  id: string;
  name: string;
  price: number;
  cadence: string;
  description: string;
  accent: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 1999,
    cadence: 'per month',
    description: 'A focused control plane for a small production footprint.',
    accent: 'cyan',
    features: ['3 Kubernetes clusters', '15-day telemetry retention', 'S3 lifecycle automation', 'Email incident alerts'],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 5999,
    cadence: 'per month',
    description: 'More automation and observability for growing platform teams.',
    accent: 'amber',
    features: ['12 Kubernetes clusters', '90-day telemetry retention', 'Prometheus and Grafana views', 'Slack, SNS, and email routing'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 14999,
    cadence: 'per month',
    description: 'Governance, capacity, and support for critical infrastructure.',
    accent: 'violet',
    features: ['Unlimited clusters', '1-year telemetry retention', 'Advanced RBAC and audit trails', 'Priority platform support'],
  },
];

const ONE_TIME_PURCHASES: Plan[] = [
  { id: 'incident-pack', name: 'Incident Response Pack', price: 2499, cadence: 'one-time', description: 'A one-time incident review and recovery readiness session.', accent: 'rose', features: ['Incident timeline review', 'Runbook health scan', 'Recovery action brief'] },
  { id: 'migration-pack', name: 'Cloud Migration Pack', price: 8999, cadence: 'one-time', description: 'A guided migration assessment for one production workload.', accent: 'violet', features: ['Architecture assessment', 'Migration risk map', 'Cutover checklist'] },
];

// The dashboard Express server continues to serve the rest of the app. Payments
// are deliberately handled by the dedicated Python service.
const PAYMENT_API_URL = (import.meta.env.VITE_PAYMENT_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const loadRazorpay = () => new Promise<boolean>((resolve, reject) => {
  if (window.Razorpay) {
    resolve(true);
    return;
  }

  const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
  if (existingScript) {
    existingScript.addEventListener('load', () => resolve(true), { once: true });
    existingScript.addEventListener('error', () => reject(new Error('Razorpay checkout could not load.')), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => resolve(true);
  script.onerror = () => reject(new Error('Razorpay checkout could not load.'));
  document.body.appendChild(script);
});

export const BillingManager: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState('scale');
  const [purchaseMode, setPurchaseMode] = useState<'subscription' | 'one-time'>('subscription');
  const [isPaying, setIsPaying] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [gateway, setGateway] = useState<{ configured: boolean; mode: string; methods: string[] } | null>(null);

  const activePlan = (purchaseMode === 'subscription' ? PLANS : ONE_TIME_PURCHASES).find(plan => plan.id === selectedPlan) || (purchaseMode === 'subscription' ? PLANS[1] : ONE_TIME_PURCHASES[0]);

  useEffect(() => {
    fetch(`${PAYMENT_API_URL}/api/payments/status`).then(response => response.ok ? response.json() : null).then(setGateway).catch(() => setGateway(null));
  }, []);

  const startCheckout = async () => {
    setIsPaying(true);
    setStatus(null);

    try {
      const orderResponse = await fetch(`${PAYMENT_API_URL}/api/payments/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: activePlan.id, purchase_type: purchaseMode }),
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || 'Unable to create a Razorpay order.');

      await loadRazorpay();
      if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable.');

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Shogun KUBER X',
        description: `${activePlan.name} ${purchaseMode === 'subscription' ? 'subscription' : 'purchase'}`,
        order_id: order.orderId,
        prefill: { name: 'Ashirbad Biswal', email: 'ashirbad.admin@shogun-kuber.io' },
        theme: { color: '#0891b2' },
        method: { upi: true, card: true },
        handler: async (response: Record<string, string>) => {
          try {
            const verificationResponse = await fetch(`${PAYMENT_API_URL}/api/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              // The server uses its stored order metadata, never client-supplied pricing.
              body: JSON.stringify(response),
            });
            const verification = await verificationResponse.json();
            if (!verificationResponse.ok) throw new Error(verification.error || 'Payment verification failed.');
            setStatus({ type: 'success', message: `${activePlan.name} is active. Payment ${verification.paymentId} verified.` });
          } catch (error) {
            setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Payment verification failed.' });
          } finally {
            setIsPaying(false);
          }
        },
        modal: { ondismiss: () => setIsPaying(currentlyPaying => {
          if (currentlyPaying) setStatus({ type: 'error', message: 'Checkout closed before payment was completed.' });
          return false;
        }) },
      });

      checkout.open();
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Unable to start checkout.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-700/20">
        <div>
          <div className="flex items-center gap-2 text-amber-500 text-[11px] font-mono uppercase tracking-[0.18em] mb-2">
            <Sparkles className="w-4 h-4" /> Platform plans
          </div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-100">Choose your operating altitude</h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">Provision the right amount of Kubernetes observability, automation, and response capacity for your team.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <ShieldCheck className={`w-4 h-4 ${gateway?.configured ? 'text-emerald-500' : 'text-amber-500'}`} /> {gateway?.mode === 'live' ? 'Live Razorpay checkout' : gateway?.mode === 'test' ? 'Razorpay test checkout' : 'Razorpay setup required'}
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/70 border border-slate-800 w-fit">
        {(['subscription', 'one-time'] as const).map(mode => <button key={mode} onClick={() => { setPurchaseMode(mode); setSelectedPlan(mode === 'subscription' ? 'scale' : 'incident-pack'); }} className={`glass-button px-4 py-2 rounded-lg text-xs font-bold ${purchaseMode === mode ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>{mode === 'subscription' ? 'Subscriptions' : 'One-time purchases'}</button>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(purchaseMode === 'subscription' ? PLANS : ONE_TIME_PURCHASES).map(plan => {
          const isSelected = selectedPlan === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative text-left p-5 rounded-2xl border transition-all ${
                isSelected
                  ? 'bg-cyan-500/10 border-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
              }`}
            >
              {plan.id === 'scale' && <span className="absolute -top-3 left-5 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold uppercase tracking-wider">Most chosen</span>}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400">{plan.name}</span>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-100">₹{plan.price.toLocaleString('en-IN')}</span>
                    <span className="text-xs text-slate-500">/{plan.cadence.replace('per ', '')}</span>
                  </div>
                </div>
                {isSelected && <BadgeCheck className="w-5 h-5 text-cyan-400" />}
              </div>
              <p className="text-xs text-slate-400 mt-3 min-h-10">{plan.description}</p>
              <div className="mt-5 pt-4 border-t border-slate-800 space-y-2.5">
                {plan.features.map(feature => <div key={feature} className="flex items-center gap-2 text-xs text-slate-300"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />{feature}</div>)}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-amber-400" /><h2 className="text-sm font-bold text-slate-100">Selected plan: {activePlan.name}</h2></div>
          <p className="text-xs text-slate-400">Your subscription is created as a Razorpay order only after you confirm this selection. No card information is stored by KUBER X.</p>
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-400 font-mono"><span>INR billing</span><span>•</span><span>Cancel anytime</span><span>•</span><span>GST invoice after payment</span></div>
        </div>
        <div className="p-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/10">
          <div className="flex justify-between items-center text-xs text-slate-400"><span>Due today</span><span className="font-mono">{purchaseMode === 'subscription' ? 'Monthly renewal' : 'One-time charge'}</span></div>
          <div className="text-3xl font-bold text-slate-100 mt-1">₹{activePlan.price.toLocaleString('en-IN')}</div>
          <button onClick={startCheckout} disabled={isPaying || !gateway?.configured} className="w-full mt-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors">
            {isPaying ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {isPaying ? 'Preparing checkout...' : gateway?.configured ? 'Pay securely with Razorpay' : 'Configure Razorpay keys'}
            {!isPaying && <ExternalLink className="w-3.5 h-3.5" />}
          </button>
          {status && <div className={`mt-3 text-xs ${status.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>{status.message}</div>}
          {!gateway?.configured && <div className="mt-3 text-xs text-amber-300">Add Razorpay keys on the server, then activate UPI and cards in the Razorpay Dashboard.</div>}
        </div>
      </div>
    </div>
  );
};
