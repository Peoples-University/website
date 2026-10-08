/* Shared by the CMS widget, its preview and public session pages. */
((root) => {
  function slidesURL(value) {
    if (!value || !value.trim()) return null;
    let url;
    try { url = new URL(value.trim()); } catch { return null; }
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null;
    const published = url.pathname.match(/^\/presentation\/d\/e\/([\w-]+)(?:\/|$)/);
    const shared = url.pathname.match(/^\/presentation\/(?:u\/\d+\/)?d\/([\w-]+)(?:\/|$)/);
    const id = published?.[1] || shared?.[1];
    if (!id) return null;
    const base = `https://docs.google.com/presentation/d/${published ? 'e/' : ''}${id}`;
    return { embed: `${base}/${published ? 'pubembed' : 'embed'}?start=false&loop=false&delayms=3000`, open: `${base}/${published ? 'pub' : 'edit'}` };
  }
  root.PUPSlidesURL = slidesURL;
  if (typeof module !== 'undefined' && module.exports) module.exports = slidesURL;
})(typeof window !== 'undefined' ? window : globalThis);
