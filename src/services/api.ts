import { 
  AlertItem, 
  AwsAccountStatus, 
  AwsDiscoveryData, 
  MetricHistoryPoint, 
  OfflineQueueItem, 
  S3Bucket, 
  S3MediaObject, 
  SystemMetrics, 
  User,
  ClusterStatusResponse,
  TelemetryMetricsResponse,
  StorageArtifactsResponse
} from '../types';

const STORAGE_KEYS = {
  TOKEN: 'shogun_jwt_token',
  USER: 'shogun_user',
  OFFLINE_QUEUE: 'shogun_offline_queue',
  WIDGET_CONFIG: 'shogun_widget_config',
  OFFLINE_CACHE: 'shogun_offline_cache',
};

class ApiService {
  private token: string | null = null;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private queueChangeListeners: Array<(queue: OfflineQueueItem[]) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushOfflineQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    }
    return this.token;
  }

  // ------------------------------------
  // AWS MANAGEMENT ACCOUNT INTEGRATION
  // ------------------------------------
  async getAwsStatus(): Promise<AwsAccountStatus> {
    try {
      const res = await fetch('/api/aws/status');
      if (!res.ok) throw new Error('Failed to fetch AWS status');
      return await res.json();
    } catch (err: any) {
      return {
        connected: false,
        region: 'us-east-1',
        error: err.message,
      };
    }
  }

  async connectAws(credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    region: string;
  }): Promise<{ success: boolean; account?: string; arn?: string; error?: string }> {
    const res = await fetch('/api/aws/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return await res.json();
  }

  async switchAwsRegion(region: string): Promise<{ success: boolean; region: string }> {
    const res = await fetch('/api/aws/region', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region }),
    });
    return await res.json();
  }

  async disconnectAws(): Promise<boolean> {
    try {
      const res = await fetch('/api/aws/disconnect', { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getAwsDiscovery(region?: string): Promise<AwsDiscoveryData> {
    try {
      const url = region ? `/api/aws/discovery?region=${encodeURIComponent(region)}` : '/api/aws/discovery';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to discover AWS services');
      const data = await res.json();
      localStorage.setItem(STORAGE_KEYS.OFFLINE_CACHE + '_aws_discovery', JSON.stringify(data));
      return data;
    } catch (err: any) {
      const cached = localStorage.getItem(STORAGE_KEYS.OFFLINE_CACHE + '_aws_discovery');
      if (cached) return JSON.parse(cached);
      return {
        connected: false,
        region: region || 'us-east-1',
        s3Buckets: [],
        eksClusters: [],
        ec2Instances: [],
        snsTopics: [],
        cloudWatchAlarms: [],
        error: err.message,
      };
    }
  }

  async createAwsBucket(bucketName: string): Promise<any> {
    const res = await fetch('/api/aws/create-bucket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create bucket in AWS');
    }
    return await res.json();
  }

  async createAwsSnsTopic(topicName: string): Promise<any> {
    const res = await fetch('/api/aws/create-sns-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create SNS topic in AWS');
    }
    return await res.json();
  }

  // ------------------------------------
  // AUTH
  // ------------------------------------
  async login(role: string = 'super_admin'): Promise<{ token: string; user: User }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Login failed');
      const data = await res.json();
      this.setToken(data.token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
      return data;
    } catch {
      const mockUser: User = {
        id: 'usr-1',
        email: 'ashirbadbiswal82791@gmail.com',
        username: 'Ashirbad Biswal',
        role: role as any,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        permissions: ['cluster:write', 'storage:upload', 'storage:delete', 'alerts:trigger', 'iac:apply', 'pipeline:trigger', 'rbac:admin']
      };
      return { token: 'jwt-auth-token', user: mockUser };
    }
  }

  async generateToken(role: string = 'super_admin', expiresIn: string = '30d'): Promise<{ token: string; user: User; expiresIn: string }> {
    const res = await fetch(`/api/auth/token?role=${encodeURIComponent(role)}&expiresIn=${encodeURIComponent(expiresIn)}`);
    if (!res.ok) throw new Error('Failed to generate integration token');
    return await res.json();
  }

  async verifyToken(token: string): Promise<{ valid: boolean; claims?: any; error?: string }> {
    const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
    return await res.json();
  }

  // ------------------------------------
  // AWS EKS & TELEMETRY CORE ENDPOINTS
  // ------------------------------------
  async getClusterStatus(): Promise<ClusterStatusResponse> {
    const res = await fetch('/api/cluster/status');
    if (!res.ok) throw new Error('Failed to fetch EKS cluster status');
    return await res.json();
  }

  async getTelemetryMetrics(): Promise<TelemetryMetricsResponse> {
    const res = await fetch('/api/telemetry/metrics');
    if (!res.ok) throw new Error('Failed to fetch CloudWatch telemetry metrics');
    return await res.json();
  }

  async getStorageArtifacts(): Promise<StorageArtifactsResponse> {
    const res = await fetch('/api/storage/artifacts');
    if (!res.ok) throw new Error('Failed to fetch S3 pipeline storage artifacts');
    return await res.json();
  }

  // ------------------------------------
  // METRICS & TELEMETRY (REAL ZEROES WHEN DISCONNECTED)
  // ------------------------------------
  async getCurrentMetrics(): Promise<{ cluster: any; system: SystemMetrics }> {
    try {
      const res = await fetch('/api/metrics/current');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return await res.json();
    } catch {
      return {
        cluster: {
          name: 'Not Connected',
          kubernetesVersion: 'N/A',
          nodesTotal: 0,
          nodesReady: 0,
          podsTotal: 0,
          podsRunning: 0,
          podsPending: 0,
          podsFailed: 0,
          namespaces: []
        },
        system: {
          cpuUsagePercent: 0,
          memoryUsagePercent: 0,
          memoryUsedGB: '0',
          memoryTotalGB: 0,
          networkRxMBps: 0,
          networkTxMBps: 0,
          iopsRead: 0,
          iopsWrite: 0,
          requestsPerSecond: 0,
          errorRatePercent: 0,
          latencies: { p50: 0, p95: 0, p99: 0 }
        }
      };
    }
  }

  async getMetricsHistory(): Promise<{ points: MetricHistoryPoint[] }> {
    try {
      const res = await fetch('/api/metrics/history');
      if (!res.ok) throw new Error('Failed to fetch metric history');
      return await res.json();
    } catch {
      return { points: [] };
    }
  }

  // ------------------------------------
  // AWS S3 STORAGE
  // ------------------------------------
  async getBuckets(): Promise<{ connectedToRealAws: boolean; region: string; buckets: S3Bucket[] }> {
    try {
      const res = await fetch('/api/s3/buckets');
      if (!res.ok) throw new Error('Failed to fetch buckets');
      return await res.json();
    } catch {
      return {
        connectedToRealAws: false,
        region: 'us-east-1',
        buckets: []
      };
    }
  }

  async getObjects(bucket: string, type?: string, search?: string): Promise<{ count: number; objects: S3MediaObject[] }> {
    try {
      const params = new URLSearchParams();
      if (bucket) params.set('bucket', bucket);
      if (type) params.set('type', type);
      if (search) params.set('search', search);

      const res = await fetch(`/api/s3/objects?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch S3 objects');
      return await res.json();
    } catch {
      return { count: 0, objects: [] };
    }
  }

  async uploadObject(
    bucketOrPayload: string | { bucket: string; filename: string; mimeType: string; contentBase64?: string },
    filenameArg?: string,
    mimeTypeArg?: string,
    contentBase64Arg?: string
  ): Promise<any> {
    let bucket: string;
    let filename: string;
    let mimeType: string;
    let contentBase64: string | undefined;

    if (typeof bucketOrPayload === 'object') {
      bucket = bucketOrPayload.bucket;
      filename = bucketOrPayload.filename;
      mimeType = bucketOrPayload.mimeType;
      contentBase64 = bucketOrPayload.contentBase64;
    } else {
      bucket = bucketOrPayload;
      filename = filenameArg || '';
      mimeType = mimeTypeArg || 'application/octet-stream';
      contentBase64 = contentBase64Arg;
    }

    if (!this.isOnline) {
      const offlineId = `off-upload-${Date.now()}`;
      this.enqueueMutation({
        id: offlineId,
        action: 's3_upload',
        timestamp: new Date().toISOString(),
        payload: { bucket, filename, mimeType, contentBase64 },
        status: 'pending',
      });
      return {
        success: true,
        queued: true,
        message: `Network offline. Upload for [${filename}] queued for automatic sync.`,
        object: {
          id: offlineId,
          bucket,
          key: `offline/${filename}`,
          filename,
          size: 1024,
          mimeType,
          type: mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : 'document',
          url: '',
          storageClass: 'STANDARD',
          lastModified: new Date().toISOString(),
          uploadedBy: 'Offline User',
          tags: ['offline-queued']
        }
      };
    }

    const res = await fetch('/api/s3/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, filename, mimeType, contentBase64 }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload to AWS S3 failed');
    }
    return await res.json();
  }

  async deleteObject(bucket: string, key: string): Promise<any> {
    const res = await fetch(`/api/s3/objects/${encodeURIComponent(key)}?bucket=${encodeURIComponent(bucket)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete S3 object');
    }
    return await res.json();
  }

  // ------------------------------------
  // INCIDENT ALERTS
  // ------------------------------------
  async getAlerts(): Promise<{ alerts: AlertItem[] }> {
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return await res.json();
    } catch {
      return { alerts: [] };
    }
  }

  async acknowledgeAlert(id: string): Promise<any> {
    const res = await fetch('/api/alerts/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return await res.json();
  }

  async resolveAlert(id: string): Promise<any> {
    const res = await fetch('/api/alerts/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return await res.json();
  }

  async dispatchIncidentAlert(payload: {
    title: string;
    severity: string;
    description: string;
    channels: string[];
    topicArn?: string;
  }): Promise<any> {
    const res = await fetch('/api/alerts/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to dispatch alert');
    }
    return await res.json();
  }

  // ------------------------------------
  // OFFLINE QUEUE ENGINE
  // ------------------------------------
  private getQueue(): OfflineQueueItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: OfflineQueueItem[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    this.queueChangeListeners.forEach(cb => cb(queue));
  }

  public subscribeQueue(callback: (queue: OfflineQueueItem[]) => void): () => void {
    this.queueChangeListeners.push(callback);
    callback(this.getQueue());
    return () => {
      this.queueChangeListeners = this.queueChangeListeners.filter(cb => cb !== callback);
    };
  }

  public enqueueMutation(item: OfflineQueueItem) {
    const queue = this.getQueue();
    queue.push(item);
    this.saveQueue(queue);
  }

  public async flushOfflineQueue(): Promise<{ processed: number }> {
    const queue = this.getQueue();
    if (queue.length === 0) return { processed: 0 };

    let processed = 0;
    const remaining: OfflineQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.action === 's3_upload') {
          await this.uploadObject(
            item.payload.bucket,
            item.payload.filename,
            item.payload.mimeType,
            item.payload.contentBase64
          );
          processed++;
        } else if (item.action === 'alert_ack') {
          await this.acknowledgeAlert(item.payload.id);
          processed++;
        }
      } catch {
        remaining.push(item);
      }
    }

    this.saveQueue(remaining);
    return { processed };
  }
}

export const api = new ApiService();
