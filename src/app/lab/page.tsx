'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Beaker,Database,Code2,Play,ShieldCheck,Search,RefreshCw,CheckCircle2,XCircle,BookOpen,Square,Copy,Download} from 'lucide-react';
import {api} from '@/lib/client';
import {useAdmin} from '@/components/Shell';
type Case={id:string;section:string;title:string;purpose:string;statements:string[];expectError?:string};
type TestResult={id:string;title:string;passed:boolean;message:string;rows:Record<string,unknown>[];durationMs:number;rolledBack:boolean};
type Catalog={tables:string[];groups:string[];cases:Case[]};
type Dataset={table:string;count:number;columns:string[];rows:Record<string,unknown>[];limit:number};
type SqlRows={columns:string[];rows:Record<string,unknown>[];count:number;truncated:boolean};
const defaultSql=`SELECT o.operator_name, count(t.trip_id) AS trips,\n       sum(t.available_seats) AS seats_available\nFROM bus_operator o\nJOIN route r ON r.operator_id=o.operator_id\nJOIN trip t ON t.route_id=r.route_id\nGROUP BY o.operator_name\nORDER BY trips DESC`;
function displayCell(value:unknown){if(value===null||value===undefined)return 'NULL';if(typeof value==='object')return JSON.stringify(value);return String(value);}
function DataTable({columns,rows}:{columns:string[];rows:Record<string,unknown>[]}){
 if(!columns.length)return <p className="empty">No rows to display.</p>;
 return <div className="table-overflow"><table className="lab-result-table"><thead><tr>{columns.map(c=><th key={c}>{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{columns.map(c=><td key={c} title={displayCell(r[c])}>{displayCell(r[c])}</td>)}</tr>)}</tbody></table></div>;
}
export default function Lab(){
 const {isAdmin,checked}=useAdmin();const [tab,setTab]=useState<'tests'|'data'|'console'>('tests');
 const [catalog,setCatalog]=useState<Catalog|null>(null),[error,setError]=useState(''),[query,setQuery]=useState('');
 const [group,setGroup]=useState('All groups'),[results,setResults]=useState<Record<string,TestResult>>({});
 const [selected,setSelected]=useState('meta-seed'),[running,setRunning]=useState(''),[progress,setProgress]=useState({done:0,total:0});
 const shouldStop=useRef(false);
 const [table,setTable]=useState('trip'),[dataset,setDataset]=useState<Dataset|null>(null),[sql,setSql]=useState(defaultSql),[output,setOutput]=useState<SqlRows|null>(null);
 useEffect(()=>{if(isAdmin)api<Catalog>('/api/lab').then(c=>{setCatalog(c);}).catch(e=>setError(e.message));},[isAdmin]);
 const filtered=useMemo(()=>catalog?.cases.filter(c=>(group==='All groups'||c.section===group) && (c.title+' '+c.id+' '+c.purpose).toLowerCase().includes(query.toLowerCase()))||[],[catalog,group,query]);
 const selectedCase=catalog?.cases.find(c=>c.id===selected);
 const passed=Object.values(results).filter(r=>r.passed).length,failed=Object.values(results).filter(r=>!r.passed).length;
 function downloadReport(){
  const report={generated_at:new Date().toISOString(),project:'HCMUT Intercity Booking Assignment 2',total:catalog?.cases.length||0,executed:Object.keys(results).length,passed,failed,results:Object.values(results)};
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='assignment2-sql-test-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function exportTable(){if(!dataset)return;
  const escaped=(v:unknown)=>'"'+displayCell(v).replaceAll('"','""')+'"';
  const csv=[dataset.columns.map(escaped).join(','),...dataset.rows.map(r=>dataset.columns.map(c=>escaped(r[c])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`${dataset.table}-sample.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }

 async function runCase(id:string){
  setRunning(id);setError('');try{const result=await api<TestResult>('/api/lab',{method:'POST',body:JSON.stringify({action:'test',id})});setResults(r=>({...r,[id]:result}));}
  catch(e){setResults(r=>({...r,[id]:{id,title:id,passed:false,message:(e as Error).message,rows:[],durationMs:0,rolledBack:true}}));}
  finally{setRunning('');}
 }
 async function runAll(){if(!catalog||running)return;
  shouldStop.current=false;setRunning('__suite__');setResults({});setError('');setProgress({done:0,total:catalog.cases.length});
  for(const [index,c] of catalog.cases.entries()){
   if(shouldStop.current)break;
   try{const result=await api<TestResult>('/api/lab',{method:'POST',body:JSON.stringify({action:'test',id:c.id})});setResults(r=>({...r,[c.id]:result}));}
   catch(e){setResults(r=>({...r,[c.id]:{id:c.id,title:c.title,passed:false,message:(e as Error).message,rows:[],durationMs:0,rolledBack:true}}));}
   setProgress({done:index+1,total:catalog.cases.length});
  }
  setRunning('');
 }
 async function loadTable(name:string){setTable(name);setRunning('table');setError('');try{setDataset(await api<Dataset>('/api/lab?table='+encodeURIComponent(name)));}catch(e){setError((e as Error).message);}finally{setRunning('');}}
 async function runQuery(){setRunning('query');setOutput(null);setError('');try{setOutput(await api<SqlRows>('/api/lab',{method:'POST',body:JSON.stringify({action:'select',sql})}));}catch(e){setError((e as Error).message);}finally{setRunning('');}}
 useEffect(()=>{if(catalog&&tab==='data'&&!dataset)void loadTable(table);},[tab,catalog]);
 return <div><div className="page-heading"><div><div className="eyebrow">POSTGRESQL · LIVE SQL VALIDATION</div><h1>SQL laboratory</h1><p>Run the actual database procedures, cursor functions, triggers and constraints from your browser. Write tests run inside transactions that are rolled back.</p></div><button className="btn" onClick={()=>void runAll()} disabled={!isAdmin||Boolean(running)||!catalog}><Play size={16}/> Run full suite ({catalog?.cases.length||0})</button></div>
 {!isAdmin&&checked&&<div className="alert">Administrator login is required to open the SQL laboratory and view sample records.</div>}
 {error&&<div className="alert error">{error}</div>}
 <div className="lab-export-bar"><span>Run the tests, then export the actual results for your presentation.</span><button className="btn secondary small" onClick={downloadReport} disabled={Object.keys(results).length===0}><Download size={15}/> Export test results (JSON)</button></div>
 <div className="lab-metrics"><div className="stat-card"><div className="stat-top">Available cases <Beaker size={19}/></div><strong>{catalog?.cases.length??'—'}</strong><div className="stat-foot">Fixed SQL from project source</div></div><div className="stat-card"><div className="stat-top">Passed <CheckCircle2 size={19}/></div><strong>{passed}</strong><div className="stat-foot">Verified PostgreSQL results</div></div><div className="stat-card"><div className="stat-top">Failed <XCircle size={19}/></div><strong>{failed}</strong><div className="stat-foot">Unexpected result or database error</div></div><div className="stat-card"><div className="stat-top">Sampled tables <Database size={19}/></div><strong>{catalog?.tables.length??'—'}</strong><div className="stat-foot">Browse all relational schemas</div></div></div>
 <div className="lab-tabs"><button className={tab==='tests'?'active':''} onClick={()=>setTab('tests')}><Beaker size={17}/> Guided SQL tests</button><button className={tab==='data'?'active':''} onClick={()=>setTab('data')}><Database size={17}/> Table explorer</button><button className={tab==='console'?'active':''} onClick={()=>setTab('console')}><Code2 size={17}/> Read-only SQL console</button></div>
 {tab==='tests'&&<><div className="alert">Expected constraint violations count as <b>PASS</b> when PostgreSQL rejects the statement for the expected reason. All mutation tests roll back; identity sequences may still advance.</div>
 {running==='__suite__'&&<div className="alert">Running suite: {progress.done}/{progress.total} <button className="text-btn" style={{display:'inline-flex',marginLeft:12}} onClick={()=>shouldStop.current=true}><Square size={14}/> Stop after this test</button><div className="lab-progress"><div style={{width:(progress.total?100*progress.done/progress.total:0)+'%'}}/></div></div>}
 <div className="lab-layout"><section className="panel lab-list"><div className="lab-filter"><div className="search-field"><Search size={16}/><input placeholder="Search SQL test or SC number" value={query} onChange={e=>setQuery(e.target.value)}/></div><select value={group} onChange={e=>setGroup(e.target.value)}><option>All groups</option>{catalog?.groups.map(g=><option key={g}>{g}</option>)}</select></div><div className="lab-case-list">{filtered.map(c=><button key={c.id} className={'lab-case '+(selected===c.id?'selected':'')} onClick={()=>setSelected(c.id)}><div className="lab-case-title"><span>{c.title}</span>{results[c.id]&&(results[c.id].passed?<CheckCircle2 size={17} className="pass-icon"/>:<XCircle size={17} className="fail-icon"/>)}</div><div className="lab-case-desc">{c.section} · {c.id}</div></button>)}</div></section><section className="panel lab-detail">{selectedCase?<><div className="eyebrow">{selectedCase.section}</div><h2>{selectedCase.title}</h2><p>{selectedCase.purpose}</p><div className="lab-sql-heading"><strong>Executed SQL</strong><button className="text-btn" onClick={()=>navigator.clipboard?.writeText(selectedCase.statements.join('\n\n')).catch(()=>{})}><Copy size={14}/> Copy</button></div><pre className="sql-code">{selectedCase.statements.join('\n\n')}</pre>{selectedCase.expectError&&<div className="lab-expected">Expected rejection: SQLSTATE <code>{selectedCase.expectError}</code></div>}<div className="lab-actions"><button className="btn" disabled={!isAdmin||Boolean(running)} onClick={()=>void runCase(selectedCase.id)}><Play size={16}/>{running===selectedCase.id?'Running...':'Run this test'}</button><span><ShieldCheck size={15}/> Transaction rolled back</span></div>{results[selectedCase.id]&&<div className={results[selectedCase.id].passed?'lab-test-message pass':'lab-test-message fail'}><strong>{results[selectedCase.id].passed?'PASS':'FAIL'} · {results[selectedCase.id].durationMs} ms</strong><div>{results[selectedCase.id].message}</div></div>}{results[selectedCase.id]?.rows?.length>0&&<DataTable columns={Object.keys(results[selectedCase.id].rows[0])} rows={results[selectedCase.id].rows}/>}</>:<p className="empty">Select a test to see its SQL.</p>}</section></div></>}
 {tab==='data'&&<section className="panel lab-card"><div className="lab-toolbar"><div><div className="eyebrow">DATA BROWSER · 23 RELATIONS</div><h2>Live seeded records</h2></div><div className="lab-table-select"><select value={table} onChange={e=>void loadTable(e.target.value)}>{catalog?.tables.map(t=><option key={t} value={t}>{t}</option>)}</select><button className="btn secondary small" onClick={()=>void loadTable(table)} disabled={running==='table'}><RefreshCw size={15}/> Refresh</button><button className="btn secondary small" onClick={exportTable} disabled={!dataset}><Download size={15}/> CSV</button></div></div><p>Showing up to {dataset?.limit||50} rows per table. Changes made through trip/booking interfaces appear here immediately.</p><div className="lab-table-count">{dataset?<><b>{dataset.count}</b> total records in <code>{dataset.table}</code></>:'Select a table to see records.'}</div>{dataset&&<DataTable columns={dataset.columns} rows={dataset.rows}/>}</section>}
 {tab==='console'&&<section className="panel lab-card"><div className="eyebrow">INTERACTIVE SQL · READ-ONLY</div><h2>Run your own SELECT queries</h2><p>Execute PostgreSQL SELECT or WITH queries against your Neon PostgreSQL database. The server runs each statement inside a <code>READ ONLY</code> transaction with a timeout and returns up to 50 rows. INSERT, UPDATE, DELETE, DDL and arbitrary CALL are available only through guided cases and application controls.</p><textarea spellCheck={false} className="lab-editor" value={sql} onChange={e=>setSql(e.target.value)}/><div className="lab-actions"><button className="btn" onClick={()=>void runQuery()} disabled={!isAdmin||Boolean(running)}><Play size={16}/>{running==='query'?'Executing...':'Execute SELECT'}</button><button className="btn secondary" onClick={()=>setSql(defaultSql)}><BookOpen size={16}/> Load example</button></div>{output&&<><div className="lab-table-count">Returned {output.rows.length} row(s){output.truncated?' (limited to 50)':''}</div><DataTable columns={output.columns} rows={output.rows}/></>}</section>}
 </div>;
}
