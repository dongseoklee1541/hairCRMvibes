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
const results=[];
try{
for(const [width,height] of [[390,844],[360,800]]){
 const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
 let failure='',role='owner'; const mutations=[];
 const appointment={id:'44444444-4444-4444-8444-444444444444',customer_id:customer,date:today,time:'10:00',service_id:service,service:'합성 커트',duration:'60분',duration_minutes:60,status:'confirmed',memo:'',actual_price_krw:30000,price_snapshot_krw:30000,actual_price_updated_at:null,appointment_session_pass_usages:[],customers:{id:customer,name:'합성 고객 A'}};
 await context.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),session);
 await context.route('http://127.0.0.1:54379/**',async r=>{
  const u=new URL(r.request().url());let data=[];let status=200;
  if(u.pathname.includes('/rpc/set_appointment_actual_price')||u.pathname.includes('/rpc/update_appointment_with_session_pass'))mutations.push(u.pathname);
  if(r.request().method()==='OPTIONS'){await r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});return;}
  if(u.pathname.includes('/auth/v1/')){data=user;if(u.pathname.endsWith('/token')){status=400;data={error:'invalid_grant',error_description:'Invalid login credentials',code:'invalid_credentials'};}}
  else if(u.pathname.endsWith('/profiles')) data={role};
  else if(u.pathname.endsWith('/customers'))data=[{id:customer,name:'합성 고객 A'},{id:'55555555-5555-4555-8555-555555555555',name:'합성 고객 B'}];
  else if(u.pathname.endsWith('/salon_operation_settings')) data={default_service_id:service,default_duration_minutes:60,appointment_slot_minutes:30};
  else if(u.pathname.endsWith('/salon_service_defaults'))data=[{id:service,name:'합성 커트',price_krw:30000,default_duration_minutes:60}];
  else if(u.pathname.endsWith('/salon_business_hours'))data=Array.from({length:7},(_,weekday)=>({weekday,is_open:true,open_time:'09:00',close_time:'20:00'}));
  else if(u.pathname.endsWith('/appointments'))data=[appointment];
  else if(u.pathname.includes('/rpc/update_appointment_with_session_pass')){appointment.time=r.request().postDataJSON().p_time;data=[appointment];}
  else if(u.pathname.includes('/rpc/set_appointment_actual_price')){appointment.actual_price_krw=35000;data=[{actual_price_krw:35000,actual_price_updated_at:new Date().toISOString()}];}
  if(failure&&u.pathname.includes(failure)){status=500;data={message:'Synthetic read failure',code:'TEST'};}
  await r.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','content-range':'0-1/2'},body:JSON.stringify(data)});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/appointments/new');await page.locator('#appointment-service').waitFor();await page.locator('#appointment-customer-search').waitFor();
 await page.screenshot({path:`${out}/${phase}_new_${width}x${height}.png`,fullPage:true});
 const initialCustomer=await page.locator('#appointment-customer-search').inputValue();
 if(phase==='after'){assert.equal(initialCustomer,'');assert.equal(await page.locator('button[type=submit]').last().isDisabled(),true);}
 await page.locator('#appointment-date').click();await page.getByRole('dialog').waitFor();
 const dates=await page.getByRole('dialog').getByRole('button',{name:/년.*월.*일/}).evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
 await page.screenshot({path:`${out}/${phase}_calendar_${width}x${height}.png`});
 if(phase==='after')assert.ok(dates.every(d=>d.width>=44&&d.height>=44));
 await page.keyboard.press('Escape');
 failure='list_appointment_session_pass_options';await page.goto(origin+'/appointments/new?customerId='+customer);await page.getByText(/횟수권을 불러오지 못했습니다/).waitFor();
 await page.screenshot({path:`${out}/${phase}_pass_error_${width}x${height}.png`,fullPage:true});
 if(phase==='after'){
  assert.equal(await page.locator('button[type=submit]').last().isDisabled(),true);
  failure='';await page.getByRole('button',{name:'다시 시도',exact:true}).click();await page.getByText(/횟수권을 불러오지 못했습니다/).waitFor({state:'hidden'});
  for(const [key,label] of [['salon_closed_dates','휴무일 다시 불러오기'],['salon_service_defaults','시술 다시 불러오기']]){
   failure=key;await page.goto(origin+'/appointments/new?customerId='+customer);await page.getByRole('button',{name:label}).waitFor();await page.locator('#appointment-time').fill('14:30');failure='';await page.getByRole('button',{name:label}).click();await page.getByRole('button',{name:label}).waitFor({state:'hidden'});assert.equal(await page.locator('#appointment-time').inputValue(),'14:30');
  }
 }
 failure='';await page.goto(origin+'/appointments');await page.getByRole('button',{name:'수정',exact:true}).first().click();
 await page.screenshot({path:`${out}/${phase}_edit_${width}x${height}.png`,fullPage:true});
 if(phase==='after'){
  await page.getByLabel('시간',{exact:true}).fill('14:30');
  await page.getByLabel(/실제 시술금액/).fill('35000');
  await page.getByRole('button',{name:'예약 정보 저장',exact:true}).click();
  await page.getByText('시술금액을 먼저 저장한 뒤 예약 정보를 저장해 주세요.').waitFor();assert.equal(mutations.length,0);
  await page.getByRole('button',{name:'시술금액 저장',exact:true}).click();
  await page.getByText('시술금액을 저장했습니다. 예약 정보는 아래 버튼으로 저장해 주세요.').waitFor();assert.equal(await page.getByLabel('시간',{exact:true}).inputValue(),'14:30');
  await page.getByRole('button',{name:'예약 정보 저장',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/after_price_saved_${width}x${height}.png`});
  await page.getByRole('button',{name:'예약 정보 저장',exact:true}).click();await page.getByText('합성 고객 A 예약을 수정했습니다.').waitFor();assert.equal(mutations.length,2);
 }

 results.push({width,height,initialCustomer,calendarMinWidth:Math.min(...dates.map(x=>x.width)),calendarMinHeight:Math.min(...dates.map(x=>x.height)),pageErrors:errors});
 await context.close();
 const login=await browser.newContext({viewport:{width,height}});const lp=await login.newPage();
 await login.route('http://127.0.0.1:54379/**',r=>r.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify({code:'invalid_credentials',error_code:'invalid_credentials',message:'Invalid login credentials'})}));
 await lp.goto(origin+'/login');await lp.locator('input[type=email]').fill('synthetic@example.invalid');await lp.locator('input[type=password]').fill('synthetic-only');await lp.getByRole('button',{name:'로그인',exact:true}).click();await lp.getByText(/Invalid login credentials|이메일 또는 비밀번호/).waitFor();if(phase==='after') { await lp.getByRole('button',{name:'로그인',exact:true}).waitFor(); assert.equal(await lp.getByRole('button',{name:'로그인',exact:true}).isEnabled(),true); } await lp.screenshot({path:`${out}/${phase}_login_${width}x${height}.png`,fullPage:true});await login.close();
}
await fs.writeFile(`${out}/${phase}-measurements.json`,JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();}
