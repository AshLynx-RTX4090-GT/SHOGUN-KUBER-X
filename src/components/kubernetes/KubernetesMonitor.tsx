import React, { useState } from 'react';
import { 
  Layers, 
  Server, 
  Terminal, 
  X, 
  RotateCw, 
  Cloud, 
  ArrowRight, 
  Check, 
  Copy,
  ExternalLink,
  Plus
} from 'lucide-react';
import { User, AwsAccountStatus, AwsDiscoveryData } from '../../types';

interface KubernetesMonitorProps {
  currentUser: User | null;
  isDarkMode: boolean;
  awsStatus?: AwsAccountStatus | null;
  discovery?: AwsDiscoveryData | null;
  onNavigateTab?: (tab: any) => void;
  onRefreshDiscovery?: () => void;
}

export const KubernetesMonitor: React.FC<KubernetesMonitorProps> = ({
  isDarkMode,
  awsStatus,
  discovery,
  onNavigateTab,
  onRefreshDiscovery,
}) => {
  const isAwsConnected = awsStatus?.connected === true;
  const eksClusters = discovery?.eksClusters || [];
  const ec2Nodes = discovery?.ec2Instances || [];
  const [selectedCluster, setSelectedCluster] = useState<string>(eksClusters[0]?.name || '');
  const [copiedCli, setCopiedCli] = useState(false);
  const [activeLogItem, setActiveLogItem] = useState<string | null>(null);

  const EKS_CLI_COMMAND = `aws eks create-cluster \\
  --name shogun-kuber-cluster \\
  --region ${awsStatus?.region || 'us-east-1'} \\
  --kubernetes-version 1.31 \\
  --role-arn ${awsStatus?.arn || 'arn:aws:iam::YOUR_ACCOUNT:role/eks-service-role'} \\
  --resources-vpc-config subnetIds=subnet-xxx,subnet-yyy,securityGroupIds=sg-zzz`;

  const handleCopyCli = () => {
    navigator.clipboard.writeText(EKS_CLI_COMMAND);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
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
            Real EKS clusters and EC2 worker instances discovered directly from your AWS Management Account.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Region: {awsStatus?.region || 'ap-south-1'}</span>
          </span>

          {onRefreshDiscovery && (
            <button
              onClick={onRefreshDiscovery}
              className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Refresh Discovery"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Real EKS Clusters in AWS Account */}
      {isAwsConnected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Real EKS Clusters ({eksClusters.length} Found in AWS {awsStatus?.region})</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">Live Amazon EKS API</span>
          </div>

          {eksClusters.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
              <Layers className="w-8 h-8 mx-auto text-slate-600" />
              <h3 className="text-sm font-bold text-slate-200">0 EKS Clusters Found in Your AWS Account</h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                You have zero EKS clusters in region <strong className="text-slate-200 font-mono">{awsStatus?.region}</strong>. When you create an EKS cluster in the AWS Console, AWS CLI, or Terraform, it will appear here immediately upon discovery!
              </p>

              {/* Copyable AWS CLI Command */}
              <div className="max-w-lg mx-auto text-left pt-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Create EKS Cluster via AWS CLI:</span>
                  <button
                    onClick={handleCopyCli}
                    className="flex items-center gap-1 text-cyan-400 hover:underline cursor-pointer"
                  >
                    {copiedCli ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCli ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  {EKS_CLI_COMMAND}
                </pre>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eksClusters.map(c => (
                <div
                  key={c.name}
                  className={`p-4 rounded-xl border text-xs transition-all ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-100 font-mono">{c.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                      c.status === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {c.status || 'UNKNOWN'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-mono text-slate-400">
                    <div>Version: <span className="text-slate-200">v{c.version || '1.31'}</span></div>
                    <div className="truncate">Endpoint: <span className="text-cyan-400">{c.endpoint || 'Internal'}</span></div>
                    <div className="truncate">ARN: <span className="text-slate-500">{c.arn}</span></div>
                    <div>Node Groups: <span className="text-slate-200">{c.nodegroups?.length || 0} active</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Real EC2 Instances Acting as Compute Nodes */}
      {isAwsConnected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Real EC2 Compute Nodes ({ec2Nodes.length} Discovered in AWS)</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">Live Amazon EC2 API</span>
          </div>

          {ec2Nodes.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-slate-400 text-xs">
              <Server className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="font-semibold text-slate-300">0 EC2 Instances in region {awsStatus?.region}</p>
              <p className="mt-1 text-slate-500">Launch an EC2 worker node in your AWS Management Console to see it appear live.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4 font-sans">Instance ID & Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">State</th>
                      <th className="py-2.5 px-3">Private IP</th>
                      <th className="py-2.5 px-3">Public IP</th>
                      <th className="py-2.5 px-3">Launch Time</th>
                      <th className="py-2.5 px-4 text-right font-sans">Diagnostic</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {ec2Nodes.map(inst => (
                      <tr key={inst.instanceId} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                          <div>{inst.name || inst.instanceId}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{inst.instanceId}</div>
                        </td>
                        <td className="py-3 px-3 text-cyan-400">{inst.instanceType || 't3.medium'}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            inst.state === 'running'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {inst.state || 'running'}
                          </span>
                        </td>
                        <td className="py-3 px-3">{inst.privateIp || 'N/A'}</td>
                        <td className="py-3 px-3 text-slate-400">{inst.publicIp || 'Internal'}</td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {inst.launchTime ? new Date(inst.launchTime).toLocaleDateString() : 'Active'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setActiveLogItem(`Instance ${inst.instanceId} (${inst.instanceType}) is in state: ${inst.state}. Attached to VPC: ${inst.vpcId || 'default'}.`)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-sans"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Diagnostics Modal */}
      {activeLogItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-slate-200">AWS Resource Diagnostics</span>
              <button onClick={() => setActiveLogItem(null)} className="text-slate-400 hover:text-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-mono text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
              {activeLogItem}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
