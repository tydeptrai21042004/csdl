import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { apiError,reply,requireAdmin } from '@/lib/api';
import { upgradeDatabase } from '@/lib/bootstrap';
export const runtime='nodejs';
export const maxDuration=60;
function eq(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export async function POST(request:Request){
 const auth=await requireAdmin();if(auth)return auth;
 const setupSecret=process.env.SETUP_TOKEN||'';
 if(setupSecret.length<24)return reply({error:'SETUP_TOKEN (24+ characters) is not configured.'},503);
 try{
  const b=z.object({token:z.string(),confirmation:z.literal('UPGRADE EXISTING DATABASE')}).parse(await request.json());
  if(!eq(b.token,setupSecret))return reply({error:'Incorrect setup token.'},403);
  return reply(await upgradeDatabase());
 }catch(e){const err=e as {code?:string;message?:string};if(err?.code&&err.message){
   return reply({error:`Upgrade failed (${err.code}): ${err.message.replace(/postgres(?:ql)?:\/\/\S+/gi,'[database URL redacted]')}`},400);
  }return apiError(e);}
}
