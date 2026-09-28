import React, { useState } from 'react';
import { 
  Terminal, 
  Layers, 
  GitBranch, 
  Play, 
  Check, 
  Copy, 
  FileCode, 
  Cloud, 
  CheckCircle, 
  Clock, 
  Box,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { User } from '../../types';

interface DevOpsHubProps {
  currentUser: User | null;
  isDarkMode: boolean;
}

export const DevOpsHub: React.FC<DevOpsHubProps> = ({
  currentUser,
  isDarkMode,
}) => {
  const [activeDevopsTab, setActiveDevopsTab] = useState<'terraform' | 'docker' | 'cicd'>('terraform');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isApplyingTf, setIsApplyingTf] = useState(false);
  const [tfLogs, setTfLogs] = useState<string[]>([]);
  const [isTriggeringCi, setIsTriggeringCi] = useState(false);
  const [ciWorkflowRuns, setCiWorkflowRuns] = useState([
    {
      id: 'run-8821',
      commitSha: 'b7c491e',
      message: 'feat(s3-sync): add high-speed streaming multipart uploader & offline cache',
      author: 'Ashirbad Biswal',
      duration: '1m 42s',
      status: 'passed',
      timeAgo: '12m ago',
      steps: [
        { name: 'Setup Node.js & Bun Cache', duration: '6s', status: 'passed' },
        { name: 'TypeScript Static Analysis & Lint', duration: '14s', status: 'passed' },
        { name: 'Unit & Vitest Integration Suite (142 tests)', duration: '32s', status: 'passed' },
        { name: 'Docker Build & AWS ECR Push', duration: '38s', status: 'passed' },
        { name: 'Terraform Plan & EKS Canary Deployment', duration: '12s', status: 'passed' }
      ]
    },
    {
      id: 'run-8820',
      commitSha: 'a19fd03',
      message: 'chore(helm): update replica scaling threshold to 75% CPU',
      author: 'Ashirbad Biswal',
      duration: '1m 55s',
      status: 'passed',
      timeAgo: '3h ago',
      steps: [
        { name: 'Setup Node.js & Bun Cache', duration: '5s', status: 'passed' },
        { name: 'TypeScript Static Analysis & Lint', duration: '16s', status: 'passed' },
        { name: 'Unit & Vitest Integration Suite (142 tests)', duration: '34s', status: 'passed' },
        { name: 'Docker Build & AWS ECR Push', duration: '45s', status: 'passed' },
        { name: 'Terraform Plan & EKS Canary Deployment', duration: '15s', status: 'passed' }
      ]
    }
  ]);

  const canApplyIaC = currentUser?.permissions.includes('iac:apply') || currentUser?.role === 'super_admin';
  const canTriggerPipeline = currentUser?.permissions.includes('pipeline:trigger') || currentUser?.role === 'super_admin';

  const TERRAFORM_HCL = `# Shogun KUBER X // AWS Infrastructure as Code Definition
# Maintained by DevOps & Cloud Architecture Team

terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
  }

  backend "s3" {
    bucket         = "shogun-terraform-state-prod"
    key            = "kuber-x/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "shogun-terraform-locks"
    encrypt        = true
  }
}

# 1. AWS EKS Production Cluster
module "eks_cluster" {
  source          = "terraform-aws-modules/eks/aws"
  version         = "20.8.5"
  cluster_name    = "shogun-prod-kuber-x-us-east"
  cluster_version = "1.31"

  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets

  eks_managed_node_groups = {
    standard_workers = {
      min_size     = 4
      max_size     = 16
      desired_size = 8
      instance_types = ["c6i.2xlarge", "m6i.2xlarge"]
      capacity_type  = "ON_DEMAND"
    }
  }
}

# 2. High-Capacity AWS S3 Media & Archival Vault
resource "aws_s3_bucket" "media_vault" {
  bucket = "kuber-x-media-assets-prod"
}

resource "aws_s3_bucket_lifecycle_configuration" "media_lifecycle" {
  bucket = aws_s3_bucket.media_vault.id

  rule {
    id     = "auto-glacier-deep-archive"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }
  }
}

# 3. AWS SNS Incident Topic for Critical Alerts
resource "aws_sns_topic" "incident_alerts" {
  name = "shogun-kuber-x-critical-incidents"
}
`;

  const DOCKERFILES = [
    {
      name: 'Dockerfile.api-gateway',
      role: 'Express & Vite API Core Server',
      code: `# Multi-stage High-Performance Container for Shogun KUBER X
FROM node:22-alpine AS builder
WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN npm ci

# Build frontend and server bundles
COPY . .
RUN npm run build

# Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Non-root security user
RUN addgroup -S shogun && adduser -S shogun -G shogun
USER shogun

COPY --from=builder --chown=shogun:shogun /app/dist ./dist
COPY --from=builder --chown=shogun:shogun /app/package*.json ./
COPY --from=builder --chown=shogun:shogun /app/node_modules ./node_modules
COPY --from=builder --chown=shogun:shogun /app/server.ts ./

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/metrics || exit 1

CMD ["node", "--loader", "tsx", "server.ts"]`
    },
    {
      name: 'Dockerfile.telemetry-processor',
      role: 'Prometheus & OpenTelemetry Scraper Worker',
      code: `FROM golang:1.23-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /bin/telemetry-worker ./cmd/worker

FROM scratch
COPY --from=builder /bin/telemetry-worker /telemetry-worker
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 9090
ENTRYPOINT ["/telemetry-worker"]`
    },
    {
      name: 'Dockerfile.s3-transcoder',
      role: 'AWS S3 Video & Image Batch Transcoder',
      code: `FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \\
    ffmpeg \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /worker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY transcoder.py .

ENV AWS_DEFAULT_REGION=us-east-1
USER 10001
ENTRYPOINT ["python", "transcoder.py"]`
    }
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleApplyTerraform = () => {
    if (!canApplyIaC) return;
    setIsApplyingTf(true);
    setTfLogs(['$ terraform plan -out=tfplan', 'Refreshing state... [s3://shogun-terraform-state-prod]', 'Acquiring state lock from DynamoDB...']);

    setTimeout(() => {
      setTfLogs(prev => [...prev, 'Plan: 0 to add, 1 to change, 0 to destroy.', '$ terraform apply tfplan', 'aws_eks_cluster.prod: Modifying... [id=shogun-prod-kuber-x-us-east]']);
    }, 1000);

    setTimeout(() => {
      setTfLogs(prev => [...prev, 'aws_eks_cluster.prod: Modifications complete after 4s', 'Apply complete! Resources: 0 added, 1 changed, 0 destroyed.', 'Outputs:', 'cluster_endpoint = "https://kuber-prod.shogun.eks.amazonaws.com"']);
      setIsApplyingTf(false);
    }, 2200);
  };

  const handleTriggerCi = () => {
    if (!canTriggerPipeline) return;
    setIsTriggeringCi(true);
    setTimeout(() => {
      const newRun = {
        id: `run-${Math.floor(Math.random() * 900) + 8900}`,
        commitSha: Math.random().toString(16).substring(2, 9),
        message: 'ci: manual workflow trigger via Shogun KUBER X DevOps console',
        author: currentUser?.username || 'Ashirbad Biswal',
        duration: '1m 38s',
        status: 'passed',
        timeAgo: 'Just now',
        steps: [
          { name: 'Setup Node.js & Bun Cache', duration: '5s', status: 'passed' },
          { name: 'TypeScript Static Analysis & Lint', duration: '12s', status: 'passed' },
          { name: 'Unit & Vitest Integration Suite (142 tests)', duration: '28s', status: 'passed' },
          { name: 'Docker Build & AWS ECR Push', duration: '36s', status: 'passed' },
          { name: 'Terraform Plan & EKS Canary Deployment', duration: '17s', status: 'passed' }
        ]
      };
      setCiWorkflowRuns(prev => [newRun, ...prev]);
      setIsTriggeringCi(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Terminal className="w-6 h-6 text-cyan-400" />
            <span>DevOps, Terraform IaC & CI/CD Pipelines</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Infrastructure as Code provisioning, containerized Docker worker manifests, and automated GitHub Actions verification.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveDevopsTab('terraform')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              activeDevopsTab === 'terraform' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Terraform IaC</span>
          </button>

          <button
            onClick={() => setActiveDevopsTab('docker')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              activeDevopsTab === 'docker' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Dockerfiles</span>
          </button>

          <button
            onClick={() => setActiveDevopsTab('cicd')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              activeDevopsTab === 'cicd' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>GitHub Actions</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Terraform IaC */}
      {activeDevopsTab === 'terraform' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="text-xs text-slate-400 font-mono">
              <span>Terraform v1.9.5</span> · <span>State: s3://shogun-terraform-state-prod</span> · <span>48 Managed Resources</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(TERRAFORM_HCL)}
                className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 font-mono"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy HCL'}</span>
              </button>

              {canApplyIaC && (
                <button
                  onClick={handleApplyTerraform}
                  disabled={isApplyingTf}
                  className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Play className={`w-3.5 h-3.5 ${isApplyingTf ? 'animate-spin' : ''}`} />
                  <span>{isApplyingTf ? 'Applying Plan...' : 'Run Terraform Apply'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950 font-mono text-xs">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-slate-400">
              <span>infra/terraform/main.tf</span>
              <span>HCL / AWS Provider ~5.50</span>
            </div>
            <pre className="p-4 text-slate-300 overflow-x-auto leading-relaxed max-h-[500px]">
              {TERRAFORM_HCL}
            </pre>
          </div>

          {tfLogs.length > 0 && (
            <div className="p-4 rounded-xl border border-slate-800 bg-black font-mono text-xs text-emerald-400 space-y-1">
              <div className="text-slate-500 text-[10px] mb-2 uppercase">Execution Console Output:</div>
              {tfLogs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Dockerfiles */}
      {activeDevopsTab === 'docker' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {DOCKERFILES.map(df => (
              <div
                key={df.name}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-xs mb-1">
                    <Box className="w-4 h-4" />
                    <span>{df.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{df.role}</p>
                </div>
                <button
                  onClick={() => handleCopy(df.code)}
                  className="mt-3 w-full py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-1 font-mono"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Dockerfile</span>
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {DOCKERFILES.map(df => (
              <div key={df.name} className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950 font-mono text-xs">
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-slate-400">
                  <span className="font-bold text-slate-200">{df.name}</span>
                  <span>{df.role}</span>
                </div>
                <pre className="p-4 text-slate-300 overflow-x-auto leading-relaxed">
                  {df.code}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: GitHub Actions CI/CD */}
      {activeDevopsTab === 'cicd' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="text-xs text-slate-400 font-mono">
              <span>Repo: github.com/shogun-cloud/kuber-x-enterprise</span> · <span>Branch: main</span>
            </div>

            {canTriggerPipeline && (
              <button
                onClick={handleTriggerCi}
                disabled={isTriggeringCi}
                className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTriggeringCi ? 'animate-spin' : ''}`} />
                <span>{isTriggeringCi ? 'Dispatching CI...' : 'Trigger Workflow Run'}</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {ciWorkflowRuns.map(run => (
              <div
                key={run.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-bold text-xs text-slate-200 font-mono">{run.id}</span>
                      <span className="text-xs text-slate-300 font-semibold">{run.message}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      commit: {run.commitSha} · by {run.author} · {run.timeAgo}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-300 tabular-nums">{run.duration}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold uppercase">
                      Passed
                    </span>
                  </div>
                </div>

                {/* Pipeline Step Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                  {run.steps.map((st, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50 text-[11px] flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-1.5 font-medium text-slate-200 mb-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{st.name}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[10px] self-end">{st.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
