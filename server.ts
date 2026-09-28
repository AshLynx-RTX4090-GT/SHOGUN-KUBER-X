import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListBucketsCommand, GetBucketVersioningCommand, PutBucketVersioningCommand } from '@aws-sdk/client-s3';
import { createIntegrationStore } from './backend/integrations-store';
import { createDeliveriesStore, DeliveryStatus } from './backend/deliveries-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'shogun-kuber-x-secure-jwt-secret-2026';
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// AWS S3 configuration from environment (optional for real connection, falls back to in-memory store)
const s3Config = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
};

// An IAM role (recommended in ECS/EC2/Lambda) is also a real AWS connection. Do not
// expose any of these credentials to the browser.
const hasAwsConfiguration = Boolean(process.env.AWS_BUCKET_NAME || (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY));
const s3Client = hasAwsConfiguration ? new S3Client(s3Config) : null;
const configuredBuckets = (process.env.AWS_BUCKET_NAME || '').split(',').map(name => name.trim()).filter(Boolean);
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024);
const AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID || '';
const AWS_BACKUP_PLAN_ARN = process.env.AWS_BACKUP_PLAN_ARN || '';
const AWS_EBS_SNAPSHOT_VOLUMES = (process.env.AWS_EBS_SNAPSHOT_VOLUMES || '').split(',').map(id => id.trim()).filter(Boolean);
const integrationStore = createIntegrationStore();
const deliveriesStore = createDeliveriesStore();

const BILLING_PLANS: Record<string, { name: string; amount: number }> = {
  starter: { name: 'Starter', amount: 199900 },
  scale: { name: 'Scale', amount: 599900 },
  enterprise: { name: 'Enterprise', amount: 1499900 },
};

const ONE_TIME_PURCHASES: Record<string, { name: string; amount: number }> = {
  'incident-pack': { name: 'Incident Response Pack', amount: 249900 },
  'migration-pack': { name: 'Cloud Migration Pack', amount: 899900 },
};

/**
 * Pending Razorpay orders are created exclusively from our server-side price
 * catalog. Replace this in-memory store with a database in a multi-instance
 * deployment so verification and fulfillment remain durable and idempotent.
 */
interface PendingPayment {
  planId: string;
  purchaseType: 'subscription' | 'one-time';
  amount: number;
  currency: string;
  fulfilled: boolean;
  paymentId?: string;
}
const pendingPayments = new Map<string, PendingPayment>();
const paymentToOrder = new Map<string, string>();

