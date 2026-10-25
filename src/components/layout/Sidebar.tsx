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
  X,
  UserRound,
  UsersRound,
  Truck
} from 'lucide-react';
import { SystemMetrics } from '../../types';

export type NavTabId = 
  | 'overview' 
  | 'kubernetes' 
  | 'storage' 
  | 'devops' 
  | 'alerts' 
  | 'security' 
  | 'observability' 
  | 'deliveries'
  | 'collaboration'
  | 'profile'
  | 'widgets';

interface SidebarProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  isDarkMode: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  metrics: SystemMetrics | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isDarkMode,
  isOpenMobile,
  onCloseMobile,
  metrics,
}) => {
  const navItems: { id: NavTabId; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: 'overview', label: 'Overview Analytics', icon: LayoutDashboard },
    { id: 'kubernetes', label: 'Kubernetes Cluster', icon: Layers, badge: 'EKS v1.31' },
    { id: 'storage', label: 'AWS S3 Storage', icon: Database, badge: 'Buckets' },
    { id: 'devops', label: 'DevOps & Pipelines', icon: Terminal, badge: 'CI/CD' },
    { id: 'alerts', label: 'Incidents & Alerts', icon: BellRing, badge: 'AWS SNS' },
    { id: 'security', label: 'Security & RBAC', icon: ShieldAlert, badge: 'IAM' },
    { id: 'observability', label: 'Prometheus & CloudWatch', icon: Activity, badge: 'Live' },
    { id: 'deliveries', label: 'Delivery Tracking', icon: Truck, badge: 'India' },
    { id: 'collaboration', label: 'Team & Versions', icon: UsersRound, badge: 'Sync' },
    { id: 'profile', label: 'AWS & Account Settings', icon: UserRound, badge: 'Console' },
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
      <aside className={`fixed md:static inset-y-0 left-0 w-64 md:w-68 shrink-0 flex flex-col justify-between border-r border-emerald-900/60 z-50 transition-all duration-300 bg-[#061510] text-emerald-200 ${isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Navigation Tabs Area */}
        <div className="p-4 flex-1 overflow-y-auto">
          {/* Mobile Close Button & Header */}
          <div className="flex md:hidden items-center justify-between pb-3 mb-3 border-b border-emerald-900/50">
            <span className="font-bold text-sm text-emerald-100">Navigation Modules</span>
            <button 
              onClick={onCloseMobile} 
              aria-label="Close navigation menu"
              className="p-1 rounded-md text-emerald-400 hover:text-emerald-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400/80 px-3 mb-2 font-semibold">
            System Modules
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
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm'
                      : 'hover:bg-emerald-950/50 hover:text-emerald-100 text-emerald-300/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-emerald-500/80'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                        : 'bg-[#020b08] text-emerald-400/80 border border-emerald-900/60'
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
        <div className="p-4 border-t border-emerald-900/60 bg-[#020b08]">
          <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-2 flex items-center justify-between font-bold">
            <span>Resource Usage</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* CPU Metric */}
            <div>
              <div className="flex justify-between text-emerald-400/80 mb-1">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-emerald-400" />
                  <span>CPU Cluster</span>
                </span>
                <span className="font-mono tabular-nums text-emerald-200">
                  {metrics?.cpuUsagePercent ?? 48}%
                </span>
              </div>
              <div className="w-full bg-emerald-950/60 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metrics?.cpuUsagePercent ?? 48}%` }}
                />
              </div>
            </div>

            {/* RAM Metric */}
            <div>
              <div className="flex justify-between text-emerald-400/80 mb-1">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-teal-400" />
                  <span>Memory RAM</span>
                </span>
                <span className="font-mono tabular-nums text-emerald-200">
                  {metrics?.memoryUsagePercent ?? 62}%
                </span>
              </div>
              <div className="w-full bg-emerald-950/60 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-teal-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metrics?.memoryUsagePercent ?? 62}%` }}
                />
              </div>
            </div>
          </div>
        </div>

      </aside>
    </>
  );
};
