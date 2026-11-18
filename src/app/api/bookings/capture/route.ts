import { z } from 'zod';
import { callJson } from '@/lib/db';
import { requireAdmin,apiError,reply } from '@/lib/api';
export const runtime='nodejs';
export async function POST(request:Request) {
 const auth=await requireAdmin();if(auth)return auth;
 try {
  const b=z.object({booking_id:z.coerce.number().int().positive(),method_id:z.coerce.number().int().positive()}).parse(await request.json());
  return reply(await callJson('sp_capture_demo_payment',[b.booking_id,b.method_id]));
 }catch(e){return apiError(e);}
}
