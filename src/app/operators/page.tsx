'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,BusFront,MapPin,Phone,Route as RouteIcon,Users} from 'lucide-react';
import {api} from '@/lib/client';
type R={route_id:number;origin:string;destination:string;distance_km:number};
type Op={operator_id:number;operator_name:string;email:string;buses:number;drivers:number;routes:number;route_list:R[];phone_numbers:string[]};
export default function Operators(){const [operators,setOperators]=useState<Op[]>([]),[error,setError]=useState('');useEffect(()=>{api<{operators:Op[]}>('/api/public/operators').then(x=>setOperators(x.operators)).catch(e=>setError((e as Error).message));},[]);
 return <div className="operators-page"><div className="page-heading"><div><div className="eyebrow">OUR BUS NETWORK</div><h1>Discover bus operators</h1><p>Explore bus companies, their routes and contact details before you book.</p></div><Link href="/" className="btn">Search scheduled trips <ArrowRight size={17}/></Link></div>{error&&<div className="alert error">{error}</div>}<div className="operator-cards">{operators.map(o=><article className="panel operator-card" key={o.operator_id}><div className="operator-title"><span className="operator-logo"><BusFront size={25}/></span><div><h2>{o.operator_name}</h2><p>{o.email}</p></div></div><div className="operator-counts"><span><BusFront size={17}/>{o.buses} buses</span><span><Users size={17}/>{o.drivers} drivers</span><span><RouteIcon size={17}/>{o.routes} routes</span></div><h3>Routes served</h3>{o.route_list.map(r=><div className="operator-route" key={r.route_id}><MapPin size={15}/><span>{r.origin} <ArrowRight size={13}/> {r.destination}</span><small>{r.distance_km} km</small></div>)}<div className="operator-footer"><Phone size={16}/>{o.phone_numbers.join(' · ')}</div></article>)}</div></div>;
}
