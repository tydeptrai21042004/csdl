import { z } from 'zod';
import { callJson } from '@/lib/db';
import { apiError,reply } from '@/lib/api';
import { getPassenger } from '@/lib/passenger-auth';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getPassenger();if(!user)return reply({error:'Passenger sign in required.'},401);
  const id=z.coerce.number().int().positive().parse((await params).id);
  const {method_id}=z.object({method_id:z.number().int().positive()}).parse(await request.json());
  return reply(await callJson('sp_capture_passenger_demo_payment',[id,user.account_id,method_id]));
 }catch(e){return apiError(e);}
}
