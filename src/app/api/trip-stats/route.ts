import { z } from 'zod';
import { callJson,queryRows } from '@/lib/db';
import { apiError,reply,requireAdmin } from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 const auth=await requireAdmin();if(auth)return auth;
 try {
  const url=new URL(request.url);
  const from=url.searchParams.get('from') || new Date(Date.now()-1000*86400*90).toISOString().slice(0,10);
  const to=url.searchParams.get('to') || new Date(Date.now()+1000*86400*90).toISOString().slice(0,10);
  const min=z.coerce.number().int().min(0).max(1000).parse(url.searchParams.get('min') || '1');
  const [fromDate,toDate]=[from,to];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)||!/^\d{4}-\d{2}-\d{2}$/.test(toDate))return reply({error:'Invalid date format'},400);
  const summary=await callJson('sp_operator_summary',[fromDate,toDate,min]);
  const stats=await queryRows(`SELECT (SELECT count(*)::int FROM trip) AS trips,
    (SELECT count(*)::int FROM bus_operator) AS operators,
    (SELECT count(*)::int FROM booking) AS bookings,
    (SELECT count(*)::int FROM ticket WHERE status IN ('HELD','CONFIRMED','USED')) AS occupied_seats`);
  return reply({summary,stats:stats[0]});
 }catch(e){return apiError(e);}
}
export async function POST(request:Request) {
 const auth=await requireAdmin();if(auth)return auth;
 try {
  const b=z.object({kind:z.enum(['driver','passenger']),id:z.coerce.number().int().positive(),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse(await request.json());
  const fn=b.kind==='driver'?'fn_driver_workload_hours':'fn_passenger_captured_spend';
  const rows=await queryRows<{value:string}>(`SELECT ${fn}($1::bigint,$2::date,$3::date) AS value`,[b.id,b.from,b.to]);
  return reply({value:Number(rows[0]?.value),unit:b.kind==='driver'?'hours':'VND'});
 }catch(e){return apiError(e);}
}
