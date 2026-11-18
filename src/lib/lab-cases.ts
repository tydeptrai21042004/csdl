/* Predetermined SQL demonstrations. The browser selects IDs, never submits write SQL. */
export const TABLES=[
 'user_account','passenger_profile','operator_staff','platform_admin','bus_operator',
 'operator_phone','driver','bus','seat','station','route','route_stop','trip','trip_seat',
 'trip_driver_assignment','promotion','booking','ticket','payment_method','payment',
 'refund','invoice','review'
] as const;
export type LabCase={
 id:string;section:string;title:string;purpose:string;statements:string[];
 expectError?:string;errorText?:string;expectTrue?:boolean;
};
const counts=TABLES.map(t=>`SELECT '${t}' AS table_name,count(*)::int AS n FROM ${t}`).join('\nUNION ALL ');
const createTrip="CALL sp_create_trip(1,1,now()+interval '380 days',now()+interval '380 days 6 hours',250000,'{}'::jsonb)";
export const LAB_CASES:LabCase[]=[
 {id:'meta-tables',section:'Schema and sample data',title:'All 23 relational tables',purpose:'Shows the 23 Assignment 1 relations.',statements:[`SELECT count(*)::int=23 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`],expectTrue:true},
 {id:'meta-seed',section:'Schema and sample data',title:'At least five rows in every table',purpose:'Checks every relation and minimum seed requirement.',statements:[`SELECT bool_and(n>=5) AS ok FROM (${counts}) AS counts`],expectTrue:true},
 {id:'meta-keys',section:'Schema and sample data',title:'Primary/foreign/unique key metadata',purpose:'Queries PostgreSQL system metadata for real constraints.',statements:[`SELECT count(*)>=45 AS ok FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype IN ('p','f','u','c','x')`],expectTrue:true},
 {id:'meta-triggers',section:'Schema and sample data',title:'Installed business triggers',purpose:'Verifies database-level trigger installation.',statements:[`SELECT count(*)>=15 AS ok FROM information_schema.triggers WHERE trigger_schema='public'`],expectTrue:true},
 {id:'meta-routines',section:'Schema and sample data',title:'Stored procedures and cursor functions',purpose:'Verifies required SQL routines exist.',statements:[`SELECT (SELECT count(DISTINCT p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='p')>=8 AND (SELECT count(DISTINCT p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('fn_driver_workload_hours','fn_passenger_captured_spend'))=2 AS ok`],expectTrue:true},
 {id:'proc-search',section:'Required procedures and functions',title:'Query procedure: filtered trip search',purpose:'WHERE + multi-table joins + ORDER BY.',statements:[`CALL sp_search_trips('Mien Dong','SCHEDULED',NULL,'[]'::jsonb)`]},
 {id:'proc-summary',section:'Required procedures and functions',title:'Query procedure: operator summary',purpose:'JOIN + WHERE + GROUP BY + HAVING + ORDER BY.',statements:[`CALL sp_operator_summary(current_date-120,current_date+120,1,'[]'::jsonb)`]},
 {id:'func-driver',section:'Required procedures and functions',title:'Cursor function: driver workload',purpose:'Parameterized cursor loop and accumulated workload hours.',statements:[`SELECT fn_driver_workload_hours(1,current_date-120,current_date+120) AS workload_hours`]},
 {id:'func-spend',section:'Required procedures and functions',title:'Cursor function: passenger spend',purpose:'Parameterized cursor loop and captured-payment total.',statements:[`SELECT fn_passenger_captured_spend(201,current_date-120,current_date+120) AS captured_vnd`]},
 {id:'proc-create',section:'Required procedures and functions',title:'CREATE trip procedure',purpose:'Stored procedure inserts a future trip and automatically creates trip-specific seats.',statements:[createTrip]},
 {id:'proc-crud',section:'Required procedures and functions',title:'Complete CREATE → UPDATE → DELETE',purpose:'Executes three stored procedures in one rolled-back transaction.',statements:[`DO $$ DECLARE v jsonb:='{}'; id bigint; BEGIN
 CALL sp_create_trip(1,1,now()+interval '381 days',now()+interval '381 days 6 hours',250000,v);
 id:=(v->>'trip_id')::bigint;
 IF (SELECT count(*) FROM trip_seat WHERE trip_id=id)<>18 THEN RAISE EXCEPTION 'Inventory missing'; END IF;
 CALL sp_update_trip(id,1,1,now()+interval '381 days',now()+interval '381 days 6 hours',260000,'SCHEDULED',v);
 IF (SELECT base_fare FROM trip WHERE trip_id=id)<>260000 THEN RAISE EXCEPTION 'Update failed'; END IF;
 CALL sp_delete_trip(id,v);
 IF EXISTS(SELECT 1 FROM trip WHERE trip_id=id) THEN RAISE EXCEPTION 'Delete failed'; END IF;
 END $$;`]},
 {id:'derived-seats',section:'Required procedures and functions',title:'Derived-attribute trigger: available_seats',purpose:'Block an available seat; database trigger must recompute the seat count.',statements:[`DO $$ DECLARE n int; actual int; seat_id_to_block bigint; BEGIN
 SELECT available_seats INTO n FROM trip WHERE trip_id=6;
 SELECT ts.seat_id INTO seat_id_to_block FROM trip_seat ts WHERE ts.trip_id=6 AND NOT ts.is_blocked AND NOT EXISTS(SELECT 1 FROM ticket t WHERE t.trip_id=6 AND t.seat_id=ts.seat_id AND t.status IN ('HELD','CONFIRMED','USED')) LIMIT 1;
 IF seat_id_to_block IS NULL THEN RAISE EXCEPTION 'Demo trip 6 has no free seat'; END IF;
 UPDATE trip_seat SET is_blocked=true WHERE trip_id=6 AND seat_id=seat_id_to_block;
 SELECT available_seats INTO actual FROM trip WHERE trip_id=6;
 IF actual<>n-1 THEN RAISE EXCEPTION 'Capacity trigger failed: before %, after %',n,actual; END IF;
 END $$;`]},
 {id:'booking-flow',section:'Required procedures and functions',title:'Booking hold → sandbox payment',purpose:'Exercises seat allocation, captured payment and ticket confirmation.',statements:[`DO $$ DECLARE v jsonb:='{}'; b bigint; s bigint; BEGIN
 SELECT ts.seat_id INTO s FROM trip_seat ts WHERE ts.trip_id=6 AND NOT ts.is_blocked AND NOT EXISTS(SELECT 1 FROM ticket tk WHERE tk.trip_id=6 AND tk.seat_id=ts.seat_id AND tk.status IN ('HELD','CONFIRMED','USED')) LIMIT 1;
 IF s IS NULL THEN RAISE EXCEPTION 'No free demonstration seat in trip 6'; END IF;
 CALL sp_place_booking(201,6,s,'Browser Test Passenger',1,3,NULL,v);
 b:=(v->>'booking_id')::bigint;
 CALL sp_capture_demo_payment(b,1,v);
 IF (SELECT status FROM booking WHERE booking_id=b)<>'PAID' THEN RAISE EXCEPTION 'Payment capture did not settle booking'; END IF;
 IF (SELECT status FROM ticket WHERE booking_id=b)<>'CONFIRMED' THEN RAISE EXCEPTION 'Ticket not confirmed'; END IF;
 END $$;`]},
 {id:'multi-seat',section:'Required procedures and functions',title:'One booking with multiple tickets',purpose:'Assignment 1 Booking–Ticket 1:N; reserves two distinct seats in one transaction.',statements:[`DO $$ DECLARE v jsonb:='{}'; ids jsonb; BEGIN
  SELECT jsonb_agg(jsonb_build_object('seat_id',q.seat_id,'traveller_name','Test Passenger '||q.seat_code)) INTO ids
  FROM (SELECT s.seat_id,s.seat_code FROM trip_seat ts JOIN seat s ON s.seat_id=ts.seat_id WHERE ts.trip_id=6 AND NOT ts.is_blocked
  AND NOT EXISTS(SELECT 1 FROM ticket tk WHERE tk.trip_id=ts.trip_id AND tk.seat_id=ts.seat_id AND tk.status IN ('HELD','CONFIRMED','USED')) ORDER BY s.seat_id LIMIT 2) q;
  IF jsonb_array_length(ids)<>2 THEN RAISE EXCEPTION 'Two available seats required'; END IF;
  CALL sp_place_multi_booking(201,6,ids,1,3,NULL,v);
  IF (SELECT count(*) FROM ticket WHERE booking_id=(v->>'booking_id')::bigint)<>2 THEN RAISE EXCEPTION 'Did not issue both ticket rows'; END IF;
  END $$;`]},

 {id:'passenger-capture',section:'Passenger website procedures',title:'Passenger-owned payment confirmation',purpose:'Tests the ownership-checked payment procedure and ticket confirmation.',statements:[`DO $$ DECLARE v jsonb:='{}'; b bigint; sid bigint; BEGIN
  SELECT seat_id INTO sid FROM trip_seat ts WHERE ts.trip_id=6 AND NOT ts.is_blocked AND NOT EXISTS(SELECT 1 FROM ticket tk WHERE tk.trip_id=6 AND tk.seat_id=ts.seat_id AND tk.status IN ('HELD','CONFIRMED','USED')) LIMIT 1;
  CALL sp_place_multi_booking(201,6,jsonb_build_array(jsonb_build_object('seat_id',sid,'traveller_name','Payment Lab Traveller')),1,3,NULL,v);
  b:=(v->>'booking_id')::bigint;
  CALL sp_capture_passenger_demo_payment(b,201,1,v);
  IF (SELECT status FROM booking WHERE booking_id=b)<>'PAID' OR (SELECT count(*) FROM ticket WHERE booking_id=b AND status='CONFIRMED')<>1 THEN RAISE EXCEPTION 'Passenger payment workflow failed'; END IF;
 END $$;`]},
 {id:'passenger-cancel',section:'Passenger website procedures',title:'Passenger cancels unpaid hold',purpose:'Cancels a pending booking and releases its reserved seat.',statements:[`DO $$ DECLARE v jsonb:='{}'; b bigint; sid bigint; before_count int; BEGIN
  SELECT available_seats INTO before_count FROM trip WHERE trip_id=6;
  SELECT seat_id INTO sid FROM trip_seat ts WHERE ts.trip_id=6 AND NOT ts.is_blocked AND NOT EXISTS(SELECT 1 FROM ticket tk WHERE tk.trip_id=6 AND tk.seat_id=ts.seat_id AND tk.status IN ('HELD','CONFIRMED','USED')) LIMIT 1;
  CALL sp_place_multi_booking(201,6,jsonb_build_array(jsonb_build_object('seat_id',sid,'traveller_name','Cancel Lab Traveller')),1,3,NULL,v);
  b:=(v->>'booking_id')::bigint;
  CALL sp_cancel_passenger_hold(b,201,v);
  IF (SELECT status FROM booking WHERE booking_id=b)<>'CANCELLED' OR (SELECT available_seats FROM trip WHERE trip_id=6)<>before_count THEN RAISE EXCEPTION 'Unpaid seat hold was not released'; END IF;
 END $$;`]},
 {id:'passenger-refund',section:'Passenger website procedures',title:'Request refund for a paid future trip',purpose:'Tests payment capture, refund eligibility, amount and request status.',statements:[`DO $$ DECLARE v jsonb:='{}'; b bigint; sid bigint; BEGIN
  SELECT seat_id INTO sid FROM trip_seat ts WHERE ts.trip_id=6 AND NOT ts.is_blocked AND NOT EXISTS(SELECT 1 FROM ticket tk WHERE tk.trip_id=6 AND tk.seat_id=ts.seat_id AND tk.status IN ('HELD','CONFIRMED','USED')) LIMIT 1;
  CALL sp_place_multi_booking(201,6,jsonb_build_array(jsonb_build_object('seat_id',sid,'traveller_name','Refund Lab Traveller')),1,3,NULL,v);
  b:=(v->>'booking_id')::bigint;
  CALL sp_capture_passenger_demo_payment(b,201,1,v);
  CALL sp_request_passenger_refund(b,201,'Travel plans changed before departure',v);
  IF (SELECT count(*) FROM refund r JOIN payment p ON p.payment_id=r.payment_id WHERE p.booking_id=b AND r.refund_status='REQUESTED')<>1 THEN RAISE EXCEPTION 'Refund request not created'; END IF;
 END $$;`]},
 {id:'passenger-invoice',section:'Passenger website procedures',title:'Issue invoice after payment',purpose:'Checks Booking–Invoice 1:0..1 relation after successful sandbox payment.',statements:[`DO $$ DECLARE v jsonb:='{}'; b bigint; sid bigint; BEGIN
  SELECT seat_id INTO sid FROM trip_seat ts WHERE ts.trip_id=6 AND NOT ts.is_blocked AND NOT EXISTS(SELECT 1 FROM ticket tk WHERE tk.trip_id=6 AND tk.seat_id=ts.seat_id AND tk.status IN ('HELD','CONFIRMED','USED')) LIMIT 1;
  CALL sp_place_multi_booking(201,6,jsonb_build_array(jsonb_build_object('seat_id',sid,'traveller_name','Invoice Lab Traveller')),1,3,NULL,v);
  b:=(v->>'booking_id')::bigint;
  CALL sp_capture_passenger_demo_payment(b,201,1,v);
  CALL sp_issue_passenger_invoice(b,201,'Test Invoice Holder','TEST-123',v);
  IF (SELECT count(*) FROM invoice WHERE booking_id=b AND tax_code='TEST-123')<>1 THEN RAISE EXCEPTION 'Invoice not saved'; END IF;
 END $$;`]},
 {id:'passenger-review',section:'Passenger website procedures',title:'Review a completed paid trip',purpose:'Tests review procedure plus SC16 qualifying booking/ticket rules.',statements:[`DO $$ DECLARE v jsonb:='{}'; b bigint; BEGIN
  INSERT INTO booking(passenger_account_id,trip_id,expires_at) VALUES(201,1,now()+interval '20 minutes') RETURNING booking_id INTO b;
  INSERT INTO ticket(booking_id,trip_id,seat_id,traveller_name,pickup_stop_order,dropoff_stop_order,fare_at_booking,status)
    VALUES(b,1,2,'Review Lab Traveller',1,3,170000,'HELD');
  INSERT INTO payment(booking_id,method_id,amount,payment_status,transaction_ref,paid_at)
    VALUES(b,1,170000,'CAPTURED','LAB-REVIEW-'||b,now());
  UPDATE booking SET status='PAID' WHERE booking_id=b;
  UPDATE ticket SET status='CONFIRMED' WHERE booking_id=b;
  UPDATE ticket SET status='USED' WHERE booking_id=b;
  CALL sp_submit_passenger_review(b,201,5,'Completed lab journey',v);
  IF (SELECT count(*) FROM review WHERE booking_id=b AND rating=5)<>1 THEN RAISE EXCEPTION 'Review was not stored'; END IF;
 END $$;`]},
 {id:'sc01',section:'Semantic constraints SC01–SC18',title:'SC01 · Route must connect distinct stations',purpose:'CHECK constraint rejects identical origin and destination.',statements:[`UPDATE route SET destination_station_id=origin_station_id WHERE route_id=1`],expectError:'23514'},
 {id:'sc02',section:'Semantic constraints SC01–SC18',title:'SC02 · Route endpoints must match ordered stops',purpose:'Deferred cross-table trigger rejects invalid endpoint.',statements:[`UPDATE route_stop SET station_id=2 WHERE route_id=1 AND stop_order=1`,`SET CONSTRAINTS ALL IMMEDIATE`],expectError:'23514',errorText:'must begin at its origin'},
 {id:'sc03',section:'Semantic constraints SC01–SC18',title:'SC03 · Stop offsets cannot decrease',purpose:'Deferred weak-entity route-stop trigger.',statements:[`UPDATE route_stop SET offset_minutes=9999 WHERE route_id=1 AND stop_order=2`,`SET CONSTRAINTS ALL IMMEDIATE`],expectError:'23514',errorText:'must not decrease'},
 {id:'sc04',section:'Semantic constraints SC01–SC18',title:'SC04 · Arrival must follow departure',purpose:'CHECK for trip timing.',statements:[`UPDATE trip SET arrival_at=departure_at-interval '1 hour' WHERE trip_id=6`],expectError:'23514'},
 {id:'sc05',section:'Semantic constraints SC01–SC18',title:'SC05 · Trip bus and route same operator',purpose:'Business trigger blocks cross-operator allocation.',statements:[`UPDATE trip SET bus_id=2 WHERE trip_id=6`],expectError:'23514',errorText:'different operator'},
 {id:'sc06',section:'Semantic constraints SC01–SC18',title:'SC06 · Trip seat belongs to its bus',purpose:'Cross-table business trigger required by Assignment 2.',statements:[`INSERT INTO trip_seat(trip_id,seat_id) VALUES(6,19)`],expectError:'23514',errorText:'does not belong'},
 {id:'sc07',section:'Semantic constraints SC01–SC18',title:'SC07 · Boarding and alighting stops valid',purpose:'Ticket trigger checks ordered permitted route stops.',statements:[`UPDATE ticket SET pickup_stop_order=77,dropoff_stop_order=99 WHERE ticket_id=1`],expectError:'23514',errorText:'not permitted'},
 {id:'sc08',section:'Semantic constraints SC01–SC18',title:'SC08 · Prevent double-booked seat',purpose:'Partial UNIQUE index on active trip/seat combinations.',statements:[`INSERT INTO booking(passenger_account_id,trip_id,expires_at) VALUES(202,1,now()+interval '20 minutes')`,`INSERT INTO ticket(booking_id,trip_id,seat_id,traveller_name,pickup_stop_order,dropoff_stop_order,fare_at_booking,status) VALUES(currval(pg_get_serial_sequence('booking','booking_id')),1,1,'Duplicate Traveller',1,3,150000,'HELD')`],expectError:'23505'},
 {id:'sc09',section:'Semantic constraints SC01–SC18',title:'SC09 · Bus intervals must not overlap',purpose:'GiST exclusion constraint enforced by PostgreSQL.',statements:[`INSERT INTO trip(route_id,bus_id,departure_at,arrival_at,base_fare) SELECT 1,1,departure_at+interval '1 hour',arrival_at+interval '1 hour',200000 FROM trip WHERE trip_id=6`],expectError:'23P01'},
 {id:'sc10',section:'Semantic constraints SC01–SC18',title:'SC10 · Assigned driver licence must be valid',purpose:'Driver qualification update trigger.',statements:[`UPDATE driver SET license_expiry=date '2000-01-01' WHERE driver_id=1`],expectError:'23514',errorText:'invalidates'},
 {id:'sc11',section:'Semantic constraints SC01–SC18',title:'SC11 · Ticket must reference booking trip',purpose:'Composite foreign key rejects mismatched booking/trip.',statements:[`INSERT INTO booking(passenger_account_id,trip_id,expires_at) VALUES(201,6,now()+interval '20 minutes')`,`INSERT INTO ticket(booking_id,trip_id,seat_id,traveller_name,pickup_stop_order,dropoff_stop_order,fare_at_booking,status) VALUES(currval(pg_get_serial_sequence('booking','booking_id')),7,6,'Mismatch Traveller',1,3,150000,'HELD')`],expectError:'23503'},
 {id:'sc12',section:'Semantic constraints SC01–SC18',title:'SC12 · Pending bookings expire',purpose:'Expiration procedure releases old pending bookings.',statements:[`INSERT INTO booking(passenger_account_id,trip_id,booked_at,expires_at) VALUES(201,6,now()-interval '2 hours',now()-interval '1 hour')`,`CALL sp_expire_bookings('{}'::jsonb)`,`SELECT status='EXPIRED' AS ok FROM booking WHERE booking_id=currval(pg_get_serial_sequence('booking','booking_id'))`],expectTrue:true},
 {id:'sc13',section:'Semantic constraints SC01–SC18',title:'SC13 · Cannot mark unpaid booking PAID',purpose:'Trigger validates captured payment amount.',statements:[`INSERT INTO booking(passenger_account_id,trip_id,expires_at) VALUES(201,6,now()+interval '20 minutes')`,`UPDATE booking SET total_amount=100 WHERE booking_id=currval(pg_get_serial_sequence('booking','booking_id'))`,`UPDATE booking SET status='PAID' WHERE booking_id=currval(pg_get_serial_sequence('booking','booking_id'))`],expectError:'23514',errorText:'Captured payments'},
 {id:'sc14',section:'Semantic constraints SC01–SC18',title:'SC14 · Refund cannot exceed captured payment',purpose:'Business trigger rejects excessive refund.',statements:[`UPDATE refund SET amount=99999999 WHERE refund_id=1`],expectError:'23514',errorText:'exceeds'},
 {id:'sc15',section:'Semantic constraints SC01–SC18',title:'SC15 · Promotion must be valid',purpose:'Booking trigger checks promotion validity dates.',statements:[`INSERT INTO booking(passenger_account_id,trip_id,promotion_id,booked_at,expires_at) VALUES(201,6,1,now()+interval '401 days',now()+interval '402 days')`],expectError:'23514',errorText:'not valid'},
 {id:'sc16',section:'Semantic constraints SC01–SC18',title:'SC16 · Review only after paid completed trip',purpose:'Business trigger verifies the ticket and trip status.',statements:[`INSERT INTO booking(passenger_account_id,trip_id,expires_at) VALUES(201,6,now()+interval '20 minutes')`,`INSERT INTO review(booking_id,rating,comment) VALUES(currval(pg_get_serial_sequence('booking','booking_id')),5,'Premature review')`],expectError:'23514',errorText:'Review requires'},
 {id:'sc17',section:'Semantic constraints SC01–SC18',title:'SC17 · Supervisor belongs to same operator',purpose:'Recursive staff hierarchy guard.',statements:[`UPDATE operator_staff SET supervisor_id=302 WHERE account_id=301`],expectError:'23514',errorText:'same operator'},
 {id:'sc18',section:'Semantic constraints SC01–SC18',title:'SC18 · Paid ticket price snapshot immutable',purpose:'Business trigger prevents historical fare modification.',statements:[`UPDATE ticket SET fare_at_booking=fare_at_booking+1 WHERE ticket_id=1`],expectError:'23514',errorText:'snapshot'},
 {id:'isa-disjoint',section:'Additional integrity checks',title:'Total/disjoint account specialization',purpose:'A user must belong to exactly one subtype (deferred constraint trigger).',statements:[`INSERT INTO user_account(email,password_hash,full_name) VALUES('orphan-test@example.test',repeat('placeholder-hash',3),'Orphan Account')`,`SET CONSTRAINTS ALL IMMEDIATE`],expectError:'23514',errorText:'exactly one subtype'},
 {id:'seat-snapshot',section:'Additional integrity checks',title:'Prevent editing settled booking discount',purpose:'Historical financial snapshot is immutable.',statements:[`UPDATE booking SET discount_amount_applied=discount_amount_applied+1 WHERE booking_id=1`],expectError:'23514',errorText:'immutable'},
 {id:'delete-history',section:'Additional integrity checks',title:'Prevent deletion of booked trip',purpose:'CRUD procedure explains why deletion is disallowed.',statements:[`CALL sp_delete_trip(1,'{}'::jsonb)`],expectError:'23514',errorText:'Only scheduled'},
];
export const LAB_GROUPS=[...new Set(LAB_CASES.map(x=>x.section))];
