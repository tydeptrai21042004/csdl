'use client';
import {useEffect,useState} from 'react';
import {BarChart3, Calculator, RefreshCw, Users, BusFront} from 'lucide-react';
import {api,dateOnly,jsonBody,money} from '@/lib/client';
import {useAdmin} from '@/components/Shell';
interface Summary{operator_id:number;operator_name:string;trip_count:number;available_seats:number;captured_revenue:number|string}
interface Stats{trips:number;operators:number;bookings:number;occupied_seats:number}
export default function Reports(){
 const {isAdmin}=useAdmin();
 const [from,setFrom]=useState(dateOnly(new Date(Date.now()-90*86400000)));
 const [to,setTo]=useState(dateOnly(new Date(Date.now()+90*86400000)));
 const [min,setMin]=useState('1'),[rows,setRows]=useState<Summary[]>([]),[stats,setStats]=useState<Stats|null>(null),[error,setError]=useState('');
 const [kind,setKind]=useState<'driver'|'passenger'>('driver'),[id,setId]=useState('1'),[result,setResult]=useState<{value:number;unit:string}|null>(null),[loading,setLoading]=useState(false);
 async function reload(){setError('');try{const q=new URLSearchParams({from,to,min});const d=await api<{summary:Summary[];stats:Stats}>(`/api/trip-stats?${q}`);setRows(d.summary);setStats(d.stats);}catch(e){setError((e as Error).message);}}
 useEffect(()=>{reload();},[]);
 async function compute(e:React.FormEvent){e.preventDefault();setLoading(true);setError('');setResult(null);try{setResult(await api<{value:number;unit:string}>('/api/trip-stats',{method:'POST',body:jsonBody({kind,id:Number(id),from,to})}));}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 const peak=Math.max(1,...rows.map(r=>Number(r.captured_revenue)));
 return <div><div className="page-heading"><div><div className="eyebrow">SECTION 2.3 + 2.4 + 3.3</div><h1>Reporting & SQL functions</h1><p>Aggregated operator performance using stored procedures, plus two cursor-driven business functions.</p></div><button className="btn secondary" onClick={reload}><RefreshCw size={17}/> Refresh report</button></div>
  {error&&<div className="alert error">{error}</div>}
  <div className="panel"><div className="panel-header"><div><div className="eyebrow">QUERY PROCEDURE · GROUP BY / HAVING</div><h2>Operator performance</h2></div><BarChart3 size={22}/></div>
  <div className="filters report-filters"><label><span>From</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label><span>To</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label><span>Minimum trips (HAVING)</span><input type="number" min="0" value={min} onChange={e=>setMin(e.target.value)}/></label><button className="btn" onClick={reload}>Run SQL procedure</button></div>
  <div className="report-list">{rows.length?rows.map(r=><div className="report-row" key={r.operator_id}><div className="report-name"><strong>{r.operator_name}</strong><small>{r.trip_count} trip(s) · {r.available_seats} seats currently available</small></div><div className="report-bar-area"><div className="report-bar" style={{width:`${Math.max(1,Number(r.captured_revenue)/peak*100)}%`}}/></div><strong className="report-value">{money(r.captured_revenue)}</strong></div>):<p className="empty">No operators match the selected date range and HAVING threshold.</p>}</div>
  <div className="table-footer"><code>CALL sp_operator_summary(from_date, to_date, minimum_trips, result)</code></div>
  </div>
  <div className="two-col"><section className="panel"><div className="panel-header"><div><div className="eyebrow">CURSOR FUNCTIONS · SECTION 2.4</div><h2>Run a database calculation</h2></div><Calculator size={22}/></div>
   <p className="panel-description">Each function validates parameters, opens an explicit cursor, fetches records in a loop, and computes a final result.</p>
   {!isAdmin&&<div className="alert">Login as administrator to execute calculation functions.</div>}
   <form className="stacked-form" onSubmit={compute}><label>Function<select value={kind} onChange={e=>{setKind(e.target.value as 'driver'|'passenger');setId(e.target.value==='driver'?'1':'201');setResult(null);}}><option value="driver">Driver workload (hours)</option><option value="passenger">Passenger captured spend (VND)</option></select></label><label>{kind==='driver'?'Driver ID':'Passenger account ID'}<input type="number" min="1" value={id} onChange={e=>setId(e.target.value)}/></label><button className="btn full" disabled={!isAdmin||loading}>{loading?'Running...':'Execute cursor function'}</button></form>
   {result&&<div className="calculation-result"><small>FUNCTION RESULT</small><strong>{kind==='passenger'?money(result.value):`${result.value.toFixed(2)} hours`}</strong><p>Calculated on Supabase PostgreSQL from stored records.</p></div>}
   </section><section className="panel"><div className="panel-header"><div><div className="eyebrow">SYSTEM CHECK</div><h2>Live database facts</h2></div><Users size={22}/></div><p className="panel-description">These values are read from the same PostgreSQL database as all Trip and Booking operations.</p>
    {[
     {name:'Scheduled + historical trips',v:stats?.trips,icon:BusFront},
     {name:'Operators',v:stats?.operators,icon:Users},
     {name:'Customer bookings',v:stats?.bookings,icon:Users},
     {name:'Allocated seats',v:stats?.occupied_seats,icon:Users},
    ].map(s=><div key={s.name} className="compact-list"><span>{s.name}</span><strong>{s.v??'—'}</strong></div>)}
   <p className="helper">Sample payments are sandbox records. Report revenue includes captured payments, not requested refunds.</p>
   </section></div>
 </div>;
}
