import React, { useState } from 'react';
import { Check, GitCommitHorizontal, KeyRound, LockKeyhole, UsersRound } from 'lucide-react';

const INITIAL_VERSIONS = [
  { id: 'v24', title: 'Production alert routing tuned', author: 'Ashirbad Biswal', time: '12 minutes ago' },
  { id: 'v23', title: 'S3 lifecycle policy updated', author: 'DevOps System Lead', time: '2 hours ago' },
  { id: 'v22', title: 'Telemetry dashboard baseline', author: 'Site Reliability Engineer', time: 'Yesterday' },
];

export const CollaborationManager: React.FC = () => {
  const [versions, setVersions] = useState(INITIAL_VERSIONS);
  const [draftTitle, setDraftTitle] = useState('');
  const [permission, setPermission] = useState<'editor' | 'commenter' | 'viewer'>('editor');
  const [saved, setSaved] = useState(false);

  const saveVersion = () => {
    if (!draftTitle.trim()) return;
    setVersions([{ id: `v${versions.length + 25}`, title: draftTitle.trim(), author: 'You', time: 'Just now' }, ...versions]);
    setDraftTitle('');
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return <div className="space-y-6">
    <div className="pb-5 border-b border-slate-700/20"><div className="flex items-center gap-2 text-violet-400 text-[11px] font-mono uppercase tracking-[0.18em] mb-2"><UsersRound className="w-4 h-4" /> Team workspace</div><h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-100">Collaborative projects & versions</h1><p className="text-sm text-slate-400 mt-2">Review changes, set teammate access, and keep an auditable project history.</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
      <section className="glass-panel rounded-2xl border border-slate-800 p-6"><div className="flex items-center justify-between gap-3 mb-5"><div><h2 className="text-sm font-bold text-slate-100">Version history</h2><p className="text-xs text-slate-400 mt-1">Local drafts are ready to sync to a configured cloud provider.</p></div><GitCommitHorizontal className="w-5 h-5 text-cyan-400" /></div><div className="space-y-3">{versions.map(version => <div key={version.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3"><div className="mt-0.5 w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-300 flex items-center justify-center text-[10px] font-mono">{version.id}</div><div className="min-w-0"><div className="text-xs font-semibold text-slate-200">{version.title}</div><div className="text-[11px] text-slate-500 mt-1">{version.author} · {version.time}</div></div></div>)}</div><div className="mt-5 flex gap-2"><input value={draftTitle} onChange={event => setDraftTitle(event.target.value)} placeholder="Describe your next project change" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-100" /><button onClick={saveVersion} className="glass-button rounded-xl bg-cyan-500 px-3 text-xs font-bold text-slate-950">{saved ? <Check className="w-4 h-4" /> : 'Save version'}</button></div></section>
      <section className="glass-panel rounded-2xl border border-slate-800 p-6 space-y-5"><div className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-400" /><h2 className="text-sm font-bold text-slate-100">Team permissions</h2></div><p className="text-xs text-slate-400">New collaborators inherit the selected project role.</p><select value={permission} onChange={event => setPermission(event.target.value as typeof permission)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-100"><option value="editor">Editor · modify and publish</option><option value="commenter">Commenter · annotate changes</option><option value="viewer">Viewer · read-only</option></select><div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex gap-2"><LockKeyhole className="w-4 h-4 shrink-0" /><span>Encryption policy: client-side project payload encryption is required before cloud sync is enabled.</span></div><button className="glass-button w-full rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200">Invite teammate</button></section>
    </div>
  </div>;
};
