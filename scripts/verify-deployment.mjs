/** Safe read-only verification of a deployed Vercel website with seeded Supabase data. */
import assert from 'node:assert/strict';
const base = process.env.DEPLOY_URL || process.argv[2];
if (!base || !/^https?:\/\//.test(base)) {
  console.error('Usage: DEPLOY_URL=https://your-project.vercel.app npm run verify:deploy');
  process.exit(2);
}
const url = (p) => new URL(p,base).href;
async function get(path) {
  const response=await fetch(url(path),{cache:'no-store',signal:AbortSignal.timeout(12000)});
  const payload=await response.text();
  assert.ok(response.ok,`${path} returned HTTP ${response.status}: ${payload.slice(0,300)}`);
  return {response,payload};
}
try {
 const html=await get('/');
 assert.match(html.payload, /Travel further|Book with confidence/);
 console.log('PASS public homepage: actual Next.js HTML');
 const health=JSON.parse((await get('/api/health')).payload);
 assert.equal(health.status,'connected');
 console.log('PASS PostgreSQL connection');
 const catalog=JSON.parse((await get('/api/public/catalog')).payload);
 assert.ok(catalog.operators?.length>=5 && catalog.stations?.length>=5 && catalog.methods?.length>=5);
 console.log(`PASS catalog: ${catalog.operators.length} operators, ${catalog.stations.length} stations`);
 const trips=JSON.parse((await get('/api/public/trips')).payload).trips;
 assert.ok(trips?.length>=5,'Expected live seeded upcoming trips');
 const trip=trips[0];
 const details=JSON.parse((await get(`/api/public/trips/${trip.trip_id}`)).payload);
 assert.equal(details.trip.trip_id,trip.trip_id);
 assert.ok(details.seats?.length>=18 && details.stops?.length>=2);
 console.log(`PASS trip #${trip.trip_id}: ${details.seats.length} real physical seats, ${details.stops.length} route stops`);
 console.log('\nDeployed read-only smoke checks passed. For real booking operations, run the isolated CI full-stack suite.');
} catch (e) {console.error('FAIL deployed website:',e.message);process.exitCode=1;}
