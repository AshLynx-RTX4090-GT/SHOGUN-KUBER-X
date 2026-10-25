import React, { useRef, useState, useEffect } from 'react';
import { Camera, Check, KeyRound, Mail, ShieldCheck, Smartphone, UserRound, Cloud, ExternalLink, RefreshCw } from 'lucide-react';
import { User, AwsConsoleConfig } from '../../types';

interface ProfileManagerProps {
  currentUser: User | null;
  onSave: (user: User) => void;
  isDarkMode: boolean;
  awsConfig?: AwsConsoleConfig | null;
  onUpdateAwsConfig?: (accountId: string, region: string) => Promise<void>;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({ 
  currentUser, 
  onSave, 
  isDarkMode,
  awsConfig,
  onUpdateAwsConfig
}) => {
  const [name, setName] = useState(currentUser?.username || 'Ashirbad Biswal');
  const [email, setEmail] = useState(currentUser?.email || 'ashirbad.admin@shogun-kuber.io');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AWS Configuration State
  const [awsAccountId, setAwsAccountId] = useState(awsConfig?.accountId || '956083908253');
  const [awsRegion, setAwsRegion] = useState(awsConfig?.region || 'us-east-1');
  const [isUpdatingAws, setIsUpdatingAws] = useState(false);
  const [awsSaved, setAwsSaved] = useState(false);

  useEffect(() => {
    if (awsConfig) {
      setAwsAccountId(awsConfig.accountId);
      setAwsRegion(awsConfig.region);
    }
  }, [awsConfig]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  const saveProfile = () => {
    if (!currentUser) return;
    onSave({ ...currentUser, username: name.trim() || currentUser.username, email: email.trim() || currentUser.email, avatar });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const saveAwsSettings = async () => {
    if (!onUpdateAwsConfig) return;
    setIsUpdatingAws(true);
    try {
      await onUpdateAwsConfig(awsAccountId.trim(), awsRegion);
      setAwsSaved(true);
      setTimeout(() => setAwsSaved(false), 3000);
    } catch (err) {
      console.error('Failed to update AWS settings:', err);
    } finally {
      setIsUpdatingAws(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-700/20">
        <div className="flex items-center gap-2 text-cyan-400 text-[11px] font-mono uppercase tracking-[0.18em] mb-2"><UserRound className="w-4 h-4" /> Account center</div>
        <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-100">AWS & Account Settings</h1>
        <p className="text-sm text-slate-400 mt-2">Manage your AWS Account ID, Region connection, and profile credentials.</p>
      </div>

      {/* AWS Account Console Connection Card */}
      <section className={`glass-panel p-6 rounded-2xl border ${isDarkMode ? 'border-amber-500/30 bg-amber-950/10' : 'border-amber-200 bg-amber-50/40'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/30">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-amber-400" />
              <span>AWS Account Console Integration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Connect this dashboard directly to your AWS Account console across Amazon S3, EKS, CloudWatch, and IAM.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              AWS Account ID
            </label>
            <input
              type="text"
              value={awsAccountId}
              onChange={e => setAwsAccountId(e.target.value)}
              placeholder="e.g. 956083908253"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 py-2.5 text-sm font-mono text-slate-100 outline-none focus:border-amber-400"
            />
            <p className="text-[11px] text-slate-500 mt-1">Used for deep-linking directly to resources in your AWS account console.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Default AWS Region
            </label>
            <select
              value={awsRegion}
              onChange={e => setAwsRegion(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 py-2.5 text-sm font-mono text-slate-100 outline-none focus:border-amber-400"
            >
              <option value="us-east-1">us-east-1 (N. Virginia)</option>
              <option value="us-west-2">us-west-2 (Oregon)</option>
              <option value="ap-south-1">ap-south-1 (Mumbai / India)</option>
              <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
              <option value="eu-west-1">eu-west-1 (Ireland)</option>
              <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Primary region for EKS cluster, S3 buckets, and CloudWatch metrics.</p>
          </div>
        </div>

        {/* Quick Console Action Buttons */}
        <div className="mt-5 pt-4 border-t border-slate-700/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Quick Open:</span>
            {awsConfig?.consoleUrls && (
              <>
                <a
                  href={awsConfig.consoleUrls.s3}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
                >
                  <span>S3 Console</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
                <a
                  href={awsConfig.consoleUrls.eks}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
                >
                  <span>EKS Console</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
                <a
                  href={awsConfig.consoleUrls.cloudwatch}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
                >
                  <span>CloudWatch</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
                <a
                  href={awsConfig.consoleUrls.iam}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
                >
                  <span>IAM Console</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </>
            )}
          </div>

          <button
            onClick={saveAwsSettings}
            disabled={isUpdatingAws}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-md"
          >
            {isUpdatingAws ? <RefreshCw className="w-4 h-4 animate-spin" /> : awsSaved ? <Check className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
            <span>{awsSaved ? 'AWS Settings Saved' : 'Update AWS Parameters'}</span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <section className={`glass-panel p-6 rounded-2xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="relative mx-auto w-28 h-28">
            <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-fuchsia-500 ring-4 ring-cyan-400/20 flex items-center justify-center text-3xl font-bold text-white">
              {avatar ? <img src={avatar} alt="Profile avatar" className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
            </div>
            <button onClick={() => fileInputRef.current?.click()} aria-label="Change profile avatar" className="absolute -right-1 -bottom-1 p-2 rounded-full bg-cyan-500 text-slate-950 shadow-lg" title="Change avatar"><Camera className="w-4 h-4" /></button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div className="text-center mt-4"><div className="font-bold text-slate-100">{name || 'Your name'}</div><div className="text-xs text-cyan-400 font-mono uppercase mt-1">{currentUser?.role?.replace('_', ' ') || 'Admin'}</div></div>
          <div className="mt-6 pt-5 border-t border-slate-800 text-xs text-slate-400 space-y-2"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> JWT session protected</div><div className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-amber-400" /> RBAC permissions active</div></div>
        </section>

        <section className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
          <div><h2 className="text-sm font-bold text-slate-100">Personal details</h2><p className="text-xs text-slate-400 mt-1">These details are stored in the current account session.</p></div>
          <label className="block text-xs text-slate-400">Display name<input value={name} onChange={event => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400" /></label>
          <label className="block text-xs text-slate-400">Account email<input type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400" /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><span className="text-xs text-slate-500 flex items-center gap-2"><Mail className="w-4 h-4" /> {email}</span><button onClick={saveProfile} className="glass-button px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold flex items-center gap-2">{saved ? <Check className="w-4 h-4" /> : null}{saved ? 'Saved' : 'Save profile'}</button></div>
        </section>
      </div>

      <section className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h2 className="text-sm font-bold text-slate-100 flex items-center gap-2"><Smartphone className="w-4 h-4 text-amber-400" /> Multi-factor authentication</h2><p className="text-xs text-slate-400 mt-1">Enable this setting when an AWS Cognito or enterprise identity provider is connected.</p></div><button role="switch" aria-checked={mfaEnabled} onClick={() => setMfaEnabled(value => !value)} className={`glass-button w-14 h-8 rounded-full p-1 transition-colors ${mfaEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}><span className={`block w-6 h-6 rounded-full bg-white transition-transform ${mfaEnabled ? 'translate-x-6' : ''}`} /></button></div>
        <div className={`mt-4 text-xs rounded-xl border p-3 ${mfaEnabled ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' : 'border-amber-500/30 text-amber-300 bg-amber-500/10'}`}>{mfaEnabled ? 'MFA preference saved for this session.' : 'MFA is currently off. Connect AWS Cognito credentials before using production authentication.'}</div>
      </section>
    </div>
  );
};
