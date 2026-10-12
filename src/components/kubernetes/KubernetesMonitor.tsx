import React, { useState } from 'react';
import { 
  Layers, 
  Server, 
  Search, 
  RotateCw, 
  Terminal, 
  X, 
  Cpu, 
  HardDrive, 
  ShieldAlert,
  Play,
  Copy,
  Check
} from 'lucide-react';
import { PodItem, User } from '../../types';

interface KubernetesMonitorProps {
  currentUser: User | null;
  isDarkMode: boolean;
}

const INITIAL_PODS: PodItem[] = [
  { id: 'pod-1', name: 'shogun-api-gateway-7f48b99-xk9m2', namespace: 'production-apps', node: 'worker-node-01', status: 'Running', restarts: 0, cpuCores: '240m', memoryMB: 512, age: '14d 6h', ip: '10.244.1.42' },
  { id: 'pod-2', name: 'shogun-api-gateway-7f48b99-pw8s1', namespace: 'production-apps', node: 'worker-node-02', status: 'Running', restarts: 0, cpuCores: '215m', memoryMB: 498, age: '14d 6h', ip: '10.244.2.19' },
  { id: 'pod-3', name: 'telemetry-stream-processor-59db-48vn1', namespace: 'telemetry-kuber', node: 'worker-node-03', status: 'Running', restarts: 1, cpuCores: '680m', memoryMB: 1420, age: '8d 12h', ip: '10.244.3.88' },
  { id: 'pod-4', name: 's3-media-transcoder-worker-41df-99zt', namespace: 'production-apps', node: 'worker-node-04', status: 'Running', restarts: 2, cpuCores: '950m', memoryMB: 2048, age: '4d 1h', ip: '10.244.4.15' },
  { id: 'pod-5', name: 'prometheus-server-kuber-x-8d59-ml22', namespace: 'kube-system', node: 'worker-node-05', status: 'Running', restarts: 0, cpuCores: '420m', memoryMB: 1850, age: '22d 4h', ip: '10.244.5.07' },
  { id: 'pod-6', name: 'grafana-dashboards-ingress-33ff-qp10', namespace: 'kube-system', node: 'worker-node-06', status: 'Running', restarts: 0, cpuCores: '150m', memoryMB: 380, age: '22d 4h', ip: '10.244.6.24' },
  { id: 'pod-7', name: 's3-archival-sync-cron-trigger-09aa', namespace: 'production-apps', node: 'worker-node-07', status: 'Running', restarts: 0, cpuCores: '80m', memoryMB: 190, age: '1d 18h', ip: '10.244.7.11' },
  { id: 'pod-8', name: 'elasticsearch-search-index-worker-02', namespace: 'telemetry-kuber', node: 'worker-node-08', status: 'Pending', restarts: 0, cpuCores: '0m', memoryMB: 0, age: '2m 14s', ip: 'Pending' },
  { id: 'pod-9', name: 'event-bridge-sns-dispatcher-01ba', namespace: 'production-apps', node: 'worker-node-02', status: 'CrashLoopBackOff', restarts: 5, cpuCores: '40m', memoryMB: 95, age: '35m', ip: '10.244.2.82' },
];

const MOCK_NODES = [
  { name: 'worker-node-01', status: 'Ready', role: 'Compute Node', cpuAllocated: '62%', memAllocated: '71%', kubelet: 'v1.31.2' },
  { name: 'worker-node-02', status: 'Ready', role: 'Compute Node', cpuAllocated: '58%', memAllocated: '64%', kubelet: 'v1.31.2' },
  { name: 'worker-node-03', status: 'Ready', role: 'Compute Node', cpuAllocated: '74%', memAllocated: '82%', kubelet: 'v1.31.2' },
  { name: 'worker-node-04', status: 'Ready', role: 'Compute Node', cpuAllocated: '49%', memAllocated: '55%', kubelet: 'v1.31.2' },
  { name: 'worker-node-05', status: 'Ready', role: 'Observability', cpuAllocated: '68%', memAllocated: '78%', kubelet: 'v1.31.2' },
  { name: 'worker-node-06', status: 'Ready', role: 'Observability', cpuAllocated: '42%', memAllocated: '51%', kubelet: 'v1.31.2' },
  { name: 'worker-node-07', status: 'Ready', role: 'Storage Worker', cpuAllocated: '35%', memAllocated: '46%', kubelet: 'v1.31.2' },
  { name: 'worker-node-08', status: 'Ready', role: 'Batch Processing', cpuAllocated: '80%', memAllocated: '89%', kubelet: 'v1.31.2' },
];

