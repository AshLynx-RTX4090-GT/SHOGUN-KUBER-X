import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Lock, 
  Check, 
  X, 
  UserCheck, 
  Copy, 
  Clock, 
  ShieldAlert
} from 'lucide-react';
import { User, UserRole } from '../../types';
import { api } from '../../services/api';

interface RbacManagerProps {
  currentUser: User | null;
  onRoleChange: (role: UserRole) => void;
  isDarkMode: boolean;
}

const PERMISSION_DEFINITIONS = [
  { key: 'cluster:read', label: 'Read Cluster Telemetry', desc: 'Inspect pods, nodes, and namespaces' },
  { key: 'cluster:write', label: 'Modify Kubernetes Pods', desc: 'Restart pods, scale deployments' },
  { key: 'storage:read', label: 'Browse AWS S3 Media', desc: 'List objects and download assets' },
  { key: 'storage:upload', label: 'Upload S3 Objects', desc: 'Store videos, images, and manifests' },
  { key: 'storage:delete', label: 'Delete S3 Objects', desc: 'Permanent object deletion from S3' },
  { key: 'alerts:trigger', label: 'Broadcast Incident Alerts', desc: 'Push to SNS, Slack, and email' },
  { key: 'iac:apply', label: 'Run Terraform Apply', desc: 'Mutate AWS cloud infrastructure' },
  { key: 'pipeline:trigger', label: 'Trigger GitHub Actions CI', desc: 'Execute container build & test runs' },
];

const ROLES_CONFIG: {
  role: UserRole;
  title: string;
  badgeColor: string;
  permissions: string[];
}[] = [
  {
    role: 'super_admin',
    title: 'Super Administrator',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    permissions: ['cluster:read', 'cluster:write', 'storage:read', 'storage:upload', 'storage:delete', 'alerts:trigger', 'iac:apply', 'pipeline:trigger']
  },
  {
    role: 'devops_lead',
    title: 'DevOps System Lead',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    permissions: ['cluster:read', 'cluster:write', 'storage:read', 'storage:upload', 'storage:delete', 'alerts:trigger', 'iac:apply', 'pipeline:trigger']
  },
  {
    role: 'sre',
    title: 'Site Reliability Engineer',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    permissions: ['cluster:read', 'cluster:write', 'storage:read', 'storage:upload', 'alerts:trigger', 'pipeline:trigger']
  },
  {
    role: 'viewer',
    title: 'Security & Audit Viewer',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    permissions: ['cluster:read', 'storage:read']
  }
];

export const RbacManager: React.FC<RbacManagerProps> = ({
  currentUser,
  onRoleChange,
  isDarkMode,
}) => {
  const [copiedToken, setCopiedToken] = useState(false);
  const token = api.getToken() || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.token';

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-700/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <span>JWT Security & Role-Based Access Control (RBAC)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            HMAC-SHA256 authenticated bearer sessions, cryptographic claim validation, and granular role enforcement.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>JWT Session Active</span>
          </span>
        </div>
      </div>

      {/* Role Switcher Cards */}
      <div>
        <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">
          Select Active User Role to Test Authorization
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ROLES_CONFIG.map(r => {
            const isActive = currentUser?.role === r.role;
            return (
              <button
                key={r.role}
                onClick={() => onRoleChange(r.role)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                    : isDarkMode
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-slate-200">{r.title}</span>
                  {isActive && <UserCheck className="w-4 h-4 text-cyan-400" />}
                </div>

                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-block mb-3 ${r.badgeColor}`}>
                  role: {r.role}
                </span>

                <div className="text-[11px] text-slate-400 font-mono">
                  {r.permissions.length} Granted Permissions
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* JWT Token Decoder & Claims Viewer */}
      <div className={`p-5 rounded-xl border ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Decoded JWT Bearer Claims</span>
            </h3>
            <p className="text-xs text-slate-400">
              Session token signed with HS256 algorithm and validated by Express auth middleware.
            </p>
          </div>

          <button
            onClick={handleCopyToken}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedToken ? 'Copied Token' : 'Copy Bearer JWT'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          {/* Header */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] text-rose-400 uppercase font-bold block mb-1">Header (Algorithm & Type)</span>
            <pre className="text-slate-300 leading-relaxed overflow-x-auto">
{JSON.stringify({
  alg: "HS256",
  typ: "JWT"
}, null, 2)}
            </pre>
          </div>

          {/* Payload */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 md:col-span-2">
            <span className="text-[10px] text-purple-400 uppercase font-bold block mb-1">Payload (Session Claims & Scopes)</span>
            <pre className="text-slate-300 leading-relaxed overflow-x-auto">
{JSON.stringify({
  id: currentUser?.id || "usr-1",
  username: currentUser?.username || "Ashirbad Biswal",
  email: currentUser?.email || "ashirbad.admin@shogun-kuber.io",
  role: currentUser?.role || "super_admin",
  permissions: currentUser?.permissions || [],
  iss: "shogun-kuber-x-auth",
  exp: Math.floor(Date.now() / 1000) + 86400
}, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
        <div className="p-4 bg-slate-800/60 border-b border-slate-800">
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
            Granular Role vs. Permission Enforcement Matrix
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4">Permission Scope</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-center">Super Admin</th>
                <th className="py-2.5 px-3 text-center">DevOps Lead</th>
                <th className="py-2.5 px-3 text-center">SRE On-Call</th>
                <th className="py-2.5 px-3 text-center">Auditor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {PERMISSION_DEFINITIONS.map(perm => (
                <tr key={perm.key} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-cyan-400">
                    {perm.key}
                  </td>
                  <td className="py-3 px-3 text-slate-400">{perm.desc}</td>
                  <td className="py-3 px-3 text-center">
                    <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                  </td>
                  <td className="py-3 px-3 text-center">
                    {['storage:delete', 'iac:apply'].includes(perm.key) ? (
                      <X className="w-4 h-4 text-rose-500/60 mx-auto" />
                    ) : (
                      <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {['cluster:read', 'storage:read'].includes(perm.key) ? (
                      <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
