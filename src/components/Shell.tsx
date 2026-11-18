'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {BusFront,CalendarDays,Ticket,ChartNoAxesCombined,Database,LogIn,LogOut,ShieldCheck,Beaker,Settings2,MapPinned,BriefcaseBusiness,UserRound,Menu,X,ArrowRight} from 'lucide-react';
import {api} from '@/lib/client';
type Passenger={account_id:number;email:string;full_name:string;loyalty_points:number};
const AuthContext=createContext<{isAdmin:boolean;checked:boolean;passenger:Passenger|null;refreshPassenger:()=>Promise<void>}>({isAdmin:false,checked:false,passenger:null,refreshPassenger:async()=>{}});
export function useAdmin(){return useContext(AuthContext);}
const publicNav=[{href:'/',name:'Find a bus',icon:MapPinned},{href:'/my-bookings',name:'My tickets',icon:Ticket},{href:'/operators',name:'Bus operators',icon:BusFront}];
const adminNav=[{href:'/trips',name:'Trip management',icon:CalendarDays},{href:'/bookings',name:'Booking admin',icon:Ticket},{href:'/operations',name:'Fleet & records',icon:BriefcaseBusiness},{href:'/reports',name:'Reports',icon:ChartNoAxesCombined},{href:'/lab',name:'SQL laboratory',icon:Beaker},{href:'/setup',name:'Database setup',icon:Settings2}];
export default function Shell({children}:{children:React.ReactNode}) {
 const path=usePathname();
 const [isAdmin,setIsAdmin]=useState(false),[checked,setChecked]=useState(false),[passenger,setPassenger]=useState<Passenger|null>(null);
 const [showLogin,setShowLogin]=useState(false),[password,setPassword]=useState(''),[authError,setAuthError]=useState(''),[busy,setBusy]=useState(false),[menu,setMenu]=useState(false);
 async function refreshPassenger(){const d=await api<{passenger:Passenger|null}>('/api/passenger/auth');setPassenger(d.passenger);}
 useEffect(()=>{Promise.all([api<{authenticated:boolean}>('/api/auth/status').then(x=>setIsAdmin(x.authenticated)),refreshPassenger()]).catch(()=>{}).finally(()=>setChecked(true));},[]);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setAuthError('');try{await api('/api/auth/login',{method:'POST',body:JSON.stringify({password})});setIsAdmin(true);setShowLogin(false);setPassword('');}catch(e){setAuthError((e as Error).message);}finally{setBusy(false);}}
 async function logoutAdmin(){await api('/api/auth/logout',{method:'POST'}).catch(()=>{});setIsAdmin(false);}
 async function logoutPassenger(){await api('/api/passenger/auth',{method:'POST',body:JSON.stringify({action:'logout'})});setPassenger(null);}
 return <AuthContext.Provider value={{isAdmin,checked,passenger,refreshPassenger}}>
 <div className="site-shell">
  <header className="site-header"><div className="site-header-inner">
   <Link className="site-brand" href="/"><span className="site-brand-mark"><BusFront size={25}/></span><span>Intercity<span className="site-brand-dot">.</span><small>Bus travel made simple</small></span></Link>
   <nav className={menu?'site-navigation open':'site-navigation'} aria-label="Main navigation">{publicNav.map(n=><Link onClick={()=>setMenu(false)} key={n.href} className={path===n.href?'site-navlink selected':'site-navlink'} href={n.href}><n.icon size={17}/>{n.name}</Link>)}</nav>
   <div className="site-actions">{passenger?<><Link className="site-user" href="/account"><UserRound size={16}/><span>{passenger.full_name.split(' ')[0]}</span></Link><button className="site-icon-btn" title="Passenger sign out" onClick={logoutPassenger}><LogOut size={16}/></button></>:<Link className="btn small" href="/account"><UserRound size={16}/> Sign in / Register</Link>}
     <button className="site-menu-toggle" aria-label="Toggle navigation" onClick={()=>setMenu(m=>!m)}>{menu?<X size={22}/>:<Menu size={22}/>}</button>
   </div>
  </div></header>
  {adminNav.some(n=>n.href===path)&&<div className="workspace-toolbar"><div className="workspace-toolbar-inner"><div className="workspace-title"><Database size={17}/> DATABASE WORKSPACE <span>HCMUT · ASSIGNMENT 2</span></div><nav className="workspace-nav">{adminNav.map(n=><Link key={n.href} className={path===n.href?'current':''} href={n.href}><n.icon size={15}/>{n.name}</Link>)}</nav><div className="workspace-login">{isAdmin?<button onClick={logoutAdmin}><ShieldCheck size={15}/> Admin · Sign out</button>:<button onClick={()=>setShowLogin(true)}><LogIn size={15}/> Admin login</button>}</div></div></div>}
  <main className={path==='/'?'site-content site-home':'site-content content'}>{children}</main>
  <footer className="site-footer"><div><span className="footer-brand">Intercity.</span><span>Route search · Scheduled departures · Seat reservations · Ticket records</span></div><div><Link href="/">Find trips</Link><Link href="/operators">Operators</Link><Link href="/trips">Admin workspace <ArrowRight size={13}/></Link></div><small>University database project · Sandbox payments only · No real travel tickets issued</small></footer>
 </div>
 {showLogin&&<div className="modal-backdrop" onClick={()=>setShowLogin(false)}><div className="login-modal" onClick={e=>e.stopPropagation()}><div className="eyebrow">DATABASE ADMINISTRATION</div><h2>Administrator login</h2><p>This account manages the academic database and SQL lab. Passengers use the normal account page.</p><form onSubmit={login}><label>Administrator password<input type="password" required autoFocus value={password} onChange={e=>setPassword(e.target.value)} placeholder="ADMIN_PASSWORD from Vercel"/></label>{authError&&<p className="error-text">{authError}</p>}<div className="button-row"><button type="button" className="btn secondary" onClick={()=>setShowLogin(false)}>Cancel</button><button className="btn" disabled={busy}>{busy?'Signing in...':'Sign in'}</button></div></form></div></div>}
 </AuthContext.Provider>;
}
