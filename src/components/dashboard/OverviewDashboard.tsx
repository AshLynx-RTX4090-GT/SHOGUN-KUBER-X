import React, { useState } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Layers, 
  Database, 
  Zap, 
  ArrowUpRight, 
  Clock, 
  AlertOctagon, 
  ShieldCheck,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { SystemMetrics, MetricHistoryPoint, ClusterInfo, AlertItem, WidgetConfig } from '../../types';
import { DeveloperMarquee } from './DeveloperMarquee';

interface OverviewDashboardProps {
  metrics: SystemMetrics | null;
  history: MetricHistoryPoint[];
  cluster: ClusterInfo | null;
  alerts: AlertItem[];
  widgets: WidgetConfig[];
  isDarkMode: boolean;
  onNavigateTab: (tab: any) => void;
  onTriggerSimulatedAlert: () => void;
  onRefreshMetrics: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  metrics,
  history,
  cluster,
  alerts,
  widgets,
  isDarkMode,
  onNavigateTab,
  onTriggerSimulatedAlert,
  onRefreshMetrics,
}) => {
  const [activeChartMetric, setActiveChartMetric] = useState<'cpu' | 'memory' | 'network' | 'rps'>('cpu');
  const [hoveredPoint, setHoveredPoint] = useState<MetricHistoryPoint | null>(null);

  const activeWidgetMap = widgets.reduce<Record<string, boolean>>((acc, w) => {
    acc[w.id] = w.enabled;
    return acc;
  }, {});

  // Compute SVG chart coordinates
  const chartPoints = history.length > 0 ? history : [];
  const maxVal = activeChartMetric === 'cpu' || activeChartMetric === 'memory' 
    ? 100 
    : activeChartMetric === 'network' 
    ? Math.max(...chartPoints.map(p => p.network), 500)
    : Math.max(...chartPoints.map(p => p.rps), 20000);

  const svgWidth = 800;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  const pointsString = chartPoints.map((pt, idx) => {
    const x = paddingX + (idx / Math.max(1, chartPoints.length - 1)) * (svgWidth - paddingX * 2);
    const val = pt[activeChartMetric];
    const y = svgHeight - paddingY - (val / maxVal) * (svgHeight - paddingY * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaString = chartPoints.length > 0 
    ? `${paddingX},${svgHeight - paddingY} ${pointsString} ${svgWidth - paddingX},${svgHeight - paddingY}`
    : '';

  return (
    <div className="space-y-6">
      <DeveloperMarquee />
      {/* Top Banner & Control Zone */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Cluster Telemetry & Performance</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-node observability engine for EKS production workload & AWS S3 pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshMetrics}
            className={`px-3 py-1.5 text-xs rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
              isDarkMode 
                ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300' 
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={onTriggerSimulatedAlert}
            className="px-3 py-1.5 text-xs rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white font-medium flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Simulate Anomaly</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards Grid */}
      {activeWidgetMap['kpi_cards'] !== false && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>CPU Cluster Load</span>
              </span>
              <span className="text-emerald-400 flex items-center font-mono">
                <TrendingUp className="w-3 h-3 mr-0.5" /> Nominal
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-100">
                {metrics?.cpuUsagePercent ?? 48}%
              </div>
              <span className="text-xs text-slate-400 font-mono">8 Cores Active</span>
            </div>
            <div className="mt-3 w-full bg-slate-800/40 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${metrics?.cpuUsagePercent ?? 48}%` }}
              />
            </div>
          </div>

          {/* Memory Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <HardDrive className="w-4 h-4 text-sky-400" />
                <span>Memory Allocation</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">64 GB Total</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-100">
                {metrics?.memoryUsedGB ?? '41.2'} <span className="text-sm font-normal text-slate-400">GB</span>
              </div>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {metrics?.memoryUsagePercent ?? 64}%
              </span>
            </div>
            <div className="mt-3 w-full bg-slate-800/40 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-sky-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${metrics?.memoryUsagePercent ?? 64}%` }}
              />
            </div>
          </div>

          {/* Pods Status Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Pod Topology</span>
              </span>
              <button 
                onClick={() => onNavigateTab('kubernetes')}
                className="text-xs text-cyan-400 hover:underline flex items-center"
              >
                Inspect <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </button>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-100">
                {cluster?.podsRunning ?? 118}
                <span className="text-xs font-normal text-slate-400"> / {cluster?.podsTotal ?? 124}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-amber-400">{cluster?.podsPending ?? 4} pend</span>
                <span className="text-rose-400">{cluster?.podsFailed ?? 2} fail</span>
              </div>
            </div>
            <div className="mt-3 flex gap-1 h-1.5 rounded-full overflow-hidden bg-slate-800/40">
              <div className="bg-emerald-400 h-full" style={{ width: '92%' }} />
              <div className="bg-amber-400 h-full" style={{ width: '5%' }} />
              <div className="bg-rose-400 h-full" style={{ width: '3%' }} />
            </div>
          </div>

          {/* AWS S3 Storage Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Database className="w-4 h-4 text-purple-400" />
                <span>AWS S3 Managed</span>
              </span>
              <button 
                onClick={() => onNavigateTab('storage')}
                className="text-xs text-purple-400 hover:underline flex items-center"
              >
                Media Vault <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </button>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-100">
                809 <span className="text-sm font-normal text-slate-400">MB</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">3 Buckets Active</span>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Glacier Tiered</span>
              <span className="font-mono text-slate-200">1,420 snapshots</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Telemetry Graph Section */}
      {activeWidgetMap['telemetry_chart'] !== false && (
        <div className={`p-5 rounded-xl border ${
          isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Live Cluster Observability Stream</span>
              </h2>
              <p className="text-xs text-slate-400">
                Interactive real-time metrics polled at 3s intervals with percentile telemetry.
              </p>
            </div>

            {/* Metric Segmented Control Buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-800/80 rounded-lg text-xs font-medium">
              {(
                [
                  { id: 'cpu', label: 'CPU %' },
                  { id: 'memory', label: 'RAM %' },
                  { id: 'network', label: 'Network MB/s' },
                  { id: 'rps', label: 'RPS Throughput' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveChartMetric(tab.id)}
                  className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
                    activeChartMetric === tab.id
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Telemetry Canvas */}
          <div className="relative w-full overflow-hidden">
            <svg 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
              className="w-full h-56 select-none"
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="#334155" strokeDasharray="3 3" strokeOpacity="0.4" />
              <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="#334155" strokeDasharray="3 3" strokeOpacity="0.4" />
              <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="#334155" strokeOpacity="0.6" />

              {/* Area Under Curve */}
              {areaString && (
                <polygon points={areaString} fill="url(#chartGradient)" />
              )}

              {/* Smooth Trajectory Polyline */}
              {pointsString && (
                <polyline
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointsString}
                />
              )}

              {/* Data points */}
              {chartPoints.map((pt, idx) => {
                const x = paddingX + (idx / Math.max(1, chartPoints.length - 1)) * (svgWidth - paddingX * 2);
                const val = pt[activeChartMetric];
                const y = svgHeight - paddingY - (val / maxVal) * (svgHeight - paddingY * 2);
                const isHovered = hoveredPoint?.timestamp === pt.timestamp;
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r={isHovered ? 5 : 2}
                    className="cursor-pointer transition-all"
                    fill={isHovered ? '#38bdf8' : '#0891b2'}
                    stroke={isHovered ? '#ffffff' : '#0e7490'}
                    strokeWidth="1.5"
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint && (
              <div className="absolute top-2 right-4 bg-slate-800/90 border border-slate-700 text-slate-100 text-xs rounded-lg p-2.5 shadow-lg backdrop-blur-md font-mono">
                <div className="text-[10px] text-slate-400 mb-1">{hoveredPoint.timestamp}</div>
                <div className="flex gap-4">
                  <div>CPU: <span className="text-cyan-400 font-bold">{hoveredPoint.cpu}%</span></div>
                  <div>RAM: <span className="text-sky-400 font-bold">{hoveredPoint.memory}%</span></div>
                  <div>Net: <span className="text-emerald-400 font-bold">{hoveredPoint.network} MB/s</span></div>
                  <div>RPS: <span className="text-amber-400 font-bold">{hoveredPoint.rps}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Latency & SLO Percentile Strip */}
          <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Latency P50</span>
              <span className="text-slate-200 font-bold tabular-nums">{metrics?.latencies.p50 ?? 18} ms</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Latency P95</span>
              <span className="text-slate-200 font-bold tabular-nums">{metrics?.latencies.p95 ?? 44} ms</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Latency P99</span>
              <span className="text-amber-400 font-bold tabular-nums">{metrics?.latencies.p99 ?? 89} ms</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Error Rate</span>
              <span className="text-emerald-400 font-bold tabular-nums">{metrics?.errorRatePercent ?? 0.05}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Section: Live Incidents & Fast Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident Alerts Feed (2 cols) */}
        {activeWidgetMap['incident_feed'] !== false && (
          <div className={`lg:col-span-2 p-5 rounded-xl border ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <span>Real-Time Incident Stream & Alert Logs</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Integrated with AWS SNS, Slack Webhook, and On-Call escalation.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('alerts')}
                className="text-xs text-cyan-400 hover:underline flex items-center font-medium"
              >
                View Dispatcher <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>

            <div className="space-y-3">
              {alerts.slice(0, 3).map(alert => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    alert.severity === 'critical'
                      ? 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                      : alert.severity === 'warning'
                      ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        alert.severity === 'critical' ? 'bg-rose-600 text-white' : alert.severity === 'warning' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-200'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="font-semibold text-slate-100">{alert.title}</span>
                    </div>
                    <p className="text-xs text-slate-400">{alert.description}</p>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Source: {alert.source} · Time: {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      via {alert.dispatchedChannels.join(' + ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Operations & Architecture Shortcuts (1 col) */}
        {activeWidgetMap['quick_actions'] !== false && (
          <div className={`p-5 rounded-xl border flex flex-col justify-between ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>DevOps & Storage Actions</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Instant access to core Kubernetes modules and cloud infrastructure.
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => onNavigateTab('storage')}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-xs transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold text-slate-200">AWS S3 Media Hub</div>
                      <div className="text-[10px] text-slate-400">Upload & stream videos & images</div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </button>

                <button
                  onClick={() => onNavigateTab('kubernetes')}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-xs transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-slate-200">Kubernetes Pod Inspector</div>
                      <div className="text-[10px] text-slate-400">Live logs, restart pods, scale nodes</div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </button>

                <button
                  onClick={() => onNavigateTab('devops')}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-xs transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="font-semibold text-slate-200">CI/CD & Terraform IaC</div>
                      <div className="text-[10px] text-slate-400">GitHub Actions pipeline & Docker</div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>RBAC Enforced</span>
              </span>
              <span>JWT Bearer 24h</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
