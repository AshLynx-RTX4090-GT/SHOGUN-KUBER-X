import React, { useState } from 'react';
import { 
  BellRing, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Check, 
  Slack, 
  Mail, 
  Radio, 
  ShieldAlert,
  Clock,
  RefreshCw
} from 'lucide-react';
import { AlertItem, User } from '../../types';
import { api } from '../../services/api';

interface AlertsManagerProps {
  alerts: AlertItem[];
  currentUser: User | null;
  isDarkMode: boolean;
  onRefreshAlerts: () => void;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  alerts,
  currentUser,
  isDarkMode,
  onRefreshAlerts,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');

  // Dispatch Form State
  const [alertTitle, setAlertTitle] = useState('High Cluster Memory Pressure in Worker Node 04');
  const [severity, setSeverity] = useState<'critical' | 'warning' | 'info'>('critical');
  const [description, setDescription] = useState('Pod memory limit reached 92%. Kubernetes OOM killer risk detected on pod s3-media-transcoder.');
  const [channels, setChannels] = useState<{ slack: boolean; sns: boolean; email: boolean }>({
    slack: true,
    sns: true,
    email: true,
  });
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchReceipt, setDispatchReceipt] = useState<any>(null);

  const canTriggerAlerts = currentUser?.permissions.includes('alerts:trigger') || currentUser?.role === 'super_admin';

  const filteredAlerts = alerts.filter(a => {
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  const handleAcknowledge = async (id: string) => {
    await api.acknowledgeAlert(id);
    onRefreshAlerts();
  };

  const handleResolve = async (id: string) => {
    await api.resolveAlert(id);
    onRefreshAlerts();
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim()) return;

    setIsDispatching(true);
    const activeChannels: ('slack' | 'sns' | 'email')[] = [];
    if (channels.slack) activeChannels.push('slack');
    if (channels.sns) activeChannels.push('sns');
    if (channels.email) activeChannels.push('email');

    try {
      const res = await api.dispatchIncidentAlert({
        title: alertTitle,
        severity,
        description,
        channels: activeChannels,
      });

      setDispatchReceipt(res.dispatchLog);
      onRefreshAlerts();
    } catch (err) {
      console.error('Failed to dispatch incident alert:', err);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <BellRing className="w-6 h-6 text-rose-500" />
            <span>Incident Response & Multi-Channel Alert Dispatcher</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time push notifications across AWS SNS, Slack incident room, and PagerDuty email webhooks.
          </p>
        </div>

        <button
          onClick={onRefreshAlerts}
          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 font-medium self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Alerts</span>
        </button>
      </div>

      {/* Two Column Layout: Dispatcher Form & Live Alerts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Multi-Channel Dispatch Console (1 col) */}
        <div className={`p-5 rounded-xl border flex flex-col justify-between ${
          isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-1">
              <Send className="w-4 h-4 text-cyan-400" />
              <span>Broadcast Incident Alert</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Dispatches alerts to SRE on-call engineers via SNS, Slack, and email.
            </p>

            <form onSubmit={handleDispatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1">Alert Headline</label>
                <input
                  type="text"
                  value={alertTitle}
                  onChange={e => setAlertTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 focus:outline-none focus:border-rose-500 font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1">Severity Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['critical', 'warning', 'info'] as const).map(sev => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity(sev)}
                      className={`py-1.5 rounded-lg text-xs font-mono uppercase font-bold transition-colors cursor-pointer ${
                        severity === sev
                          ? sev === 'critical'
                            ? 'bg-rose-600 text-white'
                            : sev === 'warning'
                            ? 'bg-amber-600 text-white'
                            : 'bg-cyan-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1">Incident Diagnostic Details</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 focus:outline-none focus:border-rose-500 font-sans resize-none"
                  required
                />
              </div>

              {/* Channel Selector */}
              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1.5">Escalation Channels</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.sns}
                      onChange={e => setChannels(prev => ({ ...prev, sns: e.target.checked }))}
                      className="rounded text-rose-500"
                    />
                    <Radio className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-semibold text-slate-200">AWS SNS Topic</span>
                    <span className="text-[10px] text-slate-500 font-mono ml-auto">Direct Push</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.slack}
                      onChange={e => setChannels(prev => ({ ...prev, slack: e.target.checked }))}
                      className="rounded text-rose-500"
                    />
                    <Slack className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-semibold text-slate-200">Slack Webhook</span>
                    <span className="text-[10px] text-slate-500 font-mono ml-auto">#incident-room</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.email}
                      onChange={e => setChannels(prev => ({ ...prev, email: e.target.checked }))}
                      className="rounded text-rose-500"
                    />
                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-semibold text-slate-200">PagerDuty / Email</span>
                    <span className="text-[10px] text-slate-500 font-mono ml-auto">On-Call SLA</span>
                  </label>
                </div>
              </div>

              {canTriggerAlerts ? (
                <button
                  type="submit"
                  disabled={isDispatching}
                  className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Send className={`w-3.5 h-3.5 ${isDispatching ? 'animate-spin' : ''}`} />
                  <span>{isDispatching ? 'Transmitting Escalation...' : 'Dispatch Alert Immediately'}</span>
                </button>
              ) : (
                <div className="p-2 rounded bg-amber-950/40 border border-amber-900/60 text-amber-300 text-[11px] text-center">
                  Viewer mode: Switch to Super Admin or DevOps Lead to dispatch alerts.
                </div>
              )}
            </form>
          </div>

          {dispatchReceipt && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-[11px] text-emerald-300 font-mono space-y-1">
              <div className="font-bold flex items-center gap-1 text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Delivery Receipts Confirmed</span>
              </div>
              <div className="truncate text-slate-400">SNS: {dispatchReceipt.snsTopicArn}</div>
              <div className="truncate text-slate-400">Slack: {dispatchReceipt.slackChannel}</div>
              <div className="truncate text-slate-400">Email: {dispatchReceipt.recipientEmail}</div>
            </div>
          )}
        </div>

        {/* Right Column: Live Incident Log Stream (2 cols) */}
        <div className={`lg:col-span-2 p-5 rounded-xl border ${
          isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Active & Historical System Incidents</span>
              </h2>
              <p className="text-xs text-slate-400">
                Chronological audit record of cluster events and operator interventions.
              </p>
            </div>

            {/* Severity and Status Filter Selectors */}
            <div className="flex items-center gap-2">
              <select
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value as any)}
                className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
              >
                <option value="all">All States</option>
                <option value="active">Active</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
                No alerts found matching filter criteria.
              </div>
            ) : (
              filteredAlerts.map(alert => {
                const isCritical = alert.severity === 'critical';
                const isWarning = alert.severity === 'warning';

                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isCritical
                        ? 'bg-rose-950/20 border-rose-900/50'
                        : isWarning
                        ? 'bg-amber-950/20 border-amber-900/50'
                        : 'bg-slate-800/40 border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          isCritical ? 'bg-rose-600 text-white' : isWarning ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-200'
                        }`}>
                          {alert.severity}
                        </span>
                        <h3 className="font-bold text-xs text-slate-100">{alert.title}</h3>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          alert.status === 'active'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : alert.status === 'acknowledged'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}>
                          {alert.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                      {alert.description}
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
                      <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                        <span>Source: {alert.source}</span>
                        <span>·</span>
                        <span>Delivered: {alert.dispatchedChannels.join(', ')}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {alert.status === 'active' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Resolve</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
