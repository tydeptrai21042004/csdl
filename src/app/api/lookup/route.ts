import { queryRows } from '@/lib/db';
import { apiError, reply, requireAdmin } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 try {
  const url=new URL(request.url), kind=url.searchParams.get('kind');
  if (kind === 'public') {
    const [routes,operators,buses]= await Promise.all([
      queryRows(`SELECT r.route_id,r.operator_id, o.operator_name, a.station_name AS origin,b.station_name AS destination FROM route r JOIN bus_operator o ON o.operator_id=r.operator_id JOIN station a ON a.station_id=r.origin_station_id JOIN station b ON b.station_id=r.destination_station_id ORDER BY r.route_id`),
      queryRows('SELECT operator_id,operator_name FROM bus_operator ORDER BY operator_name'),
      queryRows('SELECT bus_id,operator_id,license_plate,bus_type FROM bus ORDER BY bus_id')
    ]);
    return reply({ routes, operators, buses });
  }
  const auth=await requireAdmin(); if(auth)return auth;
  if(kind==='seats') {
    const tripId=Number(url.searchParams.get('trip_id'));
    if(!Number.isInteger(tripId)||tripId<=0)return reply({error:'Valid trip ID required'},400);
    const [seats,stops]=await Promise.all([
      queryRows(`SELECT s.seat_id,s.seat_code,s.seat_class,ts.is_blocked,
       EXISTS(SELECT 1 FROM ticket tk WHERE tk.trip_id=ts.trip_id AND tk.seat_id=ts.seat_id AND tk.status IN ('HELD','CONFIRMED','USED')) AS occupied
       FROM trip_seat ts JOIN seat s ON s.seat_id=ts.seat_id WHERE ts.trip_id=$1 ORDER BY s.seat_code`,[tripId]),
      queryRows(`SELECT rs.stop_order,st.station_name,rs.pickup_allowed,rs.dropoff_allowed FROM route_stop rs
       JOIN station st ON st.station_id=rs.station_id JOIN trip t ON t.route_id=rs.route_id
       WHERE t.trip_id=$1 ORDER BY rs.stop_order`,[tripId])
    ]);
    return reply({seats,stops});
  }
  if(kind==='booking') {
    const [passengers,methods,promotions]=await Promise.all([
      queryRows('SELECT p.account_id,u.full_name FROM passenger_profile p JOIN user_account u ON u.account_id=p.account_id ORDER BY p.account_id'),
      queryRows('SELECT method_id,method_name,provider FROM payment_method ORDER BY method_id'),
      queryRows('SELECT promo_code,discount_type,discount_value FROM promotion WHERE valid_from<=now() AND valid_until>=now() ORDER BY promo_code')
    ]);
    return reply({passengers,methods,promotions});
  }
  return reply({error:'Unknown lookup kind'},400);
 }catch(e){return apiError(e);}
}
