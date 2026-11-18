import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const paths=[
'src/app/page.tsx','src/app/account/page.tsx','src/app/checkout/[id]/page.tsx','src/app/my-bookings/page.tsx','src/app/operators/page.tsx',
'src/app/trips/page.tsx','src/app/bookings/page.tsx','src/app/reports/page.tsx','src/app/operations/page.tsx','src/app/lab/page.tsx','src/app/setup/page.tsx',
'src/app/api/public/catalog/route.ts','src/app/api/public/trips/route.ts','src/app/api/public/trips/[id]/route.ts',
'src/app/api/passenger/auth/route.ts','src/app/api/passenger/bookings/route.ts',
'src/app/api/passenger/bookings/[id]/pay/route.ts','src/app/api/passenger/bookings/[id]/cancel/route.ts','src/app/api/passenger/bookings/[id]/refund/route.ts','src/app/api/passenger/bookings/[id]/review/route.ts','src/app/api/passenger/bookings/[id]/invoice/route.ts',
'src/app/api/operations/route.ts','src/app/api/setup/upgrade/route.ts','database/05_upgrade_from_v2.sql'
];
const errors=[];
for(const p of paths)if(!existsSync(resolve(p)))errors.push('Missing '+p);
const logic=readFileSync('database/02_logic.sql','utf8');
for(const p of ['sp_place_multi_booking','sp_capture_passenger_demo_payment','sp_cancel_passenger_hold','sp_request_passenger_refund','sp_submit_passenger_review','sp_issue_passenger_invoice'])
 if(!logic.includes('CREATE OR REPLACE PROCEDURE '+p))errors.push('Missing business stored procedure '+p);
const call=readFileSync('src/lib/db.ts','utf8');
for(const p of ['sp_place_multi_booking','sp_capture_passenger_demo_payment','sp_cancel_passenger_hold','sp_request_passenger_refund','sp_submit_passenger_review','sp_issue_passenger_invoice'])
 if(!call.includes(`'${p}'`))errors.push('Procedure is not permitted by backend call allowlist: '+p);
const seed=readFileSync('database/03_seed.sql','utf8');
if(!seed.includes('generate_series(1,18)'))errors.push('Expected 18 seeded seats per operator');
if(!seed.includes('generate_series(1,5) b;'))errors.push('Missing future seeded trips');
const bundle=readFileSync('src/generated/db-bundle.ts','utf8');
if(!bundle.includes('05_upgrade_from_v2.sql'))errors.push('Bundled SQL missing upgrade script');
console.log(JSON.stringify({publicAndAdminFilesChecked:paths.length,passengerBusinessProcedures:6,seededSeatsPerBus:18,errors},null,2));
if(errors.length)process.exit(1);
