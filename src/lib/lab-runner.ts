import 'server-only';
import {getPool} from '@/lib/db';
import {databaseUrl} from '@/lib/db-config';
import {pgOptions} from '@/lib/pg-options';
import {Client} from 'pg';
import {LAB_CASES,TABLES} from '@/lib/lab-cases';
import type {LabCase} from '@/lib/lab-cases';
export type LabResult={id:string;title:string;passed:boolean;message:string;rows:Record<string,unknown>[];durationMs:number;rolledBack:boolean};

export async function executeLabCase(id:string):Promise<LabResult> {
 const item=LAB_CASES.find(c=>c.id===id);
 if(!item) throw new Error('Unknown test case ID.');
 const started=Date.now(); const client=await getPool().connect();
 let passed=false,message='';let rows:Record<string,unknown>[]=[];
 try{
  await client.query('BEGIN');
  await client.query('SET LOCAL statement_timeout=6000');
  await client.query('SET LOCAL lock_timeout=2500');
  try{
   for(const sql of item.statements){
    const result=await client.query(sql);
    if(result.rows) rows=result.rows as Record<string,unknown>[];
   }
   if(item.expectError){message=`Expected PostgreSQL error ${item.expectError}, but SQL succeeded.`;}
   else if(item.expectTrue && rows[0]?.ok!==true){message='SQL assertion returned false (expected ok=true).';}
   else {passed=true;message='Expected database behavior confirmed.';}
  } catch(error){
    const e=error as {code?:string;message?:string};
    if(item.expectError && e.code===item.expectError && (!item.errorText||String(e.message).includes(item.errorText))){
      passed=true;message=`Expected rejection ${e.code}: ${e.message}`;
    }else{message=`Unexpected ${e.code || 'error'}: ${e.message||String(error)}`;}
  }
 }finally{
   await client.query('ROLLBACK').catch(()=>{});
   client.release();
 }
 return {id:item.id,title:item.title,passed,message,rows:rows.slice(0,15),durationMs:Date.now()-started,rolledBack:true};
}

export async function exploreTable(name:string) {
 if(!(TABLES as readonly string[]).includes(name)) throw new Error('Unknown table name.');
 // Table identifiers come exclusively from a server-owned whitelist.
 const [sample,stats]=await Promise.all([
  getPool().query(`SELECT * FROM public.${name} LIMIT 50`),
  getPool().query(`SELECT count(*)::int AS n FROM public.${name}`)
 ]);
 return {table:name,count:stats.rows[0].n,rows:sample.rows,columns:sample.fields.map(f=>f.name),limit:50};
}

export async function executeReadOnlySql(raw:string){
 const sql=raw.trim().replace(/;\s*$/,'');
 if(sql.length<6||sql.length>4000||!/^\s*(SELECT|WITH)\b/i.test(sql) || sql.includes(';') || /\b(SELECT\s+INTO|FOR\s+UPDATE|FOR\s+SHARE|LOCK\s+TABLE)\b/i.test(sql)){
  throw new Error('Read-only console accepts a single SELECT or WITH query (maximum 4,000 characters), without semicolons or row locks.');
 }
 const client=new Client({...pgOptions(databaseUrl()),connectionTimeoutMillis:8000});
 await client.connect();
 try{
  await client.query('BEGIN READ ONLY');
  await client.query('SET LOCAL statement_timeout=4000');
  await client.query('SET LOCAL lock_timeout=1500');
  // Read-only transaction forbids writes inside user-invoked volatile functions.
  const result=await client.query(`SELECT * FROM (${sql}) AS lab_read_only_query LIMIT 50`);
  return {columns:result.fields.map(x=>x.name),rows:result.rows,count:result.rowCount,truncated:result.rowCount===50};
 }finally{await client.query('ROLLBACK').catch(()=>{});await client.end();}
}
