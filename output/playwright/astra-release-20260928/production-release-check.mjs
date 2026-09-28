import {chromium} from '/Users/idongseog/.npm/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='https://hair-cr-mvibes.vercel.app';
const out='/Users/idongseog/workspace/hairCRMvibes/output/playwright/astra-release-20260928';
const browser=await chromium.launch({channel:'chrome',headless:true});
const evidence={at:new Date().toISOString(),base,checks:[]};
try{
 for(const [width,height] of [[390,844],[360,800]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'allow'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(base+'/login');assert.equal(response.status(),200);
  await page.getByLabel('이메일',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('이메일',{exact:true}).getAttribute('id'),'login-email');
  assert.equal(await page.getByLabel('비밀번호',{exact:true}).getAttribute('type'),'password');
  await page.getByRole('button',{name:'비밀번호 보기',exact:true}).click();
  assert.equal(await page.locator('#login-password').getAttribute('type'),'text');
  await page.getByRole('button',{name:'비밀번호 숨기기',exact:true}).click();
  assert.equal(await page.locator('#login-password').getAttribute('type'),'password');
  await page.screenshot({path:`${out}/production_login_${width}x${height}.png`,fullPage:true});
  const layout=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,toggleHeight:document.querySelector('button[aria-label="비밀번호 보기"]').getBoundingClientRect().height}));
  assert.ok(layout.width<=width);assert.ok(layout.toggleHeight>=44);
  const api=await context.request.get(base+'/api/staff');assert.equal(api.status(),401);assert.match(api.headers()['cache-control']||'',/no-store/);
  await page.goto(base+'/settings/team');await page.waitForURL(/\/login\?from=/);
  console.log({width,errors});
  if(errors.length) await fs.writeFile(out+'/page-errors.json',JSON.stringify({width,errors},null,2));
  assert.equal(errors.length,0);
  evidence.checks.push({width,height,http:response.status(),newLoginLabels:true,passwordToggle:true,layout,staffUnauthenticatedStatus:api.status(),staffCacheControl:api.headers()['cache-control'],protectedPageRedirect:true,pageErrors:errors});
  await context.close();
 }
 await fs.writeFile(out+'/production-verification.json',JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
}finally{await browser.close();}
