/* Reading navigation is an enhancement; page content works without JavaScript. */
(() => {
  const prose = document.querySelector('.prose');
  const nav = document.querySelector('.on-this-page');
  if (!prose || !nav) return;

  const headings = [...prose.querySelectorAll('h1, h2, h3')]
    .filter(heading => !heading.closest('details'));
  if (headings.length < 2) return;
  const list = nav.querySelector('ol');
  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = `section-${index + 1}`;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    item.append(link);
    list.append(item);
  });
  nav.hidden = false;
})();
