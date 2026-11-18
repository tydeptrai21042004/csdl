import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { apiError,reply,requireAdmin } from '@/lib/api';
import { bootstrapDatabase } from '@/lib/bootstrap';
export const runtime='nodejs';
export const maxDuration=60;
function secureEquals(a:string,b:string) {const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export async function POST(request:Request) {
  const auth=await requireAdmin();if(auth)return auth;
  const setupSecret=process.env.SETUP_TOKEN || '';
  if(setupSecret.length<24)return reply({error:'SETUP_TOKEN (24+ characters) is not configured in Vercel.'},503);
  try{
    const {token,confirmation}=z.object({token:z.string(),confirmation:z.literal('INITIALIZE EMPTY DATABASE')}).parse(await request.json());
    if(!secureEquals(token,setupSecret)) return reply({error:'Incorrect setup token.'},403);
    return reply(await bootstrapDatabase());
  }catch(e){
    if(e instanceof Error && (e.message.startsWith('Database is already initialized')||e.message.startsWith('The public schema contains'))) return reply({error:e.message},409);
    const err=e as {code?:string;message?:string};
    if(err?.code && err.message){
      const safe=err.message.replace(/postgres(?:ql)?:\/\/\S+/gi,'[database URL redacted]');
      return reply({error:`PostgreSQL setup failed (${err.code}): ${safe}`},400);
    }
    return apiError(e);
  }
}
