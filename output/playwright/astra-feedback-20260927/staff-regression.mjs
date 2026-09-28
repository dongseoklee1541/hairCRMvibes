import {chromium} from '/Users/idongseog/.npm/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const phase=process.argv[2]||'before';
const out='/Users/idongseog/workspace/hairCRMvibes/output/playwright/astra-feedback-20260927';
const origin='http://127.0.0.1:3157';
const id='11111111-1111-4111-8111-111111111111',customer='22222222-2222-4222-8222-222222222222',service='33333333-3333-4333-8333-333333333333';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const user={id,email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated'};
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+36000})+'.synthetic';
const session={access_token:token,refresh_token:'synthetic-only',token_type:'bearer',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,user};
const browser=await chromium.launch({channel:'chrome',headless:true});

const tempRoot=(await fs.readFile('/private/tmp/haircrm-feedback-ui-path','utf8')).trim();
const root='/Users/idongseog/workspace/hairCRMvibes';
const cp=await import('node:child_process');
const css='components/settings/RoleManagementPanel.module.css';
const originalCSS=cp.execFileSync('git',['show','HEAD:'+css],{cwd:root,encoding:'utf8'});
const currentCSS=await fs.readFile(root+'/'+css,'utf8');
await fs.copyFile(root+'/components/settings/RoleManagementPanel.js',tempRoot+'/components/settings/RoleManagementPanel.js');
const evidence=[];
try{
for(const [width,height] of [[390,844],[360,800]]){
 for(const mode of ['before','after']){
  await fs.writeFile(tempRoot+'/'+css,mode==='before'?originalCSS:currentCSS);
  const c=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
  await c.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),session);
  await c.route('http://127.0.0.1:54379/**',r=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({role:'owner'})}));
  let postCount=0;const bodies=[];
  await c.route('**/api/staff**',async r=>{
   if(r.request().method()==='POST'){
    postCount++;bodies.push(r.request().postDataJSON());
    if(postCount===1){await r.abort('failed');return;}
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,status:'replayed',staff:{userId:customer,role:'staff',emailMasked:'sy•••@example.invalid',emailConfirmed:false}})});return;
   }
   await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,staff:[{userId:id,role:'owner',emailMasked:'ow•••@example.invalid',emailConfirmed:true,createdAt:new Date().toISOString()},{userId:customer,role:'staff',emailMasked:'sy•••@example.invalid',emailConfirmed:false,createdAt:new Date().toISOString()}]})});
  });
  const p=await c.newPage();await p.goto(origin+'/settings/team');await p.locator('[class*="roleBadge"]').first().waitFor();
  await p.waitForFunction(size=>getComputedStyle(document.querySelector('[class*="roleBadge"]')).fontSize===size,mode==='before'?'11px':'14px');
  await p.screenshot({path:`${out}/${mode}_staff_${width}x${height}.png`,fullPage:true});
  if(mode==='after'){
   await p.getByLabel('직원 이메일').fill('synthetic@example.invalid');await p.getByRole('button',{name:'초대 보내기',exact:true}).click();await p.getByRole('button',{name:'초대 요청 확인',exact:true}).waitFor();
   await p.screenshot({path:`${out}/after_invitation_retry_${width}x${height}.png`,fullPage:true});
   await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForFunction(()=>document.querySelector('#staff-invite-email')?.value==='');await p.getByLabel('직원 이메일').fill('synthetic@example.invalid');await p.getByRole('button',{name:'초대 요청 확인',exact:true}).click();await p.getByText('이미 처리된 요청입니다. 현재 초대 상태를 확인해주세요.').waitFor();assert.equal(bodies[0].requestId,bodies[1].requestId);
   const metrics=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,badges:[...document.querySelectorAll('[class*="roleBadge"]')].map(e=>getComputedStyle(e).fontSize)}));evidence.push({width,height,...metrics,requestIdReused:true});
  }
  await c.close();
 }
}
await fs.writeFile(out+'/staff-measurements.json',JSON.stringify(evidence,null,2));console.log(evidence);
}finally{await fs.writeFile(tempRoot+'/'+css,currentCSS);await browser.close();}
