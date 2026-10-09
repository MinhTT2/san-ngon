// API/RPC contracts and email rendering, with mocks only.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
let role='admin', previous={owner_application_status:'rejected',business_license_path:'actor/existing.pdf',business_license_name:'Giấy tờ cũ'}, fail=false;
const calls=[], uploads=[], removals=[], emails=[];
const db={
  auth:{getUser:async()=>({data:{user:{id:'e0940000-0000-4000-8000-000000000002'}}})},
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role}}),single:async()=>({data:previous,error:null})})})}),
  rpc:async(name,args)=>{calls.push({name,args});return {data:name==='get_owner_email'?'fixture@example.invalid':null,error:fail?{message:'OWNER_ALREADY_REVIEWED'}:null};},
  storage:{from:()=>({upload:async(path)=>{uploads.push(path);return {error:null};},remove:async(paths)=>{removals.push(paths);return {error:null};}})},
};
async function load(path, mock={}) {
  const sandbox={exports:{},URL,File,FormData,process:{env:{}},require(name){
    if (name in mock) return mock[name];
    if(name==='@/lib/supabase/server')return {createClient:async()=>db};
    if(name==='@/lib/constants')return {ownerErrorMessage:()=> 'Hồ sơ đã được xử lý.'};
    if(name==='@/lib/notify')return {ownerApplicationEmail:(status,reason)=>({subject:status,html:reason}),sendEmail:async(...args)=>{emails.push(args);return {ok:true};}};
    return require(name);
  }};
  vm.runInNewContext(ts.transpileModule(await readFile(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,sandbox);
  return sandbox.exports;
}
const review=await load('app/api/admin/owners/[id]/status/route.ts');
const params={params:Promise.resolve({id:'e0940000-0000-4000-8000-000000000002'})};
async function post(body){return review.POST(new Request('https://site.invalid/api/admin/owners/actor/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),params);}
for(const reason of [undefined,'ngắn',' '.repeat(15),'đ'.repeat(1001)])assert.equal((await post({status:'rejected',reason})).status,400);
assert.equal(calls.length,0,'invalid reasons never reach SQL');
role='player';assert.equal((await post({status:'rejected',reason:'Bổ sung giấy tờ rõ nét'})).status,403);assert.equal(calls.length,0);
role='admin';
assert.equal((await post({status:'rejected',reason:'  Bổ sung giấy tờ rõ nét  '})).status,200);
assert.equal(calls[0].args.p_reason,'Bổ sung giấy tờ rõ nét');
assert.equal(emails[0][2],calls[0].args.p_reason,'email uses the same normalized reason as SQL/inbox');
fail=true;const sent=emails.length;assert.equal((await post({status:'active'})).status,409);assert.equal(emails.length,sent,'failed/repeated review never sends a success email');fail=false;
const notify=await load('lib/notify.ts',{'./format':{vnd:()=>''}});
const html=notify.ownerApplicationEmail('rejected','<script>alert(1)</script> & thông tin\nDòng mới').html;
assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('<br>'));
const registration=await load('app/api/owner-registration/route.ts');
async function resubmit(extra={}){
 const form=new FormData();form.set('data',JSON.stringify({full_name:'Hồ sơ sửa',phone:'0900000002',reuse_document:true,business_license_path:'another-user/private.pdf',...extra}));
 return registration.POST(new Request('https://site.invalid/api/owner-registration',{method:'POST',body:form}));
}
calls.length=0;assert.equal((await resubmit()).status,201);assert.equal(calls[0].args.p_business_license_path,'actor/existing.pdf','server selects the saved document, ignores client path');assert.equal(uploads.length,0);
fail=true;assert.equal((await resubmit()).status,400);assert.equal(removals.length,0,'rejected resubmit never deletes the existing document');fail=false;
previous={...previous,owner_application_status:'pending'};assert.equal((await resubmit()).status,400);
assert.equal((await resubmit({reuse_document:false})).status,400);
console.log('OK: reason validation, role checks, consistent/escaped email, failed review handling and safe document reuse without upload/removal.');
