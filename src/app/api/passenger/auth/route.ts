import { z } from 'zod';
import { getPool, queryRows } from '@/lib/db';
import { apiError, reply } from '@/lib/api';
import { beginPassengerSession,checkPassword,clearPassengerSession,getPassenger,hashPassword } from '@/lib/passenger-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const email=z.string().trim().email().max(254).transform(s=>s.toLowerCase());
const password=z.string().min(10).max(128);
export async function GET(){ try{return reply({passenger:await getPassenger()});}catch(e){return apiError(e);} }
export async function POST(request:Request) {
 try{
  const body=z.discriminatedUnion('action',[
    z.object({action:z.literal('register'),email,password,full_name:z.string().trim().min(2).max(120)}),
    z.object({action:z.literal('login'),email,password:z.string().min(1).max(128)}),
    z.object({action:z.literal('logout')})]).parse(await request.json());
  if(body.action==='logout'){await clearPassengerSession();return reply({ok:true});}
  if(body.action==='login'){
    const rows=await queryRows<{account_id:number;password_hash:string}>(
      `SELECT u.account_id,u.password_hash FROM user_account u JOIN passenger_profile pp ON pp.account_id=u.account_id WHERE u.email=$1 AND u.status='ACTIVE'`,[body.email]);
    if(!rows[0] || !(await checkPassword(body.password,rows[0].password_hash)))return reply({error:'Invalid email or password.'},401);
    await beginPassengerSession(rows[0].account_id);
    return reply({ok:true,passenger:await getPassenger()});
  }
  const encoded=await hashPassword(body.password);
  const client=await getPool().connect();
  let id:number;
  try{
    await client.query('BEGIN');
    const row=await client.query<{account_id:number}>(`INSERT INTO user_account(email,password_hash,full_name) VALUES($1,$2,$3) RETURNING account_id`,[body.email,encoded,body.full_name]);
    id=Number(row.rows[0].account_id);
    await client.query(`INSERT INTO passenger_profile(account_id) VALUES($1)`,[id]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  await beginPassengerSession(id);
  return reply({ok:true,passenger:await getPassenger()},201);
 }catch(e){
   if((e as {code?:string}).code==='23505')return reply({error:'An account with that email address already exists.'},409);
   return apiError(e);
 }
}
