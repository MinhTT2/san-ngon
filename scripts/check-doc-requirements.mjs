// Regression checks without mail, browser sessions or money mutations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { normalizePhone } from '../lib/profile.ts';
import { extractTournamentCodes } from '../lib/sepay.ts';
const require = createRequire(import.meta.url);
const sandbox = { exports: {}, require(name) {
  if (name === './navigation-marker') return { NavigationMarker: () => null };
  if (name === './count-up') return { CountUp: () => null };
  if (name === 'next/link') return { default: 'a' };
  if (name === '@/lib/format') return { vnd: String };
  return require(name);
}};
const code = ts.transpileModule(readFileSync(new URL('../components/stats-panels.tsx',import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code,sandbox);
for (const path of ['/admin','/chu-san?venue=venue-id']) {
 const tree = sandbox.exports.PeriodLinks({ path,period:30 });
 const links = tree.props.children.flat().filter(node => node?.props?.href);
 assert.equal(links.length,3);
 for (const link of links) {
  const url = new URL(link.props.href,'https://test.invalid');
  assert.equal(url.searchParams.get('period'),link.key);
  if (path.includes('venue=')) assert.equal(url.searchParams.get('venue'),'venue-id');
 }
 assert.equal(links[1].props['aria-current'],'page');
}
const body = { transferType:'in', transferAmount:100000,id:1 };
assert.deepEqual(extractTournamentCodes({...body,content:'CT giaiabcdef123456'}),['GIAIABCDEF123456']);
assert.deepEqual(extractTournamentCodes({...body,content:'GIAIABCDEF123456',description:'GIAIABCDEF123456'}),['GIAIABCDEF123456']);
assert.deepEqual(extractTournamentCodes({...body,content:'GIAIABCDEF1234567 SANABC234 PHIABCDEF12'}),[]);
assert.equal(extractTournamentCodes({...body,content:'GIAIABCDEF123456 GIAI123456ABCDEF'}).length,2);
console.log('OK: statistics period links preserve venue; tournament payment references remain separate.');
// Exercise auth calls without sending email: trimmed input, transport errors and full navigation.
let states=[],cursor=0,calls=[],authResult={data:{session:{},user:{}},error:null},offline=false;
const auth={};
for(const method of ['signInWithPassword','signUp','verifyOtp','resend'])auth[method]=async args=>{calls.push([method,args]);if(offline)throw Error('offline');return authResult;};
const authSandbox={exports:{},process:{env:{}},window:{location:{origin:'https://test.invalid',assign(path){calls.push(['navigate',path]);}}},require(name){
 if(name==='react')return {useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useEffect(){}};
 if(name==='next/navigation')return {useSearchParams:()=>new URLSearchParams('next=/giai-dau')};
 if(name==='@/lib/supabase/client')return {createClient:()=>({auth})};
 if(name==='@/lib/profile')return {normalizePhone};
 if(name==='@/lib/safe-next')return {safeNext:path=>path};
 return require(name);
}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/(site)/dang-nhap/login-form.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,authSandbox);
function render(mode='login'){cursor=0;return authSandbox.exports.LoginForm({mode});}
function nodes(t){return !t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];}
function input(id,value,mode){nodes(render(mode)).find(n=>n.props?.id===id).props.onChange({target:{value}});}
async function submit(mode){await nodes(render(mode)).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});}
input('email',' player@example.invalid ');input('password','password-123');await submit();assert.equal(calls[0][1].email,'player@example.invalid');assert.equal(calls.at(-1)[1],'/giai-dau');
states=[];calls=[];offline=true;input('email','player@example.invalid');input('password','password-123');await submit();assert(nodes(render()).some(n=>n.props?.role==='alert'));assert.equal(nodes(render()).find(n=>n.props?.type==='submit').props.disabled,false);
states=[];calls=[];offline=false;authResult={data:{user:{identities:[{}]},session:null},error:null};
input('name','Người đăng ký','signup');input('phone','+84 912 345 678','signup');input('email',' player@example.invalid ','signup');input('password','password-123','signup');input('password-again','password-123','signup');await submit('signup');assert.equal(calls[0][0],'signUp');assert.equal(calls[0][1].email,'player@example.invalid');assert.equal(calls[0][1].options.data.phone,'0912345678');
input('token','12345678','signup');authResult={data:{session:{}},error:null};await submit('signup');assert.equal(calls[1][0],'verifyOtp');assert.equal(calls[1][1].type,'signup');assert.equal(calls[1][1].token,'12345678');assert.equal(calls.at(-1)[0],'navigate');
console.log('OK: sign-in/sign-up/OTP use correct inputs, recover offline, and reload authenticated UI.');
