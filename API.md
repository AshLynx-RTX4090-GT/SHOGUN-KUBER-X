# Shogun KUBER X API

All JSON endpoints are served by the Express server. In development, start the server with `npm run dev`; the default base URL is `http://localhost:3000`.

## Authentication

`POST /api/auth/login`

```json
{ "role": "super_admin" }
```

Returns `{ token, user }`. Send the token as `Authorization: Bearer <token>` to protected endpoints. The local demo uses JWT fallback users. Production deployments should replace this route with AWS Cognito/OIDC and MFA enforcement.

`GET /api/auth/me` (protected)

## Telemetry

- `GET /api/metrics/current` returns cluster and current system metrics.
- `GET /api/metrics/history` returns time-series points for CPU, memory, network, RPS, and error rate.
- `GET /metrics` returns the Prometheus scrape payload.

## Storage

- `GET /api/s3/buckets` lists buckets and connection status.
- `GET /api/s3/objects?bucket=&type=&search=` lists filtered objects.
- `POST /api/s3/upload` accepts `bucket`, `filename`, `mimeType`, `size`, `contentBase64`, `tags`, and an optional `keyPrefix`. It requires a Bearer token. Valid protected prefixes are `workspace-uploads`, `eks-manifests`, and `cloudformation-templates`. YAML/JSON, images, HD video, audio, PDF, logs, archives, and arbitrary files are supported up to `MAX_UPLOAD_BYTES` (50 MB by default).
- `DELETE /api/s3/objects/:id` removes an object.
- `POST /api/s3/archive` accepts `{ id, targetClass }`.

Configure `AWS_REGION` and `AWS_BUCKET_NAME` (plus an IAM role, or `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`) for live S3 access. In live mode the server calls `PutObject` with AES-256 server-side encryption and does not keep file content in its process memory after the request. Use IAM roles in production instead of long-lived keys. Grant only `s3:ListBucket`, `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` for the configured bucket prefix.

## AWS account and backups

- `GET /api/aws/status` verifies the configured S3 connection and reports S3 Versioning, AWS Backup-plan, and EBS-volume configuration.
- `POST /api/aws/s3/enable-versioning` (Bearer token required) enables S3 Versioning on an approved bucket. Grant `s3:PutBucketVersioning` if operators should use this control.

S3 Versioning protects uploaded files from accidental overwrite/delete. EBS snapshots protect EC2 EBS volumes, not S3 objects; configure AWS Backup separately for managed backups and record the plan ARN in `AWS_BACKUP_PLAN_ARN`.

## Connected-service catalog

`GET /api/integrations` returns the backend catalog for AWS and third-party services. `PUT /api/integrations/:id` (Bearer token required) persists non-secret connection state and identifiers such as region, bucket, project ID, or tenant ID. The catalog is stored locally at `data/integrations.json` for development. Production deployments should replace this store with a database and place OAuth tokens/AWS credentials in AWS Secrets Manager or another secrets manager.

## Location and weather

`GET /api/location/context?latitude=&longitude=` resolves weather via Open-Meteo. When `GOOGLE_MAPS_API_KEY` is configured server-side, it uses Google Maps Geocoding for country and region detection; otherwise it uses Open-Meteo reverse geocoding. Browser geolocation permission is still required.

## Delivery tracking

- `GET /api/deliveries` returns Indian regional endpoints and live delivery analytics. PostgreSQL is used when `DATABASE_URL` is configured; development falls back to seeded local data.
- `PATCH /api/deliveries/:id/status` requires a JWT bearer token and accepts `{ "status": "in_transit", "progress": 74 }`.
- The dashboard polls delivery analytics every five seconds, caches the latest response in local storage, and queues status changes while offline.
- Set `VITE_GOOGLE_MAPS_API_KEY` to render the Google Maps endpoint view. Restrict the browser key to Maps Embed API and the application's allowed origins.

## Docker and AWS deployment

Local PostgreSQL and the Node service can be started with `docker compose up --build`. Set a strong `JWT_SECRET`, `DATABASE_URL`, and Google Maps key before using a shared environment.

The production image is defined in `Dockerfile`. Build and publish it to ECR, replace `REPLACE_WITH_ECR_IMAGE` in `infra/eks-app.yaml`, create the Kubernetes secret values, and apply the manifest with `kubectl apply -f infra/eks-app.yaml`. Use Amazon RDS for PostgreSQL in production rather than running the database inside the application pod.

## Billing

`POST /api/payments/create-order`

```json
{ "planId": "scale", "purchaseType": "subscription" }
```

`purchaseType` can be `subscription` or `one-time`. The server creates the Razorpay order and returns only the public key ID, order ID, amount, and currency.

`POST /api/payments/verify`

```json
{
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "..."
}
```

The server verifies the HMAC signature using `RAZORPAY_KEY_SECRET` in constant time. It only fulfills an order that it created and recorded, and treats a repeat verification as idempotent. Never expose that secret to the browser. In production, persist pending orders and entitlements in a database and also reconcile final payment state via Razorpay webhooks.

`GET /api/payments/status` returns whether the server has Razorpay keys configured and whether they are test or live keys. The client loads Razorpay Standard Checkout directly from Razorpay and requests the UPI and card payment groups. Debit and credit cards are both provided through the Razorpay card method; the enabled methods ultimately depend on the merchant account's Razorpay Dashboard configuration.

## Support

`POST /api/support/ask`

```json
{ "question": "How do I investigate a pod eviction?" }
```

Uses Gemini when `GEMINI_API_KEY` is configured and returns a local support fallback otherwise.

## Reliability and security contract

The browser uses cached telemetry and an offline mutation queue when disconnected. The current demo server stores sample state in memory. For multi-device realtime sync, collaborative editing, and end-to-end encrypted project data, deploy a persistent database plus a websocket/realtime provider, AWS Cognito/OIDC, KMS envelope encryption, per-project authorization, audit logging, and key rotation. Do not treat the in-memory demo store as production persistence.
