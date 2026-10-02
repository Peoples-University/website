/* Progressively enhance the published schedule; never use publication dates. */
(() => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const [year, month] = today.split('-').map(Number);
  document.querySelectorAll('.event-calendar').forEach((calendar, calendarIndex) => {
    let cursor = new Date(Date.UTC(year, month - 1, 1));
    const entries = [...calendar.querySelectorAll('[data-event-date]')]
      .sort((a, b) => a.dataset.eventDate.localeCompare(b.dataset.eventDate));
    const list = calendar.querySelector('.calendar-event-list');
    entries.forEach((entry, index) => {
      entry.id = `calendar-${calendarIndex}-event-${index}`;
      list.append(entry);
    });
    const view = calendar.querySelector('.calendar-month-view');
    const monthLabel = calendar.querySelector('.calendar-month');
    function render() {
      const monthKey = cursor.toISOString().slice(0, 7);
      const monthName = new Intl.DateTimeFormat('en-CA', {
        month: 'long', year: 'numeric', timeZone: 'UTC'
      }).format(cursor);
      monthLabel.textContent = monthName;
      const shown = entries.filter(entry => entry.dataset.eventDate.startsWith(monthKey));
      entries.forEach(entry => { entry.hidden = !entry.dataset.eventDate.startsWith(monthKey); });
      calendar.querySelector('.calendar-empty').hidden = shown.length !== 0;
      const table = document.createElement('table');
      table.className = 'calendar-grid';
      const caption = table.createCaption();
      caption.className = 'visually-hidden';
      caption.textContent = `${monthName}. Dates with events link to the schedule.`;
      const header = table.createTHead().insertRow();
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
        const th = document.createElement('th');
        th.scope = 'col'; th.textContent = day; header.append(th);
      });
      const body = table.createTBody();
      const offset = (cursor.getUTCDay() + 6) % 7;
      const days = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
      let row;
      for (let index = 0; index < Math.ceil((offset + days) / 7) * 7; index++) {
        if (index % 7 === 0) row = body.insertRow();
        const cell = row.insertCell();
        const day = index - offset + 1;
        if (day < 1 || day > days) { cell.className = 'calendar-blank'; continue; }
        const key = `${monthKey}-${String(day).padStart(2, '0')}`;
        const daily = shown.filter(entry => entry.dataset.eventDate === key);
        const label = document.createElement(daily.length ? 'a' : 'span');
        label.textContent = day;
        if (key === today) { cell.classList.add('calendar-current'); label.setAttribute('aria-current', 'date'); }
        if (daily.length) {
          cell.classList.add('calendar-has-events');
          label.href = `#${daily[0].id}`;
          label.setAttribute('aria-label', `${day} ${monthName}: ${daily.length} event${daily.length === 1 ? '' : 's'}`);
          const count = document.createElement('small');
          count.textContent = `${daily.length} event${daily.length === 1 ? '' : 's'}`;
          label.append(count);
        }
        cell.append(label);
      }
      view.replaceChildren(table);
    }
    calendar.querySelectorAll('[data-month-step]').forEach(button => {
      button.addEventListener('click', () => {
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + Number(button.dataset.monthStep), 1));
        render();
      });
    });
    calendar.querySelector('[data-calendar-today]').addEventListener('click', () => {
      cursor = new Date(Date.UTC(year, month - 1, 1)); render();
    });
    render();
    calendar.querySelector('.calendar-controls').hidden = false;
    view.hidden = false;
  });
})();
