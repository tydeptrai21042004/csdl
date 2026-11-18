import {queryRows} from '@/lib/db';
import {apiError,reply} from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{
 const rows=await queryRows(`SELECT o.operator_id,o.operator_name,o.email,o.status,
    (SELECT count(*)::int FROM bus b WHERE b.operator_id=o.operator_id) AS buses,
    (SELECT count(*)::int FROM driver d WHERE d.operator_id=o.operator_id) AS drivers,
    (SELECT count(*)::int FROM route r WHERE r.operator_id=o.operator_id) AS routes,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('route_id',r.route_id,'origin',s1.station_name,'destination',s2.station_name,'distance_km',r.distance_km)),'[]'::jsonb)
      FROM route r JOIN station s1 ON s1.station_id=r.origin_station_id JOIN station s2 ON s2.station_id=r.destination_station_id WHERE r.operator_id=o.operator_id) AS route_list,
    (SELECT COALESCE(jsonb_agg(p.phone_number),'[]'::jsonb) FROM operator_phone p WHERE p.operator_id=o.operator_id) AS phone_numbers
   FROM bus_operator o WHERE o.status='APPROVED' ORDER BY o.operator_name`);
 return reply({operators:rows});
 }catch(e){return apiError(e);}}
