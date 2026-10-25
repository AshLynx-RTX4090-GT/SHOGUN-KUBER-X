import React, { useState } from 'react';
import { 
  Bell, 
  Wifi, 
  WifiOff, 
  Sun, 
  Moon, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle, 
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Cloud
} from 'lucide-react';
import { User, UserRole, AlertItem, OfflineQueueItem } from '../../types';

interface HeaderProps {
  currentUser: User | null;
  onRoleChange: (role: UserRole) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isOnline: boolean;
  offlineQueue: OfflineQueueItem[];
  onManualSync: () => void;
  activeAlerts: AlertItem[];
  currentTabTitle: string;
  awsRegion?: string;
  awsAccountId?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onRoleChange,
  isDarkMode,
  onToggleDarkMode,
  isOnline,
  offlineQueue,
  onManualSync,
  activeAlerts,
  currentTabTitle,
  awsRegion = 'us-east-1',
  awsAccountId = '956083908253',
}) => {
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isAwsConsoleOpen, setIsAwsConsoleOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const unreadAlertCount = activeAlerts.filter(a => a.status === 'active').length;

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await onManualSync();
    setTimeout(() => setIsSyncing(false), 600);
  };

  const consoleLinks = [
    { name: 'AWS Management Console', url: `https://${awsRegion}.console.aws.amazon.com/console/home?region=${awsRegion}`, desc: 'Main AWS Console Home' },
    { name: 'Amazon S3 Console', url: `https://s3.console.aws.amazon.com/s3/home?region=${awsRegion}`, desc: 'Buckets, storage classes & lifecycle' },
    { name: 'Amazon EKS Console', url: `https://${awsRegion}.console.aws.amazon.com/eks/home?region=${awsRegion}#/clusters`, desc: 'Clusters, nodes & workloads' },
    { name: 'Amazon CloudWatch', url: `https://${awsRegion}.console.aws.amazon.com/cloudwatch/home?region=${awsRegion}`, desc: 'Metrics, alarms & logs' },
    { name: 'AWS CloudFormation', url: `https://${awsRegion}.console.aws.amazon.com/cloudformation/home?region=${awsRegion}#/stacks`, desc: 'Infrastructure as Code stacks' },
    { name: 'AWS IAM Console', url: 'https://us-east-1.console.aws.amazon.com/iamv2/home#/roles', desc: 'Roles, users & policies' },
    { name: 'Amazon SNS Notifications', url: `https://${awsRegion}.console.aws.amazon.com/sns/v3/home?region=${awsRegion}#/topics`, desc: 'Incident dispatch topics' },
  ];

  return (
    <header className={`h-16 px-4 md:px-6 flex items-center justify-between border-b transition-colors ${
      isDarkMode 
        ? 'bg-slate-900/90 border-slate-800 text-slate-100' 
        : 'bg-white/95 border-slate-200 text-slate-900'
    } backdrop-blur-md sticky top-0 z-40`}>
      {/* Zone 1: Single Text Element Brand Wordmark */}
      <div className="flex items-center gap-3">
        <a href="#overview" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center text-white shadow-sm font-mono font-bold text-sm tracking-wider">
            CD
          </div>
          <span className="font-extrabold text-lg tracking-tight font-sans">
            CloudDeployX
          </span>
        </a>
        <span className="hidden sm:inline text-xs text-slate-400 font-mono" aria-hidden="true">/</span>
        <span className="hidden sm:inline text-xs font-medium text-slate-400">
          {currentTabTitle}
        </span>
      </div>

      {/* Zone 2: System Telemetry & Cluster Context */}
      <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-200">{awsRegion}</span>
        </span>
        <span aria-hidden="true">·</span>
        <span>EKS v1.31.2</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">118/124 Pods Nominal</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">AWS S3 Connected</span>
        <span aria-hidden="true">·</span>
        <span className="text-amber-400/90 flex items-center gap-1">
          <Cloud className="w-3.5 h-3.5" />
          <span>Acc: {awsAccountId}</span>
        </span>
      </div>

      {/* Zone 3: Primary Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* AWS Console Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setIsAwsConsoleOpen(!isAwsConsoleOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isDarkMode
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/40'
                : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
            }`}
            title="Open in your AWS Account Console"
          >
            <Cloud className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline font-mono">AWS Console</span>
            <ChevronDown className="w-3 h-3 text-amber-400/80" />
          </button>

          {isAwsConsoleOpen && (
            <div className={`absolute right-0 mt-2 w-72 rounded-lg shadow-2xl border p-2 z-50 ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-slate-100' 
                : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className="px-2 py-1.5 border-b border-slate-700/50 mb-1 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5" /> AWS Account Console
                  </span>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    ID: {awsAccountId} · {awsRegion}
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">Live</span>
              </div>
              <div className="py-1 space-y-0.5">
                {consoleLinks.map(link => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsAwsConsoleOpen(false)}
                    className={`block px-2.5 py-2 rounded text-xs transition-colors group ${
                      isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold group-hover:text-amber-400">
                      <span>{link.name}</span>
                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{link.desc}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Offline / Online Sync State */}
        <div className="flex items-center gap-1.5 text-xs">
          {isOnline ? (
            <div className="flex items-center gap-1 text-emerald-500">
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-slate-400">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-500">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden xl:inline font-medium">Offline Mode</span>
            </div>
          )}

          {offlineQueue.length > 0 && (
            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                isDarkMode 
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60 hover:bg-amber-900/60' 
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
              title="Click to sync offline changes"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="tabular-nums font-mono">{offlineQueue.length} pending</span>
            </button>
          )}
        </div>

        {/* Notifications & Critical Alerts Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsAlertsOpen(!isAlertsOpen)}
            aria-label="Alerts"
            className={`relative p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'hover:bg-slate-800 text-slate-300' 
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadAlertCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900" />
            )}
          </button>

          {isAlertsOpen && (
            <div className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-lg shadow-xl border p-3 z-50 ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-slate-100' 
                : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/50">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Incident Feed & Alerts
                </span>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {unreadAlertCount} active
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {activeAlerts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No active alerts. All systems normal.</p>
                ) : (
                  activeAlerts.slice(0, 4).map(alert => (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded border text-xs ${
                        alert.severity === 'critical'
                          ? isDarkMode ? 'bg-rose-950/40 border-rose-900/50' : 'bg-rose-50 border-rose-200 text-rose-900'
                          : alert.severity === 'warning'
                          ? isDarkMode ? 'bg-amber-950/40 border-amber-900/50' : 'bg-amber-50 border-amber-200 text-amber-900'
                          : isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold flex items-center gap-1.5">
                          {alert.severity === 'critical' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          {alert.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{alert.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleDarkMode}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`p-2 rounded-lg transition-colors ${
            isDarkMode 
              ? 'hover:bg-slate-800 text-amber-400' 
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Account & RBAC Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
            className={`flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-lg border transition-colors ${
              isDarkMode 
                ? 'border-slate-800 bg-slate-900 hover:bg-slate-800/80 text-slate-200' 
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
            }`}
          >
            <div className="w-6 h-6 rounded-full overflow-hidden bg-cyan-700 flex items-center justify-center text-white text-[10px] font-bold">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                'AB'
              )}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold leading-tight truncate max-w-[110px]">
                {currentUser?.username || 'Ashirbad Biswal'}
              </span>
              <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider">
                {currentUser?.role?.replace('_', ' ') || 'Super Admin'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isRoleMenuOpen && (
            <div className={`absolute right-0 mt-2 w-56 rounded-lg shadow-xl border p-2 z-50 ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-slate-200' 
                : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className="px-2 py-1.5 border-b border-slate-700/50 mb-1">
                <p className="text-xs font-semibold">{currentUser?.username}</p>
                <p className="text-[10px] text-slate-400 font-mono">{currentUser?.email}</p>
              </div>

              <div className="py-1">
                <span className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                  Switch Active Role (RBAC)
                </span>
                {(
                  [
                    { id: 'super_admin', label: 'Super Admin', desc: 'Full Cluster & S3 Control' },
                    { id: 'devops_lead', label: 'DevOps Lead', desc: 'Deployments & IaC' },
                    { id: 'sre', label: 'SRE On-Call', desc: 'Alerts & Incidents' },
                    { id: 'viewer', label: 'Auditor (Viewer)', desc: 'Read-only Access' },
                  ] as const
                ).map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onRoleChange(r.id);
                      setIsRoleMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between ${
                      currentUser?.role === r.id
                        ? isDarkMode ? 'bg-cyan-950/60 text-cyan-300 font-semibold' : 'bg-cyan-50 text-cyan-800 font-semibold'
                        : isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div>
                      <div>{r.label}</div>
                      <div className="text-[10px] text-slate-500">{r.desc}</div>
                    </div>
                    {currentUser?.role === r.id && <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
