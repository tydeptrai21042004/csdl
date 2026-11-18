import { databaseStatus } from '@/lib/bootstrap';
import { apiError,reply,requireAdmin } from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET() {
  const auth=await requireAdmin(); if(auth)return auth;
  try{return reply({configured:Boolean(process.env.DATABASE_URL),...await databaseStatus()});}
  catch(e){return apiError(e);}
}
