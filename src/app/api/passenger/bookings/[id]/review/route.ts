import { z } from 'zod';
import { callJson } from '@/lib/db';
import { apiError,reply } from '@/lib/api';
import { getPassenger } from '@/lib/passenger-auth';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getPassenger();if(!user)return reply({error:'Passenger sign in required.'},401);
  const body=z.object({rating:z.number().int().min(1).max(5),comment:z.string().max(500).optional().default('')}).parse(await request.json());
  return reply(await callJson('sp_submit_passenger_review',[z.coerce.number().int().positive().parse((await params).id),user.account_id,body.rating,body.comment]));
 }catch(e){return apiError(e);}
}
