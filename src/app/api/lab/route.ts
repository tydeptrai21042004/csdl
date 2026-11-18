import {z} from 'zod';
import {LAB_CASES,TABLES,LAB_GROUPS} from '@/lib/lab-cases';
import {executeLabCase,executeReadOnlySql,exploreTable} from '@/lib/lab-runner';
import {apiError,reply,requireAdmin} from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
export async function GET(request:Request){
 const auth=await requireAdmin();if(auth)return auth;
 try{
  const url=new URL(request.url),table=url.searchParams.get('table');
  if(table)return reply(await exploreTable(table));
  return reply({tables:TABLES,groups:LAB_GROUPS,cases:LAB_CASES});
 }catch(e){return apiError(e);}
}
export async function POST(request:Request){
 const auth=await requireAdmin();if(auth)return auth;
 try{
  const body=z.discriminatedUnion('action',[
   z.object({action:z.literal('test'),id:z.string().max(64)}),
   z.object({action:z.literal('select'),sql:z.string().max(4000)})
  ]).parse(await request.json());
  if(body.action==='test')return reply(await executeLabCase(body.id));
  return reply(await executeReadOnlySql(body.sql));
 }catch(e){
   const message=e instanceof Error?e.message:'';
   if(message.startsWith('Read-only console')||message==='Unknown test case ID.'||message==='Unknown table name.')return reply({error:message},400);
   const err=e as {code?:string;message?:string};
   if(err?.code && ['42601','42703','42P01','42883','25006','57014','42501'].includes(err.code)) return reply({error:`SQL ${err.code}: ${err.message}`},400);
   return apiError(e);
 }
}
