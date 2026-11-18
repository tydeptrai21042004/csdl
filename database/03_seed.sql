-- Deterministic demonstration records. Run once after 01_schema and 02_logic.
-- All 23 relations receive >=5 rows; dates relative to execution time.
-- Names, payments and email addresses are synthetic examples, not real transactions.
BEGIN;
INSERT INTO user_account(account_id,email,password_hash,full_name) VALUES
(101,'admin1@example.test',repeat('not-a-login-hash-',3),'Platform Admin One'),
(102,'admin2@example.test',repeat('not-a-login-hash-',3),'Platform Admin Two'),
(103,'admin3@example.test',repeat('not-a-login-hash-',3),'Platform Admin Three'),
(104,'admin4@example.test',repeat('not-a-login-hash-',3),'Platform Admin Four'),
(105,'admin5@example.test',repeat('not-a-login-hash-',3),'Platform Admin Five'),
(201,'guest1@example.test',repeat('not-a-login-hash-',3),'Nguyen An'),
(202,'guest2@example.test',repeat('not-a-login-hash-',3),'Tran Binh'),
(203,'guest3@example.test',repeat('not-a-login-hash-',3),'Le Chi'),
(204,'guest4@example.test',repeat('not-a-login-hash-',3),'Pham Dung'),
(205,'guest5@example.test',repeat('not-a-login-hash-',3),'Vo Giang'),
(301,'staff1@example.test',repeat('not-a-login-hash-',3),'Staff North'),
(302,'staff2@example.test',repeat('not-a-login-hash-',3),'Staff South'),
(303,'staff3@example.test',repeat('not-a-login-hash-',3),'Staff East'),
(304,'staff4@example.test',repeat('not-a-login-hash-',3),'Staff West'),
(305,'staff5@example.test',repeat('not-a-login-hash-',3),'Staff Central');
INSERT INTO platform_admin(account_id,admin_level) VALUES
(101,'SUPERADMIN'),(102,'MANAGER'),(103,'MANAGER'),(104,'SUPPORT'),(105,'SUPPORT');
INSERT INTO passenger_profile(account_id,loyalty_points,preferred_contact) VALUES
(201,150,'EMAIL'),(202,210,'PHONE'),(203,70,'EMAIL'),(204,95,'PHONE'),(205,35,'EMAIL');
INSERT INTO bus_operator(operator_id,operator_name,email,status,approved_by) VALUES
(1,'Southern Star Express','southern@example.test','APPROVED',101),
(2,'Mekong Travel','mekong@example.test','APPROVED',102),
(3,'Coastal Transit','coastal@example.test','APPROVED',103),
(4,'Highland Connect','highland@example.test','APPROVED',104),
(5,'Delta Shuttle','delta@example.test','APPROVED',105);
INSERT INTO operator_staff(account_id,operator_id,employee_code,hired_on) VALUES
(301,1,'SS-001',current_date-900),(302,2,'MK-001',current_date-800),
(303,3,'CT-001',current_date-700),(304,4,'HC-001',current_date-600),
(305,5,'DS-001',current_date-500);
INSERT INTO operator_phone(operator_id,phone_number) VALUES
(1,'+84901230001'),(2,'+84901230002'),(3,'+84901230003'),(4,'+84901230004'),(5,'+84901230005');
INSERT INTO driver(driver_id,operator_id,full_name,license_no,license_class,license_expiry) VALUES
(1,1,'Pham Driver A','DEMO-DL-001','E',current_date+730),
(2,2,'Pham Driver B','DEMO-DL-002','D',current_date+730),
(3,3,'Pham Driver C','DEMO-DL-003','D',current_date+730),
(4,4,'Pham Driver D','DEMO-DL-004','E',current_date+730),
(5,5,'Pham Driver E','DEMO-DL-005','D',current_date+730);
INSERT INTO bus(bus_id,operator_id,license_plate,bus_type,deck_count) VALUES
(1,1,'51B-DEMO1','SLEEPER',2),(2,2,'65B-DEMO2','STANDARD',1),
(3,3,'72B-DEMO3','LIMOUSINE',1),(4,4,'49B-DEMO4','SLEEPER',2),
(5,5,'64B-DEMO5','STANDARD',1);
INSERT INTO seat(seat_id,bus_id,seat_code,deck_no,seat_class)
SELECT (b-1)*18+s,b,'A'||lpad(s::text,2,'0'),CASE WHEN b IN (1,4) AND s>9 THEN 2 ELSE 1 END,
CASE WHEN s IN (1,2,10,11) THEN 'VIP' ELSE 'STANDARD' END
FROM generate_series(1,5) AS b CROSS JOIN generate_series(1,18) AS s;
INSERT INTO station(station_id,station_name,street,ward,city,province) VALUES
(1,'Mien Dong Station','292 Dinh Bo Linh','Binh Thanh','Ho Chi Minh City','HCMC'),
(2,'Bao Loc Station','Tran Phu','Ward 1','Bao Loc','Lam Dong'),
(3,'Da Lat Station','To Hien Thanh','Ward 3','Da Lat','Lam Dong'),
(4,'My Tho Station','Ap Bac','Ward 5','My Tho','Tien Giang'),
(5,'Can Tho Station','Nguyen Van Linh','Hung Loi','Can Tho','Can Tho'),
(6,'Long Thanh Station','QL51','Long Thanh','Long Thanh','Dong Nai'),
(7,'Vung Tau Station','Nam Ky Khoi Nghia','Ward 3','Vung Tau','Ba Ria-Vung Tau'),
(8,'Nha Trang Station','23/10','Phuoc Hai','Nha Trang','Khanh Hoa'),
(9,'Cam Ranh Station','Hung Vuong','Cam Nghia','Cam Ranh','Khanh Hoa');
INSERT INTO route(route_id,operator_id,origin_station_id,destination_station_id,distance_km) VALUES
(1,1,1,3,310),(2,2,1,5,165),(3,3,1,7,105),(4,4,3,8,140),(5,5,5,1,165);
INSERT INTO route_stop(route_id,stop_order,station_id,offset_minutes,pickup_allowed,dropoff_allowed) VALUES
(1,1,1,0,true,false),(1,2,2,190,true,true),(1,3,3,350,false,true),
(2,1,1,0,true,false),(2,2,4,100,true,true),(2,3,5,210,false,true),
(3,1,1,0,true,false),(3,2,6,60,true,true),(3,3,7,130,false,true),
(4,1,3,0,true,false),(4,2,9,150,true,true),(4,3,8,230,false,true),
(5,1,5,0,true,false),(5,2,4,100,true,true),(5,3,1,210,false,true);
-- A historic completed trip and an upcoming scheduled trip for each operator.
INSERT INTO trip(trip_id,route_id,bus_id,departure_at,arrival_at,base_fare,status)
SELECT b,b,b,now()-interval '30 days'+make_interval(days=>b),
       now()-interval '30 days'+make_interval(days=>b,hours=>6),
       150000+b*20000,'COMPLETED'
