'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Plus, RefreshCw, Search, Pencil, Trash2, X, ArrowRight, Save} from 'lucide-react';
import {api,BusOption,dateTime,jsonBody,money,OperatorOption,RouteOption,toLocalInput,Trip} from '@/lib/client';
import {useAdmin} from '@/components/Shell';
type TripForm={trip_id?:number;route_id:string;bus_id:string;departure_at:string;arrival_at:string;base_fare:string;status:string};
const future=(days:number)=>toLocalInput(new Date(Date.now()+days*86400000).toISOString());
const emptyForm=():TripForm=>({route_id:'',bus_id:'',departure_at:future(45),arrival_at:future(45+6/24),base_fare:'200000',status:'SCHEDULED'});
export default function TripsPage(){
 const {isAdmin}=useAdmin();
 const [trips,setTrips]=useState<Trip[]>([]),[routes,setRoutes]=useState<RouteOption[]>([]),[buses,setBuses]=useState<BusOption[]>([]),[operators,setOperators]=useState<OperatorOption[]>([]);
 const [search,setSearch]=useState(''),[status,setStatus]=useState(''),[operator,setOperator]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editing,setEditing]=useState(false),[form,setForm]=useState<TripForm>(emptyForm()),[saving,setSaving]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const q=new URLSearchParams();if(search)q.set('search',search);if(status)q.set('status',status);if(operator)q.set('operator',operator);
   const [res,opts]=await Promise.all([api<{trips:Trip[]}>(`/api/trips?${q}`),api<{routes:RouteOption[],buses:BusOption[],operators:OperatorOption[]}>('/api/lookup?kind=public')]);
   setTrips(res.trips);setRoutes(opts.routes);setBuses(opts.buses);setOperators(opts.operators);
  }catch(e){setError((e as Error).message);}finally{setLoading(false);}
 },[search,status,operator]);
 useEffect(()=>{load();},[load]);
 const selectedRoute=routes.find(r=>r.route_id===Number(form.route_id));
 const validBuses=useMemo(()=>buses.filter(b=>!selectedRoute||b.operator_id===selectedRoute.operator_id),[buses,selectedRoute]);
 function startNew(){const r=routes[0];const bus=buses.find(b=>b.operator_id===r?.operator_id);setForm({...emptyForm(),route_id:String(r?.route_id??''),bus_id:String(bus?.bus_id??'')});setEditing(true);setNotice('');}
 function startEdit(t:Trip){setForm({trip_id:t.trip_id,route_id:String(t.route_id),bus_id:String(t.bus_id),departure_at:toLocalInput(t.departure_at),arrival_at:toLocalInput(t.arrival_at),base_fare:String(t.base_fare),status:t.status});setEditing(true);setNotice('');}
 function changeRoute(value:string){const r=routes.find(r=>String(r.route_id)===value),b=buses.find(b=>b.operator_id===r?.operator_id);setForm(f=>({...f,route_id:value,bus_id:b?String(b.bus_id):''}));}
 async function save(e:React.FormEvent){e.preventDefault();setError('');setNotice('');setSaving(true);
  try{
   const payload={...form,route_id:Number(form.route_id),bus_id:Number(form.bus_id),base_fare:Number(form.base_fare),departure_at:new Date(form.departure_at).toISOString(),arrival_at:new Date(form.arrival_at).toISOString()};
   const result=await api<{message:string}>('/api/trips',{method:form.trip_id?'PATCH':'POST',body:jsonBody(payload)});
   setNotice(result.message);setEditing(false);await load();
  }catch(e){setError((e as Error).message);}finally{setSaving(false);}
 }
 async function remove(t:Trip){if(!confirm(`Delete trip #${t.trip_id}? Only unbooked scheduled trips may be deleted.`))return;
  try{const data=await api<{message:string}>('/api/trips',{method:'DELETE',body:jsonBody({trip_id:t.trip_id})});setNotice(data.message);await load();}catch(e){setError((e as Error).message);}
 }
 return <div><div className="page-heading"><div><div className="eyebrow">SECTION 2.1 + 3.1 + 3.2</div><h1>Trip management</h1><p>Search departures, manage schedules, and demonstrate insert/update/delete stored procedures.</p></div><button className="btn" onClick={startNew} disabled={!isAdmin}><Plus size={17}/> New trip</button></div>
  {!isAdmin&&<div className="alert">Sign in as administrator to insert, update, or delete trips. Trip search is available in read-only mode.</div>}
  {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}
  <section className="panel"><div className="filters"><label className="search-field"><Search size={18}/><input placeholder="Search station or operator" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <label><span>Trip status</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'].map(s=><option key={s}>{s}</option>)}</select></label>
   <label><span>Operator</span><select value={operator} onChange={e=>setOperator(e.target.value)}><option value="">All operators</option>{operators.map(o=><option key={o.operator_id} value={o.operator_id}>{o.operator_name}</option>)}</select></label>
   <button className="btn secondary icon-only" onClick={load} title="Refresh data"><RefreshCw size={18}/></button>
  </div>
  <div className="table-overflow"><table><thead><tr><th>Trip / Route</th><th>Operator / Bus</th><th>Departure</th><th>Price</th><th>Seats left</th><th>Status</th><th>Actions</th></tr></thead><tbody>
   {trips.map(t=><tr key={t.trip_id}><td><div className="cell-strong">#{t.trip_id} · {t.origin} <ArrowRight size={12}/> {t.destination}</div><small>Route #{t.route_id}</small></td><td>{t.operator_name}<small>{t.license_plate}</small></td><td>{dateTime(t.departure_at)}</td><td className="currency">{money(t.base_fare)}</td><td><span className="seat-count">{t.available_seats}</span></td><td><span className={`pill ${t.status==='SCHEDULED'?'blue':t.status==='COMPLETED'?'success':''}`}>{t.status}</span></td><td><div className="table-actions"><button className="table-icon" disabled={!isAdmin} onClick={()=>startEdit(t)} title="Edit"><Pencil size={16}/></button><button className="table-icon danger" disabled={!isAdmin} onClick={()=>remove(t)} title="Delete"><Trash2 size={16}/></button></div></td></tr>)}
  </tbody></table>{!loading&&!trips.length&&<div className="empty">No trips found. Try clearing filters or initializing the database.</div>}{loading&&<div className="empty">Loading trips...</div>}</div><div className="table-footer">Showing {trips.length} rows · Data source: <code>CALL sp_search_trips(...)</code></div></section>
  {editing&&<div className="modal-backdrop" onClick={()=>setEditing(false)}><div className="edit-modal" onClick={e=>e.stopPropagation()}><div className="modal-title"><div><div className="eyebrow">STORED PROCEDURE</div><h2>{form.trip_id?`Edit trip #${form.trip_id}`:'Create a trip'}</h2></div><button className="table-icon" onClick={()=>setEditing(false)}><X size={19}/></button></div><form onSubmit={save} className="form-grid">
   <label>Route<select required value={form.route_id} onChange={e=>changeRoute(e.target.value)}>{routes.map(r=><option value={r.route_id} key={r.route_id}>{r.origin} → {r.destination} ({r.operator_name})</option>)}</select></label>
   <label>Bus<select required value={form.bus_id} onChange={e=>setForm(f=>({...f,bus_id:e.target.value}))}>{validBuses.map(b=><option key={b.bus_id} value={b.bus_id}>{b.license_plate} · {b.bus_type}</option>)}</select></label>
   <label>Departure<input required type="datetime-local" value={form.departure_at} onChange={e=>setForm(f=>({...f,departure_at:e.target.value}))}/></label>
   <label>Arrival<input required type="datetime-local" value={form.arrival_at} onChange={e=>setForm(f=>({...f,arrival_at:e.target.value}))}/></label>
   <label>Base fare (VND)<input required type="number" min="0" value={form.base_fare} onChange={e=>setForm(f=>({...f,base_fare:e.target.value}))}/></label>
   {form.trip_id&&<label>Status<select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'].map(s=><option key={s}>{s}</option>)}</select></label>}
   <div className="full-span"><div className="form-note">Bus/route consistency, schedule overlaps and existing bookings are enforced by PostgreSQL, not the browser.</div><div className="button-row"><button type="button" className="btn secondary" onClick={()=>setEditing(false)}>Cancel</button><button className="btn" disabled={saving}><Save size={17}/>{saving?'Saving...':'Save using procedure'}</button></div></div>
  </form></div></div>}
 </div>;
}
