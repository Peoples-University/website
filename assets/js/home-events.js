(() => {
  const upcoming = document.querySelector('#coming-up');
  const past = document.querySelector('#past-events');
  if (!upcoming || !past) return;
  // Reclassify on each visit so GitHub Pages does not need a rebuild after every event.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type).value;
  const today = `${value('year')}-${value('month')}-${value('day')}`;
  const cards = [...document.querySelectorAll('#coming-up [data-event-date], #past-events [data-event-date]')]
    .sort((a, b) => a.dataset.eventDate.localeCompare(b.dataset.eventDate));
  const nextCards = cards.filter(card => card.dataset.eventDate >= today);
  const pastCards = cards.filter(card => card.dataset.eventDate < today).reverse();
  const seenSeries = new Set();
  let visibleUpcoming = 0;
  nextCards.forEach(card => {
    const series = card.dataset.eventSeries;
    card.hidden = Boolean(series && seenSeries.has(series));
    if (!card.hidden) {
      if (series) seenSeries.add(series);
      visibleUpcoming++;
    }
  });
  pastCards.forEach(card => { card.hidden = false; });
  upcoming.querySelector('.card-grid').replaceChildren(...nextCards);
  past.querySelector('.card-grid').replaceChildren(...pastCards);
  upcoming.querySelector('[data-events-empty]').hidden = visibleUpcoming > 0;
  past.querySelector('[data-events-empty]').hidden = pastCards.length > 0;
})();
