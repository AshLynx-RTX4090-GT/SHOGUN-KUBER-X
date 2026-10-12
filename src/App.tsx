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
import { 
  User, 
  UserRole, 
  SystemMetrics, 
  MetricHistoryPoint, 
  ClusterInfo, 
  AlertItem, 
  WidgetConfig, 
  OfflineQueueItem,
  AwsAccountStatus,
  AwsDiscoveryData
} from './types';
import { api } from './services/api';

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'kpi_cards', title: 'Top KPI Metrics (Real S3 Buckets, EKS/EC2 Nodes, CPU, RAM)', enabled: true, order: 0, description: 'Summary cards of real AWS cloud resources and telemetry' },
  { id: 'telemetry_chart', title: 'Interactive Real-Time Telemetry Stream', enabled: true, order: 1, description: 'Time-series curve with multi-metric toggle and hover percentile inspection' },
  { id: 'incident_feed', title: 'Real CloudWatch Alarms & Push Alert Stream', enabled: true, order: 2, description: 'Recent active and acknowledged incident notices dispatched to SNS/Slack' },
  { id: 'quick_actions', title: 'AWS Cloud Quick Actions', enabled: true, order: 3, description: 'Direct shortcuts to real AWS S3 storage, EKS cluster, and account sync' },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTabId>('overview');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isOpenMobileNav, setIsOpenMobileNav] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // AWS Management Account State
  const [awsStatus, setAwsStatus] = useState<AwsAccountStatus | null>(null);
  const [discovery, setDiscovery] = useState<AwsDiscoveryData | null>(null);

  // Telemetry & Cluster State
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [metricHistory, setMetricHistory] = useState<MetricHistoryPoint[]>([]);
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Settings & Offline State
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(5000);
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

  // Handle User Init & Role Change
  const initUser = useCallback(async (role: UserRole = 'super_admin') => {
    const authData = await api.login(role);
    setCurrentUser(authData.user);
  }, []);

  // Invalidate legacy localStorage cache keys
  useEffect(() => {
    const CURRENT_VERSION = 'v4-aws-live-891923193192';
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('shogun_app_version');
      if (stored !== CURRENT_VERSION) {
        localStorage.removeItem('shogun_offline_cache_metrics');
        localStorage.removeItem('shogun_offline_cache_s3_objects');
        localStorage.removeItem('shogun_widgets');
        localStorage.setItem('shogun_app_version', CURRENT_VERSION);
        setWidgets(DEFAULT_WIDGETS);
      }
    }
  }, []);

  useEffect(() => {
    initUser();
  }, [initUser]);

  const handleRoleChange = async (role: UserRole) => {
    await initUser(role);
  };

  // Fetch AWS Live Discovery
  const fetchAwsDiscovery = useCallback(async () => {
    try {
      const [statusRes, discRes] = await Promise.all([
        api.getAwsStatus(),
        api.getAwsDiscovery(),
      ]);
      setAwsStatus(statusRes);
      setDiscovery(discRes);
    } catch (err) {
      console.warn('AWS Discovery warning:', err);
    }
  }, []);

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
    fetchAwsDiscovery();
    fetchData();

    if (refreshIntervalMs > 0) {
      const interval = setInterval(() => {
        fetchAwsDiscovery();
        fetchData();
      }, refreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchAwsDiscovery, fetchData, refreshIntervalMs]);

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
    await fetchAwsDiscovery();
    await fetchData();
  };

  const handleSaveWidgets = (updated: WidgetConfig[]) => {
    setWidgets(updated);
    localStorage.setItem('shogun_widgets', JSON.stringify(updated));
  };

  const handleTriggerSimulatedAlert = async () => {
    await api.dispatchIncidentAlert({
      title: 'High CPU Spike Alert: AWS EC2 Instance',
      severity: 'critical',
      description: 'CPU threshold exceeded 94% on worker node due to intensive batch processing job.',
      channels: ['slack', 'sns', 'email'],
    });
    await fetchData();
  };

  const handleSwitchRegion = async (newRegion: string) => {
    try {
      await api.switchAwsRegion(newRegion);
      await fetchAwsDiscovery();
      await fetchData();
    } catch (err) {
      console.warn('Failed to switch region:', err);
    }
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
  };

  // URL Query Parameters Detection (Embed & JWT Token Support)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token') || params.get('jwt') || params.get('key') || params.get('apiKey');
      if (urlToken) {
        api.setToken(urlToken);
      }
      const urlTab = params.get('tab') as NavTabId;
      if (urlTab && TAB_TITLES[urlTab]) {
        setCurrentTab(urlTab);
      }
      const urlRegion = params.get('region');
      if (urlRegion) {
        api.switchAwsRegion(urlRegion).catch(() => {});
      }
    }
  }, []);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
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
        awsStatus={awsStatus}
        discovery={discovery}
        onNavigateTab={tab => setCurrentTab(tab as any)}
        onSwitchRegion={handleSwitchRegion}
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
          awsStatus={awsStatus}
          discovery={discovery}
        />

        {/* Workspace Main Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
          {/* Mobile Drawer Trigger Bar */}
          <div className="flex md:hidden items-center justify-between pb-3 border-b border-slate-800">
            <button
              onClick={() => setIsOpenMobileNav(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-medium text-slate-200 cursor-pointer"
            >
              <Menu className="w-4 h-4 text-cyan-400" />
              <span>Select Module ({TAB_TITLES[currentTab]})</span>
            </button>
          </div>

          {/* Tab Route Switching */}
          {currentTab === 'overview' && (
            <OverviewDashboard
              metrics={metrics}
              history={metricHistory}
              cluster={clusterInfo}
              alerts={alerts}
              widgets={widgets}
              isDarkMode={isDarkMode}
              awsStatus={awsStatus}
              discovery={discovery}
              onNavigateTab={tab => setCurrentTab(tab)}
              onTriggerSimulatedAlert={handleTriggerSimulatedAlert}
              onRefreshMetrics={fetchData}
              onSwitchRegion={handleSwitchRegion}
            />
          )}

          {currentTab === 'kubernetes' && (
            <KubernetesMonitor
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              awsStatus={awsStatus}
              discovery={discovery}
              onNavigateTab={tab => setCurrentTab(tab)}
              onRefreshDiscovery={fetchAwsDiscovery}
            />
          )}

          {currentTab === 'storage' && (
            <S3StorageManager
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              isOnline={isOnline}
              awsStatus={awsStatus}
              discovery={discovery}
              onNavigateTab={tab => setCurrentTab(tab)}
              onRefreshDiscovery={fetchAwsDiscovery}
            />
          )}

          {currentTab === 'devops' && (
            <DevOpsHub
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              awsStatus={awsStatus}
              discovery={discovery}
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
        </main>
      </div>
    </div>
  );
}
