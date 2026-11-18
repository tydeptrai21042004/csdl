import { z } from 'zod';
import { callJson } from '@/lib/db';
import { apiError,reply } from '@/lib/api';
import { getPassenger } from '@/lib/passenger-auth';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getPassenger();if(!user)return reply({error:'Passenger sign in required.'},401);
  const {reason}=z.object({reason:z.string().trim().min(8).max(500)}).parse(await request.json());
  return reply(await callJson('sp_request_passenger_refund',[z.coerce.number().int().positive().parse((await params).id),user.account_id,reason]));
 }catch(e){return apiError(e);}
}
