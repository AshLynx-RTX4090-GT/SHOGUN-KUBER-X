export type UserRole = 'super_admin' | 'devops_lead' | 'sre' | 'viewer';

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  avatar: string;
  permissions: string[];
}

export interface ClusterInfo {
  name: string;
  kubernetesVersion: string;
  nodesTotal: number;
  nodesReady: number;
  podsTotal: number;
  podsRunning: number;
  podsPending: number;
  podsFailed: number;
  namespaces: string[];
}

export interface SystemMetrics {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  memoryUsedGB: string;
  memoryTotalGB: number;
  networkRxMBps: number;
  networkTxMBps: number;
  iopsRead: number;
  iopsWrite: number;
  requestsPerSecond: number;
  errorRatePercent: number;
  latencies: {
    p50: number;
    p95: number;
    p99: number;
  };
}

export interface MetricHistoryPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  network: number;
  rps: number;
  errorRate: number;
}

export interface S3Bucket {
  name: string;
  region: string;
  created: string;
  objectCount: number;
  sizeBytes: number;
  versioning: boolean;
  encryption: string;
  publicAccessBlock: boolean;
}

export interface S3MediaObject {
  id: string;
  bucket: string;
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'config';
  url: string;
  storageClass: 'STANDARD' | 'GLACIER' | 'DEEP_ARCHIVE' | 'INTELLIGENT_TIERING';
  lastModified: string;
  uploadedBy: string;
  tags: string[];
}

export interface PodItem {
  id: string;
  name: string;
  namespace: string;
  node: string;
  status: 'Running' | 'Pending' | 'CrashLoopBackOff' | 'Completed' | 'Failed';
  restarts: number;
  cpuCores: string;
  memoryMB: number;
  age: string;
  ip: string;
}

export interface AlertItem {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  description: string;
  dispatchedChannels: ('slack' | 'sns' | 'email')[];
}

export interface OfflineQueueItem {
  id: string;
  action: 's3_upload' | 'alert_ack' | 'delivery_status' | 'pod_restart' | 'terraform_apply';
  payload: any;
  timestamp: string;
  status: 'pending' | 'synced' | 'failed';
}

export interface WidgetConfig {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
  description: string;
}

export type DeliveryStatus = 'pending' | 'in_transit' | 'delivered' | 'delayed';

export interface DeliveryEndpoint {
  id: string;
  trackingCode: string;
  customerName: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  status: DeliveryStatus;
  progress: number;
  eta: string;
  updatedAt: string;
  urgent: boolean;
}

export interface DeliveryAnalytics {
  total: number;
  delivered: number;
  inTransit: number;
  delayed: number;
  averageProgress: number;
  urgent: number;
}
