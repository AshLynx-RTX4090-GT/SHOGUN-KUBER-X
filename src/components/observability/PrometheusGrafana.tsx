import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Play, 
  Terminal, 
  BarChart2, 
  ExternalLink, 
  RefreshCw, 
  Check, 
  Copy,
  LineChart
} from 'lucide-react';
import { SystemMetrics } from '../../types';

interface PrometheusGrafanaProps {
  metrics: SystemMetrics | null;
  isDarkMode: boolean;
}

const PRESET_QUERIES = [
  { label: 'CPU Utilization Rate', query: 'rate(node_cpu_seconds_total{mode="idle"}[5m]) * 100' },
  { label: 'HTTP Ingress Throughput', query: 'sum(rate(http_requests_total[2m])) by (status)' },
  { label: 'Pod Memory Resident Bytes', query: 'container_memory_working_set_bytes{namespace="production-apps"}' },
  { label: 'AWS S3 Storage Bytes', query: 'shogun_s3_storage_bytes_stored' },
  { label: 'API P95 Request Latency', query: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))' },
];

export const PrometheusGrafana: React.FC<PrometheusGrafanaProps> = ({
  metrics,
  isDarkMode,
}) => {
  const [promQuery, setPromQuery] = useState(PRESET_QUERIES[0].query);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [rawPromMetrics, setRawPromMetrics] = useState<string>('');
  const [copiedRaw, setCopiedRaw] = useState(false);

  const fetchRawMetrics = async () => {
    try {
      const res = await fetch('/metrics');
      if (res.ok) {
        const text = await res.text();
        setRawPromMetrics(text);
      }
    } catch {
      setRawPromMetrics('# Failed to scrape /metrics endpoint');
    }
  };

  useEffect(() => {
    fetchRawMetrics();
    handleExecuteQuery();
  }, []);

  const handleExecuteQuery = () => {
    setIsQuerying(true);
    setTimeout(() => {
      const now = Math.floor(Date.now() / 1000);
      const points = [];
      for (let i = 10; i >= 0; i--) {
        points.push([now - i * 15, (45 + Math.sin(i * 0.8) * 15).toFixed(2)]);
      }

      setQueryResult({
        status: 'success',
        data: {
          resultType: 'matrix',
          result: [
            {
              metric: {
                __name__: promQuery.split('{')[0] || 'shogun_metric',
                cluster: 'shogun-prod-kuber-x-us-east',
                instance: 'worker-node-01:9090',
                job: 'kubernetes-nodes'
              },
              values: points
            }
          ]
        }
      });
      setIsQuerying(false);
    }, 400);
  };

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(rawPromMetrics);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-amber-400" />
            <span>Prometheus Telemetry & Grafana Observability</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time PromQL query engine, multi-dimensional time series, and scrape target diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-amber-950/40 text-amber-400 border border-amber-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Prometheus v2.52 Online</span>
          </span>
        </div>
      </div>

      {/* PromQL Query Console */}
      <div className={`p-5 rounded-xl border ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Search className="w-4 h-4 text-amber-400" />
            <span>PromQL Query Explorer</span>
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">Evaluation Interval: 15s</span>
        </div>

        {/* Preset Queries */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESET_QUERIES.map(pq => (
            <button
              key={pq.label}
              onClick={() => {
                setPromQuery(pq.query);
                setTimeout(handleExecuteQuery, 50);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                promQuery === pq.query
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700/60'
              }`}
            >
              {pq.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={promQuery}
              onChange={e => setPromQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500"
              placeholder="e.g. rate(http_requests_total[5m])"
            />
          </div>
          <button
            onClick={handleExecuteQuery}
            disabled={isQuerying}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isQuerying ? 'animate-spin' : ''}`} />
            <span>Execute</span>
          </button>
        </div>

        {/* Query Result Matrix Output */}
        {queryResult && (
          <div className="rounded-lg bg-slate-950 border border-slate-800 p-3.5 font-mono text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-slate-800">
              <span>Status: {queryResult.status}</span>
              <span>Result Type: {queryResult.data.resultType}</span>
            </div>

            {queryResult.data.result.map((res: any, idx: number) => (
              <div key={idx} className="space-y-2">
                <div className="text-[11px] text-cyan-400">
                  {JSON.stringify(res.metric)}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {res.values.slice(-6).map((val: any, vIdx: number) => (
                    <div key={vIdx} className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                      <span className="text-[9px] text-slate-500 block">
                        {new Date(val[0] * 1000).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="font-bold text-amber-400 tabular-nums">{val[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Grafana Observability Heatmap & Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Grafana Panel 1: Throughput */}
        <div className={`p-4 rounded-xl border ${
          isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5 font-mono">
              <BarChart2 className="w-4 h-4 text-cyan-400" />
              <span>Grafana Panel: Ingress Traffic by Node</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400">Live 1s</span>
          </div>

          <div className="space-y-2">
            {['worker-01', 'worker-02', 'worker-03', 'worker-04'].map((node, i) => {
              const pct = 40 + (i * 12) + (metrics ? (metrics.cpuUsagePercent % 10) : 0);
              return (
                <div key={node} className="text-xs">
                  <div className="flex justify-between text-slate-400 text-[11px] mb-1 font-mono">
                    <span>{node}</span>
                    <span className="tabular-nums text-slate-200">{pct}% Load</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-cyan-400 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grafana Panel 2: Latency Percentile Distribution */}
        <div className={`p-4 rounded-xl border ${
          isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5 font-mono">
              <LineChart className="w-4 h-4 text-purple-400" />
              <span>Grafana Panel: SLO Latency Distribution</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">99.95% Target</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center font-mono py-4">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">p50</span>
              <span className="text-lg font-bold text-emerald-400 tabular-nums">{metrics?.latencies.p50 ?? 18}ms</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">p95</span>
              <span className="text-lg font-bold text-cyan-400 tabular-nums">{metrics?.latencies.p95 ?? 44}ms</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">p99</span>
              <span className="text-lg font-bold text-amber-400 tabular-nums">{metrics?.latencies.p99 ?? 89}ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Raw /metrics Prometheus Scrape Viewer */}
      <div className={`p-5 rounded-xl border ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Live Prometheus Scrape Target: /metrics</span>
            </h3>
            <p className="text-[11px] text-slate-400">Standard OpenMetrics 2.0 endpoint scraped by Prometheus agent.</p>
          </div>

          <button
            onClick={handleCopyRaw}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedRaw ? 'Copied' : 'Copy Scrape Text'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed max-h-60">
          {rawPromMetrics || '# Scraped metrics loading...'}
        </pre>
      </div>
    </div>
  );
};
