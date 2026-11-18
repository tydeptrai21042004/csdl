import {queryRows} from '@/lib/db';
import {apiError,reply} from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const [stations,operators,promotions,methods]=await Promise.all([
   queryRows(`SELECT DISTINCT s.station_id,s.station_name,s.city FROM station s JOIN route r ON r.origin_station_id=s.station_id OR r.destination_station_id=s.station_id ORDER BY s.city,s.station_name`),
   queryRows(`SELECT operator_id,operator_name FROM bus_operator WHERE status='APPROVED' ORDER BY operator_name`),
   queryRows(`SELECT promo_code,discount_type,discount_value FROM promotion WHERE now() BETWEEN valid_from AND valid_until AND usage_limit>(SELECT count(*) FROM booking WHERE promotion_id=promotion.promotion_id AND status NOT IN ('EXPIRED','CANCELLED')) ORDER BY promo_code LIMIT 8`),
   queryRows(`SELECT method_id,method_name,provider FROM payment_method ORDER BY method_id`)
  ]);
  return reply({stations,operators,promotions,methods});
 }catch(e){return apiError(e);}
}