export const KubernetesMonitor: React.FC<KubernetesMonitorProps> = ({
  currentUser,
  isDarkMode,
}) => {
  const [pods, setPods] = useState<PodItem[]>(INITIAL_PODS);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchPodQuery, setSearchPodQuery] = useState('');
  const [activeLogPod, setActiveLogPod] = useState<PodItem | null>(null);
  const [copiedLog, setCopiedLog] = useState(false);
  const [restartingPodId, setRestartingPodId] = useState<string | null>(null);

  const canManagePods = currentUser?.permissions.includes('cluster:write') || currentUser?.role === 'super_admin';

  const filteredPods = pods.filter(pod => {
    if (selectedNamespace !== 'all' && pod.namespace !== selectedNamespace) return false;
    if (selectedStatus !== 'all' && pod.status !== selectedStatus) return false;
    if (searchPodQuery) {
      const q = searchPodQuery.toLowerCase();
      return pod.name.toLowerCase().includes(q) || pod.node.toLowerCase().includes(q) || pod.ip.toLowerCase().includes(q);
    }
    return true;
  });

  const handleRestartPod = (podId: string) => {
    if (!canManagePods) return;
    setRestartingPodId(podId);
    setTimeout(() => {
      setPods(prev => prev.map(p => {
        if (p.id === podId) {
          return {
            ...p,
            status: 'Running',
            restarts: p.restarts + 1,
            age: '10s'
          };
        }
        return p;
      }));
      setRestartingPodId(null);
    }, 1200);
  };

  const generateMockLogs = (podName: string) => {
    const time = new Date().toISOString();
    return [
      `[${time}] INFO [main] Starting Shogun KUBER container runtime for ${podName}`,
      `[${time}] INFO [k8s-client] Attached to EKS cluster control plane (v1.31.2-eks)`,
      `[${time}] INFO [telemetry] Prometheus exporter listening on :9090/metrics`,
      `[${time}] INFO [s3-client] AWS S3 bucket [kuber-x-media-assets-prod] initialized with SSL`,
      `[${time}] DEBUG [worker] Healthcheck passed. Status: 200 OK. Latency: 1.8ms`,
      `[${time}] INFO [http] Serving 14,800 requests/sec with 0.02% variance`,
      `[${time}] INFO [security] Validated JWT bearer session claims successfully`,
      `[${time}] INFO [gc] Garbage collection cycle completed in 4.2ms. Memory stable.`
    ].join('\n');
  };

  const handleCopyLogs = (logs: string) => {
    navigator.clipboard.writeText(logs);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-400" />
            <span>Kubernetes Cluster & Node Pool Monitor</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-node cluster topology, live container log streams, and self-healing orchestration.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800">
            Cluster: shogun-prod-us-east
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300">
            v1.31.2-eks
          </span>
        </div>
      </div>

      {/* Node Pool Health Matrix */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Server className="w-4 h-4 text-cyan-400" />
            <span>Active Worker Nodes (8 Instances)</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Managed EKS Node Group</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {MOCK_NODES.map(node => (
            <div
              key={node.name}
              className={`p-3.5 rounded-xl border text-xs transition-all ${
                isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-bold text-slate-200">{node.name}</span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {node.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mb-2">{node.role}</div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="bg-slate-800/40 p-1.5 rounded border border-slate-700/50">
                  <span className="text-slate-500 block text-[9px]">CPU</span>
                  <span className="text-cyan-400 font-bold">{node.cpuAllocated}</span>
                </div>
                <div className="bg-slate-800/40 p-1.5 rounded border border-slate-700/50">
                  <span className="text-slate-500 block text-[9px]">RAM</span>
                  <span className="text-sky-400 font-bold">{node.memAllocated}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pods Control Filter Bar */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 font-mono text-[11px] shrink-0">Namespace:</span>
          {['all', 'production-apps', 'telemetry-kuber', 'kube-system'].map(ns => (
            <button
              key={ns}
              onClick={() => setSelectedNamespace(ns)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                selectedNamespace === ns
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {ns}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search pod name, IP..."
              value={searchPodQuery}
              onChange={e => setSearchPodQuery(e.target.value)}
              className="w-48 sm:w-56 pl-8 pr-3 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          </div>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
          >
            <option value="all">All States</option>
            <option value="Running">Running</option>
            <option value="Pending">Pending</option>
            <option value="CrashLoopBackOff">CrashLoopBackOff</option>
          </select>
        </div>
      </div>

      {/* Pods Table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Pod Name & Namespace</th>
                <th className="py-2.5 px-3">Node</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Restarts</th>
                <th className="py-2.5 px-3">CPU / Mem</th>
                <th className="py-2.5 px-3">Age</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
              {filteredPods.map(pod => {
                const isRunning = pod.status === 'Running';
                const isPending = pod.status === 'Pending';
                const isFailed = pod.status === 'CrashLoopBackOff';

                return (
                  <tr key={pod.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200 font-sans truncate max-w-sm">
                        {pod.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        ns: {pod.namespace} · ip: {pod.ip}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">{pod.node}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isRunning
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : isPending
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {pod.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-300">
                      {pod.restarts}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-300">
                      {pod.cpuCores} / {pod.memoryMB} MB
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400">{pod.age}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setActiveLogPod(pod)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 transition-colors"
                          title="View Live Container Logs"
                        >
                          <Terminal className="w-3 h-3 text-cyan-400" />
                          <span>Logs</span>
                        </button>

                        {canManagePods && (
                          <button
                            onClick={() => handleRestartPod(pod.id)}
                            disabled={restartingPodId === pod.id}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                            title="Restart Pod"
                          >
                            <RotateCw className={`w-3.5 h-3.5 ${restartingPodId === pod.id ? 'animate-spin text-emerald-400' : ''}`} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Container Logs Modal */}
      {activeLogPod && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-slate-200">
                  kubectl logs {activeLogPod.name} -n {activeLogPod.namespace}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyLogs(generateMockLogs(activeLogPod.name))}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs flex items-center gap-1 hover:bg-slate-700"
                >
                  {copiedLog ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLog ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => setActiveLogPod(null)}
                  className="p-1 text-slate-400 hover:text-slate-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-black font-mono text-xs text-slate-300 overflow-y-auto flex-1 space-y-1 select-text">
              {generateMockLogs(activeLogPod.name).split('\n').map((line, idx) => (
                <div key={idx} className="hover:bg-slate-900/60 px-1 rounded leading-relaxed">
                  <span className="text-slate-500 mr-2">{idx + 1}</span>
                  {line.includes('INFO') && <span className="text-cyan-400">{line}</span>}
                  {line.includes('DEBUG') && <span className="text-slate-400">{line}</span>}
                  {line.includes('WARN') && <span className="text-amber-400">{line}</span>}
                  {line.includes('ERROR') && <span className="text-rose-400">{line}</span>}
                </div>
              ))}
            </div>

            <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Streaming: stdout & stderr connected</span>
              <span>Buffer: 100 lines · Auto-tail: On</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
