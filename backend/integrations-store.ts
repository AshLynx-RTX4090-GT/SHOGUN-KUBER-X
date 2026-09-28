import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ConnectionState = 'configured' | 'not_configured' | 'pending';

export interface IntegrationRecord {
  id: string;
  provider: 'aws' | 'third_party';
  name: string;
  category: string;
  description: string;
  consoleUrl: string;
  state: ConnectionState;
  configuredAt?: string;
  metadata?: Record<string, string | boolean | number>;
}

const AWS_CATALOG: Omit<IntegrationRecord, 'state' | 'configuredAt' | 'metadata'>[] = [
  ['aws-iam', 'IAM', 'Security', 'Roles, policies, and least-privilege access.', 'https://console.aws.amazon.com/iam/'],
  ['aws-s3', 'Amazon S3', 'Storage', 'Encrypted object storage for workspace uploads.', 'https://console.aws.amazon.com/s3/'],
  ['aws-vpc', 'Amazon VPC', 'Networking', 'Private networking, subnets, and security groups.', 'https://console.aws.amazon.com/vpc/'],
  ['aws-cloudformation', 'AWS CloudFormation', 'Infrastructure as code', 'Managed stack deployment and change sets.', 'https://console.aws.amazon.com/cloudformation/'],
  ['aws-lambda', 'AWS Lambda', 'Compute', 'Event-driven serverless functions.', 'https://console.aws.amazon.com/lambda/'],
  ['aws-eks', 'Amazon EKS', 'Kubernetes', 'Managed Kubernetes clusters and workloads.', 'https://console.aws.amazon.com/eks/'],
  ['aws-codedeploy', 'AWS CodeDeploy', 'Delivery', 'Automated EC2, Lambda, and ECS deployments.', 'https://console.aws.amazon.com/codedeploy/'],
  ['aws-ec2', 'Amazon EC2', 'Compute', 'Instances and attached EBS volumes.', 'https://console.aws.amazon.com/ec2/'],
  ['aws-backup', 'AWS Backup', 'Recovery', 'Backup plans and recovery points.', 'https://console.aws.amazon.com/backup/'],
  ['aws-cloudwatch', 'Amazon CloudWatch', 'Observability', 'Logs, alarms, dashboards, and metrics.', 'https://console.aws.amazon.com/cloudwatch/'],
  ['aws-ecr', 'Amazon ECR', 'Containers', 'Private container image registry.', 'https://console.aws.amazon.com/ecr/'],
  ['aws-route53', 'Amazon Route 53', 'Networking', 'DNS, domains, and health checks.', 'https://console.aws.amazon.com/route53/'],
].map(([id, name, category, description, consoleUrl]) => ({ id, provider: 'aws', name, category, description, consoleUrl }));

const THIRD_PARTY_CATALOG: Omit<IntegrationRecord, 'state' | 'configuredAt' | 'metadata'>[] = [
  ['google-drive', 'Google Drive', 'Files', 'OAuth file import and export.', 'https://drive.google.com/'],
  ['microsoft-onedrive', 'Microsoft OneDrive', 'Files', 'Microsoft 365 document import and export.', 'https://www.office.com/'],
  ['docker-hub', 'Docker Hub', 'Containers', 'Public and private image registry access.', 'https://hub.docker.com/'],
  ['apple-icloud', 'Apple iCloud Drive', 'Files', 'Apple account file access via approved integration.', 'https://www.icloud.com/'],
].map(([id, name, category, description, consoleUrl]) => ({ id, provider: 'third_party', name, category, description, consoleUrl }));

export function createIntegrationStore() {
  const dataDirectory = path.resolve(process.cwd(), 'data');
  const dataFile = path.join(dataDirectory, 'integrations.json');

  const seed = (): IntegrationRecord[] => [...AWS_CATALOG, ...THIRD_PARTY_CATALOG].map(item => ({ ...item, state: 'not_configured' }));
  const read = async (): Promise<IntegrationRecord[]> => {
    try { return JSON.parse(await readFile(dataFile, 'utf8')); } catch { return seed(); }
  };
  const save = async (records: IntegrationRecord[]) => {
    await mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${dataFile}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(records, null, 2), 'utf8');
    await rename(temporaryFile, dataFile);
  };

  return {
    list: read,
    async setState(id: string, state: ConnectionState, metadata: IntegrationRecord['metadata'] = {}) {
      const records = await read();
      const item = records.find(record => record.id === id);
      if (!item) throw new Error('Unknown integration');
      item.state = state;
      item.configuredAt = state === 'configured' ? new Date().toISOString() : undefined;
      item.metadata = metadata;
      await save(records);
      return item;
    },
  };
}
