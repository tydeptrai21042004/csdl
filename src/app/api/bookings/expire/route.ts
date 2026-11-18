import { callJson } from '@/lib/db';
import { requireAdmin,apiError,reply } from '@/lib/api';
export const runtime='nodejs';
export async function POST() {
 const auth=await requireAdmin();if(auth)return auth;
 try {return reply(await callJson('sp_expire_bookings'));}catch(e){return apiError(e);}
}
