# website
This is the website of the People's University Project.

## Local preview

From this folder, run:

```sh
bash scripts/serve
```

Open http://127.0.0.1:4000/website/ and press Ctrl+C in the terminal to stop.
The first run installs Jekyll into the ignored `vendor/preview` folder. Later
runs reuse it. Ruby and Bundler are required; the script automatically uses
Homebrew Ruby when available. `Gemfile.preview` leaves the existing deployment
Gemfile and its Windows lockfile unchanged.

## Event dates and calendar

- `date` remains the publication/legacy date.
- Set `event_date: "2026-10-08"` to the actual event date (YYYY-MM-DD). It takes
  precedence in cards and page headings and adds the event to the calendar.
- Use `time` and `location` for the event details. Times are Vancouver time.
- For additional confirmed meetings on a study page, add `sessions`, with a
  `date` and optional `title` for each meeting. Do not duplicate the start date.
- `calendar_hide_start: true` suppresses a duplicate start-date calendar entry
  when a dedicated session page already represents that meeting.
- A new event without an event date displays “Date to be announced” and is not
  put on the calendar. Publication dates are never used as calendar dates.
- Set `series: cinema` on screenings to include them on Cinema & Struggle.

The calendar reads these fields directly. It is independent of Google Calendar;
the shared Google Calendar link is provided separately, not automatically synced.
Only confirmed dates from the site's published schedules have been added.

Cinema membership copy lives in `_data/cinema.yml`, shared between the homepage
and the Cinema & Struggle page. The source describes tentative tasks, not fixed
eligibility criteria. Update it when the membership document changes.
