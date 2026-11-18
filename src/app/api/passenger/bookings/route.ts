import { z } from 'zod';
import { queryRows, callJson } from '@/lib/db';
import { apiError, reply } from '@/lib/api';
import { getPassenger } from '@/lib/passenger-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const user=await getPassenger();if(!user)return reply({error:'Passenger sign in required.'},401);
  await callJson('sp_expire_bookings');
  const bookings=await queryRows(`SELECT b.booking_id,b.trip_id,b.booked_at,b.expires_at,b.status,b.total_amount,b.discount_amount_applied,
    t.departure_at,t.arrival_at,t.status AS trip_status,op.operator_name,st1.station_name AS origin,st2.station_name AS destination,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('ticket_id',tk.ticket_id,'seat_code',s.seat_code,'traveller_name',tk.traveller_name,'fare',tk.fare_at_booking,'status',tk.status,'pickup',p.station_name,'dropoff',d.station_name))
      FROM ticket tk JOIN seat s ON s.seat_id=tk.seat_id
      JOIN route_stop rp ON rp.route_id=t.route_id AND rp.stop_order=tk.pickup_stop_order JOIN station p ON p.station_id=rp.station_id
      JOIN route_stop rd ON rd.route_id=t.route_id AND rd.stop_order=tk.dropoff_stop_order JOIN station d ON d.station_id=rd.station_id WHERE tk.booking_id=b.booking_id),'[]'::jsonb) AS tickets,
    (SELECT pm.method_name FROM payment py JOIN payment_method pm ON pm.method_id=py.method_id WHERE py.booking_id=b.booking_id AND py.payment_status='CAPTURED' LIMIT 1) AS payment_method,
    (SELECT rf.refund_status FROM refund rf JOIN payment py ON py.payment_id=rf.payment_id WHERE py.booking_id=b.booking_id LIMIT 1) AS refund_status,
    (SELECT rv.rating FROM review rv WHERE rv.booking_id=b.booking_id) AS rating,
    (SELECT i.invoice_id FROM invoice i WHERE i.booking_id=b.booking_id) AS invoice_id
    FROM booking b JOIN trip t ON t.trip_id=b.trip_id JOIN route r ON r.route_id=t.route_id
     JOIN bus_operator op ON op.operator_id=r.operator_id JOIN station st1 ON st1.station_id=r.origin_station_id
     JOIN station st2 ON st2.station_id=r.destination_station_id
    WHERE b.passenger_account_id=$1 ORDER BY b.booking_id DESC LIMIT 100`,[user.account_id]);
  return reply({bookings});
 }catch(e){return apiError(e);}
}
export async function POST(request:Request){
 try{
  const user=await getPassenger();if(!user)return reply({error:'Please sign in as a passenger before selecting your seat.'},401);
  const b=z.object({trip_id:z.number().int().positive(),seats:z.array(z.object({seat_id:z.number().int().positive(),traveller_name:z.string().trim().min(2).max(120)})).min(1).max(6),pickup_stop_order:z.number().int().positive(),dropoff_stop_order:z.number().int().positive(),promo_code:z.string().trim().max(30).optional().default('')}).parse(await request.json());
  const result=await callJson('sp_place_multi_booking',[user.account_id,b.trip_id,JSON.stringify(b.seats),b.pickup_stop_order,b.dropoff_stop_order,b.promo_code||null]);
  return reply(result,201);
 }catch(e){return apiError(e);}
}
