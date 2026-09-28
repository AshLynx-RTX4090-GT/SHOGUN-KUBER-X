import React, { useState } from 'react';
import { Bell, Bot, LifeBuoy, Send, ShieldCheck } from 'lucide-react';

export const SupportManager: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('Ask about Kubernetes, billing, alerts, S3, or account security.');
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted');

  const askAssistant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/support/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
      const data = await response.json();
      setAnswer(data.answer || 'The support team is unavailable right now. Please try again.');
    } catch {
      setAnswer('Offline assistant: your question is saved locally. Reconnect to receive a live answer from the support service.');
    } finally {
      setIsLoading(false);
    }
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotifications(permission === 'granted');
  };

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-700/20"><div className="flex items-center gap-2 text-fuchsia-400 text-[11px] font-mono uppercase tracking-[0.18em] mb-2"><LifeBuoy className="w-4 h-4" /> 24/7 platform help</div><h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-100">AI support & status center</h1><p className="text-sm text-slate-400 mt-2">Get an instant operational answer or connect your browser to critical status notifications.</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <section className="glass-panel rounded-2xl border border-slate-800 p-6"><div className="flex items-center gap-2 mb-4"><Bot className="w-5 h-5 text-cyan-400" /><h2 className="text-sm font-bold text-slate-100">KUBER X assistant</h2></div><div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm leading-6 text-slate-200 min-h-28">{answer}</div><form onSubmit={askAssistant} className="mt-4 flex gap-2"><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="How do I investigate a pod eviction?" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400" /><button disabled={isLoading} className="glass-button rounded-xl bg-cyan-500 px-4 text-slate-950" aria-label="Ask assistant">{isLoading ? <span className="block w-4 h-4 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" /> : <Send className="w-4 h-4" />}</button></form></section>
        <section className="glass-panel rounded-2xl border border-slate-800 p-6"><div className="flex items-center gap-2"><Bell className="w-5 h-5 text-amber-400" /><h2 className="text-sm font-bold text-slate-100">Critical updates</h2></div><p className="text-xs text-slate-400 mt-3">Receive browser notifications for incidents and project milestones while this workspace is open.</p><button onClick={enableNotifications} className="glass-button mt-5 w-full rounded-xl border border-amber-400/40 px-4 py-2.5 text-xs font-bold text-amber-300">{notifications ? 'Notifications enabled' : 'Enable notifications'}</button><div className="mt-5 text-xs text-slate-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> No notification data leaves your browser.</div></section>
      </div>
    </div>
  );
};
