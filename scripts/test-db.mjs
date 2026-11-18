import { setupConnectionUrl } from './db-env.mjs';
import dotenv from 'dotenv';
import pg from 'pg';
import { pgOptions } from './pg-options.mjs';
dotenv.config({path:'.env.local'});dotenv.config();
const connectionString=setupConnectionUrl();
if(!connectionString) {console.error('DATABASE_URL_UNPOOLED is missing.');process.exit(1);}
const client=new pg.Client(pgOptions(connectionString));
function ensure(ok,message){if(!ok)throw new Error(message);console.log('  PASS:',message);}
try{
 await client.connect();
 const tableNames=['user_account','passenger_profile','operator_staff','platform_admin','bus_operator','operator_phone','driver','bus','seat','station','route','route_stop','trip','trip_seat','trip_driver_assignment','promotion','booking','ticket','payment_method','payment','refund','invoice','review'];
 for(const table of tableNames){const r=await client.query(`SELECT count(*)::int AS n FROM ${table}`);ensure(r.rows[0].n>=5,`${table}: >=5 records (${r.rows[0].n})`);}
 const rls=await client.query(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relname=ANY($1::text[])`,[tableNames]);
 ensure(rls.rows[0].n===23,'RLS is enabled on all 23 application tables');
 const procedures=await client.query('CALL sp_search_trips($1::text,$2::text,$3::bigint,$4::jsonb)',[null,'SCHEDULED',null,'[]']);
 ensure(Array.isArray(procedures.rows[0].p_result),'sp_search_trips returns JSON array');
 const summary=await client.query('CALL sp_operator_summary($1::date,$2::date,$3::int,$4::jsonb)',[new Date(Date.now()-90*86400000).toISOString().slice(0,10),new Date(Date.now()+90*86400000).toISOString().slice(0,10),1,'[]']);
 ensure(Array.isArray(summary.rows[0].p_result),'sp_operator_summary returns JSON array');
 const f=await client.query('SELECT fn_driver_workload_hours(1,current_date-90,current_date+90) AS hours, fn_passenger_captured_spend(201,current_date-90,current_date+90) AS spend');
 ensure(Number(f.rows[0].hours)>0 && Number(f.rows[0].spend)>0,'both cursor functions return computed values');
 await client.query('BEGIN');
 try{
   const before=await client.query('SELECT available_seats FROM trip WHERE trip_id=6');
   await client.query('UPDATE trip_seat SET is_blocked=true WHERE trip_id=6 AND seat_id=2');
   const after=await client.query('SELECT available_seats FROM trip WHERE trip_id=6');
   ensure(after.rows[0].available_seats===before.rows[0].available_seats-1,'trigger recomputes available seats');
 }finally{await client.query('ROLLBACK');}
 await client.query('BEGIN');
 try{
  const dep=new Date(Date.now()+95*86400000),arr=new Date(dep.getTime()+6*3600000);
  const c=await client.query('CALL sp_create_trip($1::bigint,$2::bigint,$3::timestamptz,$4::timestamptz,$5::numeric,$6::jsonb)',[1,1,dep.toISOString(),arr.toISOString(),280000,'{}']);
  const id=Number(c.rows[0].p_result.trip_id);
  ensure(id>0,'sp_create_trip inserts a scheduled trip');
  const inventory=await client.query('SELECT count(*)::int AS n FROM trip_seat WHERE trip_id=$1',[id]);
  ensure(inventory.rows[0].n===18,'new trip automatically gets 18 seats');
  const u=await client.query('CALL sp_update_trip($1::bigint,$2::bigint,$3::bigint,$4::timestamptz,$5::timestamptz,$6::numeric,$7::text,$8::jsonb)',[id,1,1,dep.toISOString(),arr.toISOString(),290000,'SCHEDULED','{}']);
  ensure(u.rows[0].p_result.trip_id===id,'sp_update_trip updates fare');
  const d=await client.query('CALL sp_delete_trip($1::bigint,$2::jsonb)',[id,'{}']);
  ensure(d.rows[0].p_result.trip_id===id,'sp_delete_trip removes unbooked trip');
 }finally{await client.query('ROLLBACK');}
 await client.query('BEGIN');
 try{
  let rejected=false;
  try {await client.query('INSERT INTO trip_seat(trip_id,seat_id) VALUES(6,19)');} catch(e){rejected=String(e.message).includes('does not belong');}
  ensure(rejected,'business trigger blocks seat from another bus');
 }finally{await client.query('ROLLBACK');}

 await client.query('BEGIN');
 try {
  const current=await client.query('SELECT available_seats FROM trip WHERE trip_id=6');
  const reserve=await client.query('CALL sp_place_booking($1::bigint,$2::bigint,$3::bigint,$4::text,$5::int,$6::int,$7::text,$8::jsonb)',[201,6,2,'Runtime Test Traveller',1,3,null,'{}']);
  const bookingId=Number(reserve.rows[0].p_result.booking_id);
  ensure(bookingId>0,'seat reservation procedure creates a booking');
  const occupied=await client.query('SELECT available_seats FROM trip WHERE trip_id=6');
  ensure(occupied.rows[0].available_seats===current.rows[0].available_seats-1,'reservation decrements available_seats');
  await client.query('SAVEPOINT sp_duplicate');
  let duplicateBlocked=false;
  try {await client.query('CALL sp_place_booking($1::bigint,$2::bigint,$3::bigint,$4::text,$5::int,$6::int,$7::text,$8::jsonb)',[202,6,2,'Another Test Traveller',1,3,null,'{}']);}
  catch(err){duplicateBlocked=String(err.message).includes('already held')||err.code==='23505';}
  await client.query('ROLLBACK TO SAVEPOINT sp_duplicate');
  ensure(duplicateBlocked,'duplicate reservation is rejected');
  const paid=await client.query('CALL sp_capture_demo_payment($1::bigint,$2::bigint,$3::jsonb)',[bookingId,1,'{}']);
  ensure(paid.rows[0].p_result.status==='PAID','sandbox payment marks booking paid');
  const confirmed=await client.query('SELECT status FROM ticket WHERE booking_id=$1',[bookingId]);
  ensure(confirmed.rows[0].status==='CONFIRMED','ticket becomes confirmed after sandbox payment');
 } finally {await client.query('ROLLBACK');}
 console.log('\nDatabase checks passed.');
}catch(e){console.error('\nTEST FAILED:',e.stack||e.message);process.exitCode=1;}finally{await client.end();}
