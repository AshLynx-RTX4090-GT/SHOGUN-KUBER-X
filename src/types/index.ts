export type UserRole = 'super_admin' | 'devops_lead' | 'sre' | 'viewer';

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  avatar: string;
  permissions: string[];
}

export interface AwsAccountStatus {
  connected: boolean;
  account?: string;
  arn?: string;
  userId?: string;
  region: string;
  hasSessionToken?: boolean;
  configuredVia?: string;
  error?: string;
  lastVerified?: string;
  message?: string;
}

export interface AwsDiscoveredCluster {
  name: string;
  arn?: string;
  status?: string;
  version?: string;
  endpoint?: string;
  createdAt?: string;
  roleArn?: string;
  nodegroups: string[];
}

export interface AwsDiscoveredInstance {
  instanceId: string;
  name: string;
  instanceType?: string;
  state?: string;
  privateIp?: string;
  publicIp?: string;
  launchTime?: string;
  subnetId?: string;
  vpcId?: string;
}

export interface AwsDiscoveredS3Bucket {
  name: string;
  creationDate?: string;
  region: string;
}

export interface AwsDiscoveredSnsTopic {
  arn: string;
  name: string;
}

export interface AwsDiscoveredAlarm {
  name: string;
  arn?: string;
  state: string;
  stateReason?: string;
  metricName?: string;
  namespace?: string;
  threshold?: number;
  comparison?: string;
}

export interface AwsDiscoveryData {
  connected: boolean;
  account?: string;
  arn?: string;
  userId?: string;
  region: string;
  lastSyncedAt?: string;
  summary?: {
    s3BucketCount: number;
    eksClusterCount: number;
    ec2InstanceCount: number;
    snsTopicCount: number;
    cloudWatchAlarmCount: number;
  };
  s3Buckets: AwsDiscoveredS3Bucket[];
  eksClusters: AwsDiscoveredCluster[];
  ec2Instances: AwsDiscoveredInstance[];
  snsTopics: AwsDiscoveredSnsTopic[];
  cloudWatchAlarms: AwsDiscoveredAlarm[];
  message?: string;
  error?: string;
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
  created?: string;
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
  type: 'image' | 'video' | 'document' | 'config';
  url: string;
  storageClass: string;
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
  action: 's3_upload' | 'alert_ack' | 'pod_restart' | 'terraform_apply';
  type?: string;
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

export interface ClusterNodeInfo {
  instanceId: string;
  name: string;
  instanceType: string;
  state: string;
  privateIp?: string;
  publicIp?: string;
  subnetId?: string;
  vpcId?: string;
  launchTime?: string;
}

export interface ClusterPodInfo {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  node: string;
  age: string;
}

export interface ClusterStatusResponse {
  connected: boolean;
  cluster: {
    name: string;
    status: string;
    health: 'Active' | 'Degraded';
    kubernetesVersion: string;
    arn: string;
    endpoint: string;
    roleArn: string;
    createdAt: string;
    region: string;
    nodegroups: string[];
  };
  nodes: {
    total: number;
    active: number;
    items: ClusterNodeInfo[];
  };
  pods: {
    total: number;
    running: number;
    pending: number;
    failed: number;
    items: ClusterPodInfo[];
  };
  timestamp: string;
}

export interface MetricDataPoint {
  timestamp: string;
  label: string;
  cpuUtilization: number;
  memoryUtilization: number;
  networkThroughputMBps: number;
}

export interface TelemetryMetricsResponse {
  period: string;
  resolutionSeconds: number;
  nodegroup: string;
  nodeCount: number;
  current: {
    cpuUtilizationPercent: number;
    memoryUtilizationPercent: number;
    networkThroughputMBps: number;
  };
  summary: {
    averageCpuPercent: number;
    averageMemoryPercent: number;
    peakCpuPercent: number;
  };
  dataPoints: MetricDataPoint[];
  timestamp: string;
}

export interface PipelineArtifact {
  key: string;
  filename: string;
  bucket: string;
  sizeBytes: number;
  formattedSize: string;
  lastModified: string;
  eTag: string;
  storageClass: string;
  category: 'pipeline_report' | 'run_artifact';
  downloadUrl: string;
  s3Uri: string;
}

export interface StorageArtifactsResponse {
  bucket: string;
  region: string;
  totalCount: number;
  totalSizeBytes: number;
  artifacts: PipelineArtifact[];
  timestamp: string;
}

export interface PipelineStage {
  name: string;
  status: 'SUCCESS' | 'RUNNING' | 'PENDING' | 'FAILED';
  duration: string;
}

export interface LiveTelemetryStreamData {
  timestamp: string;
  connected: boolean;
  region: string;
  cluster: {
    name: string;
    health: string;
    status: string;
    kubernetesVersion: string;
    nodesTotal: number;
    nodesReady: number;
    podsTotal: number;
    podsRunning: number;
  };
  metrics: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    networkThroughputMBps: number;
    requestsPerSecond: number;
    errorRatePercent: number;
    latencies: { p50: number; p95: number; p99: number };
  };
  pipeline: {
    id: string;
    name: string;
    status: string;
    duration: string;
    completedAt: string;
    stages: PipelineStage[];
  };
  storage: {
    bucket: string;
    artifactsCount: number;
  };
}
