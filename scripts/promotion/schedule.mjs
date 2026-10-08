export const DEFAULT_SCHEDULE = {
  launchChannels:['email','instagram','story','whatsapp'],
  instagramDays:[7,3,2,1], whatsappDays:[7,1], instagramChannel:'story',
  reminderTime:'10:00', timezone:'America/Vancouver', reviewRequired:true
};
export function validateSchedule(settings) {
  const errors=[];
  for(const key of ['instagramDays','whatsappDays']) if (!Array.isArray(settings[key]) || settings[key].some(n=>!Number.isInteger(n)||n<1||n>90)) errors.push('Reminder days must be whole numbers between 1 and 90');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.reminderTime || '')) errors.push('Reminder time must be HH:MM');
  if (!['story','instagram','both'].includes(settings.instagramChannel)) errors.push('Choose Stories, feed posts, or both');
  if (!Array.isArray(settings.launchChannels) || settings.launchChannels.some(c=>!['email','instagram','story','whatsapp'].includes(c))) errors.push('Invalid launch channels');
  if(settings.timezone!=='America/Vancouver')errors.push('Reminder timezone must be America/Vancouver');
  return [...new Set(errors)];
}
// Convert a Vancouver wall-clock time to UTC without assuming a fixed DST offset.
export function vancouverTime(date,time) {
  const target=Date.parse(`${date}T${time}:00Z`);let guess=target;
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let i=0;i<3;i++) {
    const p=Object.fromEntries(format.formatToParts(new Date(guess)).map(p=>[p.type,p.value]));
    const represented=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    if(represented===target)return new Date(guess).toISOString();guess+=target-represented;
  }
  throw new Error('That reminder time does not exist because the clocks change. Choose a different time.');
}
export function reminderPlan(event,draft,settings,now=Date.now()) {
  const errors=validateSchedule(settings);if(errors.length)throw new Error(errors.join('; '));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(event.date))return [];
  const launch=draft.scheduledAt?Date.parse(draft.scheduledAt):now;
  const rows=[];
  for(const [platform,days] of [['instagram',settings.instagramDays],['whatsapp',settings.whatsappDays]]) for(const day of [...new Set(days)].sort((a,b)=>b-a)) {
    const date=new Date(event.date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-day);
    const dueAt=vancouverTime(date.toISOString().slice(0,10),settings.reminderTime);
    const channels=platform==='whatsapp'?['whatsapp']:settings.instagramChannel==='both'?['instagram','story']:[settings.instagramChannel];
    for(const channel of channels) {
      const id=`${channel}-${day}`;
      rows.push({id,channel,daysBefore:day,dueAt,skipped:Date.parse(dueAt)<=launch,
        text:draft.reminderTexts?.[id] || `Reminder: ${event.title}\n\n${channel==='whatsapp'?draft.whatsapp:draft.instagram}`});
    }
  }
  return rows.sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.channel.localeCompare(b.channel));
}
export function createDeliveries(event,draft,settings,now=Date.now()) {
  const manual=channel=>channel==='whatsapp'||channel==='instagram'&&event.promotion?.collaborators?.length||channel==='story'&&!event.promotion?.story_image;
  const deliveries={};
  for(const channel of draft.channels) {
    const targets=channel==='email'?[...new Set(draft.groups)]:[''];
    for(const group of targets)deliveries[`launch:${channel}${group?':'+group:''}`]={channel,group:group||undefined,phase:'Launch',dueAt:draft.scheduledAt||new Date(now).toISOString(),status:manual(channel)?'manual':'queued'};
  }
  for(const row of reminderPlan(event,draft,settings,now)) {
    // Reminders are independent selections, but each channel must be reviewed in the same campaign.
    deliveries[`reminder:${row.id}`]={channel:row.channel,phase:`${row.daysBefore} day${row.daysBefore===1?'':'s'} before`,dueAt:row.dueAt,text:row.text,
      status:row.skipped?'skipped':manual(row.channel)?'manual':'queued',reason:row.skipped?'Reminder date is before the campaign starts':''};
  }
  return deliveries;
}
export function expireReminder(delivery,now=Date.now()) {
  return delivery.phase!=='Launch' && ['queued','manual'].includes(delivery.status) && now-Date.parse(delivery.dueAt)>6*60*60*1000;
}
