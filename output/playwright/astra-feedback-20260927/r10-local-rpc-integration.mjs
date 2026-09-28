import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {inviteStaffMember,StaffManagementError} from '/Users/idongseog/workspace/hairCRMvibes/lib/server/staffManagementCore.mjs';
const dir=readFileSync('/private/tmp/haircrm-rls-acl-current-path','utf8').trim();
const sql=q=>execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-h',dir+'/socket','-p','55439','-U','postgres','-d','haircrm_feedback_test','-c',q],{encoding:'utf8'}).trim();
const literal=v=>v==null?'NULL':"'"+String(v).replaceAll("'","''")+"'";
const owner=randomUUID(),staff=randomUUID(),request=randomUUID(),fresh=randomUUID();
const email='synthetic-integration@example.invalid';
const fingerprint=createHash('sha256').update(request).digest('hex');
sql(`insert into auth.users(id,email) values (${literal(owner)},'owner-integration@example.invalid'),(${literal(staff)},${literal(email)}); insert into public.profiles(id,role) values (${literal(owner)},'owner'),(${literal(staff)},'staff');`);
const asOwner=q=>JSON.parse(sql(`begin; set local role authenticated; set local "request.jwt.claim.sub"=${literal(owner)}; set local "request.jwt.claim.role"='authenticated'; ${q}; commit;`));
const rpc=(name,args)=>asOwner(`select row_to_json(t) from public.${name}(${Object.entries(args).map(([k,v])=>`${k}=>${literal(v)}`).join(',')}) t`);
let attempts=0;
const deps={
 authorizeOwner:()=>asOwner("select coalesce(jsonb_agg(t),'[]') from public.list_staff_profiles() t"),
 fingerprintEmail:()=>fingerprint,
 listAuthUsers:()=>[{id:staff,email,email_confirmed_at:null}],
 inviteUser:()=>{attempts++;throw new StaffManagementError('auth_admin_failed');},
 claimInvitation:({emailFingerprint,requestId})=>rpc('claim_staff_invitation',{p_email_fingerprint:emailFingerprint,p_request_id:requestId}),
 settleInvitation:({authUserId,claimToken,failureCode,nextState,requestId})=>rpc('settle_staff_invitation',{p_auth_user_id:authUserId,p_claim_token:claimToken,p_failure_code:failureCode,p_next_state:nextState,p_request_id:requestId}),
 provisionStaff:({requestId,userId})=>rpc('provision_invited_staff',{p_request_id:requestId,p_user_id:userId}),
 reconcileInvitation:({emailFingerprint,userId})=>rpc('reconcile_staff_invitation',{p_email_fingerprint:emailFingerprint,p_auth_user_id:userId}),
};
for(const requestId of [request,request,fresh])await assert.rejects(()=>inviteStaffMember({email,requestId,redirectTo:'http://localhost:3000/invite/accept'},deps),e=>e.code==='invitation_outcome_unknown');
assert.equal(attempts,1);
assert.equal(sql(`select state from private.staff_invitation_requests where request_id=${literal(request)}`),'unknown');
assert.equal(sql(`select count(*) from public.role_management_events where request_id=${literal(request)}`),'0');
assert.equal(sql(`select count(*) from private.staff_invitation_requests where request_id=${literal(fresh)}`),'0');
console.log('PASS: real local PostgreSQL RPC integration, three requests -> one Admin attempt; unknown retained; no provisioning audit or second claim');
