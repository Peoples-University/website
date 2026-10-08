import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,readiness,validateDraft,emailMessage,fingerprint} from '../scripts/promotion/core.mjs';
const event={title:'A study session',date:'2099-10-08',time:'6–8pm',location:'Room 2200',summary:'Study and discussion.',image:'/website/assets/poster.jpg',url:'/website/events/study.html',promotion:{confirmed:true,materials_ready:true},readings:[{reading_title:'Reading one',reading_pdf:'/website/assets/reading.pdf'}]};
test('channel drafts retain event facts and include materials in email',()=>{
  const d=generate(event,'https://example.org');
  for(const key of ['email','instagram','whatsapp']) {assert.match(d[key],/Room 2200/);assert.match(d[key],/October 8, 2099/);assert.match(d[key],/https:\/\/example.org\/website\/events\/study.html/);}
  assert.match(d.email,/Required: Reading one/);assert.match(d.email,/https:\/\/example.org\/website\/assets\/reading.pdf/);
  assert(!d.instagram.includes('Reading one'));assert.equal(d.reviewed,false);
});
test('readiness requires both confirmation fields and complete facts',()=>{
  assert.deepEqual(readiness(event),[]);
  assert.equal(readiness({...event,promotion:{}}).length,2);
  assert(readiness({...event,date:'2000-01-01'}).includes('Event is in the past'));
  assert(readiness({...event,image:null}).includes('Poster is missing'));
});
test('email audiences are restricted to configured groups',()=>{
  const d={...generate(event,'https://example.org'),reviewed:true,channels:['email'],groups:['cinema']};
  assert.deepEqual(validateDraft(d,{groups:[{id:'cinema'}]}),[]);
  assert(validateDraft(d,{groups:[]}).includes('Unknown Google Group'));
  assert(validateDraft({...d,reviewed:false},{groups:[{id:'cinema'}]}).length);
});
test('MIME encoding preserves Unicode and rejects header injection',()=>{
  const raw=Buffer.from(emailMessage('test@example.org','Study & struggle','People’s University'),'base64url').toString();
  assert.match(raw,/To: test@example.org/);
  const body=raw.split('\r\n\r\n')[1];assert.equal(Buffer.from(body,'base64').toString(),'People’s University');
  assert.throws(()=>emailMessage('test@example.org\r\nBcc: other@example.org','Subject','body'));
  assert.throws(()=>emailMessage('test@example.org','Subject\r\nBcc: other@example.org','body'));
});
test('poster and date edits invalidate the approved event revision',()=>{
  assert.notEqual(fingerprint(event),fingerprint({...event,date:'2099-10-09'}));
  assert.notEqual(fingerprint(event),fingerprint({...event,image:'/new.jpg'}));
});
