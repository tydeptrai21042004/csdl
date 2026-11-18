'use client';
import {useEffect,useState} from 'react';
import {CalendarClock, CreditCard, RefreshCw, TicketCheck, Armchair} from 'lucide-react';
import {api,Booking,dateTime,jsonBody,money,Trip} from '@/lib/client';
import {useAdmin} from '@/components/Shell';
type Seat={seat_id:number;seat_code:string;seat_class:string;is_blocked:boolean;occupied:boolean};
type Stop={stop_order:number;station_name:string;pickup_allowed:boolean;dropoff_allowed:boolean};
type Passenger={account_id:number;full_name:string};
type Method={method_id:number;method_name:string;provider:string};
type Promo={promo_code:string;discount_type:string;discount_value:number};
export default function BookingsPage(){
 const {isAdmin}=useAdmin();
 const [trips,setTrips]=useState<Trip[]>([]),[bookings,setBookings]=useState<Booking[]>([]),[passengers,setPassengers]=useState<Passenger[]>([]),[methods,setMethods]=useState<Method[]>([]),[promos,setPromos]=useState<Promo[]>([]);
 const [tripId,setTripId]=useState(''),[seatId,setSeatId]=useState(''),[passengerId,setPassengerId]=useState('201'),[traveller,setTraveller]=useState('Sample Traveller'),[pickup,setPickup]=useState('1'),[dropoff,setDropoff]=useState('3'),[promo,setPromo]=useState('');
 const [seats,setSeats]=useState<Seat[]>([]),[stops,setStops]=useState<Stop[]>([]),[method,setMethod]=useState('1'),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(){try{
   const t=await api<{trips:Trip[]}>('/api/trips');setTrips(t.trips.filter(x=>x.status==='SCHEDULED'&&new Date(x.departure_at)>new Date()));
   if(isAdmin){const [b,l]=await Promise.all([api<{bookings:Booking[]}>('/api/bookings'),api<{passengers:Passenger[],methods:Method[],promotions:Promo[]}>('/api/lookup?kind=booking')]);setBookings(b.bookings);setPassengers(l.passengers);setMethods(l.methods);setPromos(l.promotions);}
  }catch(e){setError((e as Error).message);}}
 useEffect(()=>{refresh();},[isAdmin]);
 useEffect(()=>{if(!tripId) {setSeats([]);setStops([]);return;}api<{seats:Seat[],stops:Stop[]}>(`/api/lookup?kind=seats&trip_id=${tripId}`).then(d=>{setSeats(d.seats);setStops(d.stops);setSeatId('');setPickup(String(d.stops.find(s=>s.pickup_allowed)?.stop_order??''));setDropoff(String([...d.stops].reverse().find(s=>s.dropoff_allowed)?.stop_order??''));}).catch(e=>setError((e as Error).message));},[tripId,isAdmin]);
 async function reserve(e:React.FormEvent){e.preventDefault();setError('');setNotice('');setLoading(true);
  try{
   const d=await api<{booking_id:number;total_amount:number}>('/api/bookings',{method:'POST',body:jsonBody({passenger_id:Number(passengerId),trip_id:Number(tripId),seat_id:Number(seatId),traveller_name:traveller,pickup_stop_order:Number(pickup),dropoff_stop_order:Number(dropoff),promo_code:promo})});
   setNotice(`Booking #${d.booking_id} created. Payable amount: ${money(d.total_amount)}. Pay using the sandbox action below within 15 minutes.`);
   await refresh();const s=await api<{seats:Seat[],stops:Stop[]}>(`/api/lookup?kind=seats&trip_id=${tripId}`);setSeats(s.seats);setSeatId('');
  }catch(e){setError((e as Error).message);}finally{setLoading(false);}
 }
 async function pay(id:number){if(!confirm(`Simulate a captured payment for booking #${id}? No money moves.`))return;setError('');setNotice('');
  try{const d=await api<{amount:number}>('/api/bookings/capture',{method:'POST',body:jsonBody({booking_id:id,method_id:Number(method)})});setNotice(`Demo payment captured: ${money(d.amount)}. Ticket is now confirmed.`);await refresh();}catch(e){setError((e as Error).message);}
 }
 async function expire(){setError('');try{const d=await api<{expired_count:number}>('/api/bookings/expire',{method:'POST'});setNotice(`${d.expired_count} expired booking(s) released.`);await refresh();}catch(e){setError((e as Error).message);}}
 const selected=trips.find(t=>String(t.trip_id)===tripId),openSeats=seats.filter(s=>!s.occupied&&!s.is_blocked);
 return <div><div className="page-heading"><div><div className="eyebrow">BOOKING LIFECYCLE DEMONSTRATION</div><h1>Seat reservations & payments</h1><p>Make a temporary reservation, then confirm it with a simulated payment. All availability checks run in PostgreSQL.</p></div><button className="btn secondary" onClick={refresh}><RefreshCw size={17}/> Refresh</button></div>
  <div className="alert"><strong>Sandbox only:</strong> this application does not process real bank cards, funds, refunds or customer authentication. Seeded passengers are test identities.</div>
  {!isAdmin&&<div className="alert">Administrator login is required to view booking records and execute demo transactions.</div>}
  {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}
  <div className="two-col booking-layout"><section className="panel"><div className="panel-header"><div><div className="eyebrow">NEW RESERVATION</div><h2>Select a trip and seat</h2></div><Armchair size={20}/></div>
   <form onSubmit={reserve} className="stacked-form">
    <label>Scheduled trip<select value={tripId} onChange={e=>setTripId(e.target.value)} required disabled={!isAdmin}><option value="">Choose a departure</option>{trips.map(t=><option key={t.trip_id} value={t.trip_id}>#{t.trip_id} · {t.origin} → {t.destination} · {dateTime(t.departure_at)}</option>)}</select></label>
    {selected&&<div className="selected-trip"><span>Fare from <strong>{money(selected.base_fare)}</strong></span><span><strong>{selected.available_seats}</strong> seats available</span></div>}
    <label>Physical seat<select value={seatId} onChange={e=>setSeatId(e.target.value)} required disabled={!isAdmin||!tripId}><option value="">{tripId?`${openSeats.length} eligible seats`:'Select a trip first'}</option>{openSeats.map(s=><option value={s.seat_id} key={s.seat_id}>{s.seat_code} · {s.seat_class}</option>)}</select></label>
    <label>Passenger account<select required value={passengerId} onChange={e=>setPassengerId(e.target.value)} disabled={!isAdmin}>{passengers.map(p=><option key={p.account_id} value={p.account_id}>{p.full_name} (#{p.account_id})</option>)}</select></label>
    <label>Actual traveller name<input required value={traveller} onChange={e=>setTraveller(e.target.value)} disabled={!isAdmin}/></label>
    <div className="form-grid"><label>Pickup stop<select required value={pickup} onChange={e=>setPickup(e.target.value)} disabled={!isAdmin}>{stops.filter(s=>s.pickup_allowed).map(s=><option key={s.stop_order} value={s.stop_order}>{s.stop_order}. {s.station_name}</option>)}</select></label><label>Drop-off stop<select required value={dropoff} onChange={e=>setDropoff(e.target.value)} disabled={!isAdmin}>{stops.filter(s=>s.dropoff_allowed).map(s=><option key={s.stop_order} value={s.stop_order}>{s.stop_order}. {s.station_name}</option>)}</select></label></div>
    <label>Promotion (optional)<select value={promo} onChange={e=>setPromo(e.target.value)} disabled={!isAdmin}><option value="">No promotion</option>{promos.map(p=><option key={p.promo_code} value={p.promo_code}>{p.promo_code} · {p.discount_type==='PERCENT'?`${p.discount_value}%`:money(p.discount_value)}</option>)}</select></label>
    <button className="btn full" type="submit" disabled={!isAdmin||!seatId||loading}><TicketCheck size={17}/>{loading?'Reserving...':'Hold seat for 15 minutes'}</button>
   </form></section>
   <section className="panel"><div className="panel-header"><div><div className="eyebrow">SEAT INVENTORY</div><h2>{selected?`Trip #${selected.trip_id}`:'Choose a departure'}</h2></div><span className="pill">Live</span></div>
    {tripId?<><div className="seat-legend"><span><i className="legend-box free"/>Available</span><span><i className="legend-box taken"/>Occupied</span><span><i className="legend-box blocked"/>Blocked</span></div><div className="seat-grid">{seats.map(s=><button key={s.seat_id} type="button" className={`seat-tile ${s.occupied?'taken':s.is_blocked?'blocked':String(s.seat_id)===seatId?'selected':''}`} disabled={s.occupied||s.is_blocked||!isAdmin} onClick={()=>setSeatId(String(s.seat_id))}>{s.seat_code}</button>)}</div><p className="helper">Status is calculated per trip, rather than for the physical bus globally.</p></>:<div className="empty with-icon"><Armchair size={35}/>Select a trip to see its individual seat inventory.</div>}
   </section></div>
  <section className="panel"><div className="panel-header"><div><div className="eyebrow">HISTORICAL & PENDING RECORDS</div><h2>Bookings</h2></div><div className="inline-controls"><select aria-label="Demo payment method" value={method} onChange={e=>setMethod(e.target.value)}>{methods.map(m=><option value={m.method_id} key={m.method_id}>{m.method_name}</option>)}</select><button className="btn secondary small" disabled={!isAdmin} onClick={expire}><CalendarClock size={15}/> Release expired holds</button></div></div>
   <div className="table-overflow"><table><thead><tr><th>Booking</th><th>Purchaser</th><th>Trip / Date</th><th>Tickets</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{bookings.map(b=><tr key={b.booking_id}><td className="cell-strong">#{b.booking_id}</td><td>{b.purchaser}</td><td>#{b.trip_id}<small>{dateTime(b.departure_at)}</small></td><td>{b.ticket_count}</td><td className="currency">{money(b.total_amount)}</td><td><span className={`pill ${b.status==='PAID'?'success':b.status==='PENDING'?'blue':''}`}>{b.status}</span></td><td>{b.status==='PENDING'?<button className="btn small" onClick={()=>pay(b.booking_id)}><CreditCard size={15}/> Demo capture</button>:<span className="muted">—</span>}</td></tr>)}</tbody></table>{!bookings.length&&<div className="empty">No bookings visible. Administrator access is required.</div>}</div>
  </section>
 </div>;
}
