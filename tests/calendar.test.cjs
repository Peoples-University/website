const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Small DOM test double, so calendar logic can be tested without browser automation.
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {};
    this.handlers = {}; this.hidden = false; this.classes = new Set();
    this.classList = { add: value => this.classes.add(value) };
  }
  append(child) { this.children.push(child); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(key, callback) { this.handlers[key] = callback; }
  replaceChildren(...children) { this.children = children; }
  createCaption() { const e = new Element('caption'); this.append(e); return e; }
  createTHead() { const e = new Element('thead'); this.append(e); return e; }
  createTBody() { const e = new Element('tbody'); this.append(e); return e; }
  insertRow() { const e = new Element('tr'); this.append(e); return e; }
  insertCell() { const e = new Element('td'); this.append(e); return e; }
}
const html = fs.readFileSync('_site/index.html', 'utf8');
const dates = [...html.matchAll(/class="calendar-entry" data-event-date="([^"]+)"/g)].map(match => match[1]);
assert.equal(dates.length, 19, 'All confirmed screenings and study sessions included');
assert.equal(dates.filter(date => date === '2026-10-08').length, 1, 'Course and session must not duplicate');
assert.equal(dates.filter(date => date === '2026-10-15').length, 1, 'Week 2 must replace its syllabus calendar placeholder');
assert.equal(dates.filter(date => date === '2026-10-22').length, 1, 'Week 3 must replace its syllabus calendar placeholder');
assert(!dates.includes('2026-09-24'), 'Publication dates must not enter the calendar');
assert(!dates.includes('2026-09-21'), 'Session publication date must not enter the calendar');
const entries = dates.map(date => { const entry = new Element('li'); entry.dataset.eventDate = date; return entry; });
const elements = Object.fromEntries(['.calendar-event-list', '.calendar-month-view', '.calendar-month', '.calendar-empty', '.calendar-controls', '[data-calendar-today]'].map(key => [key, new Element()]));
const previous = new Element('button'); previous.dataset.monthStep = '-1';
const next = new Element('button'); next.dataset.monthStep = '1';
const calendar = new Element();
calendar.querySelector = key => elements[key];
calendar.querySelectorAll = key => key === '[data-event-date]' ? entries : [previous, next];
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-02T02:30:00Z'])); }
}
const document = { querySelectorAll: () => [calendar], createElement: tag => new Element(tag) };
vm.runInNewContext(fs.readFileSync('assets/js/calendar.js', 'utf8'), { document, Date: FixedDate, Intl });
const visibleDates = () => entries.filter(entry => !entry.hidden).map(entry => entry.dataset.eventDate).sort();
assert.equal(elements['.calendar-month'].textContent, 'October 2026');
assert.deepEqual(visibleDates(), ['2026-10-04', '2026-10-08', '2026-10-15', '2026-10-16', '2026-10-18', '2026-10-22', '2026-10-29']);
const table = elements['.calendar-month-view'].children[0];
const cells = table.children.find(child => child.tag === 'tbody').children.flatMap(row => row.children);
assert.equal(cells.filter(cell => cell.className === 'calendar-blank').length, 4);
assert.equal(cells.filter(cell => cell.classes.has('calendar-current')).length, 1, 'Today uses Vancouver, not UTC');
assert(cells.find(cell => cell.classes.has('calendar-has-events')).children[0].href.startsWith('#calendar-0-event-'));
previous.handlers.click();
assert.deepEqual(visibleDates(), ['2026-09-04']);
elements['[data-calendar-today]'].handlers.click();
assert.equal(elements['.calendar-month'].textContent, 'October 2026');
next.handlers.click(); next.handlers.click(); next.handlers.click();
assert.equal(elements['.calendar-month'].textContent, 'January 2027');
assert.equal(elements['.calendar-empty'].hidden, false);
assert.equal(visibleDates().length, 0);
// Leap February and year navigation.
for (let n = 0; n < 13; n++) next.handlers.click();
assert.equal(elements['.calendar-month'].textContent, 'February 2028');
const leapTable = elements['.calendar-month-view'].children[0];
const leapCells = leapTable.children.find(child => child.tag === 'tbody').children.flatMap(row => row.children);
assert.equal(leapCells.filter(cell => cell.children.length).length, 29);
for (const [file, expected] of [
  ['_site/orgschool26/thinking-scientifically.html', '2026-10-08'],
  ['_site/orgschool26/toward-a-science-of-society.html', '2026-10-15'],
  ['_site/orgschool26/the-birth-of-the-capitalist-mode-of-production.html', '2026-10-22'],
  ['_site/studies/canadian-class-structure-discussion-writing-group.html', '2026-10-04'],
  ['_site/events/cinema-struggle-how-to-blow-up-a-pipeline.html', '2026-09-04'],
  ['_site/events/cinema-struggle-the-people-under-the-stairs.html', '2026-10-16']
]) {
  const page = fs.readFileSync(file, 'utf8');
  const meta = page.match(/<div class="article-meta">([\s\S]*?)<\/div>/)[1];
  assert(meta.includes(`datetime="${expected}"`), `${file} must show the meeting date`);
}
const cinema = fs.readFileSync('_site/cinema-and-struggle/index.html', 'utf8');
assert(cinema.includes('class="cinema-theme"'));
assert(cinema.includes('The People Under The Stairs'));
assert.equal((cinema.match(/class="content-card/g) || []).length, 6);
assert(html.includes('VPL Central Branch, Level 6 North (690) Meeting Room'));
const school = fs.readFileSync('_site/orgschool26/thinking-scientifically.html', 'utf8');
assert.equal((school.match(/class="resource-link"[^>]*>\[OPTIONAL\] Activist Study/g) || []).length, 1);
assert(school.includes('2PACX-1vRojCS-TonINxh0dUw4wfylBsOI-HH-ckQdMqCll6yC1BshU_-LmyKkcps-obA3BcV_yalDPrQDUrgG'));
assert(school.includes('theses/theses.pdf'));
const week2 = fs.readFileSync('_site/orgschool26/toward-a-science-of-society.html', 'utf8');
assert.equal((week2.match(/class="reading-resource"/g) || []).length, 5);
assert.equal((week2.match(/class="reading-audio"/g) || []).length, 4);
assert.equal((week2.match(/>Web version/g) || []).length, 4);
assert(!week2.includes('href=""'), 'Missing web versions must not generate empty links');
assert(!week2.includes('Audio not yet available'));
assert(!week2.includes('If a file asks you to sign in'));
assert(week2.includes('1LVkicBoXKOPa8u0NHNVZYEfgIa-Zr9vAozG4Jq4o5SM/embed'));
assert(week2.includes('1J9glLQMwqeDDd__wSBSfHwIjOFkyCtc2aRW3UPHoqvE/export?format=pdf'));
assert(fs.readFileSync('_site/studies/organizer-school-fall-2026.html', 'utf8').includes('/website/orgschool26/toward-a-science-of-society.html'));
const schoolLanding = fs.readFileSync('_site/orgschool26/index.html', 'utf8');
assert(schoolLanding.includes('Course overview &amp; syllabus'));
assert(schoolLanding.indexOf('course-overview-heading') > schoolLanding.lastIndexOf('class="content-card'), 'Course overview must follow all session cards');
assert(schoolLanding.includes('Week 10 (10 Dec)'));
assert(schoolLanding.includes('SFU Harbour Centre Room 2200'));
assert(schoolLanding.includes('/website/orgschool26/toward-a-science-of-society.html'));

const remainingWeeks = [
  {
    "week": 4,
    "slug": "the-capitalist-production-and-accumulation-process",
    "date": "2026-10-29",
    "readings": 2,
    "audios": 1,
    "slides": "1uIqiuWXiIRJmlHjB4ut2GDgfx4wNTbj_",
    "ids": [
      "1qs5wLGt6zidZ0VayeNvhEUMqHRKhotsx",
      "1LMXNtAs59UwtsSD0tQWnNSv5MKtF9-Zn",
      "11HFWGxLPqNvmYiY5k7Rlh4jRQ-noftM5",
      "18qS5NF91u2fzFPb698WucpD9kWkDDvRUmwdu2deN_WQ"
    ]
  },
  {
    "week": 5,
    "slug": "imperialism-and-the-general-crises-of-capitalism",
    "date": "2026-11-05",
    "readings": 1,
    "audios": 2,
    "slides": "1uIqiuWXiIRJmlHjB4ut2GDgfx4wNTbj_",
    "ids": [
      "13nPcgMTo_qq62OHOSeY5zg2JAwRscMzj",
      "1BhUmbYjxf0c42d7k9I__uR6fxau6yY3U",
      "1yI3t0MsjWqCJKm4SgxCJ4WCR9ZRe8pTl",
      "1hNQpNsfdXmqsMp-zCR_o3Kz6kAYxa417hBNZKDjp6gI"
    ]
  },
  {
    "week": 6,
    "slug": "do-you-have-class-in-your-analysis",
    "date": "2026-11-12",
    "readings": 3,
    "audios": 0,
    "slides": "1FHNWjrc16snK7VIYwnUOdon49G9LTUGM",
    "ids": [
      "1D8uoXtsamSOSTdUXaEU_-aLb3tiIexnv",
      "1tPdSv5n_K2NQlH9VD4mDw8WD7LqKj4OM",
      "1mJsNVu8eGGijRlqfG3fF3Tue_1q0-sEH",
      "1BETagQD44M1CqQFtGbqcuh2ETY1pFXNsjezKx3werE0"
    ]
  },
  {
    "week": 7,
    "slug": "the-battle-of-the-classes",
    "date": "2026-11-19",
    "readings": 4,
    "audios": 0,
    "slides": "1S40PUprXQ2V3Q1cN2O2PPMXgrWIJYVR1",
    "ids": [
      "1WVyE-hnGmzM743ZJtQtJqUTNOajuVCrm",
      "1TQ19neXPRRm2t99EH-f5rZZYYvORGJIt",
      "1UlRG-H_wlBgKODnoXWClaFJBOSP16v2V",
      "1OgQ-KCPmWJb9d2IKd3TnNwSTe3UTD2Qp",
      "1cXv9msd-o94IWMsFEG2Csx_uO0wcr98YC4Wl8lkfC8s"
    ]
  },
  {
    "week": 8,
    "slug": "organizing-the-people",
    "date": "2026-11-26",
    "readings": 1,
    "audios": 0,
    "slides": "1VKOVmrno50UUGcrh43KBt4iaeBAKlObM",
    "ids": [
      "1IlkT0dtfiVm4T6OY6IQRsrru3ZVLRZ2b",
      "1cekLI6L4n3lEvjA1m5yRjQCvrDw52oE5FNmFBR5zaHA"
    ]
  },
  {
    "week": 9,
    "slug": "movement-leadership-unity-and-struggle",
    "date": "2026-12-03",
    "readings": 3,
    "audios": 0,
    "slides": "1uI4C0aXfNiFfGNOLk6ssPWDfOeRY5aBl",
    "ids": [
      "19bhS_LSccdJ5ZnddaIwYlEY8QtKUdPa0",
      "1VCSk8_WWUNsfGPUvfvFWqDy1NfuZqJW1",
      "1rdonGnGlx5FdFT_BLAIZhqepsN79pceE",
      "159WqMu1oWsnsw3a2XogtOlG4A_Qo0L0V8-XLGTFOTPQ",
      "1sjK_KtRqlRXzMLaeON78oxRbIfk77-ZUtrGWmd3hT20",
      "1UXWUK42J9RYpqg2WEETU6UxreJjMVCxx"
    ]
  },
  {
    "week": 10,
    "slug": "raising-consciousness",
    "date": "2026-12-10",
    "readings": 2,
    "audios": 0,
    "slides": "1qPSi1yuZp07NU31k8LgrdJRNtWjTmNfF",
    "ids": [
      "1B_2A5HrKVuwBELwIxCFVwySfj0HaYzfm",
      "16Q0Zk2TlvD42QgQlxY5l7c_nZDU7_Akz",
      "1cXx3BmJBMIkMplL1arMFYlzRM4C0QhgQ8mHzKhqD9XM"
    ]
  }
];
assert.equal((schoolLanding.match(/class="content-card/g) || []).length, 10, 'All ten Organizer School weeks have cards');
for (const week of remainingWeeks) {
  const page = fs.readFileSync('_site/orgschool26/' + week.slug + '.html', 'utf8');
  assert.equal((page.match(/class="reading-resource"/g) || []).length, week.readings, 'Week ' + week.week + ' readings');
  assert.equal((page.match(/class="reading-audio"/g) || []).length, week.audios, 'Week ' + week.week + ' audio');
  assert(page.includes(week.slides + '/preview'), 'Correct slide deck for week ' + week.week);
  assert(page.includes('SFU Harbour Centre Room 2200'));
  assert(page.includes('datetime="' + week.date + '"'));
  assert(schoolLanding.includes('/website/orgschool26/' + week.slug + '.html'));
  assert.equal(dates.filter(date => date === week.date).length, 1, 'Exactly one calendar entry for week ' + week.week);
  for (const id of week.ids) assert(page.includes(id), 'Verified folder resource ' + id + ' appears in week ' + week.week);
  assert(!page.includes('href=""'));
  assert(!page.includes('Audio not yet available'));
}
assert.equal((school.match(/class="reading-audio"/g) || []).length, 3, 'Week 1 includes supplied recordings');
assert(fs.readFileSync('_site/orgschool26/organizing-the-people.html', 'utf8').includes('Week 8'));
assert(fs.readFileSync('_site/orgschool26/movement-leadership-unity-and-struggle.html', 'utf8').includes('Week 9'));

const week3 = fs.readFileSync('_site/orgschool26/the-birth-of-the-capitalist-mode-of-production.html', 'utf8');
assert.equal((week3.match(/class="reading-resource"/g) || []).length, 4);
assert.equal((week3.match(/class="reading-audio"/g) || []).length, 4);
assert(week3.includes('<strong>the historical processes that were necessary in order for capitalism to come into existence</strong>'));
assert(week3.includes('1uIqiuWXiIRJmlHjB4ut2GDgfx4wNTbj_/preview'));
assert(week3.includes('1uIqiuWXiIRJmlHjB4ut2GDgfx4wNTbj_/edit'));
assert(schoolLanding.includes('/website/orgschool26/the-birth-of-the-capitalist-mode-of-production.html'));
const upcomingSection = html.match(/<section[^>]*id="coming-up"[\s\S]*?<\/section>/)[0];
const pastSection = html.match(/<section[^>]*id="past-events"[\s\S]*?<\/section>/)[0];
const cardDates = section => [...section.matchAll(/data-event-date="([^"]+)"/g)].map(match => match[1]);
const upcomingDates = cardDates(upcomingSection);
const pastDates = cardDates(pastSection);
const today = upcomingSection.match(/data-today="([^"]+)"/)[1];
assert.deepEqual(upcomingDates, [...upcomingDates].sort(), 'Upcoming events sort nearest-first');
assert.deepEqual(pastDates, [...pastDates].sort().reverse(), 'Past events sort most-recent-first');
assert(upcomingDates.every(date => date.replaceAll('-', '') >= today));
assert(pastDates.every(date => date.replaceAll('-', '') < today));
assert.deepEqual([...upcomingDates, ...pastDates].sort(), [...dates].sort(), 'Homepage includes every confirmed calendar date, including recurring sessions');
function testHomeDate(utcDate, expectedFirst, expectedPastFirst, expectedScreenings) {
  const nextGrid = new Element(); const pastGrid = new Element();
  const nextEmpty = new Element(); const pastEmpty = new Element();
  const homeDocument = {
    querySelector: selector => ({ querySelector: inner => inner === '.card-grid' ? (selector === '#coming-up' ? nextGrid : pastGrid) : (selector === '#coming-up' ? nextEmpty : pastEmpty) }),
    querySelectorAll: () => [...(upcomingSection + pastSection).matchAll(/<article[^>]*data-event-date="([^"]+)"[^>]*data-event-series="([^"]+)"/g)].map(match => {
      const card = new Element('article'); card.dataset.eventDate = match[1]; card.dataset.eventSeries = match[2]; return card;
    })
  };
  class HomeDate extends Date { constructor() { super(utcDate); } }
  vm.runInNewContext(fs.readFileSync('assets/js/home-events.js', 'utf8'), { document: homeDocument, Date: HomeDate, Intl });
  assert.equal(nextGrid.children[0]?.dataset.eventDate, expectedFirst);
  assert.equal(pastGrid.children[0]?.dataset.eventDate, expectedPastFirst);
  assert.equal(nextEmpty.hidden, nextGrid.children.length > 0);
  assert.equal(pastEmpty.hidden, pastGrid.children.length > 0);
  const visibleNext = nextGrid.children.filter(card => !card.hidden);
  const series = visibleNext.map(card => card.dataset.eventSeries);
  assert.equal(new Set(series).size, series.length, 'Only the next event per recurring series is visible');
  if (expectedScreenings !== undefined) assert.equal(series.filter(value => value.includes('/events/cinema-struggle-')).length, expectedScreenings, 'Cinema & Struggle screenings remain separate');
  assert.equal(pastGrid.children.filter(card => card.hidden).length, 0, 'Past events stay visible, including previously hidden future sessions');
}
testHomeDate('2026-10-16T02:30:00Z', '2026-10-15', '2026-10-08'); // Still Oct 15 in Vancouver.
testHomeDate('2026-10-17T15:00:00Z', '2026-10-18', '2026-10-16');
testHomeDate('2026-12-11T15:00:00Z', undefined, '2026-12-10');
testHomeDate('2026-05-01T15:00:00Z', '2026-05-01', undefined, 6);
const visibleUpcomingTags = [...upcomingSection.matchAll(/<article (?!hidden)[^>]*data-event-series="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(visibleUpcomingTags).size, visibleUpcomingTags.length, 'Build output also hides duplicate upcoming series without JavaScript');
assert.equal(visibleUpcomingTags.filter(series => series === 'organizer-school-fall-2026').length, 1);
for (const page of [html, cinema]) {
  assert.equal((page.match(/<ul class="cinema-tasks">[\s\S]*?<\/ul>/)[0].match(/<li>/g) || []).length, 5);
  assert(page.includes('Other suggested ways to contribute'));
  assert(page.includes('peoplesuniversityproject@sfpirg.ca'));
}
console.log('Calendar: dates, navigation, empty months, leap year, Vancouver timezone and links passed.');
console.log('Content: event headings, Cinema membership, six screenings and latest main updates passed.');
