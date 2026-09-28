import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCircle2, Clock3, MapPin, Navigation, PackageCheck, RefreshCw, WifiOff } from 'lucide-react';
import { api } from '../../services/api';
import { DeliveryAnalytics, DeliveryEndpoint, DeliveryStatus } from '../../types';

interface DeliveryDashboardProps {
  isDarkMode: boolean;
  isOnline: boolean;
}

const EMPTY_ANALYTICS: DeliveryAnalytics = { total: 0, delivered: 0, inTransit: 0, delayed: 0, averageProgress: 0, urgent: 0 };
const statusLabels: Record<DeliveryStatus, string> = { pending: 'Pending', in_transit: 'In transit', delivered: 'Delivered', delayed: 'Delayed' };
const statusColors: Record<DeliveryStatus, string> = {
  pending: 'text-slate-500 bg-slate-100',
  in_transit: 'text-cyan-800 bg-cyan-50',
  delivered: 'text-emerald-800 bg-emerald-50',
  delayed: 'text-rose-800 bg-rose-50',
};

export const DeliveryDashboard: React.FC<DeliveryDashboardProps> = ({ isDarkMode, isOnline }) => {
  const [deliveries, setDeliveries] = useState<DeliveryEndpoint[]>([]);
  const [analytics, setAnalytics] = useState<DeliveryAnalytics>(EMPTY_ANALYTICS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const notifiedIds = useRef(new Set<string>());
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const loadDeliveries = async () => {
    setIsRefreshing(true);
    const result = await api.getDeliveries();
    setDeliveries(result.deliveries);
    setAnalytics(result.analytics);
    setSelectedId(current => current && result.deliveries.some(item => item.id === current) ? current : result.deliveries[0]?.id || null);
    const urgentItems = result.deliveries.filter(item => item.urgent && item.status === 'delayed');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      urgentItems.forEach(item => {
        if (!notifiedIds.current.has(item.id)) {
          new Notification(`Urgent delivery update: ${item.city}`, { body: `${item.trackingCode} is delayed. Review the endpoint status.`, tag: item.id });
          notifiedIds.current.add(item.id);
        }
      });
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadDeliveries();
    const interval = window.setInterval(loadDeliveries, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedDelivery = deliveries.find(item => item.id === selectedId) || deliveries[0];
  const mapUrl = selectedDelivery && mapsKey
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${selectedDelivery.latitude},${selectedDelivery.longitude}&zoom=11`
    : '';

  const requestNotifications = async () => {
    if (typeof Notification !== 'undefined') await Notification.requestPermission();
  };

  const updateStatus = async (delivery: DeliveryEndpoint, status: DeliveryStatus) => {
    const updated = await api.updateDeliveryStatus(delivery.id, status, status === 'delivered' ? 100 : undefined);
    setDeliveries(current => current.map(item => item.id === updated.id ? updated : item));
    setAnalytics(current => ({ ...current, delivered: status === 'delivered' ? current.delivered + (delivery.status === 'delivered' ? 0 : 1) : current.delivered, delayed: status === 'delayed' ? current.delayed + (delivery.status === 'delayed' ? 0 : 1) : Math.max(0, current.delayed - (delivery.status === 'delayed' ? 1 : 0)), urgent: status === 'delayed' ? current.urgent + (delivery.urgent ? 0 : 1) : Math.max(0, current.urgent - (delivery.urgent ? 1 : 0)) }));
  };

  const progressLabel = useMemo(() => `${analytics.averageProgress}% average completion`, [analytics.averageProgress]);

  return (
    <div className="delivery-dashboard space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-700/20">
        <div>
          <div className="flex items-center gap-2 text-cyan-600 text-[11px] font-mono uppercase tracking-[0.18em] mb-2"><Navigation className="w-4 h-4" /> India regional delivery control</div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Delivery endpoints & live tracking</h1>
          <p className="text-sm text-slate-500 mt-2">Real-time delivery analytics across Indian regional fulfilment hubs.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg text-xs font-semibold"><WifiOff className="w-3.5 h-3.5" /> Offline cache</span>}
          <button onClick={requestNotifications} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold"><Bell className="w-3.5 h-3.5" /> Enable urgent alerts</button>
          <button onClick={loadDeliveries} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600" aria-label="Refresh deliveries"><RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          ['Total endpoints', analytics.total, 'text-slate-900'],
          ['Delivered', analytics.delivered, 'text-emerald-600'],
          ['In transit', analytics.inTransit, 'text-cyan-600'],
          ['Delayed', analytics.delayed, 'text-rose-600'],
          ['Urgent', analytics.urgent, 'text-amber-600'],
          ['Progress', progressLabel, 'text-violet-600'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{label}</div><div className={`mt-2 text-xl font-bold ${color}`}>{value}</div></div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
        <section className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="p-4 border-b border-slate-200 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Regional endpoints</h2><p className="text-xs text-slate-500 mt-1">Polling every 5 seconds {isOnline ? 'from the Node API' : 'from local cache'}.</p></div><PackageCheck className="w-5 h-5 text-cyan-600" /></div>
          <div className="divide-y divide-slate-100">
            {deliveries.map(delivery => (
              <button key={delivery.id} onClick={() => setSelectedId(delivery.id)} className={`w-full text-left p-4 transition-colors ${selectedDelivery?.id === delivery.id ? 'bg-cyan-50' : 'hover:bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-cyan-600" /><span className="font-bold text-sm text-slate-900">{delivery.city}</span>{delivery.urgent && <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Urgent</span>}</div><div className="text-xs text-slate-500 mt-1">{delivery.customerName} · {delivery.trackingCode}</div></div><span className={`px-2 py-1 rounded text-[10px] font-bold ${statusColors[delivery.status]}`}>{statusLabels[delivery.status]}</span></div>
                <div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${delivery.status === 'delayed' ? 'bg-rose-500' : 'bg-cyan-500'}`} style={{ width: `${delivery.progress}%` }} /></div><span className="text-[11px] font-mono text-slate-500">{delivery.progress}%</span></div>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500"><Clock3 className="w-3 h-3" /> ETA {delivery.eta}</div>
              </button>
            ))}
          </div>
        </section>

        <section className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="p-4 border-b border-slate-200"><h2 className="text-sm font-bold text-slate-900">Google Maps endpoint view</h2><p className="text-xs text-slate-500 mt-1">{selectedDelivery ? `${selectedDelivery.city}, ${selectedDelivery.region}` : 'Select an endpoint'}</p></div>
          {selectedDelivery && mapsKey ? <iframe title={`Google Maps location for ${selectedDelivery.city}`} src={mapUrl} className="w-full h-64 border-0" loading="lazy" allowFullScreen /> : <div className="h-64 bg-slate-100 flex flex-col items-center justify-center text-center p-6"><MapPin className="w-8 h-8 text-cyan-600 mb-2" /><p className="text-sm font-semibold text-slate-700">Google Maps API key required</p><p className="text-xs text-slate-500 mt-1">Set VITE_GOOGLE_MAPS_API_KEY to render the live map. Coordinates remain available below.</p></div>}
          {selectedDelivery && <div className="p-4 space-y-3"><div className="grid grid-cols-2 gap-3 text-xs"><div><span className="text-slate-500">Latitude</span><div className="font-mono text-slate-800">{selectedDelivery.latitude}</div></div><div><span className="text-slate-500">Longitude</span><div className="font-mono text-slate-800">{selectedDelivery.longitude}</div></div></div><div className="flex gap-2"><a className="flex-1 text-center py-2 rounded-lg bg-cyan-600 text-white text-xs font-bold" href={`https://www.google.com/maps/search/?api=1&query=${selectedDelivery.latitude},${selectedDelivery.longitude}`} target="_blank" rel="noreferrer">Open in Google Maps</a><select value={selectedDelivery.status} onChange={event => updateStatus(selectedDelivery, event.target.value as DeliveryStatus)} className="rounded-lg border border-slate-200 px-2 text-xs text-slate-700"><option value="pending">Pending</option><option value="in_transit">In transit</option><option value="delivered">Delivered</option><option value="delayed">Delayed</option></select></div><div className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Last updated {new Date(selectedDelivery.updatedAt).toLocaleTimeString()}</div></div>}
        </section>
      </div>
    </div>
  );
};
