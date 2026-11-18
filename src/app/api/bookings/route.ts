import { callJson, queryRows } from '@/lib/db';
import { apiError, reply, requireAdmin } from '@/lib/api';
import { bookingBody } from '@/lib/validators';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
 const auth=await requireAdmin();if(auth)return auth;
 try {
   const bookings=await queryRows(`SELECT b.booking_id,b.trip_id,b.status,b.booked_at,b.expires_at,b.total_amount,
    u.full_name AS purchaser, t.departure_at, count(tk.ticket_id)::int AS ticket_count
    FROM booking b JOIN user_account u ON u.account_id=b.passenger_account_id JOIN trip t ON t.trip_id=b.trip_id
    LEFT JOIN ticket tk ON tk.booking_id=b.booking_id
    GROUP BY b.booking_id,u.full_name,t.departure_at ORDER BY b.booking_id DESC LIMIT 100`);
   return reply({bookings});
 }catch(e){return apiError(e);}
}
export async function POST(request:Request) {
 const auth=await requireAdmin();if(auth)return auth;
 try {
  const b=bookingBody.parse(await request.json());
  return reply(await callJson('sp_place_booking',[b.passenger_id,b.trip_id,b.seat_id,b.traveller_name,b.pickup_stop_order,b.dropoff_stop_order,b.promo_code||null]),201);
 }catch(e){return apiError(e);}
}
