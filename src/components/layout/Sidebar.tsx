import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Database, 
  Terminal, 
  BellRing, 
  ShieldAlert, 
  Activity, 
  Sliders, 
  Cpu, 
  HardDrive,
  Cloud,
  X
} from 'lucide-react';
import { SystemMetrics, AwsAccountStatus, AwsDiscoveryData } from '../../types';

export type NavTabId = 
  | 'overview' 
  | 'kubernetes' 
  | 'storage' 
  | 'devops' 
  | 'alerts' 
  | 'security' 
  | 'observability' 
  | 'widgets';

interface SidebarProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  isDarkMode: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  metrics: SystemMetrics | null;
  awsStatus?: AwsAccountStatus | null;
  discovery?: AwsDiscoveryData | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isDarkMode,
  isOpenMobile,
  onCloseMobile,
  metrics,
  awsStatus,
  discovery,
}) => {
  const isAwsConnected = awsStatus?.connected === true;
  const s3Count = discovery?.summary?.s3BucketCount ?? (isAwsConnected ? 0 : 0);
  const nodeCount = (discovery?.summary?.ec2InstanceCount || discovery?.summary?.eksClusterCount) ?? 0;
  const alertCount = discovery?.summary?.cloudWatchAlarmCount ?? 0;

  const navItems: { id: NavTabId; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string; badgeColor?: string }[] = [
    { id: 'overview', label: 'Overview Analytics', icon: LayoutDashboard },
    { 
      id: 'kubernetes', 
      label: 'Kubernetes Cluster', 
      icon: Layers, 
      badge: isAwsConnected ? `${nodeCount} Nodes` : 'EKS / EC2' 
    },
    { 
      id: 'storage', 
      label: 'AWS S3 Storage', 
      icon: Database, 
      badge: isAwsConnected ? `${s3Count} Buckets` : 'S3 Vault' 
    },
    { id: 'devops', label: 'DevOps & Pipelines', icon: Terminal, badge: 'CI/CD' },
    { 
      id: 'alerts', 
      label: 'Incidents & Alerts', 
      icon: BellRing, 
      badge: isAwsConnected && alertCount > 0 ? `${alertCount} Alarms` : 'SNS/Slack' 
    },
    { id: 'security', label: 'Security & RBAC', icon: ShieldAlert, badge: 'JWT' },
    { id: 'observability', label: 'Prometheus & Grafana', icon: Activity },
    { id: 'widgets', label: 'Widget Layouts', icon: Sliders },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed md:static inset-y-0 left-0 w-64 md:w-68 shrink-0 flex flex-col justify-between border-r z-50 transition-all duration-300 ${
        isDarkMode 
          ? 'bg-slate-900/95 border-slate-800 text-slate-300' 
          : 'bg-slate-50/95 border-slate-200 text-slate-700'
      } ${isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Navigation Tabs Area */}
        <div className="p-4 flex-1 overflow-y-auto">
          {/* Mobile Close Button & Header */}
          <div className="flex md:hidden items-center justify-between pb-3 mb-3 border-b border-slate-700/40">
            <span className="font-bold text-sm">Navigation Modules</span>
            <button 
              onClick={onCloseMobile} 
              aria-label="Close navigation menu"
              className="p-1 rounded-md text-slate-400 hover:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 px-3 mb-2 font-semibold">
            SYSTEM MODULES
          </div>

          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? isDarkMode
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm'
                        : 'bg-cyan-50 text-cyan-900 border border-cyan-200 font-semibold'
                      : isDarkMode
                      ? 'hover:bg-slate-800/60 hover:text-slate-100'
                      : 'hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                      item.badgeColor || (isActive
                        ? isDarkMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-800'
                        : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600')
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Real-Time Resource Usage Gauge Footer */}
        <div className={`p-4 border-t ${
          isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-white/40'
        }`}>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>AWS Telemetry</span>
            <span className={isAwsConnected ? 'text-emerald-400' : 'text-amber-400'}>
              {isAwsConnected ? 'Live' : 'Standby'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* Real AWS S3 / EC2 info */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3 text-purple-400" />
                  <span>S3 Buckets</span>
                </span>
                <span className="font-mono tabular-nums text-slate-200">
                  {s3Count} Active
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-cyan-400" />
                  <span>EC2 / EKS Nodes</span>
                </span>
                <span className="font-mono tabular-nums text-slate-200">
                  {nodeCount} Nodes
                </span>
              </div>
            </div>
          </div>
        </div>

      </aside>
    </>
  );
};
