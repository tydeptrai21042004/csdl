import {z} from 'zod';
import {queryRows} from '@/lib/db';
import {apiError,reply,requireAdmin} from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){const auth=await requireAdmin();if(auth)return auth;try{
 const [buses,drivers,stations,reviews,refunds,invoices]=await Promise.all([
 queryRows(`SELECT b.bus_id,b.license_plate,b.bus_type,b.deck_count,o.operator_name,(SELECT count(*)::int FROM seat s WHERE s.bus_id=b.bus_id) AS seat_count FROM bus b JOIN bus_operator o ON o.operator_id=b.operator_id ORDER BY b.bus_id`),
 queryRows(`SELECT d.driver_id,d.full_name,d.license_no,d.license_class,d.license_expiry,o.operator_name FROM driver d JOIN bus_operator o ON o.operator_id=d.operator_id ORDER BY d.driver_id`),
 queryRows(`SELECT station_id,station_name,city,province FROM station ORDER BY station_id`),
 queryRows(`SELECT rv.review_id,rv.rating,rv.comment,b.booking_id,u.full_name FROM review rv JOIN booking b ON b.booking_id=rv.booking_id JOIN user_account u ON u.account_id=b.passenger_account_id ORDER BY rv.review_id DESC LIMIT 30`),
 queryRows(`SELECT rf.refund_id,rf.amount,rf.refund_status,rf.reason,b.booking_id FROM refund rf JOIN payment p ON p.payment_id=rf.payment_id JOIN booking b ON b.booking_id=p.booking_id ORDER BY rf.refund_id DESC LIMIT 30`),
 queryRows(`SELECT invoice_id,booking_id,billing_name,tax_code,issued_at FROM invoice ORDER BY invoice_id DESC LIMIT 30`)]);
 return reply({buses,drivers,stations,reviews,refunds,invoices});
 }catch(e){return apiError(e);}}

export async function PATCH(request:Request){
 const auth=await requireAdmin();if(auth)return auth;
 try{
  const body=z.object({refund_id:z.number().int().positive(),decision:z.enum(['APPROVED','REJECTED'])}).parse(await request.json());
  const rows=await queryRows(`UPDATE refund SET refund_status=$2 WHERE refund_id=$1 AND refund_status='REQUESTED'
    RETURNING refund_id,refund_status`,[body.refund_id,body.decision]);
  if(!rows.length)return reply({error:'Refund request is missing or has already been decided.'},409);
  return reply({refund:rows[0],message:'Administrative refund decision saved. No bank transfer was made.'});
 }catch(e){return apiError(e);}
}
