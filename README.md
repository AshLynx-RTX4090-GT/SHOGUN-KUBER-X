<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a7c52a26-b8f7-49d1-a87f-9975ae9cb37e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Razorpay Billing

The Plans & Billing screen uses the dedicated FastAPI payment service in `backend/`.
Create `backend/.env` from `backend/.env.example`, add Razorpay **test** keys, then start it in a second terminal:

```powershell
py -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

Run `npm run dev` for the dashboard. The browser receives only `RAZORPAY_KEY_ID`; `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` remain in `backend/.env`. Set `VITE_PAYMENT_API_URL` only when the Python service is hosted at a different URL. Configure `https://your-domain/api/payments/webhook` in Razorpay Dashboard for `payment.captured`, `order.paid`, and `payment.failed`.

## Optional AI and Cloud Services

Add `GEMINI_API_KEY` to `.env.local` to enable live answers in **AI Help & Status**. Without it, the screen stays available in local support mode.

AWS S3 credentials can be supplied with `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`. Production MFA and cross-device realtime sync should be connected to an AWS Cognito identity pool and a persistent realtime store before deployment; the local app continues to use JWT fallback, cached data, and its offline mutation queue.

## AWS Infrastructure

The deployment baseline is in [infra/cloudformation.yaml](infra/cloudformation.yaml). It provisions a private EKS API endpoint, private worker subnets, NAT egress, KMS keys, a versioned encrypted S3 bucket, and IAM roles. The worker autoscaling policy is in [infra/kubernetes-worker-hpa.yaml](infra/kubernetes-worker-hpa.yaml).

```powershell
aws cloudformation deploy --template-file infra/cloudformation.yaml --stack-name shogun-kuber-x --capabilities CAPABILITY_IAM --parameter-overrides ClusterName=shogun-kuber-x
kubectl apply -f infra/kubernetes-worker-hpa.yaml
```

The dashboard's **Connect AWS Console** action opens the AWS Management Console login. It does not collect or store AWS passwords.
