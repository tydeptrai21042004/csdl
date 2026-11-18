import {readFileSync} from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({path:'.env.local'});dotenv.config();
const connectionString=process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED required.');
const script=readFileSync('database/05_upgrade_from_v2.sql','utf8');
const client=new pg.Client({connectionString});
try{await client.connect();await client.query(script);console.log('Non-destructive v2 upgrade installed.');}
finally{await client.end();}
