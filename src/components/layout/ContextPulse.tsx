import React, { useEffect, useState } from 'react';
import { CloudSun, MapPin, Navigation, Sun, Wind } from 'lucide-react';

interface ContextState { country: string; region: string; timezone: string; temperature: number; wind: number; source: string; }

export const ContextPulse: React.FC = () => {
  const [context, setContext] = useState<ContextState | null>(null);
  const [time, setTime] = useState(() => new Date());
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'denied'>('idle');

  useEffect(() => {
    const interval = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) { setStatus('denied'); return; }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`/api/location/context?latitude=${coords.latitude}&longitude=${coords.longitude}`);
        if (!response.ok) throw new Error('Location service unavailable');
        const location = await response.json();
        setContext({ country: location.country || 'Detected location', region: location.region || '', timezone: location.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, temperature: location.temperature ?? 0, wind: location.wind ?? 0, source: location.source || 'Location service' });
        setStatus('ready');
      } catch { setStatus('denied'); }
    }, () => setStatus('denied'), { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  };

  const timezone = context?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localTime = new Intl.DateTimeFormat([], { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(time);

  return <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
    <span className="flex items-center gap-1.5"><Sun className="w-3.5 h-3.5 text-amber-400" />{localTime}</span>
    {context ? <><span aria-hidden="true">·</span><span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-cyan-400" />{context.region || context.country}</span><span className="flex items-center gap-1"><CloudSun className="w-3 h-3 text-sky-400" />{context.temperature}°C</span><span className="hidden xl:flex items-center gap-1"><Wind className="w-3 h-3 text-slate-500" />{context.wind} km/h</span></> : <button onClick={detectLocation} disabled={status === 'loading'} className="underline underline-offset-2 text-cyan-400 hover:text-cyan-300">{status === 'loading' ? 'Detecting...' : status === 'denied' ? 'Location unavailable' : <><Navigation className="inline w-3 h-3 mr-1" />Enable weather</>}</button>}
  </div>;
};
