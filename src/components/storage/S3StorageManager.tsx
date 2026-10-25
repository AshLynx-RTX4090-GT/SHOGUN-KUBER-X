import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  UploadCloud, 
  Search, 
  Film, 
  Image as ImageIcon, 
  FileCode, 
  FileText, 
  Trash2, 
  Download, 
  Play, 
  Maximize2, 
  X, 
  Check, 
  HardDrive, 
  RefreshCw,
  Archive,
  Grid,
  List,
  AudioLines,
  ExternalLink,
  Plus,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  Cloud
} from 'lucide-react';
import { S3Bucket, S3MediaObject, User, AwsConsoleConfig } from '../../types';
import { api } from '../../services/api';

interface S3StorageManagerProps {
  currentUser: User | null;
  isDarkMode: boolean;
  isOnline: boolean;
  awsConfig?: AwsConsoleConfig | null;
}

export const S3StorageManager: React.FC<S3StorageManagerProps> = ({
  currentUser,
  isDarkMode,
  isOnline,
  awsConfig,
}) => {
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('kuber-x-media-assets-prod');
  const [objects, setObjects] = useState<S3MediaObject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Preview Modals
  const [previewVideo, setPreviewVideo] = useState<S3MediaObject | null>(null);
  const [previewAudio, setPreviewAudio] = useState<S3MediaObject | null>(null);
  const [previewImage, setPreviewImage] = useState<S3MediaObject | null>(null);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [newUploads, setNewUploads] = useState<S3MediaObject[]>([]);
  const knownObjectIds = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadScope, setUploadScope] = useState<'workspace-uploads' | 'eks-manifests' | 'cloudformation-templates'>('workspace-uploads');

  // S3 Bucket Creation & Lifecycle States
  const [isCreateBucketOpen, setIsCreateBucketOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketRegion, setNewBucketRegion] = useState(awsConfig?.region || 'us-east-1');
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);
  const [bucketActionMsg, setBucketActionMsg] = useState<string | null>(null);
  const [isRunningLifecycle, setIsRunningLifecycle] = useState(false);

  // Direct AWS IAM Connection State
  const [showIamModal, setShowIamModal] = useState(false);
  const [iamAccessKey, setIamAccessKey] = useState('');
  const [iamSecretKey, setIamSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isConnectingIam, setIsConnectingIam] = useState(false);
  const [iamStatusMsg, setIamStatusMsg] = useState<string | null>(null);

  // AWS SDK Status
  const [awsSdkStatus, setAwsSdkStatus] = useState<{ connectedToRealAws: boolean; region: string }>({
    connectedToRealAws: false,
    region: 'us-east-1'
  });
  const [awsAccount, setAwsAccount] = useState<any>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);

  const canDelete = currentUser?.permissions.includes('storage:delete') || currentUser?.role === 'super_admin';
  const canUpload = currentUser?.permissions.includes('storage:upload') || currentUser?.role === 'super_admin';

  const handleConnectIam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iamAccessKey.trim() || !iamSecretKey.trim()) return;
    setIsConnectingIam(true);
    setIamStatusMsg(null);
    try {
      const res = await api.connectAwsIam({
        accessKeyId: iamAccessKey.trim(),
        secretAccessKey: iamSecretKey.trim(),
        accountId: awsConfig?.accountId || '956083908253',
        region: awsConfig?.region || 'us-east-1'
      });
      setIamStatusMsg(res.message);
      await loadBucketData();
    } catch (err: any) {
      setIamStatusMsg(err?.message || 'Failed to connect IAM credentials');
    } finally {
      setIsConnectingIam(false);
      setTimeout(() => setIamStatusMsg(null), 6000);
    }
  };

  const loadBucketData = async () => {
    setIsLoading(true);
    try {
      const [bData, accountData, integrationData] = await Promise.all([api.getBuckets(), api.getAwsStatus().catch(() => null), api.getIntegrations().catch(() => ({ integrations: [] }))]);
      setBuckets(bData.buckets);
      setAwsSdkStatus({ connectedToRealAws: bData.connectedToRealAws, region: bData.region });
      setAwsAccount(accountData);
      setIntegrations(integrationData.integrations);

      const oData = await api.getObjects(selectedBucket, selectedType, searchQuery);
      const discovered = oData.objects.filter(object => knownObjectIds.current.size > 0 && !knownObjectIds.current.has(object.id));
      if (discovered.length > 0) {
        setNewUploads(discovered);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New S3 upload detected', { body: `${discovered.length} new item${discovered.length === 1 ? '' : 's'} in ${selectedBucket}` });
        }
      }
      knownObjectIds.current = new Set(oData.objects.map(object => object.id));
      setObjects(oData.objects);
    } catch (err) {
      console.error('Error fetching S3 storage data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBucketData();
  }, [selectedBucket, selectedType]);

  useEffect(() => {
    const poll = window.setInterval(() => { if (isOnline) loadBucketData(); }, 10000);
    return () => window.clearInterval(poll);
  }, [isOnline, selectedBucket, selectedType]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const data = await api.getObjects(selectedBucket, selectedType, searchQuery);
    setObjects(data.objects);
    setIsLoading(false);
  };

  const readFile = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploading(true);
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} is over the 50 MB workspace limit.`);
        const contentBase64 = await readFile(file);
        const res = await api.uploadObject({
          bucket: selectedBucket, 
          filename: file.name, 
          mimeType: file.type || 'application/octet-stream', 
          size: file.size,
          contentBase64, 
          keyPrefix: uploadScope, 
          tags: [uploadScope, 's3-upload', file.type.split('/')[0] || 'file']
        });
        if (res?.object) {
          // Immediately show the newly uploaded file in the UI!
          setObjects(prev => [res.object, ...prev.filter(o => o.id !== res.object.id)]);
        }
        setUploadProgress(Math.round(((index + 1) / files.length) * 100));
      }
      setUploadSuccessMsg(`${files.length} file${files.length === 1 ? '' : 's'} uploaded & visible in S3 bucket [${selectedBucket}].`);
      setTimeout(() => setUploadSuccessMsg(null), 5000);
      await loadBucketData();
    } catch (err) {
      setUploadSuccessMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}" from AWS S3?`)) return;
    const object = objects.find(item => item.id === id);
    const ok = await api.deleteObject(id, object?.bucket, object?.key);
    if (ok) {
      setObjects(prev => prev.filter(o => o.id !== id));
    }
  };

  const handleArchiveTier = async (id: string, currentTier: string) => {
    const nextTier = currentTier === 'STANDARD' ? 'GLACIER' : currentTier === 'GLACIER' ? 'DEEP_ARCHIVE' : 'STANDARD';
    const res = await api.archiveObject(id, nextTier);
    if (res.success) {
      setObjects(prev => prev.map(o => o.id === id ? { ...o, storageClass: res.object.storageClass } : o));
    }
  };

  const currentBucketMeta = buckets.find(b => b.name === selectedBucket) || buckets[0];
  const versioningEnabled = awsAccount?.versioning?.find((item: any) => item.bucket === selectedBucket)?.enabled;

  const currentRegion = awsConfig?.region || awsSdkStatus.region || 'us-east-1';
  const currentAccountId = awsConfig?.accountId || '956083908253';
  const s3ConsoleBucketUrl = `https://s3.console.aws.amazon.com/s3/buckets/${encodeURIComponent(selectedBucket)}?region=${encodeURIComponent(currentRegion)}&tab=objects`;

  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketName.trim()) return;
    setIsCreatingBucket(true);
    setBucketActionMsg(null);
    try {
      const res = await api.createBucket(newBucketName.trim().toLowerCase(), newBucketRegion);
      setBucketActionMsg(res.message);
      setIsCreateBucketOpen(false);
      setNewBucketName('');
      await loadBucketData();
      setSelectedBucket(res.bucket.name);
    } catch (err) {
      setBucketActionMsg(err instanceof Error ? err.message : 'Failed to create bucket');
    } finally {
      setIsCreatingBucket(false);
      setTimeout(() => setBucketActionMsg(null), 6000);
    }
  };

  const handleRunLifecycleSweep = async () => {
    setIsRunningLifecycle(true);
    setBucketActionMsg(null);
    try {
      const res = await api.runS3Lifecycle();
      setBucketActionMsg(res.message || 'S3 lifecycle sweep completed.');
      await loadBucketData();
    } catch (err) {
      setBucketActionMsg(err instanceof Error ? err.message : 'Lifecycle sweep failed.');
    } finally {
      setIsRunningLifecycle(false);
      setTimeout(() => setBucketActionMsg(null), 6000);
    }
  };

  const enableBackupProtection = async () => {
    try {
      const result = await api.enableS3Versioning(selectedBucket);
      setBackupMessage(result.message);
      await loadBucketData();
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Unable to enable backup protection.');
    }
  };

  return (
    <div className="space-y-6">
      {/* S3 Header & AWS SDK Connection Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-emerald-900/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-100 flex items-center gap-2">
              <Database className="w-6 h-6 text-emerald-400" />
              <span>AWS S3 Storage & Media Asset Manager</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {awsConfig?.hasIamCredentials ? 'IAM Connected' : 'Daemon: Active'}
            </span>
          </div>
          <p className="text-xs text-emerald-400/80 mt-1">
            Connected to AWS Account <span className="font-mono text-emerald-300 font-semibold">{currentAccountId}</span> ({currentRegion}). Storage across Files, Videos, MP3 audio & MP4 recordings.
          </p>
        </div>

        {/* AWS SDK Credentials Status & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowIamModal(!showIamModal)}
            className="px-3 py-2 rounded-lg bg-[#062c1e] hover:bg-[#0a3f2c] border border-emerald-500/50 text-emerald-200 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>{showIamModal ? 'Close IAM Keys' : 'Connect IAM User'}</span>
          </button>

          <button
            onClick={() => setIsCreateBucketOpen(true)}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Bucket</span>
          </button>

          <button
            onClick={handleRunLifecycleSweep}
            disabled={isRunningLifecycle}
            className="px-3 py-2 rounded-lg border border-emerald-600/50 hover:bg-emerald-950 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Trigger automated background S3 lifecycle transition to GLACIER and expiration"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunningLifecycle ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isRunningLifecycle ? 'Sweeping...' : 'Lifecycle Sweep'}</span>
          </button>

          {canUpload && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                multiple
                accept="*/*"
              />
              <button
                onClick={() => { setUploadScope('workspace-uploads'); fileInputRef.current?.click(); }}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <UploadCloud className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} />
                <span>{isUploading ? `Uploading ${uploadProgress}%` : 'Upload to S3'}</span>
              </button>
              {isUploading && <div className="mt-2 w-full h-1.5 rounded-full bg-slate-900 overflow-hidden"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${uploadProgress}%` }} /></div>}
            </div>
          )}

          <a
            href={s3ConsoleBucketUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-950/60 transition-colors"
          >
            <span>Open in S3 Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Direct AWS IAM Credentials Connection Card */}
      {showIamModal && (
        <section className="glass-panel p-5 rounded-2xl border border-emerald-500/50 bg-[#061510] space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-sm font-bold text-emerald-100">Connect AWS IAM User Credentials Directly</h2>
                <p className="text-[11px] text-emerald-400/80">Connect your AWS Access Key ID and Secret Access Key for direct S3 bucket & workload execution.</p>
              </div>
            </div>
            <button
              onClick={() => setShowIamModal(false)}
              className="p-1 text-emerald-400 hover:text-emerald-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleConnectIam} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-200 mb-1">AWS Access Key ID</label>
              <input
                type="text"
                required
                value={iamAccessKey}
                onChange={e => setIamAccessKey(e.target.value)}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[#030806] border border-emerald-700/80 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-200 mb-1">AWS Secret Access Key</label>
              <div className="relative">
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  required
                  value={iamSecretKey}
                  onChange={e => setIamSecretKey(e.target.value)}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  className="w-full px-3 py-2 pr-12 text-xs font-mono rounded-lg bg-[#030806] border border-emerald-700/80 text-emerald-100 placeholder-emerald-800 focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-3 top-2 text-[10px] text-emerald-400 hover:text-emerald-200"
                >
                  {showSecretKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-between pt-2">
              <span className="text-[11px] text-emerald-500 font-mono">
                Target Account: {currentAccountId} · Region: {currentRegion}
              </span>
              <button
                type="submit"
                disabled={isConnectingIam || !iamAccessKey.trim() || !iamSecretKey.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isConnectingIam && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isConnectingIam ? 'Validating with AWS...' : 'Connect to AWS Account'}</span>
              </button>
            </div>
          </form>

          {iamStatusMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-600/70 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{iamStatusMsg}</span>
            </div>
          )}
        </section>
      )}

      {bucketActionMsg && (
        <div className="p-3 rounded-lg bg-[#061510] border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{bucketActionMsg}</span>
        </div>
      )}

      {newUploads.length > 0 && (
        <div className="glass-panel p-3 rounded-xl border border-emerald-500/50 bg-[#061510] text-emerald-300 text-xs flex items-center justify-between gap-3">
          <span>New upload detected in bucket: {newUploads.map(object => object.filename).join(', ')}</span>
          <button onClick={() => setNewUploads([])} className="underline underline-offset-2 hover:text-emerald-100">Dismiss</button>
        </div>
      )}

      {uploadSuccessMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-600/70 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{uploadSuccessMsg}</span>
        </div>
      )}

      {/* Bucket Selector & Storage Capacity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {buckets.map(b => {
          const isSelected = b.name === selectedBucket;
          const mbSize = (b.sizeBytes / (1024 * 1024)).toFixed(1);
          return (
            <button
              key={b.name}
              onClick={() => setSelectedBucket(b.name)}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#062c1e] border-emerald-400 shadow-lg ring-1 ring-emerald-500/50'
                  : 'bg-[#061510] border-emerald-900/60 hover:border-emerald-600/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-semibold text-emerald-200 truncate max-w-[180px]">
                  {b.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  {b.region}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-100">
                  {mbSize} <span className="text-xs font-normal text-emerald-400">MB</span>
                </div>
                <span className="text-xs text-emerald-400 font-mono tabular-nums">
                  {b.objectCount} objects
                </span>
              </div>
              <div className="mt-3 text-[10px] text-emerald-500 flex items-center justify-between font-mono">
                <span>Encryption: {b.encryption}</span>
                <span>Versioning: {b.versioning ? 'Active' : 'Disabled'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search Bar & Media Filter Tabs: All, Files, Videos, MP3, MP4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-emerald-900/50 bg-[#061510]">
        {/* Media Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium py-1">
          {[
            { id: 'all', label: 'All Objects', icon: Database },
            { id: 'files', label: 'Files (.yaml, .json, .pdf)', icon: FileCode },
            { id: 'videos', label: 'Videos', icon: Film },
            { id: 'mp3', label: 'MP3 (Audio)', icon: AudioLines },
            { id: 'mp4', label: 'MP4 (Video)', icon: Play },
          ].map(tab => {
            const Icon = tab.icon;
            const isTabActive = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  isTabActive
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-emerald-300 hover:text-emerald-100 hover:bg-emerald-950/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input & View Mode Toggles */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search S3 key, filename, or tag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-48 sm:w-60 pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#030806] border border-emerald-800 text-emerald-100 placeholder-emerald-700 focus:outline-none focus:border-emerald-400"
            />
            <Search className="w-3.5 h-3.5 text-emerald-500 absolute left-2.5 top-2.5" />
          </form>

          <div className="flex items-center border border-emerald-900/70 rounded-lg p-0.5 bg-[#030806]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded text-xs cursor-pointer ${viewMode === 'grid' ? 'bg-emerald-500 text-slate-950' : 'text-emerald-400 hover:text-emerald-200'}`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs cursor-pointer ${viewMode === 'table' ? 'bg-emerald-500 text-slate-950' : 'text-emerald-400 hover:text-emerald-200'}`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Media Objects Grid or Table View */}
      {isLoading ? (
        <div className="p-12 text-center text-emerald-400 text-xs">
          <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-emerald-400" />
          <span>Syncing S3 bucket objects...</span>
        </div>
      ) : objects.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-emerald-900/70 bg-[#061510] text-emerald-400 text-xs">
          <Database className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
          <p className="font-semibold text-emerald-200">No objects found in this category</p>
          <p className="mt-1 text-emerald-500">Upload a file, MP4 video, or MP3 audio recording to store it in AWS S3.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {objects.map(obj => {
            const isMp4 = obj.type === 'mp4' || obj.filename.toLowerCase().endsWith('.mp4') || obj.mimeType === 'video/mp4';
            const isMp3 = obj.type === 'mp3' || obj.type === 'audio' || obj.filename.toLowerCase().endsWith('.mp3') || obj.mimeType.includes('audio');
            const isVideo = isMp4 || obj.type === 'videos' || obj.type === 'video' || obj.mimeType.startsWith('video/');
            const isImage = obj.type === 'image' || obj.mimeType.startsWith('image/');
            const sizeKB = (obj.size / 1024).toFixed(0);

            return (
              <div
                key={obj.id}
                className="group rounded-xl border border-emerald-900/60 hover:border-emerald-500/70 bg-[#061510] overflow-hidden transition-all flex flex-col justify-between shadow-md"
              >
                {/* Media Preview Thumbnail */}
                <div className="relative h-44 bg-[#020b08] flex items-center justify-center overflow-hidden border-b border-emerald-900/40">
                  {isVideo ? (
                    <div className="w-full h-full relative group/video cursor-pointer" onClick={() => setPreviewVideo(obj)}>
                      <video
                        src={obj.url}
                        className="w-full h-full object-cover opacity-80 group-hover/video:opacity-100 transition-opacity"
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover/video:bg-black/20 transition-all">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg transform group-hover/video:scale-110 transition-transform">
                          <Play className="w-5 h-5 ml-0.5 fill-current" />
                        </div>
                      </div>
                      <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/80 px-2 py-0.5 rounded text-emerald-300 border border-emerald-800">
                        {isMp4 ? 'MP4 Video' : 'Video'}
                      </span>
                    </div>
                  ) : isMp3 ? (
                    <div className="w-full px-4 py-2 flex flex-col items-center justify-center">
                      <AudioLines className="w-10 h-10 mb-2 text-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-mono text-emerald-300 font-bold mb-2">MP3 Audio File</span>
                      <audio src={obj.url} controls className="w-full h-8" preload="metadata" />
                    </div>
                  ) : isImage ? (
                    <div className="w-full h-full relative group/img cursor-pointer" onClick={() => setPreviewImage(obj)}>
                      <img
                        src={obj.url}
                        alt={obj.filename}
                        className="w-full h-full object-contain p-2 group-hover/img:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 right-2 p-1 rounded bg-black/60 text-emerald-300 opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-emerald-500">
                      <FileCode className="w-10 h-10 text-emerald-400 mb-2" />
                      <span className="text-xs font-mono text-emerald-300">{obj.mimeType}</span>
                    </div>
                  )}

                  {/* Storage Tier Badge */}
                  <span className={`absolute top-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded ${
                    obj.storageClass === 'STANDARD'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : obj.storageClass === 'GLACIER'
                      ? 'bg-teal-950 text-teal-300 border border-teal-700'
                      : 'bg-emerald-900 text-emerald-200 border border-emerald-600'
                  }`}>
                    {obj.storageClass}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 truncate" title={obj.filename}>
                      {obj.filename}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {sizeKB} KB · {new Date(obj.lastModified).toLocaleDateString()}
                    </p>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {obj.tags.map(t => (
                        <span key={t} className="text-[10px] font-mono text-slate-400">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleArchiveTier(obj.id, obj.storageClass)}
                      className="text-slate-400 hover:text-purple-400 flex items-center gap-1 text-[11px] font-mono transition-colors"
                      title="Transition Archival Tier"
                    >
                      <Archive className="w-3 h-3" />
                      <span>Tier</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <a
                        href={obj.url}
                        download={obj.filename}
                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Download Asset"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      {canDelete && (
                        <button
                          onClick={() => handleDelete(obj.id, obj.filename)}
                          className="p-1.5 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete from S3"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-xl border border-emerald-900/60 overflow-hidden bg-[#061510]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#020b08] text-emerald-400 font-mono uppercase text-[10px] border-b border-emerald-900/40">
                <tr>
                  <th className="py-2.5 px-4">Key / Filename</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Storage Class</th>
                  <th className="py-2.5 px-3 text-right">Size</th>
                  <th className="py-2.5 px-3">Uploaded</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/30 font-mono text-emerald-200">
                {objects.map(obj => {
                  const isMp4 = obj.type === 'mp4' || obj.filename.toLowerCase().endsWith('.mp4');
                  const isMp3 = obj.type === 'mp3' || obj.filename.toLowerCase().endsWith('.mp3');
                  const isVideo = isMp4 || obj.type === 'videos' || obj.type === 'video';

                  return (
                    <tr key={obj.id} className="hover:bg-emerald-950/30 transition-colors">
                      <td className="py-3 px-4 flex items-center gap-2 font-sans font-semibold text-emerald-100">
                        {isVideo ? (
                          <Film className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : isMp3 ? (
                          <AudioLines className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : obj.type === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-teal-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                        <span className="truncate max-w-xs">{obj.filename}</span>
                      </td>
                      <td className="py-3 px-3 uppercase text-[10px] text-emerald-400">{obj.type}</td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#020b08] text-emerald-300 border border-emerald-800">
                          {obj.storageClass}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-emerald-300">
                        {(obj.size / 1024).toFixed(0)} KB
                      </td>
                      <td className="py-3 px-3 text-emerald-400 text-[11px]">
                        {new Date(obj.lastModified).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isVideo && (
                            <button
                              onClick={() => setPreviewVideo(obj)}
                              className="p-1 text-emerald-400 hover:text-emerald-200"
                              title="Play Video"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isMp3 && (
                            <a
                              href={obj.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-emerald-400 hover:text-emerald-200"
                              title="Listen"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {obj.type === 'image' && (
                            <button
                              onClick={() => setPreviewImage(obj)}
                              className="p-1 text-teal-400 hover:text-teal-200"
                              title="Preview Image"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <a
                            href={obj.url}
                            download={obj.filename}
                            className="p-1 text-emerald-400 hover:text-emerald-100"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(obj.id, obj.filename)}
                              className="p-1 text-emerald-500 hover:text-rose-400"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* Video Modal Player */}
      {previewVideo && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#061510] border border-emerald-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-emerald-900/60 flex items-center justify-between bg-[#020b08]">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-200">{previewVideo.filename}</span>
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
                className="p-1 text-emerald-400 hover:text-emerald-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video
                src={previewVideo.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-3 bg-[#020b08] flex items-center justify-between text-xs text-emerald-400 font-mono border-t border-emerald-900/40">
              <span>S3 Key: {previewVideo.key}</span>
              <a
                href={previewVideo.url}
                download={previewVideo.filename}
                className="text-emerald-300 hover:text-emerald-100 hover:underline flex items-center gap-1 font-bold"
              >
                <Download className="w-3 h-3" />
                <span>Download Video</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#061510] border border-emerald-700 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-emerald-900/60 flex items-center justify-between bg-[#020b08]">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-200">{previewImage.filename}</span>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 text-emerald-400 hover:text-emerald-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-black flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewImage.url}
                alt={previewImage.filename}
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            <div className="p-3 bg-[#020b08] flex items-center justify-between text-xs text-emerald-400 font-mono border-t border-emerald-900/40">
              <span>MIME: {previewImage.mimeType} · Size: {(previewImage.size / 1024).toFixed(0)} KB</span>
              <a
                href={previewImage.url}
                download={previewImage.filename}
                className="text-emerald-300 hover:text-emerald-100 hover:underline flex items-center gap-1 font-bold"
              >
                <Download className="w-3 h-3" />
                <span>Save High-Res Image</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Create S3 Bucket Modal */}
      {isCreateBucketOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#061510] border border-emerald-700 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-emerald-900/60 flex items-center justify-between bg-[#020b08]">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-100">Create Amazon S3 Bucket</h3>
                  <p className="text-[11px] text-emerald-400">AWS Account: <span className="font-mono text-emerald-300">{currentAccountId}</span></p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateBucketOpen(false)}
                className="p-1 text-emerald-400 hover:text-emerald-100 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBucket} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-300 mb-1">Bucket Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. shogun-kuber-assets-prod"
                  value={newBucketName}
                  onChange={e => setNewBucketName(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[#020b08] border border-emerald-800 text-emerald-100 placeholder-emerald-700 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-emerald-500 mt-1">Must be globally unique, lowercase, 3-63 characters, numbers, dots, and hyphens.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-300 mb-1">AWS Region</label>
                <select
                  value={newBucketRegion}
                  onChange={e => setNewBucketRegion(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#020b08] border border-emerald-800 text-emerald-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="us-east-1">US East (N. Virginia) us-east-1</option>
                  <option value="us-west-2">US West (Oregon) us-west-2</option>
                  <option value="ap-south-1">Asia Pacific (Mumbai) ap-south-1</option>
                  <option value="eu-west-1">Europe (Ireland) eu-west-1</option>
                </select>
              </div>

              <div className="p-3 rounded-lg bg-[#020b08] border border-emerald-900/60 text-[11px] space-y-1.5 text-emerald-300 font-mono">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Server-Side Encryption: AES256 (Amazon S3-Managed Key)</span>
                </div>
                <div className="flex items-center gap-1.5 text-teal-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Block Public Access: Enabled</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Lifecycle Rule: Auto-tiering to GLACIER after 90 days</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateBucketOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-emerald-400 hover:text-emerald-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBucket || !newBucketName.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCreatingBucket && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isCreatingBucket ? 'Provisioning...' : 'Create S3 Bucket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
