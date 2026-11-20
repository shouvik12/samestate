#!/usr/bin/env node
// Samestate MCP server: responsive checks for AI assistants, run locally by the assistant (stdio, no network service).
// It opens a page on several screen sizes in a hidden Chrome running the Samestate extension and returns the
// difference report, the combined checks or screenshots. Needs Node 22+ and Google Chrome.
//   claude mcp add samestate -- node /path/to/samestate/mcp/server.mjs
import {createInterface} from 'node:readline';
import {readFileSync} from 'node:fs';
import {Samestate,EXTENSION} from './chrome.mjs';

const VERSION=JSON.parse(readFileSync(EXTENSION+'/manifest.json','utf8')).version;
const log=message=>process.stderr.write(`[samestate] ${message}\n`);
const samestate=new Samestate({log});

const url={type:'string',description:'Page to open, for example http://localhost:3000/pricing or https://example.com. Local addresses work.'};
const devices={type:'array',items:{type:'string'},description:'Screen ids from list_devices. Default: the seven starter screens (iPhone 11 Pro, Nexus 7, Desktop, MacBook Air, Android, Pixel 3 XL, iPad Pro 11″).'};
const reference={type:'string',description:'Screen id the others are compared with (default: Desktop).'};
const TOOLS=[
 {name:'list_devices',title:'List screens',description:'Lists the screen sizes Samestate can open (phones, tablets, desktops) with their ids, CSS pixel sizes and which ones are on by default.',inputSchema:{type:'object',properties:{}},annotations:{readOnlyHint:true}},
 {name:'check_responsive',title:'Check a page on every screen size',description:'Opens the page on several screen sizes at once and returns Samestate\'s difference report: what breaks on which screens (sideways scroll, tables wider than their container, cut-off text, small tap targets, tiny text, stretched or broken images, missing viewport tag, content missing compared with the reference screen, accessibility, meta and performance findings), each with the affected screens and, where one exists, the CSS that usually fixes it. Use after changing layout or CSS to see what broke.',inputSchema:{type:'object',properties:{url,devices,reference,include_adaptations:{type:'boolean',description:'Also list expected layout adaptations (for example a menu that collapses on phones). Default false.'},check_links:{type:'boolean',description:'Also check same-origin links for 404s. Slower. Default false.'}},required:['url']},annotations:{readOnlyHint:true,openWorldHint:true}},
 {name:'run_checks',title:'Run combined checks',description:'Runs Samestate\'s automated check groups on the page across the chosen screens and returns pass, warning or fail per check with the findings. Groups: layout, accessibility, meta, performance, links (default: all five); widths adds a 320–1920px width sweep (takes minutes); settings scans screen settings and longer text.',inputSchema:{type:'object',properties:{url,devices,reference,groups:{type:'array',items:{type:'string',enum:['layout','accessibility','meta','performance','links','widths','settings']}}},required:['url']},annotations:{readOnlyHint:true,openWorldHint:true}},
 {name:'screenshot',title:'Screenshot every screen',description:'Opens the page on the chosen screens and returns one screenshot per screen, as Samestate shows it. Use to look at a layout problem the report mentions. Keep to a few screens; each image is up to 900px wide.',inputSchema:{type:'object',properties:{url,devices:{...devices,description:'Screen ids from list_devices. Default: iphone, ipad, desktop.'},width:{type:'number',description:'Image width in pixels (default: the screen width, at most 900).'}},required:['url']},annotations:{readOnlyHint:true,openWorldHint:true}}
];

