import 'server-only';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { queryRows } from '@/lib/db';

const scrypt = promisify(scryptCallback);
const COOKIE = 'intercity_passenger_session';
const LIFETIME = 60 * 60 * 24 * 7;
function secret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET is not configured.');
  return process.env.SESSION_SECRET;
}
function signature(payload: string) { return createHmac('sha256', secret()).update(`passenger:${payload}`).digest('hex'); }
function constantEquals(a:string,b:string) { const x=Buffer.from(a),y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); }
export async function hashPassword(password: string):Promise<string> {
  const salt=randomBytes(16).toString('hex');
  const digest=await scrypt(password,salt,64) as Buffer;
  return `scrypt$${salt}$${digest.toString('hex')}`;
}
export async function checkPassword(password:string,encoded:string):Promise<boolean> {
  const match=/^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
  if (!match) return false;
  const digest=await scrypt(password,match[1],64) as Buffer;
  return timingSafeEqual(digest,Buffer.from(match[2],'hex'));
}
export async function beginPassengerSession(accountId:number) {
  const payload=`${accountId}.${Math.floor(Date.now()/1000)+LIFETIME}.${randomBytes(16).toString('hex')}`;
  (await cookies()).set(COOKIE,`${payload}.${signature(payload)}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:LIFETIME});
}
export async function clearPassengerSession() {(await cookies()).delete(COOKIE);}
export async function getPassenger() {
  if (!process.env.SESSION_SECRET) return null;
  const token=(await cookies()).get(COOKIE)?.value||'';
  const match=/^(\d+)\.(\d+)\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if(!match||Number(match[2])<=Date.now()/1000||!constantEquals(signature(`${match[1]}.${match[2]}.${match[3]}`),match[4]))return null;
  const rows=await queryRows<{account_id:number;email:string;full_name:string;loyalty_points:number}>(
    `SELECT u.account_id,u.email,u.full_name,pp.loyalty_points FROM user_account u JOIN passenger_profile pp ON pp.account_id=u.account_id WHERE u.account_id=$1 AND u.status='ACTIVE'`,[Number(match[1])]);
  return rows[0]||null;
}
