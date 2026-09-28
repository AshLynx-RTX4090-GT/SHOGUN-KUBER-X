import { AlertItem, DeliveryAnalytics, DeliveryEndpoint, DeliveryStatus, MetricHistoryPoint, OfflineQueueItem, S3Bucket, S3MediaObject, SystemMetrics, User } from '../types';

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
    } catch (err) {
      console.warn('Backend login fallback to local user session', err);
      // Fallback local session if offline
      const mockUser: User = {
        id: 'usr-1',
        email: 'ashirbad.admin@shogun-kuber.io',
        username: 'Ashirbad Biswal',
        role: role as any,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        permissions: ['cluster:write', 'storage:upload', 'storage:delete', 'alerts:trigger', 'iac:apply', 'pipeline:trigger', 'rbac:admin']
      };
      return { token: 'mock-jwt-token-offline', user: mockUser };
    }
  }

  // ------------------------------------
  // METRICS & TELEMETRY
  // ------------------------------------
  async getCurrentMetrics(): Promise<{ cluster: any; system: SystemMetrics }> {
    try {
      const res = await fetch('/api/metrics/current');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      const data = await res.json();
      // Cache metrics for offline view
      localStorage.setItem(STORAGE_KEYS.OFFLINE_CACHE + '_metrics', JSON.stringify(data));
      return data;
    } catch (err) {
      const cached = localStorage.getItem(STORAGE_KEYS.OFFLINE_CACHE + '_metrics');
      if (cached) return JSON.parse(cached);
      // Synthetic fallback
      return {
        cluster: {
          name: 'shogun-prod-kuber-x-us-east',
          kubernetesVersion: 'v1.31.2-eks.1',
          nodesTotal: 8,
          nodesReady: 8,
          podsTotal: 124,
          podsRunning: 118,
          podsPending: 4,
          podsFailed: 2,
          namespaces: ['default', 'production-apps', 'telemetry-kuber', 'kube-system']
        },
        system: {
          cpuUsagePercent: 54,
          memoryUsagePercent: 68,
          memoryUsedGB: '43.5',
          memoryTotalGB: 64,
          networkRxMBps: 210,
          networkTxMBps: 285,
          iopsRead: 1400,
          iopsWrite: 3950,
          requestsPerSecond: 15400,
          errorRatePercent: 0.05,
          latencies: { p50: 18, p95: 44, p99: 89 }
        }
      };
    }
  }

  async getMetricsHistory(): Promise<{ points: MetricHistoryPoint[] }> {
    try {
      const res = await fetch('/api/metrics/history');
      if (!res.ok) throw new Error('Failed to fetch metric history');
      const data = await res.json();
      return data;
    } catch {
      // Offline fallback points
      const points: MetricHistoryPoint[] = [];
      const now = Date.now();
      for (let i = 29; i >= 0; i--) {
        points.push({
          timestamp: new Date(now - i * 5000).toLocaleTimeString([], { hour12: false }),
          cpu: 50 + Math.sin(i * 0.4) * 15,
          memory: 65 + Math.cos(i * 0.3) * 10,
          network: 280 + Math.sin(i * 0.5) * 60,
          rps: 14000 + Math.sin(i * 0.3) * 2000,
          errorRate: 0.04
        });
      }
      return { points };
    }
  }

  // ------------------------------------
  // AWS S3 STORAGE
  // ------------------------------------
  async getAwsStatus(): Promise<any> {
    const res = await fetch('/api/aws/status');
    if (!res.ok) throw new Error('Unable to verify AWS connection');
    return res.json();
  }

  async enableS3Versioning(bucket?: string): Promise<any> {
    const res = await fetch('/api/aws/s3/enable-versioning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify(bucket ? { bucket } : {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to enable S3 Versioning');
    return data;
  }

  async getIntegrations(): Promise<{ integrations: any[] }> {
    const res = await fetch('/api/integrations');
    if (!res.ok) throw new Error('Unable to load integrations');
    return res.json();
  }

  async getBuckets(): Promise<{ connectedToRealAws: boolean; region: string; buckets: S3Bucket[] }> {
    try {
      const res = await fetch('/api/s3/buckets');
      if (!res.ok) throw new Error('Failed to fetch buckets');
      return await res.json();
    } catch {
      return {
        connectedToRealAws: false,
        region: 'us-east-1',
        buckets: [
          {
            name: 'kuber-x-media-assets-prod',
            region: 'us-east-1',
            created: '2026-01-15T08:00:00Z',
            objectCount: 42,
            sizeBytes: 184582912,
            versioning: true,
            encryption: 'AES256',
            publicAccessBlock: true
          }
        ]
      };
    }
  }

  async getObjects(bucket?: string, type?: string, search?: string): Promise<{ count: number; objects: S3MediaObject[] }> {
    try {
      const params = new URLSearchParams();
      if (bucket) params.set('bucket', bucket);
      if (type && type !== 'all') params.set('type', type);
      if (search) params.set('search', search);

      const res = await fetch(`/api/s3/objects?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch S3 objects');
      const data = await res.json();
      localStorage.setItem(STORAGE_KEYS.OFFLINE_CACHE + '_s3_objects', JSON.stringify(data.objects));
      return data;
    } catch {
      const cached = localStorage.getItem(STORAGE_KEYS.OFFLINE_CACHE + '_s3_objects');
      if (cached) {
        return { count: JSON.parse(cached).length, objects: JSON.parse(cached) };
      }
      return { count: 0, objects: [] };
    }
  }

  async uploadObject(payload: {
    bucket?: string;
    filename: string;
    mimeType?: string;
    size?: number;
    contentBase64?: string;
    tags?: string[];
    keyPrefix?: 'workspace-uploads' | 'eks-manifests' | 'cloudformation-templates';
  }): Promise<{ success: boolean; object: S3MediaObject; message: string }> {
    if (!this.isOnline) {
      const queuedItem: OfflineQueueItem = {
        id: `queue-${Date.now()}`,
        action: 's3_upload',
        payload,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      this.enqueueOfflineItem(queuedItem);

      // Return local synthetic object so UI updates immediately
      const syntheticObj: S3MediaObject = {
        id: `s3-offline-${Date.now()}`,
        bucket: payload.bucket || 'kuber-x-media-assets-prod',
        key: `media/uploads/${payload.filename}`,
        filename: payload.filename,
        size: payload.size || 1024000,
        mimeType: payload.mimeType || 'application/octet-stream',
        type: payload.mimeType?.startsWith('image/') ? 'image' : payload.mimeType?.startsWith('video/') ? 'video' : payload.mimeType?.startsWith('audio/') ? 'audio' : 'document',
        url: payload.contentBase64 || '',
        storageClass: 'STANDARD',
        lastModified: new Date().toISOString(),
        uploadedBy: 'ashirbad.sre@shogun-cloud.io (Offline Queued)',
        tags: ['offline-queued', ...(payload.tags || [])]
      };
      return {
        success: true,
        message: 'Saved to local offline queue. Will sync to AWS S3 when connected.',
        object: syntheticObj
      };
    }

    const res = await fetch('/api/s3/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Upload failed');
    return await res.json();
  }

  async deleteObject(id: string, bucket?: string, key?: string): Promise<boolean> {
    const params = bucket && key ? `?${new URLSearchParams({ bucket, key }).toString()}` : '';
    const res = await fetch(`/api/s3/objects/${id}${params}`, { method: 'DELETE', headers: this.token ? { Authorization: `Bearer ${this.token}` } : {} });
    return res.ok;
  }

  async archiveObject(id: string, targetClass: string): Promise<any> {
    const res = await fetch('/api/s3/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, targetClass })
    });
    return await res.json();
  }

  // ------------------------------------
  // ALERTS & INCIDENTS (SNS / SLACK / EMAIL)
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

  async getDeliveries(): Promise<{ deliveries: DeliveryEndpoint[]; analytics: DeliveryAnalytics }> {
    try {
      const response = await fetch('/api/deliveries');
      if (!response.ok) throw new Error('Failed to fetch delivery endpoints');
      const data = await response.json();
      localStorage.setItem(STORAGE_KEYS.OFFLINE_CACHE + '_deliveries', JSON.stringify(data));
      return data;
    } catch {
      const cached = localStorage.getItem(STORAGE_KEYS.OFFLINE_CACHE + '_deliveries');
      if (cached) return JSON.parse(cached);
      return { deliveries: [], analytics: { total: 0, delivered: 0, inTransit: 0, delayed: 0, averageProgress: 0, urgent: 0 } };
    }
  }

  async updateDeliveryStatus(id: string, status: DeliveryStatus, progress?: number): Promise<DeliveryEndpoint> {
    if (!this.isOnline) {
      this.enqueueOfflineItem({ id: `queue-${Date.now()}`, action: 'delivery_status', payload: { id, status, progress }, timestamp: new Date().toISOString(), status: 'pending' });
      const cached = await this.getDeliveries();
      const delivery = cached.deliveries.find(item => item.id === id);
      if (!delivery) throw new Error('Delivery endpoint was not found');
      return { ...delivery, status, progress: progress ?? delivery.progress, urgent: status === 'delayed', updatedAt: new Date().toISOString() };
    }
    const response = await fetch(`/api/deliveries/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify({ status, progress }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to update delivery status');
    return data.delivery;
  }

  async acknowledgeAlert(id: string): Promise<boolean> {
    if (!this.isOnline) {
      this.enqueueOfflineItem({
        id: `queue-${Date.now()}`,
        action: 'alert_ack',
        payload: { id },
        timestamp: new Date().toISOString(),
        status: 'pending'
      });
      return true;
    }
    const res = await fetch('/api/alerts/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return res.ok;
  }

  async resolveAlert(id: string): Promise<boolean> {
    const res = await fetch('/api/alerts/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return res.ok;
  }

  async dispatchIncidentAlert(payload: {
    title: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
    channels: ('slack' | 'sns' | 'email')[];
  }): Promise<any> {
    const res = await fetch('/api/alerts/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  // ------------------------------------
  // DEVOPS & CI/CD PIPELINE
  // ------------------------------------
  async getDevopsSummary(): Promise<any> {
    try {
      const res = await fetch('/api/devops/summary');
      if (!res.ok) throw new Error('Failed to fetch devops data');
      return await res.json();
    } catch {
      return null;
    }
  }

  // ------------------------------------
  // OFFLINE QUEUE & SYNC ENGINE
  // ------------------------------------
  public getOfflineQueue(): OfflineQueueItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  public enqueueOfflineItem(item: OfflineQueueItem) {
    const queue = this.getOfflineQueue();
    queue.push(item);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    this.notifyQueueListeners();
  }

  public subscribeQueue(callback: (queue: OfflineQueueItem[]) => void) {
    this.queueChangeListeners.push(callback);
    callback(this.getOfflineQueue());
    return () => {
      this.queueChangeListeners = this.queueChangeListeners.filter(cb => cb !== callback);
    };
  }

  private notifyQueueListeners() {
    const q = this.getOfflineQueue();
    this.queueChangeListeners.forEach(cb => cb(q));
  }

  public async flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;
    const remainingQueue: OfflineQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.action === 's3_upload') {
          await fetch('/api/s3/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });
          synced++;
        } else if (item.action === 'alert_ack') {
          await fetch('/api/alerts/acknowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });
          synced++;
        } else if (item.action === 'delivery_status') {
          const response = await fetch(`/api/deliveries/${encodeURIComponent(item.payload.id)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
            body: JSON.stringify({ status: item.payload.status, progress: item.payload.progress }),
          });
          if (!response.ok) throw new Error('Delivery status sync failed');
          synced++;
        }
      } catch (err) {
        console.error('Failed to sync offline item', item, err);
        remainingQueue.push(item);
        failed++;
      }
    }

    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(remainingQueue));
    this.notifyQueueListeners();
    return { synced, failed };
  }
}

export const api = new ApiService();
