document.querySelectorAll('[data-slides-url]').forEach(container => {
  const urls = window.PUPSlidesURL(container.dataset.slidesUrl);
  if (!urls) return;
  const frame = document.createElement('iframe');
  frame.className = 'embedslides'; frame.title = container.dataset.slidesTitle;
  frame.src = urls.embed; frame.loading = 'lazy'; frame.allowFullscreen = true;
  container.prepend(frame);
  const open = container.previousElementSibling?.querySelector('[data-slides-open]');
  if (open) open.href = urls.open;
});
