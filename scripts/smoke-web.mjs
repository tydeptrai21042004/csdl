/**
 * Executes REAL HTTP tests against a running Next.js production server and a
 * throwaway PostgreSQL database initialized with the Assignment 1 seed.
 *
 * WARNING: intentionally creates accounts, bookings and payments. DO NOT run
 * against a real/customer/production database. Only run in isolated CI/branch.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
if (process.env.SMOKE_ALLOW_MUTATIONS !== 'YES_ISOLATED_TEST_DATABASE') {
  console.error('Refusing to mutate database. Set SMOKE_ALLOW_MUTATIONS=YES_ISOLATED_TEST_DATABASE only for isolated test databases.');
  process.exit(2);
}
const checks = [];
function pass(message) { checks.push(message); console.log(`  PASS  ${message}`); }
async function request(path, { method='GET', body, cookie, status=200 }={}) {
  const res = await fetch(new URL(path, base), {
    method, cache:'no-store', redirect:'manual',
    headers:{...(body===undefined?{}:{'Content-Type':'application/json'}), ...(cookie?{Cookie:cookie}:{})},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const txt = await res.text();
  let payload;
  try { payload = JSON.parse(txt); } catch { payload = {raw:txt.slice(0,1200)}; }
  assert.equal(res.status,status,`${method} ${path}: expected ${status}, got ${res.status}: ${JSON.stringify(payload).slice(0,1000)}`);
  return { res, body:payload };
}
function sessionCookie(response, name) {
  const raw = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
  const value = raw.map(x=>x.split(';',1)[0]).find(x=>x.startsWith(`${name}=`));
  assert.ok(value,`Session cookie ${name} not set`);
  return value;
}
try {
  const home = await fetch(base);
  assert.equal(home.status,200,'public homepage should render');
  assert.match(await home.text(),/Travel further|Book with confidence/i);
  pass('public homepage serves actual rendered HTML');

  const health = await request('/api/health');
  assert.equal(health.body.status,'connected');
  pass('server API connects to real PostgreSQL');

  const catalog = (await request('/api/public/catalog')).body;
  assert.ok(catalog.stations.length>=5 && catalog.operators.length>=5 && catalog.methods.length>=5);
  pass('public catalog retrieves seeded stations/operators/payment methods');

  const listing = (await request('/api/public/trips')).body;
  assert.ok(listing.trips.length>=5,'future trips must come from seed');
  const trip = listing.trips.find(x=>Number(x.available_seats)>=4) || listing.trips[0];
  assert.ok(trip?.trip_id,'public trips must have a real trip ID');
  const tripId = Number(trip.trip_id);
  const detail = (await request(`/api/public/trips/${tripId}`)).body;
  assert.ok(detail.seats.length>=18 && detail.stops.length>=2);
  assert.equal(Number(detail.trip.trip_id), tripId);
  pass('real departures, stops and physical seats are connected');

  await request('/api/passenger/bookings',{status:401});
  await request('/api/lab',{status:401});
  pass('passenger/admin private routes reject anonymous callers');

  const serial = `${Date.now()}-${randomBytes(5).toString('hex')}`;
  const email = `smoke-${serial}@example.test`;
  const password = `Smoke#-${randomBytes(12).toString('hex')}`;
  const registration = await request('/api/passenger/auth',{
    method:'POST',status:201,body:{action:'register',email,password,full_name:'Smoke Test Passenger'}
  });
  const cookie = sessionCookie(registration.res,'intercity_passenger_session');
  assert.equal(registration.body.passenger.email,email);
  const authenticated=(await request('/api/passenger/auth',{cookie})).body;
  assert.equal(authenticated.passenger.email,email);
  pass('register and reauthenticate a real passenger with signed cookie');

  const available = detail.seats.filter(x=>!x.is_blocked&&!x.occupied).slice(0,4);
  assert.ok(available.length>=4,'test requires at least 4 available seats');
  const pickup=detail.stops.find(s=>s.pickup_allowed).stop_order;
  const dropoff=[...detail.stops].reverse().find(s=>s.dropoff_allowed).stop_order;
  assert.ok(dropoff>pickup);
  const payload = { trip_id:tripId, seats:available.slice(0,2).map((s,i)=>({seat_id:Number(s.seat_id),traveller_name:`Lab Traveller ${i+1}`})),pickup_stop_order:pickup,dropoff_stop_order:dropoff,promo_code:'SAVE10' };
  const newBooking = (await request('/api/passenger/bookings',{method:'POST',status:201,cookie,body:payload})).body;
  const bookingId=Number(newBooking.booking_id);
  assert.ok(bookingId>0);
  assert.equal(Number(newBooking.ticket_count),2);
  assert.ok(Number(newBooking.total_amount)>0);
  pass('stored procedure creates one booking with TWO tickets and promotion');

  const afterReserve = (await request(`/api/public/trips/${tripId}`)).body;
  assert.equal(Number(afterReserve.trip.available_seats),Number(detail.trip.available_seats)-2);
  assert.equal(afterReserve.seats.filter(s=>payload.seats.some(t=>t.seat_id==s.seat_id)&&s.occupied).length,2);
  pass('database triggers update live capacity and reserved seat map');

  // A second independent passenger cannot reserve the already-held seat.
  const email2=`smoke-second-${serial}@example.test`;
  const second=await request('/api/passenger/auth',{
    method:'POST',status:201,body:{action:'register',email:email2,password,full_name:'Second Passenger'}
  });
  const cookie2=sessionCookie(second.res,'intercity_passenger_session');
  const duplicate=await fetch(new URL('/api/passenger/bookings',base),{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie2},body:JSON.stringify({...payload,seats:[payload.seats[0]],promo_code:''})});
  assert.ok([400,409].includes(duplicate.status),`duplicate seat must be rejected, got ${duplicate.status}`);
  pass('second passenger cannot double-book a held seat');

  const mine=(await request('/api/passenger/bookings',{cookie})).body.bookings;
  const mineBooking=mine.find(b=>Number(b.booking_id)===bookingId);
  assert.equal(mineBooking.tickets.length,2);
  assert.equal(mineBooking.status,'PENDING');
  pass('authenticated ticket history returns own two-ticket booking');

  await request(`/api/passenger/bookings/${bookingId}/pay`,{method:'POST',cookie:cookie2,status:400,body:{method_id:Number(catalog.methods[0].method_id)}});
  const payment=(await request(`/api/passenger/bookings/${bookingId}/pay`,{method:'POST',cookie,body:{method_id:Number(catalog.methods[0].method_id)}})).body;
  assert.equal(payment.status,'PAID');
  const paid=(await request('/api/passenger/bookings',{cookie})).body.bookings.find(b=>Number(b.booking_id)===bookingId);
  assert.equal(paid.status,'PAID');
  assert.equal(paid.tickets.filter(t=>t.status==='CONFIRMED').length,2);
  pass('ownership-checked sandbox capture persists payment and confirms BOTH tickets');

  const invoice=(await request(`/api/passenger/bookings/${bookingId}/invoice`,{method:'POST',cookie,body:{billing_name:'Smoke Test Billing',tax_code:'SMOKE-TAX'}})).body;
  assert.ok(Number(invoice.invoice_id)>0);
  pass('paid booking issues a persistent invoice');

  const refund=(await request(`/api/passenger/bookings/${bookingId}/refund`,{method:'POST',cookie,body:{reason:'Test refund request ahead of departure'}})).body;
  assert.equal(refund.refund_status,'REQUESTED');
  pass('paid future booking can request a recorded refund');

  const hold=(await request('/api/passenger/bookings',{method:'POST',status:201,cookie,body:{...payload,promo_code:'',seats:[{seat_id:Number(available[2].seat_id),traveller_name:'Cancel Hold Traveller'}]}})).body;
  assert.ok(hold.booking_id);
  const cancel=(await request(`/api/passenger/bookings/${hold.booking_id}/cancel`,{method:'POST',cookie,body:{}})).body;
  assert.equal(cancel.status,'CANCELLED');
  const released=(await request(`/api/public/trips/${tripId}`)).body;
  assert.equal(Number(released.trip.available_seats),Number(detail.trip.available_seats)-2);
  pass('cancellation releases held seat without cancelling paid tickets');

  const adminUnauthorized=await request('/api/operations',{status:401});
  assert.ok(adminUnauthorized.body.error);
  if(process.env.ADMIN_PASSWORD) {
    const signIn=await request('/api/auth/login',{method:'POST',body:{password:process.env.ADMIN_PASSWORD}});
    const adminCookie=sessionCookie(signIn.res,'intercity_demo_admin');
    const lab=(await request('/api/lab',{cookie:adminCookie})).body;
    assert.ok(lab.cases.length>=40);
    assert.ok(lab.cases.some(c=>c.id==='sc06'));
    for (const tc of lab.cases) {
      const check=(await request('/api/lab',{method:'POST',cookie:adminCookie,body:{action:'test',id:tc.id}})).body;
      assert.equal(check.passed,true,`SQL lab case ${tc.id} failed: ${JSON.stringify(check)}`);
    }
    pass(`admin auth and all ${lab.cases.length} real PostgreSQL SQL-lab cases`);
  }

  const result = {passed:checks.length,checks};
  console.log(`\n${result.passed} full-stack HTTP integration checks passed.`);
} catch (e) { console.error('\nFULL-STACK SMOKE FAILED:', e.stack||String(e)); process.exitCode=1; }
