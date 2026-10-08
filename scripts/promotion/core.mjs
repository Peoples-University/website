import { createHash } from 'node:crypto';
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const absolute = (value, origin) => value ? new URL(value, origin).href : '';
export function facts(event, origin) {
  const date = event.date ? new Date(event.date + 'T12:00:00Z').toLocaleDateString('en-CA', {dateStyle:'long', timeZone:'UTC'}) : 'Date to be confirmed';
  return [event.title, `${date} · ${event.time || 'Time to be confirmed'} (Vancouver)`, event.location, absolute(event.url, origin),
    event.registration && event.registration !== '##' ? `Register: ${event.registration}` : '',
    ...(event.readings || []).map(r => `${r.reading_status === 'optional' ? 'Optional' : 'Required'}: ${r.reading_title}\n${absolute(r.reading_pdf || r.reading_link, origin)}`),
    event.slides ? `Slides: ${event.slides}` : ''].filter(Boolean).join('\n');
}
export function generate(event, origin) {
  const details = {...event, readings:[], slides:''};
  const short = (event.summary || '').length > 420 ? event.summary.slice(0,420).replace(/\s+\S*$/,'')+'…' : event.summary || '';
  return {subject:event.title, email:`${event.summary || ''}\n\n${facts(event,origin)}`,
    instagram:`${event.summary || ''}\n\n${facts(details,origin)}\n\nDetails and materials on our website.`,
    whatsapp:`${short}\n\n${facts(details,origin)}`, story:event.title,
    groups:[], channels:['email','instagram','whatsapp'], scheduledAt:'', reviewed:false, revision:fingerprint(event)};
}
export function readiness(event) {
  const issues = [];
  for (const [key, label] of Object.entries({title:'Title',date:'Event date',time:'Time',location:'Venue',summary:'Description',image:'Poster'})) {
    if (!event[key]) issues.push(`${label} is missing`);
  }
  if (event.date && !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) issues.push('Event date is invalid');
  if (!event.promotion?.confirmed) issues.push('Confirm poster, date and description in the CMS');
  if (!event.promotion?.materials_ready) issues.push('Confirm materials are ready or not needed in the CMS');
  if (event.date && event.date < new Date().toLocaleDateString('en-CA', {timeZone:'America/Vancouver'})) issues.push('Event is in the past');
  return issues;
}
export function validateDraft(draft, config) {
  const issues = [];
  if (!draft.reviewed) issues.push('Review the channel drafts before queueing');
  if (!Array.isArray(draft.channels) || !draft.channels.length) issues.push('Select at least one channel');
  if ((draft.channels || []).some(c => !['email','instagram','story','whatsapp'].includes(c))) issues.push('Unknown channel');
  if (draft.channels?.includes('email')) {
    if (!draft.groups?.length) issues.push('Select at least one Google Group');
    if (draft.groups?.some(id => !config.groups.some(g => g.id === id))) issues.push('Unknown Google Group');
    if (!draft.email?.trim() || !draft.subject?.trim()) issues.push('Email subject and message are required');
  }
  if (draft.channels?.includes('instagram') && (!draft.instagram?.trim() || draft.instagram.length > 2200)) issues.push('Instagram caption must contain 1–2,200 characters');
  if (draft.scheduledAt && !Number.isFinite(Date.parse(draft.scheduledAt))) issues.push('Schedule date is invalid');
  if (/[\r\n]/.test(draft.subject || '')) issues.push('Email subject must be a single line');
  return issues;
}
export function emailMessage(to, subject, body) {
  if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to)) throw new Error('Invalid recipient');
  if (/[\r\n]/.test(subject)) throw new Error('Invalid subject');
  return Buffer.from(`To: ${to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(body).toString('base64').match(/.{1,76}/g)?.join('\r\n') || ''}`).toString('base64url');
}
