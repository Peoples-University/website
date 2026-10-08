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

## Local content editor

Keep the preview running, then open a second terminal in this folder:

```sh
bash scripts/cms
```

Open http://127.0.0.1:4000/website/admin/ and select Login. Node.js/npm is
required; the first run downloads the pinned local editor service. Local saves
write files only: they do not commit, push, or publish to the live website.
Decap may label its save button “Publish”; in local mode this still only saves
to this folder. The yellow banner identifies local mode. Stop both terminals
with Ctrl+C when finished.

- Use Events & screenings for posters, dates, venues, and ticket links.
- Use Organizer School for slides, reading uploads, and required/optional status.
- Paste a normal Google Slides sharing URL; embedding is automatic, but the
  deck still needs viewer permissions or to be published to the web.
- PDF uploads support files up to 20 MB; posters up to 8 MB.
- The side-by-side preview shows content and styling. Linked meeting details
  and Liquid includes resolve in the actual local website, not the editor.

The hosted editor is configured for draft/review/publish workflow. Unlike local
mode, saving hosted drafts creates GitHub commits. Remote workflow changes have
not been deployed or tested against GitHub.

## Event dates and calendar

For promotion drafts, story artwork and delivery setup, see
[Promotion studio](scripts/promotion/README.md). Start it with
`bash scripts/promote`, alongside the website and CMS, then open
http://127.0.0.1:4000/website/admin/promotion.html.

- `date` remains the publication/legacy date.
- Set `event_date: "2026-10-08"` to the actual event date (YYYY-MM-DD). It takes
  precedence in cards and page headings and adds the event to the calendar.
- Use `time` and `location` for the event details. Times are Vancouver time.
- For additional confirmed meetings on a study page, add `sessions`, with a
  `date` and optional `title` for each meeting. Do not duplicate the start date.
- Select `schedule_ref` when a dedicated Organizer School page owns the first
  meeting. Its date, time, and venue feed the study page and calendar; don't
  enter those twice. `calendar_hide_start` remains supported for older content.
- A new event without an event date displays “Date to be announced” and is not
  put on the calendar. Publication dates are never used as calendar dates.
- Set `series: cinema` on screenings to include them on Cinema & Struggle.

The calendar reads these fields directly. It is independent of Google Calendar;
the shared Google Calendar link is provided separately, not automatically synced.
Only confirmed dates from the site's published schedules have been added.

Cinema membership copy lives in `_data/cinema.yml`, shared between the homepage
and the Cinema & Struggle page. The source describes tentative tasks, not fixed
eligibility criteria. Update it when the membership document changes.
