'use client';
import {Suspense,useEffect,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {ArrowRight,CalendarClock,CreditCard,Printer,RefreshCw,Star,Ticket,Trash2,Wallet} from 'lucide-react';
import {api,dateTime,money} from '@/lib/client';
import {useAdmin} from '@/components/Shell';
type T={ticket_id:number;seat_code:string;traveller_name:string;fare:number;status:string;pickup:string;dropoff:string};
type B={booking_id:number;trip_id:number;booked_at:string;expires_at:string;status:string;trip_status:string;total_amount:number;discount_amount_applied:number;departure_at:string;arrival_at:string;operator_name:string;origin:string;destination:string;tickets:T[];payment_method:string|null;refund_status:string|null;rating:number|null;invoice_id:number|null};
type Method={method_id:number;method_name:string;provider:string};
function MyBookingsContents(){
 const {passenger,checked}=useAdmin(),params=useSearchParams();
 const [list,setList]=useState<B[]>([]),[methods,setMethods]=useState<Method[]>([]),[method,setMethod]=useState('1'),[loading,setLoading]=useState(true),[action,setAction]=useState<number|null>(null),[notice,setNotice]=useState(''),[error,setError]=useState(''),[showOld,setShowOld]=useState(true);
 async function load(){if(!passenger){setLoading(false);return;}setLoading(true);try{const [a,b]=await Promise.all([api<{bookings:B[]}>('/api/passenger/bookings'),api<{methods:Method[]}>('/api/public/catalog')]);setList(a.bookings);setMethods(b.methods);if(b.methods[0]&&!method)setMethod(String(b.methods[0].method_id));}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[passenger?.account_id]);
 async function perform(id:number,type:'pay'|'cancel'|'refund'|'review'|'invoice',data?:unknown){setAction(id);setError('');setNotice('');try{
  const res=await api<{message?:string;status?:string;refund_status?:string}>(`/api/passenger/bookings/${id}/${type}`,{method:'POST',body:JSON.stringify(data||{})});
  setNotice(res.message||`Booking #${id} updated successfully.`);await load();
 }catch(e){setError((e as Error).message);}finally{setAction(null);}}
 function requestRefund(id:number){const reason=prompt('Reason for requesting a refund (minimum 8 characters). Requests must be submitted at least 24 hours before departure:');if(reason!==null)perform(id,'refund',{reason});}
 function review(id:number){const rating=Number(prompt('Rate your completed trip from 1 to 5 stars:','5'));if(!Number.isInteger(rating)||rating<1||rating>5)return;const comment=prompt('Optional review comment:','')||'';perform(id,'review',{rating,comment});}
 function issueInvoice(id:number){const billing_name=prompt('Invoice billing name:',passenger?.full_name||'');if(billing_name===null)return;const tax_code=prompt('Tax code (optional):','');if(tax_code===null)return;perform(id,'invoice',{billing_name,tax_code});}
 const created=params.get('created');const visible=list.filter(b=>showOld||b.status==='PENDING'||(b.status==='PAID'&&new Date(b.departure_at)>new Date()));
 return <div className="my-tickets-page"><div className="page-heading"><div><div className="eyebrow">YOUR INTERCITY ACCOUNT</div><h1>My bookings & tickets</h1><p>Track seat holds, confirm sandbox payments, and view booked journeys directly from PostgreSQL.</p></div><Link className="btn" href="/">Find another bus <ArrowRight size={16}/></Link></div>
 {created&&<div className="alert success">Booking #{created} was created. Complete the simulated payment within 15 minutes to confirm your ticket.</div>}
 {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}
 {!passenger&&checked?<div className="panel empty"><Ticket size={37}/><h2>Sign in to view your trips</h2><p>Your booking history is private to your passenger account.</p><Link className="btn" href="/account?next=/my-bookings">Passenger sign in / Register</Link></div>:<>
 <div className="bookings-controls"><label className="inline-controls"><span>Sandbox payment method:</span><select value={method} onChange={e=>setMethod(e.target.value)}>{methods.map(m=><option key={m.method_id} value={m.method_id}>{m.method_name}</option>)}</select></label><label className="inline-controls"><input type="checkbox" checked={showOld} onChange={e=>setShowOld(e.target.checked)}/> Show history</label><button className="btn secondary small" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
 {loading?<div className="panel empty">Loading your bookings...</div>:!visible.length?<div className="panel empty"><Ticket size={36}/><h2>No bookings yet</h2><p>Search the available departures and reserve seats to see your tickets here.</p><Link href="/" className="btn">Search departures</Link></div>:<div className="ticket-collection">{visible.map(b=><section className="panel booking-ticket" key={b.booking_id}>
  <div className="booking-ticket-top"><div><small>BOOKING #{b.booking_id} · {b.operator_name}</small><h2>{b.origin} <ArrowRight size={17}/> {b.destination}</h2><p>{dateTime(b.departure_at)} · Trip #{b.trip_id}</p></div><span className={`pill ${b.status==='PAID'?'success':b.status==='PENDING'?'blue':''}`}>{b.status}</span></div>
  <div className="booking-ticket-details"><div><span>Total amount</span><strong>{money(b.total_amount)}</strong></div><div><span>Tickets</span><strong>{b.tickets.length}</strong></div><div><span>Payment</span><strong>{b.payment_method||'Not yet confirmed'}</strong></div>{b.status==='PENDING'&&<div><span>Hold expires</span><strong>{dateTime(b.expires_at)}</strong></div>}</div>
  <div className="passenger-tickets">{b.tickets.map(t=><div key={t.ticket_id} className="passenger-ticket"><Ticket size={18}/><div><strong>{t.traveller_name} · Seat {t.seat_code}</strong><small>{t.pickup} → {t.dropoff}</small></div><span className="pill">{t.status}</span></div>)}</div>
  <div className="booking-ticket-actions">{b.status==='PENDING'&&<><button className="btn small" disabled={action===b.booking_id||new Date(b.expires_at)<=new Date()} onClick={()=>perform(b.booking_id,'pay',{method_id:Number(method)})}><CreditCard size={16}/> Confirm sandbox payment</button><button className="btn secondary small" disabled={action===b.booking_id} onClick={()=>{if(confirm('Release this unpaid booking and all held seats?'))perform(b.booking_id,'cancel');}}><Trash2 size={15}/> Cancel hold</button></>}
    {b.status==='PAID'&&<><button className="btn secondary small" onClick={()=>window.print()}><Printer size={15}/> Print ticket details</button>{!b.invoice_id?<button className="btn secondary small" disabled={action===b.booking_id} onClick={()=>issueInvoice(b.booking_id)}><Ticket size={15}/> Issue invoice</button>:<span className="pill success">Invoice #{b.invoice_id}</span>}{!b.refund_status&&new Date(b.departure_at).getTime()-Date.now()>86400000&&<button className="btn secondary small" disabled={action===b.booking_id} onClick={()=>requestRefund(b.booking_id)}><Wallet size={15}/> Request refund</button>}{b.trip_status==='COMPLETED'&&b.rating===null&&<button className="btn secondary small" onClick={()=>review(b.booking_id)}><Star size={15}/> Write a review</button>}</>}
    {b.refund_status&&<span className="pill blue">Refund: {b.refund_status}</span>}{b.rating!==null&&<span className="pill success">Reviewed: {b.rating} / 5</span>}
  </div></section>)}</div>}
 <div className="sandbox-banner"><CalendarClock size={20}/><div><strong>Payment demonstration only</strong><p>No funds are processed. Choosing “Confirm sandbox payment” stores a CAPTURED test payment and confirms the real database ticket records. Refund requests are recorded but are not paid out.</p></div></div></>}
 </div>;
}

export default function MyBookings(){return <Suspense fallback={<div className="panel empty">Loading account...</div>}><MyBookingsContents/></Suspense>;}
