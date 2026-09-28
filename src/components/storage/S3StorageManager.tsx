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
  AudioLines
  ,ExternalLink
} from 'lucide-react';
import { S3Bucket, S3MediaObject, User } from '../../types';
import { api } from '../../services/api';

interface S3StorageManagerProps {
  currentUser: User | null;
  isDarkMode: boolean;
  isOnline: boolean;
}

export const S3StorageManager: React.FC<S3StorageManagerProps> = ({
  currentUser,
  isDarkMode,
  isOnline,
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
        await api.uploadObject({
          bucket: selectedBucket, filename: file.name, mimeType: file.type || 'application/octet-stream', size: file.size,
          contentBase64, keyPrefix: uploadScope, tags: [uploadScope, 'dashboard-upload', file.type.split('/')[0] || 'file']
        });
        setUploadProgress(Math.round(((index + 1) / files.length) * 100));
      }
      setUploadSuccessMsg(`${files.length} file${files.length === 1 ? '' : 's'} saved to ${awsSdkStatus.connectedToRealAws ? 'AWS S3' : 'the local demo workspace'}.`);
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Database className="w-6 h-6 text-purple-400" />
              <span>AWS S3 Storage & Media Asset Manager</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise high-throughput object archival, instant media streaming, and Glacier lifecycle tiering.
          </p>
        </div>

        {/* AWS SDK Credentials Status Tag */}
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 ${
            awsSdkStatus.connectedToRealAws
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-purple-950/40 border-purple-800 text-purple-300'
          }`}>
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="font-mono font-medium">
              AWS SDK v3: {awsSdkStatus.connectedToRealAws ? 'Live IAM Role' : 'S3 Client Engine (us-east-1)'}
            </span>
          </div>

          {canUpload && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.yaml,.yml,.json,.log,.zip,.tar,.gz"
              />
              <button
                onClick={() => { setUploadScope('workspace-uploads'); fileInputRef.current?.click(); }}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <UploadCloud className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} />
                <span>{isUploading ? `Uploading ${uploadProgress}%` : 'Upload files to S3'}</span>
              </button>
              {isUploading && <div className="mt-2 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${uploadProgress}%` }} /></div>}
            </div>
          )}
          <a href="https://console.aws.amazon.com/" target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/10">
            Connect AWS Console <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-100">Amazon EKS / Kubernetes</h2><p className="text-xs text-slate-400 mt-1">Store Kubernetes manifests, Helm values, and cluster configuration in the protected <code className="text-sky-300">eks-manifests/</code> S3 prefix.</p></div><a href="https://console.aws.amazon.com/eks/" target="_blank" rel="noreferrer" className="text-sky-300"><ExternalLink className="w-4 h-4" /></a></div><button disabled={!canUpload || isUploading} onClick={() => { setUploadScope('eks-manifests'); fileInputRef.current?.click(); }} className="mt-4 px-3 py-2 rounded-lg border border-sky-500/40 text-sky-200 text-xs font-bold hover:bg-sky-500/10 disabled:opacity-50">Upload EKS manifest</button></div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-100">AWS CloudFormation</h2><p className="text-xs text-slate-400 mt-1">Store YAML or JSON templates in the protected <code className="text-amber-300">cloudformation-templates/</code> S3 prefix before creating a stack.</p></div><a href="https://console.aws.amazon.com/cloudformation/" target="_blank" rel="noreferrer" className="text-amber-300"><ExternalLink className="w-4 h-4" /></a></div><button disabled={!canUpload || isUploading} onClick={() => { setUploadScope('cloudformation-templates'); fileInputRef.current?.click(); }} className="mt-4 px-3 py-2 rounded-lg border border-amber-500/40 text-amber-200 text-xs font-bold hover:bg-amber-500/10 disabled:opacity-50">Upload CloudFormation template</button></div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-cyan-400" /><h2 className="text-sm font-bold text-slate-100">AWS account & recovery posture</h2></div>
            <p className="text-xs text-slate-400 mt-1">{awsAccount?.connected ? `Connected to account ${awsAccount.accountId} in ${awsAccount.region}.` : 'No verified AWS account connection yet. Add an IAM role/credentials and AWS_BUCKET_NAME on the server.'}</p>
          </div>
          <a href="https://console.aws.amazon.com/s3/" target="_blank" rel="noreferrer" className="text-xs text-cyan-300 hover:text-cyan-200 flex items-center gap-1">Open S3 console <ExternalLink className="w-3 h-3" /></a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-slate-500">S3 uploads</div><div className={`font-semibold mt-1 ${awsAccount?.connected ? 'text-emerald-300' : 'text-amber-300'}`}>{awsAccount?.connected ? 'Live account storage' : 'Setup required'}</div><div className="text-[10px] text-slate-500 mt-1">Encrypted object storage for uploaded files</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-slate-500">S3 recovery</div><div className={`font-semibold mt-1 ${versioningEnabled ? 'text-emerald-300' : 'text-amber-300'}`}>{versioningEnabled ? 'Versioning enabled' : 'Versioning not enabled'}</div><div className="text-[10px] text-slate-500 mt-1">Recover overwritten or deleted S3 file versions</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-slate-500">Infrastructure backups</div><div className={`font-semibold mt-1 ${awsAccount?.backupPlanConfigured ? 'text-emerald-300' : 'text-slate-300'}`}>{awsAccount?.backupPlanConfigured ? 'AWS Backup plan configured' : 'EBS / AWS Backup not configured'}</div><div className="text-[10px] text-slate-500 mt-1">EBS snapshots protect volumes, not files in S3</div></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button onClick={enableBackupProtection} disabled={!awsAccount?.connected || versioningEnabled} className="px-3 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">{versioningEnabled ? 'S3 backup protection active' : 'Enable S3 backup protection'}</button><a href="https://console.aws.amazon.com/backup/" target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">Manage AWS Backup / EBS snapshots <ExternalLink className="w-3 h-3" /></a>{backupMessage && <span className="text-xs text-cyan-300">{backupMessage}</span>}</div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-3">
          <div><h2 className="text-sm font-bold text-slate-100">AWS services & connected applications</h2><p className="text-xs text-slate-400 mt-1">Service status is loaded from the backend catalog. AWS S3 is verified by the workspace IAM connection; third-party providers require server-side OAuth setup before file access is enabled.</p></div>
          <span className="text-[10px] font-mono text-slate-500">Files: YAML · PDF · MP3 · MP4 · HD media · archives</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
          {integrations.map(integration => <a key={integration.id} href={integration.consoleUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-800 p-3 hover:border-cyan-500/60 hover:bg-slate-800/50 transition-colors"><div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-200"><span>{integration.name}</span><span className={`shrink-0 text-[10px] font-mono ${integration.state === 'configured' ? 'text-emerald-300' : integration.state === 'pending' ? 'text-amber-300' : 'text-slate-500'}`}>{integration.state === 'configured' ? 'CONNECTED' : integration.state === 'pending' ? 'SETUP PENDING' : 'NOT CONFIGURED'}</span></div><div className="mt-1 text-[10px] text-slate-500">{integration.category} · {integration.description}</div><div className="mt-2 text-[10px] text-cyan-400 flex items-center gap-1">Open service console <ExternalLink className="w-3 h-3" /></div></a>)}
        </div>
      </section>

      {newUploads.length > 0 && <div className="glass-panel p-3 rounded-xl border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3"><span>New upload detected: {newUploads.map(object => object.filename).join(', ')}</span><button onClick={() => setNewUploads([])} className="underline underline-offset-2">Dismiss</button></div>}

      {uploadSuccessMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
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
                  ? 'bg-purple-950/30 border-purple-500 shadow-md ring-1 ring-purple-500/50'
                  : isDarkMode
                  ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-semibold text-slate-300 truncate max-w-[180px]">
                  {b.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  {b.region}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-xl font-bold font-mono tabular-nums text-slate-100">
                  {mbSize} <span className="text-xs font-normal text-slate-400">MB</span>
                </div>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {b.objectCount} objects
                </span>
              </div>
              <div className="mt-3 text-[10px] text-slate-500 flex items-center justify-between font-mono">
                <span>Encryption: {b.encryption}</span>
                <span>Versioning: {b.versioning ? 'On' : 'Off'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search Bar & Media Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/40">
        {/* Media Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs font-medium py-1">
          {[
            { id: 'all', label: 'All Objects', icon: Database },
            { id: 'video', label: 'Videos (.mp4)', icon: Film },
            { id: 'image', label: 'Images (.png/.jpg)', icon: ImageIcon },
            { id: 'config', label: 'Configs & Helm', icon: FileCode },
            { id: 'audio', label: 'Audio', icon: AudioLines },
            { id: 'document', label: 'Documents & Logs', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon;
            const isTabActive = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  isTabActive
                    ? 'bg-purple-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
              placeholder="Search S3 key or tag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-48 sm:w-56 pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </form>

          <div className="flex items-center border border-slate-800 rounded-lg p-0.5 bg-slate-900">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded text-xs ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Media Objects Grid or Table View */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs">
          <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-purple-400" />
          <span>Syncing S3 bucket objects...</span>
        </div>
      ) : objects.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 text-slate-400 text-xs">
          <Database className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="font-semibold text-slate-300">No objects found in this bucket</p>
          <p className="mt-1 text-slate-500">Upload a video, diagram, or manifest to store it in AWS S3.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {objects.map(obj => {
            const isVideo = obj.type === 'video';
            const isImage = obj.type === 'image';
            const isAudio = obj.type === 'audio';
            const sizeKB = (obj.size / 1024).toFixed(0);

            return (
              <div
                key={obj.id}
                className={`group rounded-xl border overflow-hidden transition-all flex flex-col justify-between ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-800 hover:border-purple-500/50' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                {/* Media Preview Thumbnail */}
                <div className="relative h-44 bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800">
                  {isVideo ? (
                    <div className="w-full h-full relative group/video cursor-pointer" onClick={() => setPreviewVideo(obj)}>
                      <video
                        src={obj.url}
                        className="w-full h-full object-cover opacity-75 group-hover/video:opacity-100 transition-opacity"
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover/video:bg-black/20 transition-all">
                        <div className="w-10 h-10 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg transform group-hover/video:scale-110 transition-transform">
                          <Play className="w-5 h-5 ml-0.5 fill-current" />
                        </div>
                      </div>
                      <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/80 px-2 py-0.5 rounded text-white">
                        MP4 Video
                      </span>
                    </div>
                  ) : isAudio ? (
                    <div className="w-full px-4"><AudioLines className="w-10 h-10 mx-auto mb-4 text-fuchsia-400" /><audio src={obj.url} controls className="w-full" preload="metadata" /></div>
                  ) : isImage ? (
                    <div className="w-full h-full relative group/img cursor-pointer" onClick={() => setPreviewImage(obj)}>
                      <img
                        src={obj.url}
                        alt={obj.filename}
                        className="w-full h-full object-contain p-2 group-hover/img:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 right-2 p-1 rounded bg-black/60 text-slate-300 opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-slate-500">
                      {obj.type === 'config' ? (
                        <FileCode className="w-10 h-10 text-cyan-400 mb-2" />
                      ) : (
                        <FileText className="w-10 h-10 text-amber-400 mb-2" />
                      )}
                      <span className="text-xs font-mono text-slate-400">{obj.mimeType}</span>
                    </div>
                  )}

                  {/* Storage Tier Badge */}
                  <span className={`absolute top-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded ${
                    obj.storageClass === 'STANDARD'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      : obj.storageClass === 'GLACIER'
                      ? 'bg-sky-950/80 text-sky-300 border border-sky-800'
                      : 'bg-purple-950/80 text-purple-300 border border-purple-800'
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
        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Key / Filename</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Storage Class</th>
                  <th className="py-2.5 px-3 text-right">Size</th>
                  <th className="py-2.5 px-3">Uploaded</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                {objects.map(obj => (
                  <tr key={obj.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-2 font-sans font-semibold text-slate-200">
                      {obj.type === 'video' ? (
                        <Film className="w-4 h-4 text-purple-400 shrink-0" />
                      ) : obj.type === 'image' ? (
                        <ImageIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate max-w-xs">{obj.filename}</span>
                    </td>
                    <td className="py-3 px-3 uppercase text-[10px] text-slate-400">{obj.type}</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {obj.storageClass}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-300">
                      {(obj.size / 1024).toFixed(0)} KB
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(obj.lastModified).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {obj.type === 'video' && (
                          <button
                            onClick={() => setPreviewVideo(obj)}
                            className="p-1 text-purple-400 hover:text-purple-300"
                            title="Play Video"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {obj.type === 'image' && (
                          <button
                            onClick={() => setPreviewImage(obj)}
                            className="p-1 text-cyan-400 hover:text-cyan-300"
                            title="Preview Image"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <a
                          href={obj.url}
                          download={obj.filename}
                          className="p-1 text-slate-400 hover:text-slate-200"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(obj.id, obj.filename)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Video Modal Player */}
      {previewVideo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-slate-200">{previewVideo.filename}</span>
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
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
            <div className="p-3 bg-slate-950 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>S3 Key: {previewVideo.key}</span>
              <a
                href={previewVideo.url}
                download={previewVideo.filename}
                className="text-cyan-400 hover:underline flex items-center gap-1"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">{previewImage.filename}</span>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewImage.url}
                alt={previewImage.filename}
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            <div className="p-3 bg-slate-950 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>MIME: {previewImage.mimeType} · Size: {(previewImage.size / 1024).toFixed(0)} KB</span>
              <a
                href={previewImage.url}
                download={previewImage.filename}
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Save High-Res Image</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