FROM generate_series(1,5) b;
INSERT INTO trip(trip_id,route_id,bus_id,departure_at,arrival_at,base_fare,status)
SELECT b+5,b,b,now()+interval '14 days'+make_interval(days=>b),
       now()+interval '14 days'+make_interval(days=>b,hours=>6),
       160000+b*20000,'SCHEDULED'
FROM generate_series(1,5) b;
-- Second upcoming departure per operator: additional bookable choices without resource overlap.
INSERT INTO trip(trip_id,route_id,bus_id,departure_at,arrival_at,base_fare,status)
SELECT b+10,b,b,now()+interval '7 days'+make_interval(days=>b),
       now()+interval '7 days'+make_interval(days=>b,hours=>6),
       175000+b*20000,'SCHEDULED'
FROM generate_series(1,5) b;
INSERT INTO trip_driver_assignment(trip_id,driver_id,role,assigned_at)
SELECT t.trip_id,t.bus_id,'PRIMARY',t.departure_at-interval '15 days' FROM trip t;
INSERT INTO promotion(promotion_id,promo_code,discount_type,discount_value,valid_from,valid_until,usage_limit) VALUES
(1,'SAVE10','PERCENT',10,now()-interval '365 days',now()+interval '365 days',100),
(2,'FLAT20','FIXED',20000,now()-interval '365 days',now()+interval '365 days',100),
(3,'SAVE15','PERCENT',15,now()-interval '365 days',now()+interval '365 days',100),
(4,'FLAT30','FIXED',30000,now()-interval '365 days',now()+interval '365 days',100),
(5,'SAVE05','PERCENT',5,now()-interval '365 days',now()+interval '365 days',100);
INSERT INTO payment_method(method_id,method_name,provider) VALUES
(1,'Demo Bank Transfer','Sandbox Bank'),(2,'Demo E-Wallet','Sandbox Wallet'),
(3,'Demo Credit','Sandbox Cards'),(4,'Demo QR','Sandbox QR'),(5,'Demo Cash','Sandbox Counter');
INSERT INTO booking(booking_id,passenger_account_id,trip_id,promotion_id,booked_at,expires_at)
SELECT b,200+b,b,b,t.departure_at-interval '10 days',t.departure_at-interval '10 days'+interval '15 minutes'
FROM generate_series(1,5) b JOIN trip t ON t.trip_id=b;
INSERT INTO ticket(ticket_id,booking_id,trip_id,seat_id,traveller_name,pickup_stop_order,dropoff_stop_order,fare_at_booking,status)
SELECT b,b,b,(b-1)*18+1,'Sample Traveller '||b,1,3,t.base_fare,'HELD'
FROM generate_series(1,5) b JOIN trip t ON t.trip_id=b;
UPDATE booking b SET discount_amount_applied=
CASE WHEN p.discount_type='PERCENT' THEN round(t.fare_at_booking*p.discount_value/100,2)
ELSE LEAST(t.fare_at_booking,p.discount_value) END
FROM promotion p,ticket t WHERE b.promotion_id=p.promotion_id AND t.booking_id=b.booking_id;
INSERT INTO payment(payment_id,booking_id,method_id,amount,payment_status,transaction_ref,paid_at)
SELECT b.booking_id,b.booking_id,b.booking_id,b.total_amount,'CAPTURED','SEED-CAPTURE-'||b.booking_id,b.booked_at+interval '5 minutes'
FROM booking b;
UPDATE booking SET status='PAID' WHERE booking_id BETWEEN 1 AND 5;
UPDATE ticket SET status='CONFIRMED' WHERE ticket_id BETWEEN 1 AND 5;
UPDATE ticket SET status='USED' WHERE ticket_id BETWEEN 1 AND 5;
INSERT INTO refund(refund_id,payment_id,amount,refund_status,reason)
SELECT p.payment_id,p.payment_id,10000,'REQUESTED','Synthetic goodwill adjustment' FROM payment p;
INSERT INTO invoice(invoice_id,booking_id,billing_name,tax_code)
SELECT b.booking_id,b.booking_id,'Invoice Example '||b.booking_id,'TAX-DEMO-'||b.booking_id FROM booking b;
INSERT INTO review(review_id,booking_id,rating,comment)
SELECT b.booking_id,b.booking_id,3+b.booking_id%3,'Synthetic completed-trip feedback' FROM booking b;
-- Explicit IDs require synchronizing identity sequences for user-created records.
SELECT setval(pg_get_serial_sequence('user_account','account_id'),(SELECT max(account_id) FROM user_account));
SELECT setval(pg_get_serial_sequence('bus_operator','operator_id'),(SELECT max(operator_id) FROM bus_operator));
SELECT setval(pg_get_serial_sequence('driver','driver_id'),(SELECT max(driver_id) FROM driver));
SELECT setval(pg_get_serial_sequence('bus','bus_id'),(SELECT max(bus_id) FROM bus));
SELECT setval(pg_get_serial_sequence('seat','seat_id'),(SELECT max(seat_id) FROM seat));
SELECT setval(pg_get_serial_sequence('station','station_id'),(SELECT max(station_id) FROM station));
SELECT setval(pg_get_serial_sequence('route','route_id'),(SELECT max(route_id) FROM route));
SELECT setval(pg_get_serial_sequence('trip','trip_id'),(SELECT max(trip_id) FROM trip));
SELECT setval(pg_get_serial_sequence('promotion','promotion_id'),(SELECT max(promotion_id) FROM promotion));
SELECT setval(pg_get_serial_sequence('booking','booking_id'),(SELECT max(booking_id) FROM booking));
SELECT setval(pg_get_serial_sequence('ticket','ticket_id'),(SELECT max(ticket_id) FROM ticket));
SELECT setval(pg_get_serial_sequence('payment_method','method_id'),(SELECT max(method_id) FROM payment_method));
SELECT setval(pg_get_serial_sequence('payment','payment_id'),(SELECT max(payment_id) FROM payment));
SELECT setval(pg_get_serial_sequence('refund','refund_id'),(SELECT max(refund_id) FROM refund));
SELECT setval(pg_get_serial_sequence('invoice','invoice_id'),(SELECT max(invoice_id) FROM invoice));
SELECT setval(pg_get_serial_sequence('review','review_id'),(SELECT max(review_id) FROM review));
COMMIT;
