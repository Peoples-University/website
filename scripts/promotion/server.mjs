import http from 'node:http';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fingerprint, generate, readiness, validateDraft, emailMessage, absolute} from './core.mjs';
import {DEFAULT_SCHEDULE,validateSchedule,reminderPlan,createDeliveries,expireReminder} from './schedule.mjs';
import {graphRequest,verifiedProfile} from './instagram.mjs';

const base = new URL('../../', import.meta.url);
const privateDir = new URL('.promotion/', base);
await mkdir(privateDir, {recursive:true, mode:0o700});
const readJSON = async (url, fallback) => {try {return JSON.parse(await readFile(url,'utf8'));} catch(e) {if (e.code === 'ENOENT') return fallback; throw e;}};
const defaults = await readJSON(new URL('config.example.json', import.meta.url));
const config = {...defaults, ...await readJSON(new URL('config.json',privateDir), {})};
const state = await readJSON(new URL('state.json',privateDir), {drafts:{}, jobs:{}, gmail:{}});
state.defaults={...DEFAULT_SCHEDULE,...state.defaults,reviewRequired:true};
const token = randomBytes(32).toString('hex');
const origins = new Set(['http://127.0.0.1:4000','http://localhost:4000']);
const callback = 'http://127.0.0.1:8082/oauth/callback';
let oauth, busy = false;
let writes = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(state,null,2);
  writes = writes.then(async () => {
    const temp = new URL('state.tmp',privateDir);
    await writeFile(temp, snapshot, {mode:0o600});
    await rename(temp, new URL('state.json',privateDir));
  });
  return writes;
}
const events = async () => readJSON(new URL('_site/admin/promotion-events.json',base), []);
async function eventById(id) {const e = (await events()).find(e=>e.id===id); if (!e) throw new Error('Event not found. Save in the CMS and wait for the website to rebuild.'); return e;}
async function request(url, options={}) {
  const res = await fetch(url, {...options, signal:AbortSignal.timeout(25000)});
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error_description || `Provider returned ${res.status}`);
  return data;
}
async function gmailToken() {
  if (!state.gmail.refresh_token) throw new Error('Connect Google first');
  if (state.gmail.email?.toLowerCase()!==config.gmail.sender.toLowerCase()) throw new Error('Reconnect Google with the configured sending account');
  return (await request('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({
    client_id:config.gmail.clientId,client_secret:config.gmail.clientSecret,refresh_token:state.gmail.refresh_token,grant_type:'refresh_token'
  })})).access_token;
}
async function sendEmail(to, subject, body) {
  const access = await gmailToken();
  return request('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {method:'POST', headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({raw:emailMessage(to,subject,body)})});
}
async function graph(path, params, method='GET') {
  const {url,options}=graphRequest(instagramConnection(),path,params,method);
  return request(url,options);
}
function instagramConnection() {
  return state.instagram?.accessToken?state.instagram:{...config.instagram,loginMode:config.instagram.loginMode||(config.instagram.accessToken?'facebook':'instagram')};
}
async function publishInstagram(event, draft, channel, delivery) {
  const connection=instagramConnection();
  if (!connection.accountId || !connection.accessToken) throw new Error('Instagram connection is missing');
  const image = absolute(channel === 'story' ? event.promotion?.story_image : event.image, config.siteOrigin);
  if (!image.startsWith('https:')) throw new Error('Instagram artwork needs a public HTTPS URL');
  if (!delivery.container) {
    const container = await graph(`${connection.accountId}/media`, {
      image_url:image, ...(channel === 'story' ? {media_type:'STORIES'} : {caption:draft.instagram})
    }, 'POST');
    delivery.container = container.id; await persist();
  }
  const status = await graph(delivery.container,{fields:'status_code'});
  if (status.status_code === 'IN_PROGRESS') {delivery.status='queued'; return;}
  if (status.status_code !== 'FINISHED') throw new Error(`Instagram media status: ${status.status_code}. Check the account before trying again.`);
  const result = await graph(`${connection.accountId}/media_publish`, {creation_id:delivery.container}, 'POST');
  delivery.providerId = result.id;
}
async function checkLive(event) {
  const live = await request(absolute('/website/admin/promotion-events.json',config.siteOrigin));
  if (fingerprint(live.find(e=>e.id===event.id)) !== fingerprint(event)) return false;
  const page = await fetch(absolute(event.url, config.siteOrigin),{signal:AbortSignal.timeout(15000)});
  return page.ok;
}
async function tick() {
  if (busy || !config.allowPublishing) return;
  busy=true;
  try {
    for (const job of Object.values(state.jobs)) {
      if (job.cancelled || job.finished || (job.draft.scheduledAt && Date.parse(job.draft.scheduledAt)>Date.now())) continue;
      const current = await eventById(job.event.id);
      if (fingerprint(current)!==job.revision) {job.note='Event changed. Cancel this campaign and review new drafts.'; await persist(); continue;}
      if (readiness(current).length) {job.note=readiness(current).join('; '); await persist(); continue;}
      try {if (!await checkLive(current)) {job.note='Waiting for this exact event revision to appear on the live website.'; await persist(); continue;}}
      catch {job.note='Could not verify the live website. Nothing sent.'; await persist(); continue;}
      job.note='';
      for (const [key, delivery] of Object.entries(job.deliveries)) {
        // Support earlier launch-only records without resending completed deliveries.
        delivery.channel ||= key.startsWith('email:')?'email':key;
        delivery.group ||= key.startsWith('email:')?key.slice(6):undefined;
        delivery.phase ||= 'Launch';
        delivery.dueAt ||= job.draft.scheduledAt||job.createdAt;
        if(expireReminder(delivery)) {delivery.status='skipped';delivery.reason='Reminder window passed; skipped instead of sending late.';await persist();continue;}
        if(Date.parse(delivery.dueAt)>Date.now())continue;
        if (delivery.status!=='queued') continue;
        delivery.status='sending'; await persist();
        try {
          if (delivery.channel==='email') {
            const group=config.groups.find(g=>g.id===delivery.group);
            if (!group) throw new Error('Group is no longer configured');
            const result=await sendEmail(group.address,job.draft.subject,job.draft.email);
            delivery.providerId=result.id;
          } else await publishInstagram(current,{...job.draft,instagram:delivery.text||job.draft.instagram},delivery.channel,delivery);
          if (delivery.status==='sending') {delivery.status='sent'; delivery.sentAt=new Date().toISOString();}
        } catch {delivery.status='needs-check'; delivery.error='Delivery was not confirmed. Check Gmail Sent or Instagram before starting another campaign; automatic retry is paused to prevent duplicates.';}
        await persist();
      }
      job.finished=Object.values(job.deliveries).every(d=>['sent','manual-done','skipped'].includes(d.status));
      await persist();
    }
  } finally {busy=false;}
}
// A restart during a send leaves an uncertain result. Never resend it silently.
for (const job of Object.values(state.jobs)) for (const d of Object.values(job.deliveries)) if (d.status==='sending') d.status='needs-check';
await persist();
function publicStatus() {return {publishing:config.allowPublishing,groups:config.groups.map(({id,label})=>({id,label})),defaults:state.defaults,
  gmail:{configured:!!(config.gmail?.clientId && config.gmail?.clientSecret && config.gmail?.sender), connected:!!state.gmail.refresh_token,sender:config.gmail?.sender || ''},
  instagram:!!(instagramConnection().accountId && instagramConnection().accessToken), instagramVerified:!!state.instagram?.verifiedAt,
  instagramLoginMode:instagramConnection().loginMode,instagramHandle:config.instagram?.handle||'',siteOrigin:config.siteOrigin};}
const server=http.createServer(async (req,res)=>{
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try {
    if (req.headers.host!=='127.0.0.1:8082') return reply(403,{error:'Invalid host'});
    const url=new URL(req.url,'http://127.0.0.1:8082');
    if (url.pathname==='/oauth/callback') {
      if (!oauth || Date.now()>oauth.expires || url.searchParams.get('state')!==oauth.value) throw new Error('Google connection expired. Start again.');
      oauth=null;
      const result=await request('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code:url.searchParams.get('code')||'',client_id:config.gmail.clientId,client_secret:config.gmail.clientSecret,redirect_uri:callback,grant_type:'authorization_code'})});
      if (!result.refresh_token) throw new Error('Google did not return an offline token. Reconnect with consent.');
      const identity=JSON.parse(Buffer.from(result.id_token?.split('.')[1] || '', 'base64url').toString());
      if (!identity.email_verified || identity.email?.toLowerCase()!==config.gmail.sender.toLowerCase()) throw new Error('Sign in with the configured sending account. The selected Google account does not match.');
      state.gmail={refresh_token:result.refresh_token,email:identity.email}; await persist();
      res.writeHead(302,{Location:'http://127.0.0.1:4000/website/admin/promotion.html'});return res.end();
    }
    if (!origins.has(req.headers.origin)) return reply(403,{error:'Open Promotion studio from the local website'});
    res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
    res.setHeader('Vary','Origin');
    if (req.method==='OPTIONS') {res.writeHead(204,{'Access-Control-Allow-Headers':'Content-Type, X-Promotion-Token','Access-Control-Allow-Methods':'GET, POST'});return res.end();}
    if (req.method==='GET' && url.pathname==='/api/bootstrap') return reply(200,{token,...publicStatus(),events:await events(),drafts:state.drafts,jobs:state.jobs});
    if (req.method!=='POST' || req.headers['x-promotion-token']!==token) return reply(403,{error:'Reload Promotion studio before saving'});
    let raw=''; for await (const chunk of req) {raw+=chunk; if(raw.length>250000) throw new Error('Request too large');}
    const body=JSON.parse(raw||'{}');
    if(url.pathname==='/api/instagram/connect') {
      if(busy||Object.values(state.jobs).some(j=>!j.cancelled&&!j.finished))throw new Error('Cancel pending campaigns before changing Instagram credentials');
      const accessToken=body.accessToken?.trim(),graphVersion=body.graphVersion?.trim();
      if(!accessToken||accessToken.length>10000||/\s/.test(accessToken))throw new Error('Enter the Instagram User access token generated by your app');
      const connection={loginMode:'instagram',accessToken,graphVersion};
      const {url:profileURL,options}=graphRequest(connection,'me',{fields:'user_id,username'});
      let profile;
      try {profile=await request(profileURL,options);}catch {throw new Error('Instagram could not verify this token. Check app roles, token expiry, Instagram Login setup and basic permission. Existing credentials were not changed.');}
      const verified=verifiedProfile(profile,config.instagram.handle);
      state.instagram={...connection,...verified,verifiedAt:new Date().toISOString()};await persist();
      return reply(200,{message:`Verified @${verified.username} through Instagram Login. Token saved privately. Nothing posted; publishing permission and token renewal still need checking.`,...publicStatus()});
    }
    if (url.pathname==='/api/google/connect') {
      if (!publicStatus().gmail.configured) throw new Error('Add Google OAuth settings and sender in .promotion/config.json, then restart the service');
      oauth={value:randomBytes(24).toString('hex'),expires:Date.now()+600000};
      const google=new URL('https://accounts.google.com/o/oauth2/v2/auth');
      google.search=new URLSearchParams({client_id:config.gmail.clientId,redirect_uri:callback,response_type:'code',scope:'openid email https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',state:oauth.value,login_hint:config.gmail.sender}).toString();
      return reply(200,{url:google.href});
    }
    if(url.pathname==='/api/defaults') {
      const issues=validateSchedule(body.settings||{});if(issues.length)throw new Error(issues.join('\n'));
      state.defaults={...body.settings,reviewRequired:true};await persist();
      return reply(200,{defaults:state.defaults,message:'Defaults saved. Existing drafts and queued campaigns keep their own schedules.'});
    }
    const event=await eventById(body.id);
    if (url.pathname==='/api/generate') return reply(200,{draft:{...generate(event,config.siteOrigin),channels:state.defaults.launchChannels,settings:state.defaults,reminderTexts:{}}});
    if (url.pathname==='/api/plan') return reply(200,{rows:reminderPlan(event,body.draft,body.draft.settings||state.defaults)});
    if (['/api/draft','/api/queue','/api/test-email'].includes(url.pathname) && body.draft?.revision!==fingerprint(event)) throw new Error('Event details changed since these drafts were generated. Refresh and generate fresh drafts before continuing.');
    if (url.pathname==='/api/draft') {state.drafts[event.id]=body.draft;await persist();return reply(200,{saved:true});}
    if (url.pathname==='/api/test-email') {
      if (!config.gmail.sender) throw new Error('Configure a sender first');
      await sendEmail(config.gmail.sender,`[TEST] ${body.draft.subject}`,body.draft.email);
      return reply(200,{message:`Test sent to ${config.gmail.sender}. No groups were emailed.`});
    }
    if (url.pathname==='/api/queue') {
      const issues=[...readiness(event),...validateDraft(body.draft,config)];
      issues.push(...validateSchedule(body.draft.settings||state.defaults));
      const deliveries=createDeliveries(event,body.draft,body.draft.settings||state.defaults);
      if(Object.values(deliveries).some(d=>d.channel==='instagram'&&d.text?.length>2200)) issues.push('A reminder caption exceeds 2,200 characters. Shorten it before queueing.');
      if (issues.length) throw new Error(issues.join('\n'));
      if (!config.allowPublishing) throw new Error('Live delivery is disabled. Save a draft while connections are being set up.');
      if (body.draft.channels.includes('email') && !state.gmail.refresh_token) throw new Error('Connect Google first');
      if (Object.values(deliveries).some(d=>['instagram','story'].includes(d.channel)&&d.status==='queued') && !publicStatus().instagram) throw new Error('Configure Instagram first, or use the manual handoff for that channel');
      if (state.jobs[event.id] && !state.jobs[event.id].cancelled) throw new Error('This event already has a campaign. Use its delivery history; editing does not send it again.');
      // A cancelled campaign with any attempted send cannot be replaced automatically.
      if (state.jobs[event.id] && Object.values(state.jobs[event.id].deliveries).some(d=>['sent','needs-check','manual-done'].includes(d.status))) throw new Error('This event has previous delivery activity. A follow-up needs a separate campaign; it cannot be resent here.');
      state.drafts[event.id]=body.draft;
      state.jobs[event.id]={event,draft:body.draft,revision:fingerprint(event),deliveries,createdAt:new Date().toISOString(),note:'Waiting for live website verification'};
      await persist();return reply(200,{message:'Campaign queued. The service must remain running to deliver it.'});
    }
    if (url.pathname==='/api/cancel') {
      if (busy) throw new Error('A delivery check is running. Try again in a moment.');
      if (state.jobs[event.id]) state.jobs[event.id].cancelled=true;
      await persist();return reply(200,{message:'Pending deliveries cancelled. Already sent messages remain sent.'});
    }
    if (url.pathname==='/api/manual-complete') {
      const job=state.jobs[event.id], delivery=job?.deliveries[body.channel];
      if (!delivery || delivery.status!=='manual') throw new Error('This channel does not have a pending manual step');
      if(job.cancelled)throw new Error('This campaign was cancelled');
      if(delivery.dueAt&&Date.parse(delivery.dueAt)>Date.now())throw new Error('This reminder is scheduled for later');
      delivery.status='manual-done';delivery.sentAt=new Date().toISOString();
      job.finished=Object.values(job.deliveries).every(d=>['sent','manual-done','skipped'].includes(d.status));
      await persist();return reply(200,{message:'Manual post recorded.'});
    }
    return reply(404,{error:'Not found'});
  } catch(e) {reply(400,{error:e.message});}
});
server.listen(8082,'127.0.0.1',()=>console.log('Promotion studio service: http://127.0.0.1:8082 · live delivery '+(config.allowPublishing?'enabled':'disabled')));
setInterval(()=>tick().catch(()=>console.error('Delivery check failed; queue retained.')),30000);
