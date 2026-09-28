import React, { useState, useEffect, useCallback } from 'react';
import { 
  Menu, 
  WifiOff
} from 'lucide-react';
import { Header } from './components/layout/Header';
import { Sidebar, NavTabId } from './components/layout/Sidebar';
import { OverviewDashboard } from './components/dashboard/OverviewDashboard';
import { KubernetesMonitor } from './components/kubernetes/KubernetesMonitor';
import { S3StorageManager } from './components/storage/S3StorageManager';
import { DevOpsHub } from './components/devops/DevOpsHub';
import { AlertsManager } from './components/alerts/AlertsManager';
import { RbacManager } from './components/security/RbacManager';
import { PrometheusGrafana } from './components/observability/PrometheusGrafana';
import { WidgetCustomizer } from './components/widgets/WidgetCustomizer';
import { BillingManager } from './components/billing/BillingManager';
import { ProfileManager } from './components/profile/ProfileManager';
import { SupportManager } from './components/support/SupportManager';
import { CollaborationManager } from './components/collaboration/CollaborationManager';
import { DeliveryDashboard } from './components/deliveries/DeliveryDashboard';
import { 
  User, 
  UserRole, 
  SystemMetrics, 
  MetricHistoryPoint, 
  ClusterInfo, 
  AlertItem, 
  WidgetConfig, 
  OfflineQueueItem 
} from './types';
import { api } from './services/api';

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'kpi_cards', title: 'Top KPI Metrics (CPU, RAM, Pods, S3 Storage)', enabled: true, order: 0, description: 'Summary cards of cluster compute allocation and S3 volume' },
  { id: 'telemetry_chart', title: 'Interactive Real-Time Telemetry Stream', enabled: true, order: 1, description: 'Time-series curve with multi-metric toggle and hover percentile inspection' },
  { id: 'incident_feed', title: 'Live Incident & Push Alert Stream', enabled: true, order: 2, description: 'Recent active and acknowledged incident notices dispatched to SNS/Slack' },
  { id: 'quick_actions', title: 'DevOps & Storage Fast Actions', enabled: true, order: 3, description: 'One-click shortcuts to S3 uploads, pod terminal, and CI/CD pipelines' },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTabId>('overview');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => localStorage.getItem('shogun_theme') !== 'light');
  const [isOpenMobileNav, setIsOpenMobileNav] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Telemetry & Cluster State
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [metricHistory, setMetricHistory] = useState<MetricHistoryPoint[]>([]);
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Settings & Offline State
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(3000);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem('shogun_widgets');
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  useEffect(() => {
    localStorage.setItem('shogun_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Handle User Init & Role Change
  const initUser = useCallback(async (role: UserRole = 'super_admin') => {
    const authData = await api.login(role);
    setCurrentUser(authData.user);
  }, []);

  useEffect(() => {
    initUser();
  }, [initUser]);

  const handleRoleChange = async (role: UserRole) => {
    await initUser(role);
  };

  // Fetch telemetry & alerts
  const fetchData = useCallback(async () => {
    try {
      const [mRes, hRes, aRes] = await Promise.all([
        api.getCurrentMetrics(),
        api.getMetricsHistory(),
        api.getAlerts(),
      ]);

      if (mRes) {
        setMetrics(mRes.system);
        setClusterInfo(mRes.cluster);
      }
      if (hRes) {
        setMetricHistory(hRes.points);
      }
      if (aRes) {
        setAlerts(aRes.alerts);
      }
    } catch (err) {
      console.warn('Data fetch warning:', err);
    }
  }, []);

  // Polling Effect
  useEffect(() => {
    fetchData();
    if (refreshIntervalMs > 0) {
      const interval = setInterval(fetchData, refreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshIntervalMs]);

  // Network & Offline Queue Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = api.subscribeQueue(q => setOfflineQueue(q));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    await api.flushOfflineQueue();
    await fetchData();
  };

  const handleSaveWidgets = (updated: WidgetConfig[]) => {
    setWidgets(updated);
    localStorage.setItem('shogun_widgets', JSON.stringify(updated));
  };

  const handleTriggerSimulatedAlert = async () => {
    await api.dispatchIncidentAlert({
      title: 'High CPU Spike Alert: worker-node-03',
      severity: 'critical',
      description: 'CPU threshold exceeded 94% on worker node 03 due to intensive batch video transcoding job.',
      channels: ['slack', 'sns', 'email'],
    });
    await fetchData();
  };

  const TAB_TITLES: Record<NavTabId, string> = {
    overview: 'Overview Analytics',
    kubernetes: 'Kubernetes Cluster Monitor',
    storage: 'AWS S3 Storage Manager',
    devops: 'DevOps, Docker & CI/CD Pipelines',
    alerts: 'Incidents & Alerts Dispatcher',
    security: 'JWT Security & RBAC',
    observability: 'Prometheus & Grafana',
    widgets: 'Widget Layouts & Sync Settings',
    billing: 'Plans & Billing',
    profile: 'Profile & Security Settings',
    support: 'AI Support & Status Center',
    collaboration: 'Collaboration & Version History',
    deliveries: 'India Delivery Tracking',
  };

  return (
    <div className={`app-shell ${isDarkMode ? 'theme-dark' : 'theme-light'} min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Offline Banner when disconnected */}
      {!isOnline && (
        <div className="bg-amber-600 text-slate-950 text-xs py-1.5 px-4 font-mono font-bold flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>Offline Mode Active. System changes will queue locally and sync automatically when network restores.</span>
          </div>
          <span className="tabular-nums">{offlineQueue.length} Pending Mutations</span>
        </div>
      )}

      {/* Main Top Header */}
      <Header
        currentUser={currentUser}
        onRoleChange={handleRoleChange}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        isOnline={isOnline}
        offlineQueue={offlineQueue}
        onManualSync={handleManualSync}
        activeAlerts={alerts}
        currentTabTitle={TAB_TITLES[currentTab]}
      />

      {/* Responsive App Shell: Vertical Navigation & Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Vertical Tabs Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={tab => setCurrentTab(tab)}
          isDarkMode={isDarkMode}
          isOpenMobile={isOpenMobileNav}
          onCloseMobile={() => setIsOpenMobileNav(false)}
          metrics={metrics}
        />

        {/* Workspace Main Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
          {/* Mobile Drawer Trigger Bar */}
          <div className="flex md:hidden items-center justify-between pb-3 border-b border-slate-800">
            <button
              onClick={() => setIsOpenMobileNav(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-medium text-slate-200"
            >
              <Menu className="w-4 h-4 text-cyan-400" />
              <span>Select Module ({TAB_TITLES[currentTab]})</span>
            </button>
          </div>

          {/* Tab Route Switching */}
          <div key={currentTab} className="page-transition">
          {currentTab === 'overview' && (
            <OverviewDashboard
              metrics={metrics}
              history={metricHistory}
              cluster={clusterInfo}
              alerts={alerts}
              widgets={widgets}
              isDarkMode={isDarkMode}
              onNavigateTab={tab => setCurrentTab(tab)}
              onTriggerSimulatedAlert={handleTriggerSimulatedAlert}
              onRefreshMetrics={fetchData}
            />
          )}

          {currentTab === 'kubernetes' && (
            <KubernetesMonitor
              currentUser={currentUser}
              isDarkMode={isDarkMode}
            />
          )}

          {currentTab === 'storage' && (
            <S3StorageManager
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              isOnline={isOnline}
            />
          )}

          {currentTab === 'devops' && (
            <DevOpsHub
              currentUser={currentUser}
              isDarkMode={isDarkMode}
            />
          )}

          {currentTab === 'alerts' && (
            <AlertsManager
              alerts={alerts}
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              onRefreshAlerts={fetchData}
            />
          )}

          {currentTab === 'security' && (
            <RbacManager
              currentUser={currentUser}
              onRoleChange={handleRoleChange}
              isDarkMode={isDarkMode}
            />
          )}

          {currentTab === 'observability' && (
            <PrometheusGrafana
              metrics={metrics}
              isDarkMode={isDarkMode}
            />
          )}

          {currentTab === 'widgets' && (
            <WidgetCustomizer
              widgets={widgets}
              onUpdateWidgets={handleSaveWidgets}
              refreshIntervalMs={refreshIntervalMs}
              onChangeRefreshInterval={ms => setRefreshIntervalMs(ms)}
              isOnline={isOnline}
              offlineQueue={offlineQueue}
              onManualSync={handleManualSync}
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            />
          )}

          {currentTab === 'billing' && <BillingManager />}

          {currentTab === 'profile' && (
            <ProfileManager
              currentUser={currentUser}
              onSave={user => {
                setCurrentUser(user);
                localStorage.setItem('shogun_user', JSON.stringify(user));
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {currentTab === 'support' && <SupportManager />}
          {currentTab === 'collaboration' && <CollaborationManager />}
          {currentTab === 'deliveries' && <DeliveryDashboard isDarkMode={isDarkMode} isOnline={isOnline} />}
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-800/70 px-6 py-8 md:px-10 text-center">
        <div className="text-3xl md:text-5xl font-black tracking-[0.08em] text-cyan-400">Lynx Cloud Co.</div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-400">
          <a href="#privacy" className="text-cyan-400 underline underline-offset-2">Privacy</a>
          <a href="#terms" className="text-amber-400 underline underline-offset-2">Terms</a>
          <a href="#support" className="text-fuchsia-400 underline underline-offset-2">Support</a>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Disclaimer: Dashboard data is for operational planning and demonstration. &copy; 2026 Lynx Cloud Co. All rights reserved.</p>
      </footer>
    </div>
  );
}
