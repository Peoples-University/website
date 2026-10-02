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
assert.equal(dates.length, 18, 'All confirmed screenings and study sessions included');
assert.equal(dates.filter(date => date === '2026-10-08').length, 1, 'Course and session must not duplicate');
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
assert.deepEqual(visibleDates(), ['2026-10-04', '2026-10-08', '2026-10-15', '2026-10-18', '2026-10-22', '2026-10-29']);
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
  ['_site/studies/canadian-class-structure-discussion-writing-group.html', '2026-10-04'],
  ['_site/events/cinema-struggle-how-to-blow-up-a-pipeline.html', '2026-09-04']
]) {
  const page = fs.readFileSync(file, 'utf8');
  const meta = page.match(/<div class="article-meta">([\s\S]*?)<\/div>/)[1];
  assert(meta.includes(`datetime="${expected}"`), `${file} must show the meeting date`);
}
const cinema = fs.readFileSync('_site/cinema-and-struggle/index.html', 'utf8');
assert(cinema.includes('class="cinema-theme"'));
assert(cinema.includes('No upcoming screening has been announced'));
assert.equal((cinema.match(/class="content-card/g) || []).length, 5);
for (const page of [html, cinema]) {
  assert.equal((page.match(/<ul class="cinema-tasks">[\s\S]*?<\/ul>/)[0].match(/<li>/g) || []).length, 5);
  assert(page.includes('Other suggested ways to contribute'));
  assert(page.includes('peoplesuniversityproject@sfpirg.ca'));
}
console.log('Calendar: dates, navigation, empty months, leap year, Vancouver timezone and links passed.');
console.log('Content: event headings, Cinema membership and five past screenings passed.');
