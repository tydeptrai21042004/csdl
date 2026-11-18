import { queryRows,callJson } from '@/lib/db';
import { apiError,reply } from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const id=Number((await params).id);
  if(!Number.isSafeInteger(id)||id<=0)return reply({error:'Invalid trip.'},400);
  await callJson('sp_expire_bookings');
  const [trips,seats,stops]=await Promise.all([
   queryRows(`SELECT t.trip_id,t.route_id,t.departure_at,t.arrival_at,t.base_fare,t.available_seats,t.status,b.bus_type,b.deck_count,
     o.operator_name,s1.station_name AS origin,s2.station_name AS destination
     FROM trip t JOIN route r ON r.route_id=t.route_id JOIN bus_operator o ON o.operator_id=r.operator_id JOIN bus b ON b.bus_id=t.bus_id
     JOIN station s1 ON s1.station_id=r.origin_station_id JOIN station s2 ON s2.station_id=r.destination_station_id
     WHERE t.trip_id=$1 AND t.status='SCHEDULED' AND t.departure_at>now()`,[id]),
   queryRows(`SELECT s.seat_id,s.seat_code,s.seat_class,s.deck_no,ts.is_blocked,COALESCE(ts.fare_override,t.base_fare) AS fare,
    EXISTS(SELECT 1 FROM ticket tk WHERE tk.trip_id=ts.trip_id AND tk.seat_id=ts.seat_id AND tk.status IN ('HELD','CONFIRMED','USED')) AS occupied
    FROM trip_seat ts JOIN seat s ON s.seat_id=ts.seat_id JOIN trip t ON t.trip_id=ts.trip_id WHERE ts.trip_id=$1 ORDER BY s.deck_no,s.seat_code`,[id]),
   queryRows(`SELECT rs.stop_order,st.station_name,rs.offset_minutes,rs.pickup_allowed,rs.dropoff_allowed
     FROM route_stop rs JOIN station st ON st.station_id=rs.station_id JOIN trip t ON t.route_id=rs.route_id WHERE t.trip_id=$1 ORDER BY rs.stop_order`,[id])
  ]);
  if(!trips[0])return reply({error:'Trip is not available.'},404);
  return reply({trip:trips[0],seats,stops});
 }catch(e){return apiError(e);}
}
