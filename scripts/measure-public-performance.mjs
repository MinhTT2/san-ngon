// Read-only, isolated Chromium lab measurement; blocks analytics collection and never signs in.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.argv[2];
assert(['localhost','127.0.0.1','san-ngon.vercel.app'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}) });
const reports=[];
try {
 const context=await browser.newContext({ viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block' });
 await context.route(/google-analytics\.com|googletagmanager\.com|analytics\.google\.com/,route=>route.abort());
 const page=await context.newPage(),cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
  window.__lab={lcp:0,cls:0};
  new PerformanceObserver(list=>{for(const e of list.getEntries()){window.__lab.lcp=e.startTime;window.__lab.lcp_element=e.element?.tagName;window.__lab.lcp_url=e.url;}}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__lab.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
 });
 for(const path of ['/','/tim-san']){
  const response=await page.goto(origin+path,{waitUntil:'networkidle',timeout:60000});assert.equal(response.status(),200);await page.waitForTimeout(1500);
  const report=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];const r=performance.getEntriesByType('resource');return {...window.__lab,ttfb:n.responseStart-n.requestStart,fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,script_bytes:r.filter(r=>r.initiatorType==='script').reduce((s,r)=>s+r.transferSize,0),total_bytes:r.reduce((s,r)=>s+r.transferSize,0),slow_resources:r.filter(r=>r.transferSize>10000).sort((a,b)=>b.duration-a.duration).slice(0,5).map(r=>({url:r.name,duration:r.duration,bytes:r.transferSize}))};});
  reports.push({path,...report});
 }
 await context.close();
 const directory=process.env.UX_SCREENSHOT_DIR||'output/automated-ui';await mkdir(directory,{recursive:true});await writeFile(`${directory}/performance-lab.json`,JSON.stringify({origin,conditions:'Chromium mobile 390x844; 150ms latency, 1.6Mbps download, CPU 4x, reduced motion; lab, not field p75 or INP',reports},null,2));
 console.log(JSON.stringify(reports));
 assert(reports.every(r=>r.cls<=0.1),'initial layout stability');assert(reports.every(r=>r.script_bytes<350000),'initial JavaScript transfer budget');
}finally{await browser.close();}
