import { z } from 'zod';
import { callJson } from '@/lib/db';
import { apiError,reply } from '@/lib/api';
import { getPassenger } from '@/lib/passenger-auth';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getPassenger();if(!user)return reply({error:'Passenger sign in required.'},401);
  const b=z.object({billing_name:z.string().trim().min(2).max(150),tax_code:z.string().max(60).default('')}).parse(await request.json());
  return reply(await callJson('sp_issue_passenger_invoice',[z.coerce.number().int().positive().parse((await params).id),user.account_id,b.billing_name,b.tax_code]));
 }catch(e){return apiError(e);}
}
