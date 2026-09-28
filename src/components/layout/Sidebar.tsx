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
  CreditCard,
  UserRound,
  LifeBuoy,
  UsersRound
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
  | 'widgets'
  | 'billing'
  | 'profile'
  | 'support'
  | 'collaboration';

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
    { id: 'kubernetes', label: 'Kubernetes Cluster', icon: Layers, badge: '8 Nodes' },
    { id: 'storage', label: 'AWS S3 Storage', icon: Database, badge: '3 Buckets' },
    { id: 'devops', label: 'DevOps & Pipelines', icon: Terminal, badge: 'CI/CD' },
    { id: 'alerts', label: 'Incidents & Alerts', icon: BellRing, badge: 'SNS/Slack' },
    { id: 'security', label: 'Security & RBAC', icon: ShieldAlert, badge: 'JWT' },
    { id: 'observability', label: 'Prometheus & Grafana', icon: Activity },
    { id: 'widgets', label: 'Widget Layouts', icon: Sliders },
    { id: 'billing', label: 'Plans & Billing', icon: CreditCard, badge: 'Razorpay' },
    { id: 'profile', label: 'Profile & Settings', icon: UserRound, badge: 'Account' },
    { id: 'support', label: 'AI Help & Status', icon: LifeBuoy, badge: '24/7' },
    { id: 'collaboration', label: 'Team & Versions', icon: UsersRound, badge: 'Sync' },
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? isDarkMode
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm'
                        : 'bg-cyan-50 text-cyan-900 border border-cyan-200 font-semibold'
                      : isDarkMode
                      ? 'hover:bg-slate-800/60 hover:text-slate-100'
                      : 'hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive
                        ? isDarkMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-800'
                        : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
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
            <span>Resource Usage</span>
            <span className="text-emerald-500">Nominal</span>
          </div>

          <div className="space-y-2 text-xs">
            {/* CPU Metric */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-cyan-400" />
                  <span>CPU Cluster</span>
                </span>
                <span className="font-mono tabular-nums text-slate-200">
                  {metrics?.cpuUsagePercent ?? 48}%
                </span>
              </div>
              <div className="w-full bg-slate-700/30 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metrics?.cpuUsagePercent ?? 48}%` }}
                />
              </div>
            </div>

            {/* RAM Metric */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-sky-400" />
                  <span>Memory RAM</span>
                </span>
                <span className="font-mono tabular-nums text-slate-200">
                  {metrics?.memoryUsagePercent ?? 62}%
                </span>
              </div>
              <div className="w-full bg-slate-700/30 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-sky-400 h-full rounded-full transition-all duration-500"
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