function differencesText(r,{adaptations}){
 const shown=r.findings.filter(f=>adaptations||f.severity!=='adaptation');
 const count=s=>r.findings.filter(f=>f.severity===s).length;
 const lines=[`Samestate difference report for ${r.url}`,`Screens: ${r.screens.map(s=>`${s.name} (${s.width}×${s.height})`).join(', ')}. Reference: ${r.screens.find(s=>s.id===r.reference)?.name||r.reference}.`,`${count('issue')} issues · ${count('warning')} warnings · ${count('adaptation')} adaptations${adaptations?'':' (not listed)'}`];
 if(r.unmeasured.length)lines.push(`Not measured (the page did not load or connect in time): ${r.unmeasured.join(', ')}.`);
 const groups=new Map();
 for(const f of shown){const key=f.severity+'|'+f.kind;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}
 const order={issue:0,warning:1,adaptation:2};
 for(const list of [...groups.values()].sort((a,b)=>order[a[0].severity]-order[b[0].severity])){
  const f=list[0];
  lines.push('',`## ${f.severity.toUpperCase()} · ${f.category} · ${f.kind} — ${list.map(x=>x.screen).join(', ')}`);
  for(const x of list)lines.push(`- ${x.screen}: ${x.title}. ${x.detail}`);
  if(f.fixCss)lines.push(`Usually fixed by this CSS on the affected elements: ${f.fixCss}`);
  if(f.advice)lines.push(`Suggestion: ${f.advice}`);
 }
 if(!shown.length)lines.push('','No problems found on these screens.');
 return lines.join('\n');
}
function checksText(r){
 const rep=r.report,lines=[`Samestate checks for ${rep.site}: ${rep.outcome}`,`Screens: ${rep.screens.join(', ')}`,Object.entries(rep.counts).filter(([,n])=>n).map(([s,n])=>`${n} ${s}`).join(' · ')];
 for(const row of rep.results.filter(x=>!x.manual)){
  lines.push('',`## ${row.status.toUpperCase()} · ${row.name}`);if(row.detail)lines.push(row.detail);
  for(const f of row.findings||[])lines.push(`- ${f.severity} · ${f.screen} · ${f.title}: ${f.detail}`);
 }
 lines.push('','Limits: '+rep.limitations.join(' '));
 return lines.join('\n');
}

async function call(name,args={}){
 if(name==='list_devices'){
  const list=await samestate.listDevices();
  return [{type:'text',text:list.map(d=>`${d.id} — ${d.name} ${d.width}×${d.height} (${d.kind}, ${d.group})${d.default?' · default':''}`).join('\n')}];
 }
 const options={devices:args.devices,reference:args.reference};
 if(name==='check_responsive'){
  const r=await samestate.differences(args.url,{...options,links:!!args.check_links});
  if(r.unmeasured.length===r.screens.length)throw Error(`${r.url} did not load on any screen within 30 seconds. Check that the address is right and its server is running.`);
  return [{type:'text',text:differencesText(r,{adaptations:!!args.include_adaptations})}];
 }
 if(name==='run_checks')return [{type:'text',text:checksText(await samestate.checks(args.url,{...options,groups:args.groups}))}];
 if(name==='screenshot'){
  const r=await samestate.screenshots(args.url,{devices:args.devices?.length?args.devices:['iphone','ipad','desktop'],width:args.width});
  return [{type:'text',text:`Screenshots of ${r.url}: ${r.shots.map(s=>`${s.name} (${s.width}×${s.height})`).join(', ')}`+(r.shots.length<r.screens.length?`. Not loaded: ${r.screens.filter(s=>!s.ready).map(s=>s.name).join(', ')}.`:'')},
   ...r.shots.flatMap(s=>[{type:'text',text:s.name},{type:'image',data:s.png,mimeType:'image/png'}])];
 }
 throw Object.assign(Error('Unknown tool: '+name),{code:-32602});
}

const reply=(id,body)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,...body})+'\n');
async function handle(message){
 const {id,method,params}=message;
 if(id===undefined)return; // notifications (initialized, cancelled) need no answer
 try{
  if(method==='initialize')return reply(id,{result:{protocolVersion:params?.protocolVersion||'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'samestate',title:'Samestate',version:VERSION},instructions:'Use check_responsive after changing a page\'s layout or CSS to see what breaks on phones, tablets and desktops; screenshot to look at a problem; run_checks for the full automated check groups. Pages on localhost work.'}});
  if(method==='ping')return reply(id,{result:{}});
  if(method==='tools/list')return reply(id,{result:{tools:TOOLS}});
  if(method==='tools/call'){
   try{return reply(id,{result:{content:await call(params.name,params.arguments)}});}
   catch(error){if(error.code)throw error;log(error.message);return reply(id,{result:{content:[{type:'text',text:error.message}],isError:true}});}
  }
  reply(id,{error:{code:-32601,message:'Method not found: '+method}});
 }catch(error){reply(id,{error:{code:error.code||-32603,message:error.message}});}
}

createInterface({input:process.stdin}).on('line',line=>{if(!line.trim())return;let message;try{message=JSON.parse(line);}catch{return reply(null,{error:{code:-32700,message:'Parse error'}});}handle(message);}).on('close',async()=>{await samestate.close();process.exit(0);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await samestate.close();process.exit(0);});
