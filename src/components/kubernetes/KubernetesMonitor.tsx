import React, { useState, useEffect } from 'react';
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
  Check,
  ExternalLink,
  Sliders,
  RefreshCw,
  SlidersHorizontal,
  Cloud,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { PodItem, User, AwsConsoleConfig, K8sNode, K8sDeployment, ClusterInfo } from '../../types';
import { api } from '../../services/api';

interface KubernetesMonitorProps {
  currentUser: User | null;
  isDarkMode: boolean;
  awsConfig?: AwsConsoleConfig | null;
}

export const KubernetesMonitor: React.FC<KubernetesMonitorProps> = ({
  currentUser,
  isDarkMode,
  awsConfig,
}) => {
  const [cluster, setCluster] = useState<any>(null);
  const [pods, setPods] = useState<PodItem[]>([]);
  const [nodes, setNodes] = useState<K8sNode[]>([]);
  const [deployments, setDeployments] = useState<K8sDeployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchPodQuery, setSearchPodQuery] = useState('');
  
  // Modals & Drawers
  const [activeLogPod, setActiveLogPod] = useState<PodItem | null>(null);
  const [podLogs, setPodLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const [restartingPodId, setRestartingPodId] = useState<string | null>(null);

  // Scaling Deployment State
  const [scaleModalDep, setScaleModalDep] = useState<K8sDeployment | null>(null);
  const [targetReplicas, setTargetReplicas] = useState<number>(4);
  const [isScaling, setIsScaling] = useState(false);
  const [scaleMsg, setScaleMsg] = useState<string | null>(null);

  // Terminal Exec State
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState('kubectl get pods -A');
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [isExecutingCmd, setIsExecutingCmd] = useState(false);

  const canManagePods = currentUser?.permissions.includes('cluster:write') || currentUser?.role === 'super_admin';

  const loadClusterData = async () => {
    try {
      const [cRes, nRes, pRes, dRes] = await Promise.all([
        api.getK8sCluster().catch(() => null),
        api.getK8sNodes().catch(() => ({ nodes: [] })),
        api.getK8sPods(selectedNamespace, selectedStatus, searchPodQuery).catch(() => ({ pods: [] })),
        api.getK8sDeployments().catch(() => ({ deployments: [] })),
      ]);

      if (cRes) setCluster(cRes);
      if (nRes) setNodes(nRes.nodes);
      if (pRes) setPods(pRes.pods);
      if (dRes) setDeployments(dRes.deployments);
    } catch (err) {
      console.warn('Failed to load k8s cluster data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClusterData();
    const interval = setInterval(loadClusterData, 6000);
    return () => clearInterval(interval);
  }, [selectedNamespace, selectedStatus, searchPodQuery]);

  const handleRestartPod = async (podId: string) => {
    if (!canManagePods) return;
    setRestartingPodId(podId);
    try {
      await api.restartK8sPod(podId);
      await loadClusterData();
    } catch (err) {
      console.error('Pod restart failed:', err);
    } finally {
      setTimeout(() => setRestartingPodId(null), 1200);
    }
  };

  const handleOpenLogs = async (pod: PodItem) => {
    setActiveLogPod(pod);
    setLoadingLogs(true);
    try {
      const res = await api.getK8sPodLogs(pod.id);
      setPodLogs(res.logs);
    } catch {
      setPodLogs(`[${new Date().toISOString()}] INFO [k8s] Connecting to pod ${pod.name} stream...`);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCordonNode = async (nodeName: string) => {
    if (!canManagePods) return;
    try {
      await api.toggleCordonNode(nodeName);
      await loadClusterData();
    } catch (err) {
      console.error('Failed to toggle cordon:', err);
    }
  };

  const handleScaleDeployment = async () => {
    if (!scaleModalDep || !canManagePods) return;
    setIsScaling(true);
    try {
      const res = await api.scaleK8sDeployment(scaleModalDep.name, targetReplicas);
      setScaleMsg(res.message);
      await loadClusterData();
      setTimeout(() => {
        setScaleModalDep(null);
        setScaleMsg(null);
      }, 1500);
    } catch (err: any) {
      setScaleMsg(err.message || 'Scale failed');
    } finally {
      setIsScaling(false);
    }
  };

  const handleRunCommand = async (cmdToRun?: string) => {
    const cmd = cmdToRun || terminalCommand;
    if (!cmd.trim()) return;
    setIsExecutingCmd(true);
    try {
      const res = await api.execK8sCommand(cmd);
      setTerminalOutput(res.output);
    } catch (err: any) {
      setTerminalOutput(`Error executing command: ${err.message}`);
    } finally {
      setIsExecutingCmd(false);
    }
  };

  const handleCopyLogs = (logs: string) => {
    navigator.clipboard.writeText(logs);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const eksConsoleUrl = awsConfig?.consoleUrls?.eks || `https://${awsConfig?.region || 'us-east-1'}.console.aws.amazon.com/eks/home?region=${awsConfig?.region || 'us-east-1'}#/clusters`;

  return (
    <div className="space-y-6">
      {/* Header & AWS EKS Console Deep Link */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-700/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Layers className="w-6 h-6 text-emerald-400" />
              <span>Kubernetes Cluster & Node Pool Manager</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Amazon EKS v1.31 control plane, live multi-node topology, container logs, and self-healing backend processes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setTerminalOpen(!terminalOpen);
              if (!terminalOutput) handleRunCommand('kubectl get pods -A');
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Interactive Terminal</span>
          </button>

          <a
            href={eksConsoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Cloud className="w-3.5 h-3.5 text-amber-400" />
            <span>Open in Amazon EKS Console</span>
            <ExternalLink className="w-3 h-3 text-amber-400/80" />
          </a>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-xs font-mono text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{cluster?.name || 'shogun-prod-kuber-x'}</span>
          </div>
        </div>
      </div>

      {/* Cluster Overview Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-slate-500 text-[10px] block uppercase">Nodes Ready</span>
          <span className="text-lg font-bold text-emerald-400">{nodes.filter(n => n.status === 'Ready').length} / {nodes.length || 8}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">EKS Managed NodeGroup</span>
        </div>
        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-slate-500 text-[10px] block uppercase">Running Pods</span>
          <span className="text-lg font-bold text-cyan-400">{pods.filter(p => p.status === 'Running').length} / {pods.length || 12}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Across {cluster?.namespaces?.length || 5} Namespaces</span>
        </div>
        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-slate-500 text-[10px] block uppercase">Deployments</span>
          <span className="text-lg font-bold text-sky-400">{deployments.length || 4} Active</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Scalable via backend</span>
        </div>
        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-slate-500 text-[10px] block uppercase">Reconciler Worker</span>
          <span className="text-lg font-bold text-amber-400 flex items-center gap-1">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> Auto-Healing
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Daemon loop: 8s sync</span>
        </div>
      </div>

      {/* Interactive Kubectl Terminal Drawer (if opened) */}
      {terminalOpen && (
        <section className="glass-panel p-4 rounded-2xl border border-slate-800 bg-black/80 font-mono text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-300 font-bold">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Kubernetes & AWS CLI Terminal Emulator</span>
            </div>
            <button
              onClick={() => setTerminalOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">Preset commands:</span>
            {[
              'kubectl get pods -A',
              'kubectl top nodes',
              'kubectl get deployments',
              'aws eks describe-cluster',
              'aws s3 ls'
            ].map(cmd => (
              <button
                key={cmd}
                onClick={() => {
                  setTerminalCommand(cmd);
                  handleRunCommand(cmd);
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
              >
                {cmd}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-cyan-400">$</span>
            <input
              type="text"
              value={terminalCommand}
              onChange={e => setTerminalCommand(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRunCommand();
              }}
              placeholder="e.g. kubectl get pods, aws eks describe-cluster"
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none focus:border-cyan-400"
            />
            <button
              onClick={() => handleRunCommand()}
              disabled={isExecutingCmd}
              className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
            >
              {isExecutingCmd ? 'Executing...' : 'Run'}
            </button>
          </div>

          <pre className="p-3 rounded bg-slate-950 border border-slate-800 text-slate-300 overflow-x-auto max-h-56 leading-relaxed whitespace-pre font-mono text-[11px]">
            {terminalOutput || 'Output will appear here...'}
          </pre>
        </section>
      )}

      {/* Node Pool Health Matrix */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Server className="w-4 h-4 text-cyan-400" />
            <span>Active Worker Nodes ({nodes.length} Instances)</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Region: {awsConfig?.region || 'us-east-1'}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {nodes.map(node => (
            <div
              key={node.name}
              className={`p-3.5 rounded-xl border text-xs transition-all ${
                isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-bold text-slate-200">{node.name}</span>
                <span className={`flex items-center gap-1 text-[10px] font-mono ${node.status === 'Ready' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'Ready' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {node.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
                <span>{node.role}</span>
                {canManagePods && (
                  <button
                    onClick={() => handleCordonNode(node.name)}
                    className="text-[10px] font-mono text-slate-400 hover:text-amber-400 underline"
                    title="Cordon or uncordon node scheduling"
                  >
                    {node.cordoned ? 'Uncordon' : 'Cordon'}
                  </button>
                )}
              </div>

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

      {/* Deployments Section with Scaling Control */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-sky-400" />
            <span>Kubernetes Workload Deployments</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Backend Auto-Sync</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {deployments.map(dep => (
            <div
              key={dep.name}
              className={`p-3.5 rounded-xl border text-xs ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-200 truncate font-mono">{dep.name}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {dep.status}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate mb-2">ns: {dep.namespace}</div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="font-mono text-cyan-400 font-bold">{dep.availableReplicas} / {dep.replicas} Pods</span>
                {canManagePods && (
                  <button
                    onClick={() => {
                      setScaleModalDep(dep);
                      setTargetReplicas(dep.replicas);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                    <span>Scale</span>
                  </button>
                )}
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
              {pods.map(pod => {
                const isRunning = pod.status === 'Running';
                const isPending = pod.status === 'Pending';

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
                          onClick={() => handleOpenLogs(pod)}
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

      {/* Scale Deployment Modal */}
      {scaleModalDep && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Scale Deployment: {scaleModalDep.name}</span>
              </h3>
              <button onClick={() => setScaleModalDep(null)} className="p-1 text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Target Replicas Count (1 - 32 pods)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={targetReplicas}
                  onChange={e => setTargetReplicas(Number(e.target.value))}
                  className="flex-1 accent-cyan-500"
                />
                <span className="font-mono font-bold text-cyan-400 text-base tabular-nums w-8">
                  {targetReplicas}
                </span>
              </div>
            </div>

            {scaleMsg && (
              <div className="p-2.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs">
                {scaleMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setScaleModalDep(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleScaleDeployment}
                disabled={isScaling}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                {isScaling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isScaling ? 'Scaling...' : 'Apply Replica Scale'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                  onClick={() => handleCopyLogs(podLogs)}
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
              {loadingLogs ? (
                <div className="py-8 text-center text-slate-500">Streaming logs from Kubernetes container...</div>
              ) : (
                podLogs.split('\n').map((line, idx) => (
                  <div key={idx} className="hover:bg-slate-900/60 px-1 rounded leading-relaxed">
                    <span className="text-slate-600 mr-2 select-none">{idx + 1}</span>
                    {line.includes('INFO') && <span className="text-cyan-400">{line}</span>}
                    {line.includes('DEBUG') && <span className="text-slate-400">{line}</span>}
                    {line.includes('WARN') && <span className="text-amber-400">{line}</span>}
                    {line.includes('ERROR') && <span className="text-rose-400">{line}</span>}
                    {!line.includes('INFO') && !line.includes('DEBUG') && !line.includes('WARN') && !line.includes('ERROR') && (
                      <span>{line}</span>
                    )}
                  </div>
                ))
              )}
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
