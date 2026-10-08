import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SCHEDULE,validateSchedule,vancouverTime,reminderPlan,createDeliveries,expireReminder} from '../scripts/promotion/schedule.mjs';
const event={title:'Film discussion',date:'2026-11-08',promotion:{story_image:'/story.jpg'}};
const draft={channels:['email','instagram','story','whatsapp'],groups:['pup'],instagram:'Film discussion details',whatsapp:'Discussion details'};
const now=Date.parse('2026-10-01T17:00:00Z');
test('Stories default and calendar-day reminders survive DST',()=>{
  const rows=reminderPlan(event,draft,DEFAULT_SCHEDULE,now);
  assert.equal(rows.length,6);assert.equal(rows.filter(r=>r.channel==='story').length,4);
  assert.equal(vancouverTime('2026-10-25','10:00'),'2026-10-25T17:00:00.000Z');
  assert.equal(vancouverTime('2026-11-02','10:00'),'2026-11-02T18:00:00.000Z');
  assert.throws(()=>vancouverTime('2026-03-08','02:30'));
});
test('launch email only, manual WhatsApp, immutable reminder wording',()=>{
  const deliveries=createDeliveries(event,{...draft,reminderTexts:{'story-7':'Reviewed wording'}},DEFAULT_SCHEDULE,now);
  assert.equal(Object.values(deliveries).filter(d=>d.channel==='email').length,1);
  assert.equal(deliveries['reminder:story-7'].text,'Reviewed wording');
  assert.equal(deliveries['reminder:whatsapp-7'].status,'manual');
});
test('passed reminders skipped, duplicate days collapsed, invalid settings rejected',()=>{
  const rows=reminderPlan(event,draft,{...DEFAULT_SCHEDULE,instagramDays:[7,7],whatsappDays:[]},Date.parse('2026-11-03T18:00:00Z'));
  assert.equal(rows.length,1);assert.equal(rows[0].skipped,true);
  assert.ok(validateSchedule({...DEFAULT_SCHEDULE,instagramDays:[-1]}).length);
  assert.ok(validateSchedule({...DEFAULT_SCHEDULE,reminderTime:'25:00'}).length);
});
test('late reminders expire but sent records and launch do not',()=>{
  const d={phase:'1 day before',status:'queued',dueAt:new Date(now).toISOString()};
  assert.equal(expireReminder(d,now+7*3600000),true);
  assert.equal(expireReminder({...d,status:'sent'},now+7*3600000),false);
  assert.equal(expireReminder({...d,phase:'Launch'},now+7*3600000),false);
});
