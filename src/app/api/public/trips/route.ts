import { z } from 'zod';
import { queryRows,callJson } from '@/lib/db';
import { apiError,reply } from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const q=new URL(request.url).searchParams;
  const origin=q.has('origin')?z.coerce.number().int().positive().parse(q.get('origin')):null;
  const destination=q.has('destination')?z.coerce.number().int().positive().parse(q.get('destination')):null;
  const date=q.get('date')||null;
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return reply({error:'Travel date must be YYYY-MM-DD.'},400);
  const operator=q.has('operator')?z.coerce.number().int().positive().parse(q.get('operator')):null;
  // Expire stale unpaid holds before publishing availability.
  await callJson('sp_expire_bookings');
  const rows=await queryRows(`SELECT t.trip_id,t.departure_at,t.arrival_at,t.base_fare,t.available_seats,t.status,
    r.route_id,r.distance_km,o.operator_id,o.operator_name,
    s1.station_id AS origin_id,s1.station_name AS origin,s1.city AS origin_city,
    s2.station_id AS destination_id,s2.station_name AS destination,s2.city AS destination_city,
    bus.bus_type,bus.deck_count, EXTRACT(EPOCH FROM (t.arrival_at-t.departure_at))/60 AS duration_minutes
   FROM trip t JOIN route r ON r.route_id=t.route_id JOIN bus_operator o ON o.operator_id=r.operator_id
   JOIN station s1 ON s1.station_id=r.origin_station_id JOIN station s2 ON s2.station_id=r.destination_station_id JOIN bus ON bus.bus_id=t.bus_id
   WHERE t.status='SCHEDULED' AND t.departure_at>now() AND o.status='APPROVED'
     AND ($1::bigint IS NULL OR s1.station_id=$1) AND ($2::bigint IS NULL OR s2.station_id=$2)
     AND ($3::date IS NULL OR (t.departure_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date=$3::date)
     AND ($4::bigint IS NULL OR o.operator_id=$4)
   ORDER BY t.departure_at,t.base_fare,t.trip_id LIMIT 120`,[origin,destination,date,operator]);
  return reply({trips:rows});
 }catch(e){return apiError(e);}
}
