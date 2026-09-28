import React, { useRef, useState } from 'react';
import { Camera, Check, KeyRound, Mail, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import { User } from '../../types';

interface ProfileManagerProps {
  currentUser: User | null;
  onSave: (user: User) => void;
  isDarkMode: boolean;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({ currentUser, onSave, isDarkMode }) => {
  const [name, setName] = useState(currentUser?.username || 'Ashirbad Biswal');
  const [email, setEmail] = useState(currentUser?.email || 'ashirbad.admin@shogun-kuber.io');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-700/20">
        <div className="flex items-center gap-2 text-cyan-400 text-[11px] font-mono uppercase tracking-[0.18em] mb-2"><UserRound className="w-4 h-4" /> Account center</div>
        <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-100">Profile & security settings</h1>
        <p className="text-sm text-slate-400 mt-2">Manage your identity, avatar, account contact, and sign-in protections.</p>
      </div>

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
