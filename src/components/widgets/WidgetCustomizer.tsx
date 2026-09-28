import React, { useState } from 'react';
import { 
  Sliders, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  HardDrive, 
  Check, 
  RotateCcw,
  Zap
} from 'lucide-react';
import { WidgetConfig, OfflineQueueItem } from '../../types';

interface WidgetCustomizerProps {
  widgets: WidgetConfig[];
  onUpdateWidgets: (widgets: WidgetConfig[]) => void;
  refreshIntervalMs: number;
  onChangeRefreshInterval: (ms: number) => void;
  isOnline: boolean;
  offlineQueue: OfflineQueueItem[];
  onManualSync: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const WidgetCustomizer: React.FC<WidgetCustomizerProps> = ({
  widgets,
  onUpdateWidgets,
  refreshIntervalMs,
  onChangeRefreshInterval,
  isOnline,
  offlineQueue,
  onManualSync,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const toggleWidget = (id: string) => {
    const updated = widgets.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
    onUpdateWidgets(updated);
  };

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;

    const copy = [...widgets];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    // re-assign order index
    const reordered = copy.map((w, idx) => ({ ...w, order: idx }));
    onUpdateWidgets(reordered);
  };

  const resetWidgets = () => {
    const defaults: WidgetConfig[] = [
      { id: 'kpi_cards', title: 'Top KPI Metrics (CPU, RAM, Pods, S3 Storage)', enabled: true, order: 0, description: 'Summary cards of cluster compute allocation and S3 volume' },
      { id: 'telemetry_chart', title: 'Interactive Real-Time Telemetry Stream', enabled: true, order: 1, description: 'Time-series curve with multi-metric toggle and hover percentile inspection' },
      { id: 'incident_feed', title: 'Live Incident & Push Alert Stream', enabled: true, order: 2, description: 'Recent active and acknowledged incident notices dispatched to SNS/Slack' },
      { id: 'quick_actions', title: 'DevOps & Storage Fast Actions', enabled: true, order: 3, description: 'One-click shortcuts to S3 uploads, pod terminal, and CI/CD pipelines' },
    ];
    onUpdateWidgets(defaults);
  };

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await onManualSync();
    setSyncStatusMsg('Offline queue successfully synchronized with AWS S3 & EKS API.');
    setIsSyncing(false);
    setTimeout(() => setSyncStatusMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-cyan-400" />
            <span>Dashboard Widget Layout & Offline Syncing</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Personalize your workspace layout, telemetry polling rates, and manage offline data caching.
          </p>
        </div>

        <button
          onClick={resetWidgets}
          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 font-medium cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Layout</span>
        </button>
      </div>

      {/* Widget Ordering & Visibility Manager */}
      <div className={`p-5 rounded-xl border ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <h2 className="text-sm font-bold text-slate-200 mb-1">
          Active Dashboard Widgets Configuration
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Toggle widget display or reorder vertical positioning for the main overview dashboard.
        </p>

        <div className="space-y-2.5">
          {widgets.map((widget, idx) => (
            <div
              key={widget.id}
              className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                widget.enabled 
                  ? 'bg-slate-800/40 border-slate-700' 
                  : 'bg-slate-900/30 border-slate-800/60 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-500 w-5">
                  #{idx + 1}
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-200">{widget.title}</h3>
                  <p className="text-[11px] text-slate-400">{widget.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => moveWidget(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors cursor-pointer"
                  title="Move Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => moveWidget(idx, 'down')}
                  disabled={idx === widgets.length - 1}
                  className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors cursor-pointer"
                  title="Move Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => toggleWidget(widget.id)}
                  className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                    widget.enabled
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {widget.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{widget.enabled ? 'Visible' : 'Hidden'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Settings: Polling Cadence & Offline Data Engine */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Polling Interval Setting */}
        <div className={`p-5 rounded-xl border ${
          isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>Telemetry Polling Cadence</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Adjust real-time refresh frequency based on your network bandwidth and battery preferences.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { ms: 2000, label: '2s Ultra' },
              { ms: 5000, label: '5s Nominal' },
              { ms: 10000, label: '10s Eco' },
              { ms: 0, label: 'Paused' },
            ].map(item => (
              <button
                key={item.ms}
                onClick={() => onChangeRefreshInterval(item.ms)}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                  refreshIntervalMs === item.ms
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Offline Sync & Local Cache Status */}
        <div className={`p-5 rounded-xl border ${
          isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-sky-400" />
            <span>Offline Sync Engine & Cache</span>
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Offline mutations (S3 file uploads, alert acks) are stored locally in IndexedDB/cache and auto-synced.
          </p>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono mb-3">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-slate-200">{isOnline ? 'Network Connected' : 'Offline Mode Active'}</span>
            </div>

            <span className="text-slate-400 tabular-nums">
              {offlineQueue.length} Pending Mutations
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncClick}
              disabled={isSyncing || offlineQueue.length === 0}
              className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Queued Changes Now'}</span>
            </button>
          </div>

          {syncStatusMsg && (
            <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{syncStatusMsg}</span>
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
