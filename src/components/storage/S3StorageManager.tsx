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
  RefreshCw,
  Grid,
  List,
  Plus,
  ArrowRight,
  Cloud
} from 'lucide-react';
import { S3Bucket, S3MediaObject, User, AwsAccountStatus, AwsDiscoveryData } from '../../types';
import { api } from '../../services/api';

interface S3StorageManagerProps {
  currentUser: User | null;
  isDarkMode: boolean;
  isOnline: boolean;
  awsStatus?: AwsAccountStatus | null;
  discovery?: AwsDiscoveryData | null;
  onNavigateTab?: (tab: any) => void;
  onRefreshDiscovery?: () => void;
}

export const S3StorageManager: React.FC<S3StorageManagerProps> = ({
  currentUser,
  isDarkMode,
  awsStatus,
  discovery,
  onNavigateTab,
  onRefreshDiscovery,
}) => {
  const isAwsConnected = awsStatus?.connected === true;
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [objects, setObjects] = useState<S3MediaObject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Preview Modals
  const [previewVideo, setPreviewVideo] = useState<S3MediaObject | null>(null);
  const [previewImage, setPreviewImage] = useState<S3MediaObject | null>(null);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Create Bucket Modal
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [createBucketLoading, setCreateBucketLoading] = useState(false);

  const canDelete = currentUser?.permissions.includes('storage:delete') || currentUser?.role === 'super_admin';
  const canUpload = currentUser?.permissions.includes('storage:upload') || currentUser?.role === 'super_admin';

  const loadBucketData = async () => {
    setIsLoading(true);
    try {
      const bData = await api.getBuckets();
      setBuckets(bData.buckets);
      
      const primaryBucket = bData.buckets.find(b => b.name.includes('storage') || b.name.includes('kuber'))?.name 
        || (bData.buckets.length > 0 ? bData.buckets[0].name : '');
      const currentSelected = selectedBucket || primaryBucket;
      if (currentSelected && currentSelected !== selectedBucket) {
        setSelectedBucket(currentSelected);
      }

      if (currentSelected) {
        const oData = await api.getObjects(currentSelected, selectedType, searchQuery);
        setObjects(oData.objects);
      } else {
        setObjects([]);
      }
    } catch (err) {
      console.error('Error fetching S3 storage data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBucketData();
  }, [selectedBucket, selectedType, isAwsConnected]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBucket) return;
    setIsLoading(true);
    const data = await api.getObjects(selectedBucket, selectedType, searchQuery);
    setObjects(data.objects);
    setIsLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBucket) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async () => {
      const base64Content = reader.result as string;
      try {
        const res = await api.uploadObject({
          bucket: selectedBucket,
          filename: file.name,
          mimeType: file.type,
          contentBase64: base64Content,
        });

        setUploadSuccessMsg(res.message);
        setTimeout(() => setUploadSuccessMsg(null), 4000);
        await loadBucketData();
      } catch (err: any) {
        alert(`Upload error: ${err.message}`);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  const handleDelete = async (key: string, filename: string) => {
    if (!selectedBucket) return;
    if (!confirm(`Are you sure you want to delete "${filename}" from AWS S3 bucket "${selectedBucket}"?`)) return;
    const ok = await api.deleteObject(selectedBucket, key);
    if (ok) {
      setObjects(prev => prev.filter(o => o.key !== key));
    }
  };

  const handleCreateBucketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketName.trim()) return;
    setCreateBucketLoading(true);
    try {
      const res = await api.createAwsBucket(newBucketName.trim().toLowerCase());
      setUploadSuccessMsg(res.message);
      setNewBucketName('');
      setIsCreatingBucket(false);
      if (onRefreshDiscovery) onRefreshDiscovery();
      await loadBucketData();
      setSelectedBucket(res.bucket.name);
    } catch (err: any) {
      alert(`Error creating S3 bucket in AWS: ${err.message}`);
    } finally {
      setCreateBucketLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* S3 Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Database className="w-6 h-6 text-purple-400" />
              <span>AWS S3 Storage & Media Asset Manager</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time object archival and media asset manager connected directly to your AWS Management Account.
          </p>
        </div>

        {/* AWS SDK Status & Actions */}
        <div className="flex items-center gap-2">
          {isAwsConnected ? (
            <div className="px-3 py-1.5 rounded-lg border bg-emerald-950/40 border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono font-medium">AWS Live ({awsStatus?.account})</span>
            </div>
          ) : (
            <button
              onClick={() => onNavigateTab && onNavigateTab('aws')}
              className="px-3 py-1.5 rounded-lg border bg-amber-950/40 border-amber-800 text-amber-300 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Connect AWS Account</span>
            </button>
          )}

          {isAwsConnected && (
            <button
              onClick={() => setIsCreatingBucket(true)}
              className="px-3 py-1.5 rounded-lg border border-purple-800 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Bucket in AWS</span>
            </button>
          )}

          {canUpload && selectedBucket && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,video/*,.pdf,.yaml,.yml,.json,.log,.tar.gz"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <UploadCloud className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} />
                <span>{isUploading ? 'Uploading to S3...' : 'Upload to S3'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {uploadSuccessMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{uploadSuccessMsg}</span>
        </div>
      )}

      {/* Bucket Selector */}
      {isAwsConnected && buckets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {buckets.map(b => {
            const isSelected = b.name === selectedBucket;
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
                  <span className="text-xs font-mono font-semibold text-slate-200 truncate max-w-[200px]" title={b.name}>
                    {b.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {b.region}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-1">
                  <span>{b.objectCount} {b.objectCount === 1 ? 'object' : 'objects'}</span>
                  <span>{b.sizeBytes > 1024 * 1024 ? `${(b.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : `${(b.sizeBytes / 1024).toFixed(1)} KB`}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Created: {b.created ? new Date(b.created).toLocaleDateString() : 'Active'}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* If connected but 0 buckets */}
      {isAwsConnected && buckets.length === 0 && !isLoading && (
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
          <Database className="w-8 h-8 mx-auto text-purple-400" />
          <h3 className="text-sm font-bold text-slate-200">No S3 Buckets in Your AWS Account Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            You do not currently have any S3 buckets in region {awsStatus?.region}. Create one below or create one in the AWS Console, and it will appear here immediately!
          </p>
          <button
            onClick={() => setIsCreatingBucket(true)}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create S3 Bucket in AWS Now</span>
          </button>
        </div>
      )}

      {/* Filter and Objects View */}
      {selectedBucket && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/40">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs font-medium py-1">
              {[
                { id: 'all', label: 'All Objects', icon: Database },
                { id: 'video', label: 'Videos', icon: Film },
                { id: 'image', label: 'Images', icon: ImageIcon },
                { id: 'config', label: 'Configs & YAML', icon: FileCode },
                { id: 'document', label: 'Documents', icon: FileText },
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

            {/* Search & View Mode */}
            <div className="flex items-center gap-2">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="Search key in S3..."
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
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded text-xs ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Objects Display */}
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-purple-400" />
              <span>Querying AWS S3 bucket {selectedBucket}...</span>
            </div>
          ) : objects.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 text-slate-400 text-xs">
              <Database className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="font-semibold text-slate-300">0 objects found in AWS bucket [{selectedBucket}]</p>
              <p className="mt-1 text-slate-500">Upload a video, diagram, or manifest directly to AWS S3.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {objects.map(obj => {
                const isVideo = obj.type === 'video';
                const isImage = obj.type === 'image';
                const sizeKB = (obj.size / 1024).toFixed(0);

                return (
                  <div
                    key={obj.id}
                    className={`group rounded-xl border overflow-hidden transition-all flex flex-col justify-between ${
                      isDarkMode ? 'bg-slate-900/60 border-slate-800 hover:border-purple-500/50' : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="relative h-44 bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800">
                      {isVideo ? (
                        <div className="w-full h-full relative cursor-pointer" onClick={() => setPreviewVideo(obj)}>
                          <video src={obj.url} className="w-full h-full object-cover opacity-80" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg">
                              <Play className="w-5 h-5 ml-0.5 fill-current" />
                            </div>
                          </div>
                        </div>
                      ) : isImage ? (
                        <div className="w-full h-full relative cursor-pointer" onClick={() => setPreviewImage(obj)}>
                          <img src={obj.url} alt={obj.filename} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                          <div className="absolute top-2 right-2 p-1 rounded bg-black/60 text-slate-300">
                            <Maximize2 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-slate-500">
                          {obj.type === 'config' ? <FileCode className="w-10 h-10 text-cyan-400 mb-2" /> : <FileText className="w-10 h-10 text-amber-400 mb-2" />}
                          <span className="text-xs font-mono text-slate-400">{obj.mimeType}</span>
                        </div>
                      )}

                      <span className="absolute top-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                        {obj.storageClass}
                      </span>
                    </div>

                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-200 truncate" title={obj.filename}>
                          {obj.filename}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {sizeKB} KB · {new Date(obj.lastModified).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">
                          key: {obj.key}
                        </span>

                        <div className="flex items-center gap-2">
                          <a
                            href={obj.url}
                            download={obj.filename}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                            title="Download Asset"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {canDelete && (
                            <button
                              onClick={() => handleDelete(obj.key, obj.filename)}
                              className="p-1.5 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                              title="Delete from AWS S3"
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
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4 font-sans">Key / Filename</th>
                      <th className="py-2.5 px-3">Storage Class</th>
                      <th className="py-2.5 px-3 text-right">Size</th>
                      <th className="py-2.5 px-3">Last Modified</th>
                      <th className="py-2.5 px-4 text-right font-sans">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {objects.map(obj => (
                      <tr key={obj.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans font-semibold text-slate-200 truncate max-w-xs">
                          {obj.filename}
                        </td>
                        <td className="py-3 px-3">{obj.storageClass}</td>
                        <td className="py-3 px-3 text-right">{(obj.size / 1024).toFixed(0)} KB</td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">{new Date(obj.lastModified).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a href={obj.url} download={obj.filename} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:text-slate-200">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            {canDelete && (
                              <button onClick={() => handleDelete(obj.key, obj.filename)} className="p-1 text-slate-400 hover:text-rose-400">
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
              <button onClick={() => setPreviewVideo(null)} className="p-1 text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video src={previewVideo.url} controls autoPlay className="w-full h-full object-contain" />
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
              <button onClick={() => setPreviewImage(null)} className="p-1 text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img src={previewImage.url} alt={previewImage.filename} className="max-h-[70vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Bucket */}
      {isCreatingBucket && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span>Create S3 Bucket in AWS Account</span>
            </h3>
            <form onSubmit={handleCreateBucketSubmit} className="space-y-3 text-xs">
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
                  disabled={createBucketLoading}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  {createBucketLoading ? 'Creating in AWS...' : 'Create Bucket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
