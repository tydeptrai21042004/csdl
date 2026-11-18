'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Database, ShieldCheck, RefreshCw, ArrowRight, LockKeyhole, ServerCog} from 'lucide-react';
import {api} from '@/lib/client';
import {useAdmin} from '@/components/Shell';
type Status={configured:boolean;initialized:boolean;table_count:number;trip_count:number|null};
export default function Setup(){
 const {isAdmin,checked}=useAdmin();
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[token,setToken]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){setError('');try{setStatus(await api<Status>('/api/setup/status'));}catch(e){setError((e as Error).message);}}
 useEffect(()=>{if(isAdmin)void refresh();},[isAdmin]);
 async function initialize(){if(!confirm('Initialize the EMPTY Neon database with the full assignment schema and synthetic seed data?'))return;
  setBusy(true);setError('');setMessage('');try{
   const result=await api<{message:string}>('/api/setup/initialize',{method:'POST',body:JSON.stringify({token,confirmation:'INITIALIZE EMPTY DATABASE'})});
   setMessage(result.message);setToken('');await refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function upgrade(){if(!confirm('Apply a NON-DESTRUCTIVE upgrade to the existing 23-table database? Existing bookings and payments are preserved.'))return;
  setBusy(true);setError('');setMessage('');try{const result=await api<{message:string}>('/api/setup/upgrade',{method:'POST',body:JSON.stringify({token,confirmation:'UPGRADE EXISTING DATABASE'})});setMessage(result.message);setToken('');await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div><div className="page-heading"><div><div className="eyebrow">CLOUD DATABASE SETUP</div><h1>Deploy & initialize</h1><p>One Vercel deployment hosts both the website and API. Initialize a fresh Neon branch here—no local PostgreSQL client needed.</p></div><button className="btn secondary" onClick={()=>void refresh()} disabled={!isAdmin||busy}><RefreshCw size={16}/> Check database</button></div>
  {!isAdmin&&checked&&<div className="alert">Log in as administrator from the top right to see database diagnostics and initialization controls.</div>}
  {error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}
  <div className="lab-metrics"><div className="stat-card"><div className="stat-top">PostgreSQL connection <Database size={19}/></div><strong className="lab-value">{status?.configured?'Configured':'—'}</strong><div className="stat-foot">Server-side DATABASE_URL</div></div><div className="stat-card"><div className="stat-top">Schema status <ShieldCheck size={19}/></div><strong className="lab-value">{status?.initialized?'Ready':'Not initialized'}</strong><div className="stat-foot">Never overwrites existing tables</div></div><div className="stat-card"><div className="stat-top">Tables <ServerCog size={19}/></div><strong>{status?.table_count??'—'}</strong><div className="stat-foot">23 expected</div></div></div>
  <div className="two-col"><section className="panel lab-card"><div className="eyebrow">FIRST-TIME INSTALLATION</div><h2>Initialize schema + seed data</h2><p>The setup command executes the exact SQL files bundled with this deployment in one database transaction. It refuses to run when the schema is nonempty.</p><label className="lab-label">SETUP_TOKEN<input type="password" placeholder="Paste server-side setup token" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off"/></label><button className="btn" onClick={()=>void initialize()} disabled={!isAdmin||busy||Boolean(status?.initialized)||token.length<24}><LockKeyhole size={16}/>{busy?'Initializing...':'Initialize empty Neon database'}</button><div className="lab-table-count"><strong>Already deployed Version 2?</strong><p>Use the same token to apply a non-destructive migration. It installs passenger booking routines and expands seat inventory while keeping all 23 tables and historical records.</p><button className="btn secondary" onClick={()=>void upgrade()} disabled={!isAdmin||busy||!status?.initialized||token.length<24}>Upgrade existing database</button></div><p className="helper lab-helper">Do not expose this token in a public client variable or commit it to GitHub. This operation is allowed only once per empty branch.</p></section><section className="panel lab-card"><div className="eyebrow">WHAT HAPPENS NEXT</div><h2>Presentation-ready checklist</h2><ol className="lab-steps"><li>Database schema: 21 entities + 2 mapping tables</li><li>Triggers, procedures, cursor functions</li><li>Five or more sample rows in every table</li><li>Trip CRUD and simulated bookings</li><li>Safe transaction-rollback SQL tests</li></ol><Link className="btn secondary full" href="/lab">Open SQL laboratory <ArrowRight size={15}/></Link></section></div>
 </div>;
}
