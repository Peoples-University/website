const assert = require('node:assert/strict');
const fs = require('node:fs');
const slides = require('../assets/js/slides-url.js');

assert.equal(slides('https://docs.google.com/presentation/d/test-deck/edit#slide=id.test').embed,
  'https://docs.google.com/presentation/d/test-deck/embed?start=false&loop=false&delayms=3000');
assert.equal(slides('https://docs.google.com/presentation/u/0/d/test-deck/edit').open,
  'https://docs.google.com/presentation/d/test-deck/edit');
assert.equal(slides('https://docs.google.com/presentation/d/e/published-deck/pubembed').open,
  'https://docs.google.com/presentation/d/e/published-deck/pub');
for (const url of ['', 'javascript:alert(1)', 'https://example.com/presentation/d/test/edit', 'https://docs.google.com/document/d/test/edit']) {
  assert.equal(slides(url), null);
}

const editor = fs.readFileSync('admin/editor.js', 'utf8');
assert(editor.includes("info.type !== 'local_fs'"), 'Local editor refuses a Git-writing server');
assert(editor.includes("config.backend = { name: 'proxy'"), 'Local backend replaces GitHub configuration');
assert(fs.readFileSync('scripts/cms', 'utf8').includes('export MODE=fs'));
const course = fs.readFileSync('_site/studies/organizer-school-fall-2026.html', 'utf8');
assert(course.includes('8 October 2026'), 'Course inherits first session date');
assert(course.includes('SFU Harbour Centre Room 2200'), 'Course inherits venue');
assert(!course.includes('{% include'), 'Schedule includes are rendered');
assert.equal((course.match(/<time datetime="2026-10-08"/g) || []).length, 2, 'First meeting appears in heading and syllabus');
console.log('CMS URL conversion, local safety, and shared schedule checks passed.');
