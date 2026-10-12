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
  TrendingUp,
  RefreshCw,
  Cloud,
  ArrowRight,
  Server,
  BellRing,
  Key,
  ShieldCheck,
  Check,
  Globe,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { 
  SystemMetrics, 
  MetricHistoryPoint, 
  ClusterInfo, 
  AlertItem, 
  WidgetConfig,
  AwsAccountStatus,
  AwsDiscoveryData
} from '../../types';
import { LiveClusterTelemetryDashboard } from './LiveClusterTelemetryDashboard';
import { api } from '../../services/api';

interface OverviewDashboardProps {
  metrics: SystemMetrics | null;
  history: MetricHistoryPoint[];
  cluster: ClusterInfo | null;
  alerts: AlertItem[];
  widgets: WidgetConfig[];
  isDarkMode: boolean;
  awsStatus?: AwsAccountStatus | null;
  discovery?: AwsDiscoveryData | null;
  onNavigateTab: (tab: any) => void;
  onTriggerSimulatedAlert: () => void;
  onRefreshMetrics: () => void;
  onSwitchRegion?: (region: string) => void;
}

const POPULAR_REGIONS = [
  { id: 'us-east-1', name: 'US East (N. Virginia)' },
  { id: 'us-east-2', name: 'US East (Ohio)' },
  { id: 'us-west-2', name: 'US West (Oregon)' },
  { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
  { id: 'eu-west-1', name: 'Europe (Ireland)' },
  { id: 'eu-central-1', name: 'Europe (Frankfurt)' },
];

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  metrics,
  history,
  cluster,
  alerts,
  widgets,
  isDarkMode,
  awsStatus,
  discovery,
  onNavigateTab,
  onTriggerSimulatedAlert,
  onRefreshMetrics,
  onSwitchRegion,
}) => {
  const [activeChartMetric, setActiveChartMetric] = useState<'cpu' | 'memory' | 'network' | 'rps'>('cpu');
  const [hoveredPoint, setHoveredPoint] = useState<MetricHistoryPoint | null>(null);

  const isAwsConnected = awsStatus?.connected === true;
  const s3Count = discovery?.summary?.s3BucketCount ?? 0;
  const eksCount = discovery?.summary?.eksClusterCount ?? 0;
  const ec2Count = discovery?.summary?.ec2InstanceCount ?? 0;
  const totalNodes = eksCount + ec2Count;

  const activeWidgetMap = widgets.reduce<Record<string, boolean>>((acc, w) => {
    acc[w.id] = w.enabled;
    return acc;
  }, {});

  // Compute SVG chart coordinates (only if points exist and non-zero)
  const chartPoints = history.length > 0 ? history : [];
  const maxVal = activeChartMetric === 'cpu' || activeChartMetric === 'memory' 
    ? 100 
    : activeChartMetric === 'network' 
    ? Math.max(...chartPoints.map(p => p.network), 10)
    : Math.max(...chartPoints.map(p => p.rps), 50);

  const svgWidth = 800;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  const pointsString = chartPoints.map((pt, idx) => {
    const x = paddingX + (idx / Math.max(1, chartPoints.length - 1)) * (svgWidth - paddingX * 2);
    const val = pt[activeChartMetric];
    const y = svgHeight - paddingY - (val / Math.max(1, maxVal)) * (svgHeight - paddingY * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaString = chartPoints.length > 0 && pointsString
    ? `${paddingX},${svgHeight - paddingY} ${pointsString} ${svgWidth - paddingX},${svgHeight - paddingY}`
    : '';

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Zone */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Cluster Telemetry & Performance</span>
            {isAwsConnected ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isAwsConnected 
              ? `Real-time observability stream synchronized directly with AWS Account ${awsStatus?.account} in ${awsStatus?.region}.`
              : 'Real-time observability engine. Connect your AWS Management Account to stream live cloud metrics.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchRegion && (
            <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs font-mono">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={awsStatus?.region || 'us-east-1'}
                onChange={e => onSwitchRegion(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                title="Switch Active Region"
              >
                {POPULAR_REGIONS.map(r => (
                  <option key={r.id} value={r.id} className="bg-slate-900 text-slate-100">
                    {r.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onRefreshMetrics}
            className={`px-3 py-1.5 text-xs rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              isDarkMode 
                ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300' 
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Core Monitoring Dashboard: Cluster Status, Resource Gauges, Pipeline DAG & S3 Artifacts */}
      <LiveClusterTelemetryDashboard 
        isDarkMode={isDarkMode} 
        onNavigateTab={onNavigateTab} 
      />

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
                {isAwsConnected 
                  ? 'Real-time telemetry stream sourced from your AWS compute instances and CloudWatch metrics.'
                  : 'Awaiting AWS Management Account connection to stream real CloudWatch metrics.'}
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
                  className={`px-3 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
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
            {chartPoints.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg text-center p-4">
                <Activity className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs font-bold text-slate-300">
                  {isAwsConnected ? '0 Running Instances in Selected Region' : 'AWS Disconnected'}
                </p>
                <p className="text-[11px] text-slate-500 max-w-md mt-1">
                  {isAwsConnected 
                    ? `Launch an EC2 instance or EKS cluster in ${awsStatus?.region} to view live CloudWatch CPU/Network telemetry curves.` 
                    : 'Connect your AWS Management Account above to start streaming real CloudWatch telemetry.'}
                </p>
              </div>
            ) : (
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
                  const y = svgHeight - paddingY - (val / Math.max(1, maxVal)) * (svgHeight - paddingY * 2);
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
            )}
          </div>

          {/* Latency & Percentiles */}
          <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Latency P50</span>
              <span className="text-slate-200 font-bold tabular-nums">{metrics?.latencies.p50 ?? 0} ms</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Latency P95</span>
              <span className="text-slate-200 font-bold tabular-nums">{metrics?.latencies.p95 ?? 0} ms</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Latency P99</span>
              <span className="text-amber-400 font-bold tabular-nums">{metrics?.latencies.p99 ?? 0} ms</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Error Rate</span>
              <span className="text-emerald-400 font-bold tabular-nums">{metrics?.errorRatePercent ?? 0}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident Alerts Feed (2 cols) */}
        {activeWidgetMap['incident_feed'] !== false && (
          <div className={`lg:col-span-2 p-5 rounded-xl border ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-rose-400" />
                  <span>Real CloudWatch Alarms & Incidents</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {isAwsConnected 
                    ? `Live alarms fetched from Amazon CloudWatch in ${awsStatus?.region}.`
                    : 'Awaiting AWS connection.'}
                </p>
              </div>

              <button
                onClick={() => onNavigateTab('alerts')}
                className="text-xs text-cyan-400 hover:underline flex items-center font-mono cursor-pointer"
              >
                Open Dispatcher <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {alerts.length === 0 ? (
                <div className="p-6 text-center rounded-lg border border-dashed border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-mono">
                  <ShieldCheck className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                  <span>0 CloudWatch Alarms in ALARM state. All discovered resources nominal.</span>
                </div>
              ) : (
                alerts.map(a => (
                  <div
                    key={a.id}
                    className={`p-3 rounded-lg border flex items-center justify-between text-xs font-mono ${
                      a.severity === 'critical'
                        ? 'bg-rose-950/30 border-rose-900 text-rose-200'
                        : 'bg-amber-950/30 border-amber-900 text-amber-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{a.title}</div>
                      <div className="text-[11px] text-slate-400">{a.description}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-900/40 text-rose-300">
                      {a.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Quick Actions (1 col) */}
        {activeWidgetMap['quick_actions'] !== false && (
          <div className={`p-5 rounded-xl border space-y-3 ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>AWS Cloud Quick Actions</span>
            </h3>
            <p className="text-xs text-slate-400">
              Direct shortcuts to manage real AWS infrastructure.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => onNavigateTab('observability')}
                className="w-full p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-950/30 hover:bg-cyan-900/30 text-cyan-300 text-xs font-mono flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Prometheus & Grafana</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigateTab('storage')}
                className="w-full p-2.5 rounded-lg border border-purple-500/30 bg-purple-950/30 hover:bg-purple-900/30 text-purple-300 text-xs font-mono flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span>S3 Storage & Upload</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigateTab('kubernetes')}
                className="w-full p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/30 text-emerald-300 text-xs font-mono flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>EKS & EC2 Monitor</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigateTab('devops')}
                className="w-full p-2.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 text-xs font-mono flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-slate-400" />
                  <span>Terraform IaC & Docker</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
