(() => {
  const $=id=>document.getElementById(id), API='http://127.0.0.1:8082/api';
  let data, event, draftRevision, dirty=false, storyReady=false, generation=0, reminderTexts={}, planStamp='';
  const days=id=>$(id).value.trim()?$(id).value.split(',').map(v=>Number(v.trim())):[];
  function settings(prefix='') {return {launchChannels:[...$(prefix?'default-launch':'channels').querySelectorAll('input:checked')].map(e=>e.value),instagramDays:days(prefix+'instagram-days'),whatsappDays:days(prefix+'whatsapp-days'),instagramChannel:$(prefix+'instagram-channel').value,reminderTime:$(prefix?'default-time':'reminder-time').value,timezone:'America/Vancouver',reviewRequired:true};}
  function fillSettings(s,prefix='') {$(prefix+'instagram-days').value=s.instagramDays.join(', ');$(prefix+'whatsapp-days').value=s.whatsappDays.join(', ');$(prefix+'instagram-channel').value=s.instagramChannel;$(prefix?'default-time':'reminder-time').value=s.reminderTime;}
  function stamp() {const d=draft();return JSON.stringify([d.instagram,d.whatsapp,d.settings,d.scheduledAt,d.reminderTexts]);}
  async function previewReminders() {
    const id=event.id, result=await api('/plan',{id,draft:draft()});if(event.id!==id)return;
    const root=$('reminder-plan');root.replaceChildren();
    if(!result.rows.length)text(root,'p','No reminders selected.');
    for(const row of result.rows) {
      reminderTexts[row.id]=row.text;
      const box=text(root,'details','','reminder-details');
      const when=new Date(row.dueAt).toLocaleString('en-CA',{timeZone:'America/Vancouver',dateStyle:'medium',timeStyle:'short'});
      const label=`${row.channel==='story'?'Instagram Story':row.channel==='instagram'?'Instagram feed':'WhatsApp'} · ${row.daysBefore} day${row.daysBefore===1?'':'s'} before · ${when}${row.skipped?' · skipped (before launch)':''}`;
      text(box,'summary',label).setAttribute('aria-label',label);
      text(box,'p',row.channel==='story'?'Stories use the reviewed Story artwork. This text is for manual handoff; Instagram does not publish it as a Story caption.':'Review or edit the reminder wording.','small');
      const input=document.createElement('textarea');input.value=row.text;input.rows=7;input.setAttribute('aria-label',`${row.channel} reminder ${row.daysBefore} days before`);box.append(input);
      input.addEventListener('input',()=>{reminderTexts[row.id]=input.value;planStamp=stamp();});
      const copy=text(box,'button','Copy reminder','secondary');copy.addEventListener('click',run(async()=>{await navigator.clipboard.writeText(input.value);notice('Reminder copied.');}));
    }
    planStamp=stamp();
  }
  const notice=(message,error=false)=>{$('notice').textContent=message;$('notice').classList.toggle('error',error);};
  async function api(path,body) {
    const res=await fetch(API+path,body ? {method:'POST',headers:{'Content-Type':'application/json','X-Promotion-Token':data.token},body:JSON.stringify(body)} : {});
    const result=await res.json(); if(!res.ok) throw new Error(result.error); return result;
  }
  function draft() {return {subject:$('subject').value,email:$('email').value,instagram:$('instagram').value,whatsapp:$('whatsapp').value,
    groups:[...$('groups').querySelectorAll('input:checked')].map(e=>e.value),channels:[...$('channels').querySelectorAll('input:checked')].map(e=>e.value),
    scheduledAt:$('schedule').value?new Date($('schedule').value).toISOString():'',reviewed:$('reviewed').checked,revision:draftRevision,settings:settings(),reminderTexts:{...reminderTexts}};}
  function fill(d) {
    draftRevision=d.revision;
    for (const key of ['subject','email','instagram','whatsapp']) $(key).value=d[key]||'';
    for(const input of $('channels').querySelectorAll('input')) input.checked=(d.channels||[]).includes(input.value);
    for(const input of $('groups').querySelectorAll('input')) input.checked=(d.groups||[]).includes(input.value);
    fillSettings(d.settings||data.defaults);reminderTexts={...d.reminderTexts};planStamp='';
    $('reviewed').checked=!!d.reviewed&&!!d.settings;
    const date=d.scheduledAt?new Date(d.scheduledAt):null;
    $('schedule').value=date?new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';
    count();dirty=false;
  }
  function count() {$('caption-count').textContent=`${$('instagram').value.length.toLocaleString()} / 2,200 characters`;}
  function text(parent,tag,value,className) {const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;parent.append(el);return el;}
  function history() {
    const job=data.jobs[event.id], root=$('history'); root.replaceChildren();$('cancel').hidden=!job||job.cancelled||job.finished;
    if(!job){root.textContent='No campaign queued for this event.';return;}
    text(root,'p',job.cancelled?'Campaign cancelled':job.finished?'Campaign complete':job.note||'Campaign in progress');
    for(const [key,d] of Object.entries(job.deliveries)) {
      const row=text(root,'div','','history-row');const channel=d.channel||key.split(':')[0],group=d.group||key.slice(6);
      text(row,'span',`${channel==='email'?`Email · ${data.groups.find(g=>g.id===group)?.label||group}`:channel==='story'?'Instagram Story':channel} · ${d.phase||'Launch'}${d.dueAt?' · '+new Date(d.dueAt).toLocaleString('en-CA',{timeZone:'America/Vancouver'}):''}`);
      text(row,'strong',({'sent':'Sent','manual':'Finish manually','needs-check':'Check provider','queued':'Queued','sending':'Sending','manual-done':'Manually completed'})[d.status]||d.status);
      if(d.error||d.reason)text(root,'p',d.error||d.reason);
      if(d.status==='manual'&&!job.cancelled&&(!d.dueAt||Date.parse(d.dueAt)<=Date.now())) {
        const button=text(root,'button','Mark as posted','secondary');
        button.addEventListener('click',run(async()=>{if(!confirm('Have you finished posting this announcement in the destination app?'))return;await api('/manual-complete',{id:event.id,channel:key});await load(event.id);}));
      }
    }
  }
  async function select(id) {
    event=data.events.find(e=>e.id===id);if(!event)return;
    $('event').value=id;
    $('event-title').textContent=event.title;$('series').textContent=event.series==='cinema'?'CINEMA & STRUGGLE':event.series==='orgschool26'?'ORGANIZER SCHOOL':'EVENT';
    $('details').textContent=[event.date,event.time,event.location].filter(Boolean).join(' · ');
    $('poster').hidden=!event.image;$('poster').src=event.image||'';
    $('event-link').href=event.url;
    const collection=event.series==='orgschool26'?'orgschool':'events';
    $('edit-link').href=`./#/collections/${collection}/entries/${event.id.split('/').pop().replace(/\.html$/,'')}`;
    const ready=$('readiness');ready.replaceChildren();
    for(const [done,label] of [[!!event.image,'Poster uploaded'],[!!(event.date&&event.time&&event.location),'Date, time and venue entered'],[!!event.promotion?.confirmed,'Event details confirmed'],[!!event.promotion?.materials_ready,'Materials confirmed']]) text(ready,'li',`${done?'✓':'○'} ${label}`);
    $('collaborators').textContent=event.promotion?.collaborators?.length?`Finish in Instagram: invite ${event.promotion.collaborators.map(h=>'@'+h.replace(/^@/,'')).join(', ')} as collaborators. This post will be marked for manual publishing.`:'No collaborators selected. This post can publish automatically once Instagram is connected.';
    fill(data.drafts[id]||(await api('/generate',{id})).draft);await previewReminders();history();drawStory();
    notice(data.drafts[id]?'Saved draft loaded. If the event has changed, generate fresh drafts and review them.':'Drafts prepared from the saved event. Review the wording before sending.');
  }
  async function load(id) {
    data=await api('/bootstrap');$('offline').hidden=true;$('studio').hidden=false;
    $('mode').textContent=data.publishing?'Live delivery enabled':'Preview · live delivery off';
    $('google-state').textContent=data.gmail.connected?`Google connected · test recipient: ${data.gmail.sender}`:data.gmail.sender?`${data.gmail.sender} · connection pending`:'Google account not connected';
    $('connect').disabled=!data.gmail.configured;$('connect').textContent=data.gmail.connected?'Reconnect Google':'Connect Google';
    $('test').disabled=!data.gmail.connected;$('test-note').textContent=data.gmail.connected?` Only sends to ${data.gmail.sender}.`:' Connect Google to send a test.';
    instagramStatus();
    fillSettings(data.defaults,'default-');for(const input of $('default-launch').querySelectorAll('input'))input.checked=data.defaults.launchChannels.includes(input.value);
    $('queue').disabled=!data.publishing;$('queue-note').textContent=data.publishing?'Queueing starts delivery after the selected time and live-page verification. Keep the service running.':'Live delivery is disabled. You can generate, edit and save drafts now. Account setup is required before queueing.';
    $('groups').replaceChildren();
    if(!data.groups.length)text($('groups'),'p','No mailing lists configured yet. Add your Google Groups in the private connection settings.','small');
    for(const group of data.groups){const label=text($('groups'),'label','');const input=document.createElement('input');input.type='checkbox';input.value=group.id;label.append(input,document.createTextNode(group.label));}
    $('event').replaceChildren();
    for(const e of data.events){const option=document.createElement('option');option.value=e.id;option.textContent=`${e.date||'Undated'} — ${e.title}`;$('event').append(option);}
    const upcoming=data.events.find(e=>e.date>=new Date().toLocaleDateString('en-CA',{timeZone:'America/Vancouver'}));
    await select(id||upcoming?.id||data.events[0]?.id);
  }
  async function drawStory() {
    const sequence=++generation;storyReady=false;$('download-story').disabled=true;
    const canvas=$('story-canvas'),ctx=canvas.getContext('2d');ctx.fillStyle='#f5f7fb';ctx.fillRect(0,0,1080,1920);
    ctx.strokeStyle='#dce5f0';ctx.lineWidth=1;for(let x=0;x<1080;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1920);ctx.stroke();}for(let y=0;y<1920;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1080,y);ctx.stroke();}
    ctx.fillStyle='#244f82';ctx.fillRect(0,0,1080,18);ctx.font='bold 29px sans-serif';ctx.fillText('PEOPLE’S UNIVERSITY',70,110);
    const wrap=(value,y,size,maxLines)=>{ctx.font=`bold ${size}px sans-serif`;let line='',lines=[];for(const word of value.split(/\s+/)){if(ctx.measureText(line+' '+word).width>930&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);lines.slice(0,maxLines).forEach((l,i)=>ctx.fillText(i===maxLines-1&&lines.length>maxLines?l+'…':l,70,y+i*size*1.2));};
    wrap(event.title,205,57,3);
    $('story-note').textContent='';
    let posterDrawn=false;
    if(event.image){try{const img=new Image();img.crossOrigin='anonymous';img.src=event.image;await img.decode();if(sequence!==generation)return;const scale=Math.min(940/img.width,990/img.height);ctx.drawImage(img,(1080-img.width*scale)/2,430+(990-img.height*scale)/2,img.width*scale,img.height*scale);posterDrawn=true;}catch{$('story-note').textContent='This poster host does not allow image export. The downloaded story uses a text layout; upload a local poster to include it.';}}
    if(!posterDrawn)wrap(event.summary||'Join us for discussion and study.',520,43,14);
    ctx.fillStyle='#244f82';wrap(`${event.date} · ${event.time||''}`,1540,40,2);wrap(event.location||'',1680,35,3);ctx.font='26px sans-serif';ctx.fillText('Details & materials on the People’s University website',70,1860);
    if(sequence===generation){storyReady=true;$('download-story').disabled=false;}
  }
  const run=fn=>async e=>{const button=e?.currentTarget;try{if(button?.tagName==='BUTTON')button.disabled=true;await fn(e);}catch(error){notice(error.message,true);}finally{if(button?.tagName==='BUTTON')button.disabled=false;if(data)$('queue').disabled=!data.publishing;}};
  function instagramStatus() {$('instagram-state').textContent=`${data.instagramHandle?'@'+data.instagramHandle+' · ':''}${data.instagramVerified?'Profile verified · Instagram-only':data.instagram?'Credentials configured (not yet verified)':'Instagram account not connected'}`;}
  $('instagram-connect').addEventListener('click',run(async()=>{
    const accessToken=$('instagram-token').value;$('instagram-token').value='';
    const result=await api('/instagram/connect',{accessToken,graphVersion:$('instagram-version').value});
    Object.assign(data,{instagram:result.instagram,instagramVerified:result.instagramVerified,instagramLoginMode:result.instagramLoginMode});instagramStatus();notice(result.message);
  }));
  $('event').addEventListener('change',run(async()=>{if(dirty&&!confirm('Discard unsaved draft edits?')){$('event').value=event.id;return;}await select($('event').value);}));
  $('refresh').addEventListener('click',run(async()=>{if(dirty&&!confirm('Discard unsaved draft edits and refresh?'))return;await load(event?.id);}));
  $('generate').addEventListener('click',run(async()=>{if(!confirm('Replace all channel text with fresh drafts from the saved event?'))return;fill((await api('/generate',{id:event.id})).draft);await previewReminders();dirty=true;notice('Fresh drafts generated. Review and save them.');}));
  $('save-defaults').addEventListener('click',run(async()=>{data.defaults=(await api('/defaults',{settings:settings('default-')})).defaults;notice('Defaults saved locally. Existing drafts and campaigns have not changed.');}));
  $('apply-defaults').addEventListener('click',run(async()=>{fillSettings(data.defaults);for(const input of $('channels').querySelectorAll('input'))input.checked=data.defaults.launchChannels.includes(input.value);reminderTexts={};$('reviewed').checked=false;dirty=true;await previewReminders();notice('Saved defaults applied. Review the reminder previews again.');}));
  $('preview-reminders').addEventListener('click',run(async()=>{await previewReminders();$('reviewed').checked=false;dirty=true;notice('Reminder dates and wording refreshed. Review before queueing.');}));
  $('save').addEventListener('click',run(async()=>{const d=draft();await api('/draft',{id:event.id,draft:d});data.drafts[event.id]=d;dirty=false;notice('Draft saved locally. Nothing was sent.');}));
  $('queue').addEventListener('click',run(async()=>{if(planStamp!==stamp())throw new Error('Update reminder previews and review them before queueing.');if(!confirm('Queue the reviewed launch and reminder schedule when this event is live?'))return;notice((await api('/queue',{id:event.id,draft:draft()})).message);dirty=false;await load(event.id);}));
  $('test').addEventListener('click',run(async()=>{notice((await api('/test-email',{id:event.id,draft:draft()})).message);}));
  $('cancel').addEventListener('click',run(async()=>{notice((await api('/cancel',{id:event.id})).message);await load(event.id);}));
  $('connect').addEventListener('click',run(async()=>{location.href=(await api('/google/connect',{})).url;}));
  for(const button of document.querySelectorAll('[data-copy]'))button.addEventListener('click',run(async()=>{await navigator.clipboard.writeText($(button.dataset.copy).value);notice('Copied. Paste into the selected channel when ready.');}));
  for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>{for(const tab of document.querySelectorAll('[data-tab]')){const active=tab===button;tab.setAttribute('aria-selected',String(active));$(tab.dataset.tab+'-panel').hidden=!active;}});
  $('download-story').addEventListener('click',()=>{if(!storyReady)return;$('story-canvas').toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='event-story.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);},'image/jpeg',.93);});
  $('studio').addEventListener('input',e=>{if(e.target.id==='event'||e.target.closest('#defaults-panel')||e.target.closest('#instagram-setup'))return;dirty=true;if(e.target.id!=='reviewed')$('reviewed').checked=false;count();});
  addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  $('timezone').textContent=Intl.DateTimeFormat().resolvedOptions().timeZone;
  setInterval(async()=>{
    if (!data || !event || document.hidden) return;
    try {const latest=await api('/bootstrap');data.jobs=latest.jobs;data.token=latest.token;history();} catch { /* Keep unsaved text intact if the service stops. */ }
  },15000);
  if(location.protocol==='file:') {
    $('offline').hidden=false;
    notice('Open Promotion studio through the local website to load events and save drafts.',true);
    const link=document.createElement('a');link.href='http://127.0.0.1:4000/website/admin/promotion.html';link.textContent='Open local Promotion studio →';$('offline').append(link);
  } else load().catch(()=>{$('offline').hidden=false;notice('The local promotion service is not available. Start it below, then reload.',true);});
})();
