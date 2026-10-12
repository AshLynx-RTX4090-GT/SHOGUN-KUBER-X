import React, { useState } from 'react';
import { 
  Cloud, 
  ShieldCheck, 
  RefreshCw, 
  Key, 
  Check, 
  Copy, 
  Database, 
  Layers, 
  Server, 
  BellRing, 
  Activity, 
  Plus, 
  Unlink, 
  HelpCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { AwsAccountStatus, AwsDiscoveryData } from '../../types';
import { api } from '../../services/api';

interface AwsAccountConnectionProps {
  awsStatus: AwsAccountStatus | null;
  discovery: AwsDiscoveryData | null;
  onRefreshDiscovery: () => void;
  isDarkMode: boolean;
}

const AWS_REGIONS = [
  { id: 'us-east-1', name: 'US East (N. Virginia)' },
  { id: 'us-east-2', name: 'US East (Ohio)' },
  { id: 'us-west-1', name: 'US West (N. California)' },
  { id: 'us-west-2', name: 'US West (Oregon)' },
  { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
  { id: 'eu-west-1', name: 'Europe (Ireland)' },
  { id: 'eu-central-1', name: 'Europe (Frankfurt)' },
];

export const AwsAccountConnection: React.FC<AwsAccountConnectionProps> = ({
  awsStatus,
  discovery,
  onRefreshDiscovery,
  isDarkMode,
}) => {
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [region, setRegion] = useState(awsStatus?.region || 'us-east-1');
  const [showSecret, setShowSecret] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState<string | null>(null);

  // New Service Modals
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [creationLoading, setCreationLoading] = useState(false);
  const [creationMsg, setCreationMsg] = useState<string | null>(null);

  const [copiedPolicy, setCopiedPolicy] = useState(false);

  const isConnected = awsStatus?.connected === true;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    setConnectSuccess(null);
    setIsConnecting(true);

    try {
      const res = await api.connectAws({
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
        sessionToken: sessionToken.trim() || undefined,
        region,
      });

      if (!res.success) {
        throw new Error(res.error || 'Connection failed.');
      }

      setConnectSuccess(`Connected to AWS Account [${res.account}] in ${region}!`);
      setAccessKeyId('');
      setSecretAccessKey('');
      setSessionToken('');
      onRefreshDiscovery();
    } catch (err: any) {
      setConnectError(err.message || 'Failed to authenticate with AWS.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from your AWS Management Account?')) return;
    await api.disconnectAws();
    onRefreshDiscovery();
  };

  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketName.trim()) return;
    setCreationLoading(true);
    setCreationMsg(null);
    try {
      const res = await api.createAwsBucket(newBucketName.trim().toLowerCase());
      setCreationMsg(res.message);
      setNewBucketName('');
      setIsCreatingBucket(false);
      onRefreshDiscovery();
    } catch (err: any) {
      alert(`Error creating S3 bucket in AWS: ${err.message}`);
    } finally {
      setCreationLoading(false);
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    setCreationLoading(true);
    setCreationMsg(null);
    try {
      const res = await api.createAwsSnsTopic(newTopicName.trim());
      setCreationMsg(res.message);
      setNewTopicName('');
      setIsCreatingTopic(false);
      onRefreshDiscovery();
    } catch (err: any) {
      alert(`Error creating SNS topic in AWS: ${err.message}`);
    } finally {
      setCreationLoading(false);
    }
  };

  const IAM_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity",
        "s3:ListAllMyBuckets",
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:CreateBucket",
        "eks:ListClusters",
        "eks:DescribeCluster",
        "eks:ListNodegroups",
        "eks:DescribeNodegroup",
        "ec2:DescribeInstances",
        "sns:ListTopics",
        "sns:Publish",
        "sns:CreateTopic",
        "cloudwatch:DescribeAlarms"
      ],
      "Resource": "*"
    }
  ]
}`;

  const handleCopyPolicy = () => {
    navigator.clipboard.writeText(IAM_POLICY);
    setCopiedPolicy(true);
    setTimeout(() => setCopiedPolicy(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Cloud className="w-6 h-6 text-cyan-400" />
            <span>AWS Management Account Connection</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Directly connect to your real AWS account to monitor, discover, and synchronize live cloud services with zero mock data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <>
              <button
                onClick={onRefreshDiscovery}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync with AWS</span>
              </button>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-lg border border-rose-900/60 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </>
          )}
        </div>
      </div>

      {creationMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{creationMsg}</span>
        </div>
      )}

      {/* Connection Status Banner */}
      <div className={`p-5 rounded-xl border transition-all ${
        isConnected
          ? 'bg-slate-900/80 border-emerald-500/40 shadow-sm'
          : 'bg-slate-900/60 border-amber-500/40'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">
                  {isConnected ? 'Connected to AWS Management Account' : 'AWS Account Not Connected'}
                </span>
                <span className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`} />
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {isConnected 
                  ? `Account ID: ${awsStatus?.account} · Region: ${awsStatus?.region} · Configured via ${awsStatus?.configuredVia}`
                  : 'Enter your IAM credentials below to connect your real AWS cloud resources.'}
              </p>
            </div>
          </div>

          {isConnected && (
            <div className="text-xs font-mono text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 max-w-md truncate">
              <span className="text-slate-500 block text-[10px] uppercase">IAM Caller ARN</span>
              <span className="text-cyan-400 truncate block">{awsStatus?.arn}</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Discovered Services Grid (When Connected) */}
      {isConnected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Real Discovered AWS Services in Your Account</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Last Synced: {discovery?.lastSyncedAt ? new Date(discovery.lastSyncedAt).toLocaleTimeString() : 'Just now'}
            </span>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* S3 Buckets */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Database className="w-3.5 h-3.5 text-purple-400" />
                  <span>S3 Buckets</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Live</span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">
                {discovery?.summary?.s3BucketCount ?? 0}
              </div>
            </div>

            {/* EKS Clusters */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>EKS Clusters</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Live</span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">
                {discovery?.summary?.eksClusterCount ?? 0}
              </div>
            </div>

            {/* EC2 Instances */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  <span>EC2 Nodes</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Live</span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">
                {discovery?.summary?.ec2InstanceCount ?? 0}
              </div>
            </div>

            {/* SNS Topics */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <BellRing className="w-3.5 h-3.5 text-rose-400" />
                  <span>SNS Topics</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Live</span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">
                {discovery?.summary?.snsTopicCount ?? 0}
              </div>
            </div>

            {/* CloudWatch Alarms */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>CW Alarms</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Live</span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">
                {discovery?.summary?.cloudWatchAlarmCount ?? 0}
              </div>
            </div>
          </div>

          {/* Quick Create Service Affordances */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200">Create Live AWS Service</h3>
              <p className="text-[11px] text-slate-400">Created services will be provisioned directly in your real AWS account and reflect instantly.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreatingBucket(true)}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New S3 Bucket in AWS</span>
              </button>
              <button
                onClick={() => setIsCreatingTopic(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New SNS Topic in AWS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Form (Visible if not connected, or to update credentials) */}
      <div className={`p-5 rounded-xl border ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-1">
          <Key className="w-4 h-4 text-cyan-400" />
          <span>{isConnected ? 'Update AWS IAM Credentials' : 'Connect AWS Account Credentials'}</span>
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Credentials are authenticated directly with AWS Security Token Service (<code className="text-cyan-400 font-mono">sts:GetCallerIdentity</code>).
        </p>

        {connectError && (
          <div className="p-3 mb-4 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <span>{connectError}</span>
          </div>
        )}

        {connectSuccess && (
          <div className="p-3 mb-4 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{connectSuccess}</span>
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Access Key ID */}
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                AWS Access Key ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="AKIA..."
                value={accessKeyId}
                onChange={e => setAccessKeyId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Secret Access Key */}
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                AWS Secret Access Key <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  value={secretAccessKey}
                  onChange={e => setSecretAccessKey(e.target.value)}
                  required
                  className="w-full px-3 py-2 pr-9 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AWS Region */}
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                Default AWS Region
              </label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
              >
                {AWS_REGIONS.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.id} ({r.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Session Token (Optional) */}
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                AWS Session Token <span className="text-slate-500">(Optional for temporary credentials/SSO)</span>
              </label>
              <input
                type="text"
                placeholder="IQoJb3JpZ2luX2VjE..."
                value={sessionToken}
                onChange={e => setSessionToken(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <ShieldCheck className={`w-4 h-4 ${isConnecting ? 'animate-spin' : ''}`} />
            <span>{isConnecting ? 'Authenticating with AWS...' : 'Connect to AWS Management Account'}</span>
          </button>
        </form>
      </div>

      {/* Copyable IAM Policy Reference */}
      <div className={`p-5 rounded-xl border ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
              Recommended AWS IAM Policy
            </h3>
          </div>
          <button
            onClick={handleCopyPolicy}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            {copiedPolicy ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedPolicy ? 'Copied' : 'Copy JSON'}</span>
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Create an IAM user in your AWS Management Console with Programmatic Access, attach this policy, and paste the generated Access Key ID and Secret Access Key above.
        </p>

        <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed max-h-48">
          {IAM_POLICY}
        </pre>
      </div>

      {/* Modal: Create S3 Bucket in AWS */}
      {isCreatingBucket && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span>Create S3 Bucket in Real AWS Account</span>
            </h3>
            <p className="text-xs text-slate-400">
              This bucket will be created live in region <strong className="text-slate-200 font-mono">{region}</strong> in your AWS Management Account.
            </p>

            <form onSubmit={handleCreateBucket} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1">Globally Unique Bucket Name</label>
                <input
                  type="text"
                  placeholder="e.g. kuber-prod-vault-2026"
                  value={newBucketName}
                  onChange={e => setNewBucketName(e.target.value.toLowerCase())}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingBucket(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creationLoading}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creationLoading ? 'Creating in AWS...' : 'Create Bucket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create SNS Topic in AWS */}
      {isCreatingTopic && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-rose-400" />
              <span>Create SNS Topic in Real AWS Account</span>
            </h3>
            <p className="text-xs text-slate-400">
              This topic will be provisioned live in region <strong className="text-slate-200 font-mono">{region}</strong> for developer incident alerts.
            </p>

            <form onSubmit={handleCreateTopic} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1">Topic Name</label>
                <input
                  type="text"
                  placeholder="e.g. shogun-kuber-alerts"
                  value={newTopicName}
                  onChange={e => setNewTopicName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingTopic(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creationLoading}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creationLoading ? 'Creating in AWS...' : 'Create Topic'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