// Initial mock & persistent media asset storage for AWS S3 Dashboard
interface S3MediaObject {
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

function inferMimeType(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = { yaml: 'application/yaml', yml: 'application/yaml', json: 'application/json', pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4', mov: 'video/quicktime', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', txt: 'text/plain' };
  return types[ext || ''] || 'application/octet-stream';
}

function makeS3Object(bucket: string, key: string, filename: string, size: number, mimeType: string, lastModified = new Date().toISOString()): S3MediaObject {
  const type = mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : mimeType.startsWith('audio/') ? 'audio' : /yaml|json/.test(mimeType) || /\.(yaml|yml|json)$/i.test(filename) ? 'config' : 'document';
  return {
    id: `aws-${createHash('sha256').update(`${bucket}/${key}`).digest('hex').slice(0, 16)}`,
    bucket, key, filename, size, mimeType, type,
    url: `/api/s3/objects/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`,
    storageClass: 'STANDARD', lastModified, uploadedBy: 'AWS IAM principal', tags: ['aws-s3', type],
  };
}

let s3Buckets = [
  {
    name: 'kuber-x-media-assets-prod',
    region: 'us-east-1',
    created: '2026-01-15T08:00:00Z',
    objectCount: 42,
    sizeBytes: 184582912, // ~184 MB
    versioning: true,
    encryption: 'AES256',
    publicAccessBlock: true,
  },
  {
    name: 'kuber-x-cluster-snapshots-vault',
    region: 'us-west-2',
    created: '2026-02-01T12:00:00Z',
    objectCount: 156,
    sizeBytes: 524288000, // 500 MB
    versioning: true,
    encryption: 'aws:kms',
    publicAccessBlock: true,
  },
  {
    name: 'kuber-x-telemetry-archives',
    region: 'eu-central-1',
    created: '2026-02-10T14:30:00Z',
    objectCount: 88,
    sizeBytes: 104857600, // 100 MB
    versioning: false,
    encryption: 'AES256',
    publicAccessBlock: true,
  }
];

let s3Objects: S3MediaObject[] = [
  {
    id: 's3-001',
    bucket: 'kuber-x-media-assets-prod',
    key: 'media/videos/cluster-canary-deployment-demo.mp4',
    filename: 'cluster-canary-deployment-demo.mp4',
    size: 24500000,
    mimeType: 'video/mp4',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    storageClass: 'STANDARD',
    lastModified: '2026-09-24T18:30:00Z',
    uploadedBy: 'ashirbad.sre@shogun-cloud.io',
    tags: ['canary', 'kubernetes', 'video-demo']
  },
  {
    id: 's3-002',
    bucket: 'kuber-x-media-assets-prod',
    key: 'media/videos/pod-autohealing-stress-test.mp4',
    filename: 'pod-autohealing-stress-test.mp4',
    size: 19800000,
    mimeType: 'video/mp4',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    storageClass: 'STANDARD',
    lastModified: '2026-09-24T19:15:00Z',
    uploadedBy: 'ashirbad.sre@shogun-cloud.io',
    tags: ['stress-test', 'resilience', 'video-demo']
  },
  {
    id: 's3-003',
    bucket: 'kuber-x-media-assets-prod',
    key: 'media/images/k8s-mesh-architecture-diagram.png',
    filename: 'k8s-mesh-architecture-diagram.png',
    size: 4200000,
    mimeType: 'image/png',
    type: 'image',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="%230f172a"/><circle cx="400" cy="250" r="180" fill="none" stroke="%2306b6d4" stroke-width="2" stroke-dasharray="8 4"/><circle cx="400" cy="250" r="70" fill="%231e293b" stroke="%2338bdf8" stroke-width="3"/><text x="400" y="255" fill="%23f8fafc" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">KUBER X CONTROL PLANE</text><circle cx="200" cy="150" r="45" fill="%231e293b" stroke="%2310b981" stroke-width="2"/><text x="200" y="155" fill="%23e2e8f0" font-family="sans-serif" font-size="12" text-anchor="middle">Worker-Node-01</text><circle cx="600" cy="150" r="45" fill="%231e293b" stroke="%2310b981" stroke-width="2"/><text x="600" y="155" fill="%23e2e8f0" font-family="sans-serif" font-size="12" text-anchor="middle">Worker-Node-02</text><circle cx="200" cy="350" r="45" fill="%231e293b" stroke="%2310b981" stroke-width="2"/><text x="200" y="355" fill="%23e2e8f0" font-family="sans-serif" font-size="12" text-anchor="middle">Worker-Node-03</text><circle cx="600" cy="350" r="45" fill="%231e293b" stroke="%233b82f6" stroke-width="2"/><text x="600" y="355" fill="%23e2e8f0" font-family="sans-serif" font-size="12" text-anchor="middle">Storage-S3-Gateway</text><line x1="240" y1="170" x2="350" y2="220" stroke="%2364748b" stroke-width="2"/><line x1="560" y1="170" x2="450" y2="220" stroke="%2364748b" stroke-width="2"/><line x1="240" y1="330" x2="350" y2="280" stroke="%2364748b" stroke-width="2"/><line x1="560" y1="330" x2="450" y2="280" stroke="%2364748b" stroke-width="2"/><text x="400" y="50" fill="%2338bdf8" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SHOGUN KUBER X // HIGH-AVAILABILITY CLUSTER TOPOLOGY</text></svg>',
    storageClass: 'STANDARD',
    lastModified: '2026-09-24T16:10:00Z',
    uploadedBy: 'ashirbad.sre@shogun-cloud.io',
    tags: ['architecture', 'topology', 'infographic']
  },
  {
    id: 's3-004',
    bucket: 'kuber-x-media-assets-prod',
    key: 'media/images/grafana-incident-heat-map.png',
    filename: 'grafana-incident-heat-map.png',
    size: 2100000,
    mimeType: 'image/png',
    type: 'image',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="%23090d16"/><text x="30" y="40" fill="%23f1f5f9" font-family="sans-serif" font-size="16" font-weight="bold">Grafana Observability Heatmap // Request Latency Distribution</text><g transform="translate(40, 80)"><rect x="0" y="0" width="100" height="40" fill="%231e293b"/><rect x="110" y="0" width="100" height="40" fill="%230e7490"/><rect x="220" y="0" width="100" height="40" fill="%230891b2"/><rect x="330" y="0" width="100" height="40" fill="%230284c7"/><rect x="440" y="0" width="100" height="40" fill="%230369a1"/><rect x="550" y="0" width="100" height="40" fill="%230284c7"/><rect x="660" y="0" width="100" height="40" fill="%230891b2"/><rect x="0" y="50" width="100" height="40" fill="%230891b2"/><rect x="110" y="50" width="100" height="40" fill="%2306b6d4"/><rect x="220" y="50" width="100" height="40" fill="%2322d3ee"/><rect x="330" y="50" width="100" height="40" fill="%23f59e0b"/><rect x="440" y="50" width="100" height="40" fill="%23ef4444"/><rect x="550" y="50" width="100" height="40" fill="%23f59e0b"/><rect x="660" y="50" width="100" height="40" fill="%2306b6d4"/><rect x="0" y="100" width="100" height="40" fill="%231e293b"/><rect x="110" y="100" width="100" height="40" fill="%230e7490"/><rect x="220" y="100" width="100" height="40" fill="%230891b2"/><rect x="330" y="100" width="100" height="40" fill="%230284c7"/><rect x="440" y="100" width="100" height="40" fill="%230369a1"/><rect x="550" y="100" width="100" height="40" fill="%230284c7"/><rect x="660" y="100" width="100" height="40" fill="%230e7490"/><rect x="0" y="150" width="100" height="40" fill="%230f172a"/><rect x="110" y="150" width="100" height="40" fill="%231e293b"/><rect x="220" y="150" width="100" height="40" fill="%230e7490"/><rect x="330" y="150" width="100" height="40" fill="%230891b2"/><rect x="440" y="150" width="100" height="40" fill="%230e7490"/><rect x="550" y="150" width="100" height="40" fill="%231e293b"/><rect x="660" y="150" width="100" height="40" fill="%230f172a"/></g><text x="40" y="320" fill="%2394a3b8" font-family="sans-serif" font-size="13">Nodes: worker-prod-01..07 | Timeframe: Last 24 Hours | Scraped via Prometheus v2.52</text></svg>',
    storageClass: 'STANDARD',
    lastModified: '2026-09-24T14:45:00Z',
    uploadedBy: 'ashirbad.sre@shogun-cloud.io',
    tags: ['metrics', 'grafana', 'telemetry']
  },
  {
    id: 's3-005',
    bucket: 'kuber-x-cluster-snapshots-vault',
    key: 'configs/helm-chart-production-values.yaml',
    filename: 'helm-chart-production-values.yaml',
    size: 45200,
    mimeType: 'text/yaml',
    type: 'config',
    url: 'data:text/plain;charset=utf-8,global:%0A  clusterName: shogun-kuber-prod-us-east-1%0A  environment: production%0Areplicas:%0A  apiGateway: 8%0A  telemetryStream: 6%0A  storageManager: 4%0Aresources:%0A  limits:%0A    cpu: "2000m"%0A    memory: "4096Mi"%0A  requests:%0A    cpu: "500m"%0A    memory: "1024Mi"%0Aautoscaling:%0A  enabled: true%0A  minReplicas: 4%0A  maxReplicas: 32%0A  targetCPUUtilizationPercentage: 75%0A',
    storageClass: 'STANDARD',
    lastModified: '2026-09-23T11:20:00Z',
    uploadedBy: 'ashirbad.sre@shogun-cloud.io',
    tags: ['helm', 'yaml', 'k8s-values']
  },
  {
    id: 's3-006',
    bucket: 'kuber-x-telemetry-archives',
    key: 'archives/incident-postmortem-report-2026-09.pdf',
    filename: 'incident-postmortem-report-2026-09.pdf',
    size: 1420000,
    mimeType: 'application/pdf',
    type: 'document',
    url: 'data:text/plain;charset=utf-8,Incident%20Postmortem%20Report%20-%20Shogun%20KUBER%20X%20Production%20Cluster',
    storageClass: 'GLACIER',
    lastModified: '2026-09-21T09:15:00Z',
    uploadedBy: 'ashirbad.sre@shogun-cloud.io',
    tags: ['postmortem', 'incident-report', 'sla']
  }
];

// Active Incident Alerts
interface AlertItem {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  description: string;
  dispatchedChannels: ('slack' | 'sns' | 'email')[];
}

let activeAlerts: AlertItem[] = [
  {
    id: 'alt-101',
    title: 'High Ingress Throughput Spike Detected',
    severity: 'warning',
    source: 'ingress-nginx-controller',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    status: 'active',
    description: 'Inbound requests exceeded 48,000 req/sec threshold on ingress worker-02.',
    dispatchedChannels: ['slack']
  },
  {
    id: 'alt-102',
    title: 'Pod Eviction in Namespace: production-workers',
    severity: 'critical',
    source: 'kubelet-worker-node-04',
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    status: 'acknowledged',
    description: 'Node memory pressure prompted eviction of 1 pod instance (s3-transcoder-worker). Auto-scaled to node-05.',
    dispatchedChannels: ['slack', 'sns', 'email']
  },
  {
    id: 'alt-103',
    title: 'AWS S3 Lifecycle Transition Rule Succeeded',
    severity: 'info',
    source: 'aws-s3-lifecycle-engine',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    status: 'resolved',
    description: 'Archived 1,420 telemetry snapshots to Glacier Deep Archive with zero errors.',
    dispatchedChannels: ['email']
  }
];

// Simulated Users for JWT Auth & RBAC
const USERS = [
  {
    id: 'usr-1',
    email: 'ashirbad.admin@shogun-kuber.io',
    username: 'Ashirbad Biswal',
    role: 'super_admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    permissions: ['cluster:write', 'storage:upload', 'storage:delete', 'alerts:trigger', 'iac:apply', 'pipeline:trigger', 'rbac:admin']
  },
  {
    id: 'usr-2',
    email: 'devops.lead@shogun-kuber.io',
    username: 'DevOps System Lead',
    role: 'devops_lead',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    permissions: ['cluster:write', 'storage:upload', 'storage:delete', 'alerts:trigger', 'iac:apply', 'pipeline:trigger']
  },
  {
    id: 'usr-3',
    email: 'sre.oncall@shogun-kuber.io',
    username: 'Site Reliability Engineer',
    role: 'sre',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    permissions: ['cluster:write', 'storage:upload', 'alerts:trigger', 'pipeline:trigger']
  },
  {
    id: 'usr-4',
    email: 'guest.viewer@shogun-kuber.io',
    username: 'Cluster Readonly Auditor',
    role: 'viewer',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    permissions: ['cluster:read', 'storage:read', 'telemetry:read']
  }
];

async function startServer() {
  await deliveriesStore.init();
  const app = express();
  // Base64 expands payloads by roughly one third; leave room for JSON metadata.
  const requestLimit = `${Math.ceil((MAX_UPLOAD_BYTES * 1.4) / (1024 * 1024))}mb`;
  app.use(express.json({ limit: requestLimit }));
  app.use(express.urlencoded({ extended: true, limit: requestLimit }));

  // Helper JWT Auth Middleware
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Invalid or expired token' });
      (req as any).user = user;
      next();
    });
  };

  // ----------------------------------------------------
  // 1. AUTH & RBAC ENDPOINTS
  // ----------------------------------------------------
  app.post('/api/auth/login', (req, res) => {
    const { email, role } = req.body;
    let user = USERS.find(u => u.email === email);
    if (!user) {
      const selectedRole = role || 'super_admin';
      user = USERS.find(u => u.role === selectedRole) || USERS[0];
    }
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
        permissions: user.permissions
      }
    });
  });

  app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: (req as any).user });
  });

  app.get('/api/deliveries', async (_req, res) => {
    try {
      res.json({ deliveries: await deliveriesStore.list(), analytics: await deliveriesStore.analytics(), source: process.env.DATABASE_URL ? 'postgresql' : 'development-fallback' });
    } catch (error) {
      console.error('Unable to load delivery endpoints:', error);
      res.status(503).json({ error: 'Delivery data is temporarily unavailable.' });
    }
  });

  app.patch('/api/deliveries/:id/status', authenticateToken, async (req, res) => {
    const status = req.body?.status as DeliveryStatus;
    const allowed: DeliveryStatus[] = ['pending', 'in_transit', 'delivered', 'delayed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid delivery status.' });
    try {
      const delivery = await deliveriesStore.updateStatus(req.params.id, status, Number(req.body?.progress));
      if (!delivery) return res.status(404).json({ error: 'Delivery endpoint was not found.' });
      res.json({ delivery });
    } catch (error) {
      console.error('Unable to update delivery status:', error);
      res.status(503).json({ error: 'Delivery status could not be updated.' });
    }
  });

  // Location is resolved server-side so Google Maps keys never reach the browser.
  // Google Geocoding is preferred when configured; Open-Meteo remains a no-key fallback.
  app.get('/api/location/context', async (req, res) => {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,windspeed_10m&timezone=auto`;
      const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
      const locationUrl = mapsKey
        ? `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${mapsKey}`
        : `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`;
      const [weatherResponse, locationResponse] = await Promise.all([fetch(weatherUrl), fetch(locationUrl)]);
      if (!weatherResponse.ok || !locationResponse.ok) throw new Error('Provider unavailable');
      const weather = await weatherResponse.json() as any;
      const location = await locationResponse.json() as any;
      const googleResult = location.results?.[0];
      const component = (type: string) => googleResult?.address_components?.find((part: any) => part.types?.includes(type))?.long_name;
      res.json({
        country: mapsKey ? component('country') : location.results?.[0]?.country,
        region: mapsKey ? component('administrative_area_level_1') || component('locality') : location.results?.[0]?.admin1 || location.results?.[0]?.name,
        timezone: weather.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        temperature: Math.round(weather.current?.temperature_2m ?? 0),
        wind: Math.round(weather.current?.windspeed_10m ?? 0),
        source: mapsKey ? 'Google Maps' : 'Open-Meteo',
      });
    } catch {
      res.status(502).json({ error: 'Location and weather services are currently unavailable.' });
    }
  });

  // ----------------------------------------------------
  // 2. RAZORPAY BILLING
  // ----------------------------------------------------
  app.post('/api/payments/create-order', async (req, res) => {
    const purchaseType = req.body?.purchaseType === 'one-time' ? 'one-time' : 'subscription';
    const catalog = purchaseType === 'one-time' ? ONE_TIME_PURCHASES : BILLING_PLANS;
    const plan = catalog[req.body?.planId];
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!plan) return res.status(400).json({ error: 'Unknown billing plan.' });
    if (!keyId || !keySecret) {
      return res.status(503).json({ error: 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local.' });
    }

    try {
      const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: plan.amount,
          currency: 'INR',
          receipt: `kx_${req.body.planId}_${Date.now()}`,
          notes: { product: 'Shogun KUBER X', plan: plan.name },
        }),
      });
      const order = await razorpayResponse.json() as { id?: string; amount?: number; currency?: string; error?: { description?: string } };
      if (!razorpayResponse.ok || !order.id) {
        return res.status(502).json({ error: order.error?.description || 'Razorpay order creation failed.' });
      }
      if (order.amount !== plan.amount || order.currency !== 'INR') {
        console.error('Razorpay returned an unexpected order amount or currency:', order.id);
        return res.status(502).json({ error: 'Razorpay returned an invalid order.' });
      }
      pendingPayments.set(order.id, {
        planId: req.body.planId,
        purchaseType,
        amount: plan.amount,
        currency: 'INR',
        fulfilled: false,
      });
      res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId });
    } catch (error) {
      console.error('Razorpay order error:', error);
      res.status(502).json({ error: 'Unable to reach Razorpay.' });
    }
  });

  app.get('/api/payments/status', (_req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    res.json({
      configured: Boolean(keyId && process.env.RAZORPAY_KEY_SECRET),
      mode: keyId.startsWith('rzp_live_') ? 'live' : keyId.startsWith('rzp_test_') ? 'test' : 'not_configured',
      methods: ['UPI', 'Credit card', 'Debit card'],
      checkoutUrl: 'https://checkout.razorpay.com/v1/checkout.js',
    });
  });

  app.post('/api/payments/verify', (req, res) => {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret || !orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Incomplete Razorpay payment details.' });
    }

    const pendingPayment = pendingPayments.get(orderId);
    if (!pendingPayment) {
      // Never fulfill a checkout response for an order this server did not create.
      return res.status(400).json({ error: 'Unknown or expired Razorpay order.' });
    }
    const paymentOrderId = paymentToOrder.get(paymentId);
    if (paymentOrderId && paymentOrderId !== orderId) {
      return res.status(409).json({ error: 'This payment has already been used.' });
    }

    const expectedSignature = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const signaturesMatch = expectedSignature.length === signature.length && timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature),
    );
    if (!signaturesMatch) return res.status(400).json({ error: 'Payment signature verification failed.' });

    // This is the only fulfillment point: it runs after a constant-time signature check.
    // Make the equivalent database update/entitlement grant transactional in production.
    if (!pendingPayment.fulfilled) {
      pendingPayment.fulfilled = true;
      pendingPayment.paymentId = paymentId;
      paymentToOrder.set(paymentId, orderId);
    }
    res.json({ verified: true, fulfilled: true, paymentId, planId: pendingPayment.planId, purchaseType: pendingPayment.purchaseType });
  });

  app.post('/api/support/ask', async (req, res) => {
    const question = String(req.body?.question || '').trim();
    if (!question) return res.status(400).json({ error: 'A support question is required.' });
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.json({ answer: 'Local support mode: review the Overview, Kubernetes, Alerts, and Plans modules for guided operational workflows. Add GEMINI_API_KEY to enable live AI answers.' });
    }
    try {
      const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `You are the concise 24/7 technical support assistant for Shogun KUBER X. Answer this operator question with practical, safe steps: ${question}` }] }] }),
      });
      const data = await aiResponse.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiResponse.ok || !answer) return res.status(502).json({ error: 'AI support is temporarily unavailable.' });
      res.json({ answer });
    } catch {
      res.status(502).json({ error: 'AI support is temporarily unavailable.' });
    }
  });

  // ----------------------------------------------------
  // 3. REAL-TIME TELEMETRY & SYSTEM ANALYTICS
  // ----------------------------------------------------
  app.get('/api/metrics/current', (_req, res) => {
    // Generate organic, realistic fluctuating telemetry
    const now = Date.now();
    const secondSeed = Math.floor(now / 3000);
    const cpu = Math.min(94, Math.max(18, Math.round(48 + Math.sin(secondSeed * 0.4) * 16 + Math.cos(secondSeed * 0.9) * 8)));
    const memory = Math.min(92, Math.max(35, Math.round(62 + Math.cos(secondSeed * 0.3) * 10)));
    const networkRx = Math.round(185 + Math.sin(secondSeed * 0.5) * 45); // MB/s
    const networkTx = Math.round(240 + Math.cos(secondSeed * 0.4) * 55); // MB/s
    const latencyP50 = Math.round(18 + Math.sin(secondSeed * 0.2) * 4); // ms
    const latencyP95 = Math.round(42 + Math.sin(secondSeed * 0.6) * 12); // ms
    const latencyP99 = Math.round(88 + Math.cos(secondSeed * 0.5) * 22); // ms
    const rps = Math.round(14500 + Math.sin(secondSeed * 0.8) * 2200);

    res.json({
      timestamp: new Date().toISOString(),
      cluster: {
        name: 'shogun-prod-kuber-x-us-east',
        kubernetesVersion: 'v1.31.2-eks.1',
        nodesTotal: 8,
        nodesReady: 8,
        podsTotal: 124,
        podsRunning: 118,
        podsPending: 4,
        podsFailed: 2,
        namespaces: ['default', 'production-apps', 'telemetry-kuber', 'kube-system', 's3-sync-pipeline']
      },
      system: {
        cpuUsagePercent: cpu,
        memoryUsagePercent: memory,
        memoryUsedGB: (memory * 0.64).toFixed(1),
        memoryTotalGB: 64,
        networkRxMBps: networkRx,
        networkTxMBps: networkTx,
        iopsRead: Math.round(1240 + Math.sin(secondSeed) * 200),
        iopsWrite: Math.round(3800 + Math.cos(secondSeed) * 400),
        requestsPerSecond: rps,
        errorRatePercent: parseFloat((0.04 + Math.abs(Math.sin(secondSeed * 0.7)) * 0.08).toFixed(2)),
        latencies: {
          p50: latencyP50,
          p95: latencyP95,
          p99: latencyP99
        }
      }
    });
  });

  app.get('/api/metrics/history', (_req, res) => {
    // Generate 30 telemetry points
    const points = [];
    const count = 30;
    const now = Date.now();
    for (let i = count - 1; i >= 0; i--) {
      const t = now - i * 5000;
      const step = Math.floor(t / 5000);
      points.push({
        timestamp: new Date(t).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        cpu: Math.min(95, Math.max(20, Math.round(50 + Math.sin(step * 0.3) * 20 + Math.cos(step * 0.7) * 9))),
        memory: Math.min(90, Math.max(40, Math.round(65 + Math.cos(step * 0.25) * 11))),
        network: Math.round(320 + Math.sin(step * 0.4) * 80),
        rps: Math.round(13500 + Math.sin(step * 0.5) * 2600),
        errorRate: parseFloat((0.03 + Math.abs(Math.sin(step * 0.6)) * 0.09).toFixed(2))
      });
    }
    res.json({ points });
  });

  // Prometheus Scrape Metrics endpoint
  app.get('/metrics', (_req, res) => {
    const now = Date.now();
    const secondSeed = Math.floor(now / 3000);
    const cpu = (0.48 + Math.sin(secondSeed * 0.4) * 0.16).toFixed(4);
    const memBytes = Math.round(41231686000 + Math.cos(secondSeed * 0.3) * 2000000000);
    const output = [
      '# HELP shogun_node_cpu_utilization Ratio of CPU cores currently allocated.',
      '# TYPE shogun_node_cpu_utilization gauge',
      `shogun_node_cpu_utilization{cluster="shogun-prod-kuber-x-us-east",node="worker-01"} ${cpu}`,
      '# HELP shogun_node_memory_bytes_used Total RAM bytes active.',
      '# TYPE shogun_node_memory_bytes_used gauge',
      `shogun_node_memory_bytes_used{cluster="shogun-prod-kuber-x-us-east"} ${memBytes}`,
      '# HELP shogun_kube_pod_status_phase Count of pods by phase.',
      '# TYPE shogun_kube_pod_status_phase gauge',
      'shogun_kube_pod_status_phase{phase="Running"} 118',
      'shogun_kube_pod_status_phase{phase="Pending"} 4',
      'shogun_kube_pod_status_phase{phase="Failed"} 2',
      '# HELP shogun_s3_storage_bytes_stored Total AWS S3 byte volume managed.',
      '# TYPE shogun_s3_storage_bytes_stored gauge',
      'shogun_s3_storage_bytes_stored{bucket="kuber-x-media-assets-prod"} 184582912',
      'shogun_s3_storage_bytes_stored{bucket="kuber-x-cluster-snapshots-vault"} 524288000'
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(output);
  });

  // ----------------------------------------------------
  // 3. AWS S3 STORAGE MANAGEMENT API
  // ----------------------------------------------------
  app.get('/api/aws/status', async (_req, res) => {
    const base = {
      connected: false, region: s3Config.region, accountId: AWS_ACCOUNT_ID || 'Not configured',
      buckets: configuredBuckets, backupPlanConfigured: Boolean(AWS_BACKUP_PLAN_ARN), ebsVolumes: AWS_EBS_SNAPSHOT_VOLUMES,
      services: [
        { name: 'Amazon S3', purpose: 'Uploaded workspace files', status: s3Client ? 'checking' : 'not configured' },
        { name: 'AWS Backup', purpose: 'Managed recovery plans', status: AWS_BACKUP_PLAN_ARN ? 'configured' : 'not configured' },
        { name: 'Amazon EBS', purpose: 'EC2 volume snapshots (not S3 files)', status: AWS_EBS_SNAPSHOT_VOLUMES.length ? 'configured' : 'not configured' },
      ],
    };
    if (!s3Client) return res.json(base);
    try {
      const names = configuredBuckets.length ? configuredBuckets : (await s3Client.send(new ListBucketsCommand({}))).Buckets?.map(item => item.Name).filter(Boolean) as string[];
      const versioning = await Promise.all(names.map(async bucket => ({ bucket, enabled: (await s3Client.send(new GetBucketVersioningCommand({ Bucket: bucket }))).Status === 'Enabled' })));
      res.json({ ...base, connected: true, buckets: names, versioning, services: base.services.map(service => service.name === 'Amazon S3' ? { ...service, status: 'connected' } : service) });
    } catch (error) {
      console.error('Unable to verify AWS connection:', error);
      res.status(502).json({ ...base, error: 'AWS credentials or bucket policy could not be verified.' });
    }
  });

  // Connection records deliberately contain identifiers and status only. OAuth client
  // secrets, access keys, and refresh tokens belong in a secrets manager, never JSON.
  app.get('/api/integrations', async (_req, res) => {
    const integrations = await integrationStore.list();
    res.json({ integrations: integrations.map(item => item.id === 'aws-s3' && s3Client ? {
      ...item,
      state: 'configured',
      configuredAt: item.configuredAt || new Date().toISOString(),
      metadata: { region: s3Config.region, buckets: configuredBuckets.join(', ') || 'IAM-discovered buckets' },
    } : item) });
  });

  app.put('/api/integrations/:id', authenticateToken, async (req, res) => {
    const state = req.body?.state;
    if (!['configured', 'not_configured', 'pending'].includes(state)) return res.status(400).json({ error: 'A valid connection state is required.' });
    const rawMetadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
    const safeMetadata = Object.fromEntries(Object.entries(rawMetadata)
      .filter(([key, value]) => ['accountId', 'region', 'bucket', 'projectId', 'tenantId', 'resource'].includes(key) && ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key, String(value).slice(0, 180)]));
    try {
      const integration = await integrationStore.setState(req.params.id, state, safeMetadata);
      res.json({ success: true, integration });
    } catch {
      res.status(404).json({ error: 'Integration was not found.' });
    }
  });

  // Versioning is the relevant immediate rollback protection for S3 uploads.
  // EBS snapshots are intentionally not used for S3 objects: AWS treats these as distinct services.
  app.post('/api/aws/s3/enable-versioning', authenticateToken, async (req, res) => {
    if (!s3Client) return res.status(503).json({ error: 'Connect an AWS IAM role and bucket before enabling backup protection.' });
    const requested = typeof req.body?.bucket === 'string' ? [req.body.bucket] : configuredBuckets;
    if (!requested.length) return res.status(400).json({ error: 'An approved S3 bucket is required.' });
    if (requested.some(bucket => configuredBuckets.length && !configuredBuckets.includes(bucket))) return res.status(403).json({ error: 'Bucket is not approved for this workspace.' });
    try {
      await Promise.all(requested.map(Bucket => s3Client.send(new PutBucketVersioningCommand({ Bucket, VersioningConfiguration: { Status: 'Enabled' } }))));
      res.json({ success: true, buckets: requested, message: 'S3 Versioning enabled. New and overwritten uploads can now be recovered.' });
    } catch (error) {
      console.error('Unable to enable S3 versioning:', error);
      res.status(502).json({ error: 'AWS rejected the versioning request. Grant s3:PutBucketVersioning to this IAM role.' });
    }
  });

  app.get('/api/s3/buckets', async (_req, res) => {
    if (!s3Client) return res.json({ connectedToRealAws: false, region: s3Config.region, buckets: s3Buckets });
    try {
      // Limit the dashboard to explicitly configured buckets. This prevents an
      // otherwise valid IAM role from exposing every bucket in the account.
      const bucketNames = configuredBuckets.length ? configuredBuckets : (await s3Client.send(new ListBucketsCommand({}))).Buckets?.map(bucket => bucket.Name).filter(Boolean) as string[];
      const liveBuckets = await Promise.all(bucketNames.map(async name => {
        const listed = await s3Client.send(new ListObjectsV2Command({ Bucket: name, MaxKeys: 1000 }));
        return {
          name,
          region: s3Config.region,
          created: new Date().toISOString(),
          objectCount: listed.KeyCount || 0,
          sizeBytes: (listed.Contents || []).reduce((total, object) => total + (object.Size || 0), 0),
          versioning: false,
          encryption: 'Account policy',
          publicAccessBlock: true,
        };
      }));
      res.json({ connectedToRealAws: true, region: s3Config.region, buckets: liveBuckets });
    } catch (error) {
      console.error('Unable to list AWS buckets:', error);
      res.status(502).json({ error: 'AWS S3 is configured but could not be reached. Verify the IAM role, region, and bucket policy.' });
    }
  });

  app.get('/api/s3/objects', async (req, res) => {
    const { bucket, type, search } = req.query;
    if (s3Client && bucket && typeof bucket === 'string') {
      if (configuredBuckets.length && !configuredBuckets.includes(bucket)) return res.status(403).json({ error: 'Bucket is not approved for this workspace.' });
      try {
        const listing = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000 }));
        const objects = (listing.Contents || []).map(object => {
          const filename = object.Key?.split('/').pop() || object.Key || 'unnamed-file';
          const mimeType = inferMimeType(filename);
          return makeS3Object(bucket, object.Key || filename, filename, object.Size || 0, mimeType, object.LastModified?.toISOString());
        }).filter(object => (!type || type === 'all' || object.type === type) && (!search || object.filename.toLowerCase().includes(String(search).toLowerCase()) || object.key.toLowerCase().includes(String(search).toLowerCase())));
        return res.json({ count: objects.length, objects });
      } catch (error) {
        console.error('Unable to list AWS objects:', error);
        return res.status(502).json({ error: 'Unable to list objects from AWS S3.' });
      }
    }
    let filtered = [...s3Objects];
    if (bucket && typeof bucket === 'string') {
      filtered = filtered.filter(obj => obj.bucket === bucket);
    }
    if (type && typeof type === 'string' && type !== 'all') {
      filtered = filtered.filter(obj => obj.type === type);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter(obj =>
        obj.filename.toLowerCase().includes(q) ||
        obj.key.toLowerCase().includes(q) ||
        obj.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    res.json({
      count: filtered.length,
      objects: filtered
    });
  });

  app.post('/api/s3/upload', authenticateToken, async (req, res) => {
    const { bucket, filename, mimeType, size, contentBase64, tags, keyPrefix } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    const targetBucket = bucket || configuredBuckets[0] || s3Buckets[0].name;
    if (configuredBuckets.length && !configuredBuckets.includes(targetBucket)) return res.status(403).json({ error: 'Bucket is not approved for this workspace.' });
    const detectedMime = mimeType || 'application/octet-stream';
    const reportedSize = Number(size) || 0;
    if (reportedSize > MAX_UPLOAD_BYTES) return res.status(413).json({ error: `File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB upload limit. Configure direct multipart uploads for larger media.` });
    let fileType: 'image' | 'video' | 'audio' | 'document' | 'config' = 'document';
    if (detectedMime.startsWith('image/')) fileType = 'image';
    else if (detectedMime.startsWith('video/')) fileType = 'video';
    else if (detectedMime.startsWith('audio/')) fileType = 'audio';
    else if (detectedMime.includes('yaml') || detectedMime.includes('json') || filename.endsWith('.yml') || filename.endsWith('.yaml') || filename.endsWith('.json')) fileType = 'config';

    const allowedPrefixes = ['workspace-uploads', 'eks-manifests', 'cloudformation-templates'];
    const prefix = allowedPrefixes.includes(keyPrefix) ? keyPrefix : 'workspace-uploads';
    const objectKey = `${prefix}/${new Date().toISOString().slice(0, 10)}/${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    if (s3Client) {
      try {
        const base64 = typeof contentBase64 === 'string' ? contentBase64.replace(/^data:[^;]+;base64,/, '') : '';
        if (!base64) return res.status(400).json({ error: 'File content is required for an AWS upload.' });
        const body = Buffer.from(base64, 'base64');
        if (body.byteLength > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'Decoded file exceeds the configured upload limit.' });
        await s3Client.send(new PutObjectCommand({ Bucket: targetBucket, Key: objectKey, Body: body, ContentType: detectedMime, ServerSideEncryption: 'AES256', Metadata: { uploadedBy: String((req as any).user.email || 'workspace-user'), tags: Array.isArray(tags) ? tags.join(',').slice(0, 180) : '' } }));
        const uploaded = makeS3Object(targetBucket, objectKey, filename, body.byteLength, detectedMime);
        return res.status(201).json({ success: true, message: `Saved directly to AWS S3: ${targetBucket}`, object: uploaded });
      } catch (error) {
        console.error('AWS S3 upload failed:', error);
        return res.status(502).json({ error: 'AWS rejected the upload. Verify PutObject permission, encryption policy, and bucket region.' });
      }
    }

    const url = contentBase64 && contentBase64.startsWith('data:') ? contentBase64 : `https://kuber-x-s3.cloud/${targetBucket}/${encodeURIComponent(filename)}`;

    const newObj: S3MediaObject = {
      id: `s3-${Date.now()}`,
      bucket: targetBucket,
      key: objectKey,
      filename,
      size: Number(size) || Math.floor(Math.random() * 5000000) + 100000,
      mimeType: detectedMime,
      type: fileType,
      url,
      storageClass: 'STANDARD',
      lastModified: new Date().toISOString(),
      uploadedBy: 'ashirbad.sre@shogun-cloud.io',
      tags: tags && Array.isArray(tags) ? tags : ['manual-upload', fileType]
    };

    s3Objects.unshift(newObj);

    // Update bucket size and count
    const b = s3Buckets.find(item => item.name === targetBucket);
    if (b) {
      b.objectCount += 1;
      b.sizeBytes += newObj.size;
    }

    res.status(201).json({
      success: true,
      message: `Object uploaded to S3 bucket [${targetBucket}] successfully`,
      object: newObj
    });
  });

  app.get('/api/s3/objects/:bucket/*', async (req, res) => {
    if (!s3Client) return res.status(404).json({ error: 'Object downloads require an AWS S3 connection.' });
    const bucket = req.params.bucket;
    const key = (req.params as Record<string, string>)[0];
    if (configuredBuckets.length && !configuredBuckets.includes(bucket)) return res.status(403).json({ error: 'Bucket is not approved for this workspace.' });
    try {
      const object = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (object.ContentType) res.setHeader('Content-Type', object.ContentType);
      if (object.ContentLength) res.setHeader('Content-Length', object.ContentLength);
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(key).replace(/"/g, '')}"`);
      (object.Body as any).pipe(res);
    } catch {
      res.status(404).json({ error: 'AWS object was not found or cannot be read.' });
    }
  });

  app.delete('/api/s3/objects/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const bucket = typeof req.query.bucket === 'string' ? req.query.bucket : '';
    const key = typeof req.query.key === 'string' ? req.query.key : '';
    if (s3Client && bucket && key) {
      if (configuredBuckets.length && !configuredBuckets.includes(bucket)) return res.status(403).json({ error: 'Bucket is not approved for this workspace.' });
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        return res.json({ success: true, message: 'Object deleted from AWS S3.' });
      } catch {
        return res.status(502).json({ error: 'AWS rejected the delete request.' });
      }
    }
    const index = s3Objects.findIndex(o => o.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Object not found' });
    }
    const removed = s3Objects.splice(index, 1)[0];
    const b = s3Buckets.find(item => item.name === removed.bucket);
    if (b) {
      b.objectCount = Math.max(0, b.objectCount - 1);
      b.sizeBytes = Math.max(0, b.sizeBytes - removed.size);
    }
    res.json({ success: true, message: `Object ${removed.filename} deleted from S3` });
  });

  app.post('/api/s3/archive', (req, res) => {
    const { id, targetClass } = req.body;
    const item = s3Objects.find(o => o.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Object not found' });
    }
    item.storageClass = targetClass || 'GLACIER';
    res.json({
      success: true,
      message: `Object transitioned to ${item.storageClass}`,
      object: item
    });
  });

  // ----------------------------------------------------
  // 4. INCIDENT ALERTS, SNS, SLACK & EMAIL DISPATCH
  // ----------------------------------------------------
  app.get('/api/alerts', (_req, res) => {
    res.json({ alerts: activeAlerts });
  });

  app.post('/api/alerts/acknowledge', (req, res) => {
    const { id } = req.body;
    const alert = activeAlerts.find(a => a.id === id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    alert.status = 'acknowledged';
    res.json({ success: true, alert });
  });

  app.post('/api/alerts/resolve', (req, res) => {
    const { id } = req.body;
    const alert = activeAlerts.find(a => a.id === id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    alert.status = 'resolved';
    res.json({ success: true, alert });
  });

  app.post('/api/alerts/dispatch', (req, res) => {
    const { title, severity, description, channels } = req.body;
    const alert: AlertItem = {
      id: `alt-${Date.now().toString().slice(-4)}`,
      title: title || 'Critical Cluster Anomaly',
      severity: severity || 'critical',
      source: 'shogun-telemetry-engine',
      timestamp: new Date().toISOString(),
      status: 'active',
      description: description || 'Automated health check failure triggered emergency escalation.',
      dispatchedChannels: channels || ['slack', 'sns', 'email']
    };
    activeAlerts.unshift(alert);
    res.json({
      success: true,
      message: `Alert dispatched successfully across ${alert.dispatchedChannels.join(', ')}`,
      alert,
      dispatchLog: {
        snsTopicArn: 'arn:aws:sns:us-east-1:956083908253:shogun-kuber-x-critical-incidents',
        slackChannel: '#incident-room-kuber-x',
        recipientEmail: 'ashirbadbiswal82791@gmail.com',
        httpStatus: 200,
        deliveredAt: new Date().toISOString()
      }
    });
  });

  // ----------------------------------------------------
  // 5. DEVOPS, TERRAFORM, DOCKER & CI/CD PIPELINE
  // ----------------------------------------------------
  app.get('/api/devops/summary', (_req, res) => {
    res.json({
      terraform: {
        version: 'v1.9.5',
        backend: 's3://shogun-terraform-state-prod/kuber-x/terraform.tfstate',
        managedResourcesCount: 48,
        driftDetected: false,
        lastApplied: '2026-09-24T12:00:00Z'
      },
      dockerWorkers: [
        {
          name: 'kuber-x-api-server',
          image: 'shogun-registry.io/kuber/api-gateway:v2.4.1',
          ports: ['3000:3000'],
          replicas: 4,
          status: 'healthy',
          uptime: '18d 4h 12m'
        },
        {
          name: 'kuber-x-telemetry-worker',
          image: 'shogun-registry.io/kuber/telemetry-processor:v2.4.0',
          ports: ['9090:9090'],
          replicas: 6,
          status: 'healthy',
          uptime: '18d 4h 10m'
        },
        {
          name: 'kuber-x-s3-archiver-worker',
          image: 'shogun-registry.io/kuber/s3-archiver:v1.9.8',
          ports: ['8080:8080'],
          replicas: 2,
          status: 'healthy',
          uptime: '12d 1h 45m'
        }
      ],
      cicdPipeline: {
        repository: 'github.com/shogun-cloud/kuber-x-enterprise',
        branch: 'main',
        lastCommit: {
          sha: 'b7c491e',
          message: 'feat(s3-sync): add high-speed streaming multipart uploader & offline cache',
          author: 'Ashirbad Biswal',
          timestamp: '2026-09-24T22:15:00Z'
        },
        runs: [
          {
            id: 'run-8821',
            status: 'passed',
            duration: '1m 42s',
            triggeredBy: 'push',
            steps: [
              { name: 'Lint & TypeCheck', status: 'passed', duration: '14s' },
              { name: 'Unit & Contract Tests', status: 'passed', duration: '32s' },
              { name: 'Docker Build & ECR Push', status: 'passed', duration: '41s' },
              { name: 'Terraform Validate & Security Scan', status: 'passed', duration: '15s' }
            ]
          },
          {
            id: 'run-8820',
            status: 'passed',
            duration: '1m 55s',
            triggeredBy: 'pull_request',
            steps: [
              { name: 'Lint & TypeCheck', status: 'passed', duration: '16s' },
              { name: 'Unit & Contract Tests', status: 'passed', duration: '34s' },
              { name: 'Docker Build & ECR Push', status: 'passed', duration: '48s' },
              { name: 'Terraform Validate & Security Scan', status: 'passed', duration: '17s' }
            ]
          }
        ]
      }
    });
  });

  // ----------------------------------------------------
  // VITE DEV SERVER INTEGRATION & STATIC SERVING
  // ----------------------------------------------------
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Shogun KUBER X] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Shogun KUBER X server:', err);
  process.exit(1);
});
