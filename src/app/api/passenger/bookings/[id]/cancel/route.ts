import { z } from 'zod';
import { callJson } from '@/lib/db';
import { apiError,reply } from '@/lib/api';
import { getPassenger } from '@/lib/passenger-auth';
export const runtime='nodejs';
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getPassenger();if(!user)return reply({error:'Passenger sign in required.'},401);
  return reply(await callJson('sp_cancel_passenger_hold',[z.coerce.number().int().positive().parse((await params).id),user.account_id]));
 }catch(e){return apiError(e);}
}
