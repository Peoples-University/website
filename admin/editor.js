/* No GitHub initialization on localhost, even if the local server is offline. */
(() => {
  const { CMS, h, createClass } = window;
  const mode = document.getElementById('cms-mode');
  if (!CMS || !window.jsyaml) {
    mode.textContent = 'Editor files could not load. Check your connection and reload. No changes were saved.';
    return;
  }
  const slides = window.PUPSlidesURL;
  const SlidesControl = createClass({
    isValid() {
      const value = this.props.value || '';
      return !value || !!slides(value) || { error: 'Use a Google Slides sharing or published presentation link.' };
    },
    render() {
      const value = this.props.value || '';
      const valid = !value || slides(value);
      return h('div', {},
        h('input', { id: this.props.forID, className: this.props.classNameWrapper, type: 'url', value,
          onChange: event => this.props.onChange(event.target.value), placeholder: 'https://docs.google.com/presentation/d/…/edit' }),
        h('p', { style: { fontSize: '13px', color: valid ? '#476445' : '#ac302e' } },
          valid ? 'Embed link is generated automatically. Use Share → Anyone with the link → Viewer. If the preview asks for access, check sharing or publish the slides to the web.' : 'This is not a supported Google Slides link.'));
    }
  });
  CMS.registerWidget('slides-link', SlidesControl);
  CMS.registerEventListener({ name: 'preSave', handler: ({ entry }) => {
    let data = entry.get('data');
    const books = data.get('books');
    if (books) books.forEach(book => {
      if (!(book.get('reading_link') || '').trim() && !(book.get('reading_pdf') || '').trim()) {
        throw new Error(`Add a PDF or online link for “${book.get('reading_title') || 'Untitled reading'}”.`);
      }
    });
    if (data.get('slide_url') && !slides(data.get('slide_url'))) throw new Error('Please use a valid Google Slides link.');
    if (!data.get('date') && entry.get('collection') !== 'pages') data = data.set('date', new Date().toISOString());
    return data;
  }});
  CMS.registerPreviewStyle('../assets/css/style.css');
  CMS.registerPreviewStyle('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Oswald:wght@500;600&display=swap');
  CMS.registerPreviewStyle('body{padding:20px;background:#f4f3f1}.cms-preview{max-width:850px;margin:auto}.cms-preview .prose{background:#fff;padding:16px}.cms-preview .article-header{margin-bottom:12px}.cms-preview .article-meta{font-size:13px}.cms-preview img{max-height:380px}.cms-preview .session-details{margin-top:12px}', { raw: true });
  const prettyDate = value => {
    if (!value) return '';
    const date = new Date(String(value).slice(0, 10) + 'T12:00:00Z');
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-CA', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
  };
  const PagePreview = ({ entry, widgetFor, getAsset }) => {
    const data = entry.get('data').toJS();
    const books = data.books || [];
    const deck = slides(data.slide_url);
    const asset = value => value ? String(getAsset(value)) : '';
    return h('article', { className: 'cms-preview' },
      h('header', { className: 'article-header' },
        h('p', { className: 'eyebrow' }, data.week ? `Organizer School · Unit ${data.unit} · Week ${data.week}` : data.series === 'cinema' ? 'Cinema & Struggle' : 'Page preview'),
        h('h1', {}, data.title || 'Untitled'),
        h('div', { className: 'article-meta' },
          h('time', {}, prettyDate(data.event_date)), h('span', {}, data.time || ''), h('span', {}, data.location || ''))),
      h('div', { className: 'prose' },
        data.schedule_ref ? h('p', { className: 'helper-text' }, 'First meeting details are inherited from the selected Organizer School page; the website resolves them when built.') : null,
        data.image ? h('img', { src: asset(data.image), alt: data.image_alt || 'Poster preview' }) : null,
        data.summary ? widgetFor('summary') : null,
        books.length ? h('h2', {}, 'Readings') : null,
        h('ul', { className: 'reading-list' }, books.map((book, index) => {
          const pdf = book.reading_pdf || (/\.pdf(?:[?#]|$)/i.test(book.reading_link || '') ? book.reading_link : '');
          return h('li', { className: 'reading-resource', key: index },
            h('span', { className: 'reading-file' }, pdf ? 'PDF' : 'TEXT'),
            h('div', { className: 'reading-info' },
              h('span', { className: 'resource-label' }, `${book.reading_status === 'optional' ? 'Optional' : 'Required'} · ${pdf ? 'PDF' : 'Online text'}${book.reading_pagecount ? ' · ' + book.reading_pagecount + ' pages' : ''}`),
              h('a', { className: 'resource-link', href: asset(pdf) || book.reading_link }, book.reading_title),
              h('p', { className: 'reading-author' }, book.reading_author)));
        })),
        deck ? h('div', {}, h('h2', {}, 'Session slides'), h('iframe', { className: 'embedslides', src: deck.embed, title: 'Slides preview', allowFullScreen: true }), h('a', { href: deck.open, target: '_blank', rel: 'noopener' }, 'Open presentation / check sharing ↗')) : null,
        data.sessions?.length ? h('section', {}, h('h2', {}, 'Meeting schedule'), h('ul', {}, data.sessions.map((session, i) => h('li', { key: i }, `${prettyDate(session.date)} — ${session.title || data.title}`)))) : null,
        data.body && entry.get('collection') !== 'orgschool' ? widgetFor('body') : null));
  };
  ['events', 'orgschool', 'studies', 'journal-articles', 'projects', 'about'].forEach(name => CMS.registerPreviewTemplate(name, PagePreview));
  async function start() {
    const response = await fetch('config.yml');
    if (!response.ok) throw new Error('Cannot load the CMS configuration.');
    const config = window.jsyaml.load(await response.text());
    config.load_config_file = false;
    if (['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) {
      const check = await fetch('http://127.0.0.1:8081/api/v1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'info' }) }).catch(() => {
        throw new Error('Local editor service is offline. Run bash scripts/cms in another terminal, then reload. GitHub editing is disabled here.');
      });
      const info = await check.json();
      if (!check.ok || info.type !== 'local_fs') throw new Error('Local editor must run in filesystem-only mode. Run bash scripts/cms. Git-backed editing is disabled here.');
      config.backend = { name: 'proxy', proxy_url: 'http://127.0.0.1:8081/api/v1' };
      config.publish_mode = 'simple';
      config.local_backend = { url: 'http://127.0.0.1:8081/api/v1' };
      config.site_url = location.origin + '/website';
      config.display_url = config.site_url;
      mode.textContent = 'LOCAL FILES ONLY · Saves stay on this computer. No commits, pushes or live publishing. Start the editor service with: bash scripts/cms';
      const link = document.createElement('a'); link.href = '../'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'View local website ↗'; mode.append(link);
      const promotion = document.createElement('a'); promotion.href = 'promotion.html'; promotion.target = '_blank'; promotion.rel = 'noopener'; promotion.textContent = 'Promotion studio ↗'; mode.append(promotion);
      CMS.init({ config });
    } else if (location.protocol === 'file:') {
      throw new Error('Run bash scripts/serve and open http://127.0.0.1:4000/website/admin/ rather than opening this file directly.');
    } else {
      mode.textContent = 'REMOTE EDITOR · Saving drafts creates GitHub commits. Publishing updates the live branch.';
      const button = document.createElement('button'); button.textContent = 'Connect to GitHub';
      button.addEventListener('click', () => { button.remove(); CMS.init({ config }); });
      mode.append(button);
    }
  }
  start().catch(error => { mode.textContent = error.message; });
})();
