import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

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

const SEED_DELIVERIES: DeliveryEndpoint[] = [
  { id: 'del-001', trackingCode: 'KX-IN-DEL-1042', customerName: 'Aarav Logistics', city: 'New Delhi', region: 'Delhi NCR', latitude: 28.6139, longitude: 77.209, status: 'in_transit', progress: 72, eta: 'Today, 18:30', updatedAt: new Date().toISOString(), urgent: false },
  { id: 'del-002', trackingCode: 'KX-IN-MUM-2871', customerName: 'Mumbai Retail Hub', city: 'Mumbai', region: 'Maharashtra', latitude: 19.076, longitude: 72.8777, status: 'delayed', progress: 46, eta: 'Tomorrow, 10:00', updatedAt: new Date().toISOString(), urgent: true },
  { id: 'del-003', trackingCode: 'KX-IN-BLR-4418', customerName: 'Bengaluru Cloud Works', city: 'Bengaluru', region: 'Karnataka', latitude: 12.9716, longitude: 77.5946, status: 'delivered', progress: 100, eta: 'Delivered', updatedAt: new Date().toISOString(), urgent: false },
  { id: 'del-004', trackingCode: 'KX-IN-HYD-5290', customerName: 'Hyderabad Fulfilment', city: 'Hyderabad', region: 'Telangana', latitude: 17.385, longitude: 78.4867, status: 'in_transit', progress: 63, eta: 'Tomorrow, 14:15', updatedAt: new Date().toISOString(), urgent: false },
  { id: 'del-005', trackingCode: 'KX-IN-KOL-6372', customerName: 'Kolkata Distribution', city: 'Kolkata', region: 'West Bengal', latitude: 22.5726, longitude: 88.3639, status: 'pending', progress: 8, eta: 'Sep 30, 09:45', updatedAt: new Date().toISOString(), urgent: false },
];

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS delivery_endpoints (
    id TEXT PRIMARY KEY,
    tracking_code TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    city TEXT NOT NULL,
    region TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_transit', 'delivered', 'delayed')),
    progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100),
    eta TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    urgent BOOLEAN NOT NULL DEFAULT FALSE
  )
`;

export function createDeliveriesStore() {
  const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined }) : null;
  let fallback = [...SEED_DELIVERIES];

  const toDelivery = (row: Record<string, unknown>): DeliveryEndpoint => ({
    id: String(row.id),
    trackingCode: String(row.tracking_code),
    customerName: String(row.customer_name),
    city: String(row.city),
    region: String(row.region),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    status: row.status as DeliveryStatus,
    progress: Number(row.progress),
    eta: String(row.eta),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    urgent: Boolean(row.urgent),
  });

  const seedDatabase = async () => {
    if (!pool) return;
    await pool.query(CREATE_TABLE_SQL);
    const count = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM delivery_endpoints');
    if (count.rows[0]?.count !== '0') return;
    for (const delivery of SEED_DELIVERIES) {
      await pool.query(
        `INSERT INTO delivery_endpoints (id, tracking_code, customer_name, city, region, latitude, longitude, status, progress, eta, updated_at, urgent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [delivery.id, delivery.trackingCode, delivery.customerName, delivery.city, delivery.region, delivery.latitude, delivery.longitude, delivery.status, delivery.progress, delivery.eta, delivery.updatedAt, delivery.urgent],
      );
    }
  };

  return {
    async init() {
      await seedDatabase();
    },
    async list(): Promise<DeliveryEndpoint[]> {
      if (!pool) return fallback;
      const result = await pool.query('SELECT * FROM delivery_endpoints ORDER BY updated_at DESC');
      return result.rows.map(toDelivery);
    },
    async analytics(): Promise<{ total: number; delivered: number; inTransit: number; delayed: number; averageProgress: number; urgent: number }> {
      const deliveries = await this.list();
      return {
        total: deliveries.length,
        delivered: deliveries.filter(item => item.status === 'delivered').length,
        inTransit: deliveries.filter(item => item.status === 'in_transit').length,
        delayed: deliveries.filter(item => item.status === 'delayed').length,
        averageProgress: deliveries.length ? Math.round(deliveries.reduce((sum, item) => sum + item.progress, 0) / deliveries.length) : 0,
        urgent: deliveries.filter(item => item.urgent).length,
      };
    },
    async updateStatus(id: string, status: DeliveryStatus, progress?: number): Promise<DeliveryEndpoint | null> {
      const safeProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? Number(progress) : status === 'delivered' ? 100 : 0));
      if (!pool) {
        const delivery = fallback.find(item => item.id === id);
        if (!delivery) return null;
        delivery.status = status;
        delivery.progress = safeProgress;
        delivery.updatedAt = new Date().toISOString();
        delivery.urgent = status === 'delayed';
        return delivery;
      }
      const result = await pool.query('UPDATE delivery_endpoints SET status = $1, progress = $2, urgent = $3, updated_at = NOW() WHERE id = $4 RETURNING *', [status, safeProgress, status === 'delayed', id]);
      return result.rows[0] ? toDelivery(result.rows[0]) : null;
    },
    async create(input: Omit<DeliveryEndpoint, 'id' | 'updatedAt'>): Promise<DeliveryEndpoint> {
      const delivery: DeliveryEndpoint = { ...input, id: randomUUID(), updatedAt: new Date().toISOString() };
      if (!pool) {
        fallback = [delivery, ...fallback];
        return delivery;
      }
      const result = await pool.query(
        `INSERT INTO delivery_endpoints (id, tracking_code, customer_name, city, region, latitude, longitude, status, progress, eta, updated_at, urgent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [delivery.id, delivery.trackingCode, delivery.customerName, delivery.city, delivery.region, delivery.latitude, delivery.longitude, delivery.status, delivery.progress, delivery.eta, delivery.updatedAt, delivery.urgent],
      );
      return toDelivery(result.rows[0]);
    },
  };
}
