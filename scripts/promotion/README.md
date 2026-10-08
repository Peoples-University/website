# Promotion studio — first version

Run the website with `bash scripts/serve`, the CMS with `bash scripts/cms`, and
the promotion service in another terminal with `bash scripts/promote` (Node 20+).
Open http://127.0.0.1:4000/website/admin/promotion.html.

## Editing and preview

1. Save an event or Organizer School session in the CMS. In **Promotion
   readiness**, confirm the event and materials. Neither checkbox sends anything.
2. Open **Promotion studio** from the CMS footer. Refresh after the website
   rebuilds, choose the event, edit the email, Instagram and WhatsApp drafts,
   and download vertical story artwork if needed.
3. Select channels and groups. Defaults are editable in the studio: launch email,
   feed post, Story and WhatsApp; Instagram Story reminders 7, 3, 2 and 1 days
   before; WhatsApp reminders 7 and 1 day before. No groups are preselected.
   The editable default reminder time is 10 a.m. America/Vancouver.
4. Update reminder previews, expand each reminder to check its date and wording,
   review the artwork and audiences, then save the private draft. Changes clear
   approval. Existing drafts and campaigns retain their own schedule snapshots.
4. After connections are configured, send a test email to the configured sender.
5. Queue an approved campaign. It waits for the exact saved event revision and
   event page to be available on the public site before sending. Optional timing
   uses the browser timezone and is stored as UTC.

Drafts, OAuth tokens, and delivery history are in `.promotion/`, ignored by Git
and excluded from Jekyll. Do not put account secrets or group addresses in CMS
content. No step in this service commits or pushes.

## Private connection configuration

Create `.promotion/config.json` using `config.example.json` in this directory
as the template. Restart the promotion service after configuration changes.
Leave `allowPublishing` false during setup. The UI can still prepare drafts and
explicitly send test emails while live publishing is off.

Groups are an array such as:

```json
[{"id":"cinema","label":"Cinema & Struggle","address":"YOUR-GROUP@googlegroups.com"}]
```

Use only actual groups your organisation intends to contact. The connected
Google account needs posting permission in each group; moderation and digest
preferences may affect when members receive the message. “Sent” means Gmail
accepted the email, not that every group member received it.

### Google

Enable the Gmail API in a Google Cloud project and create a Web application
OAuth client with this exact authorised redirect URI:
`http://127.0.0.1:8082/oauth/callback`.
Set `gmail.clientId`, `gmail.clientSecret`, and `gmail.sender` (the account to
connect, also the only test recipient). Use **Connect Google** in the studio.
The service requests `gmail.send` plus basic Google identity (`openid email`)
to verify the connected account matches the configured sender. It stores the
offline refresh token privately. Google consent-screen testing
restrictions or token expiry may require reconnecting; do not treat an OAuth
test setup as unattended production deployment.

### Instagram

The preferred route is **Instagram API with Instagram Login**, which does not
require linking a Facebook Page. In your Meta developer app choose the Instagram
API setup with Instagram Login (not Facebook Login). Add the organisation's
Business account; accept an app tester invitation if Meta requires it. Generate
an Instagram **User** access token with `instagram_business_basic` and
`instagram_business_content_publish`. Do not use a Facebook Page token.

In Promotion studio open **Connect Instagram only · no Facebook Page**, paste
the token and enter the Graph API version supported by the app. **Verify and
save Instagram token** makes one read-only profile request to `graph.instagram.com`
and refuses an account whose username differs from `instagram.handle` in the
private config. Successful credentials are stored in `.promotion/state.json`,
never sent back by bootstrap, placed in event content or saved in a draft.
The form clears the token after submission. Google settings are unchanged.

This is an initial dashboard-token setup, not hosted OAuth login. Token lifetime
must be checked in Meta; no automatic renewal is implemented yet. Profile
verification proves identity, not publishing scope or Story eligibility. Arrange
token renewal and app access before unattended use, and conduct a publishing
test only after explicit approval. A platform restriction may still prevent
Instagram Login; this does not bypass account restrictions.

Legacy Facebook Login credentials in the private config remain supported when
`loginMode` is `facebook` (or omitted for pre-existing configured credentials).
Do not relabel an old token as Instagram Login. The two modes use different
API hosts and permission names. New example configs use `loginMode: instagram`.

Feed and Story auto publishing currently accept a single public image. Use a
Meta-compatible JPEG; Story artwork should be vertical (9:16). Other formats,
carousels, videos and interactive stickers are not implemented. Downloaded
artwork must be uploaded into the CMS Story artwork field and deployed before
the API can fetch it. Collaborator posts and Stories with no uploaded artwork
are marked **Finish manually**. The automatic adapter never silently drops
collaborator requirements. WhatsApp is a copy-and-paste handoff, not an API send.

## Delivery behaviour and limits

- With `allowPublishing: true`, explicitly queued campaigns are checked every
  30 seconds while this service runs. It can run locally, but a laptop shutdown
  pauses scheduled delivery. Moving this to an always-on host requires proper
  authentication, HTTPS, a production OAuth callback and a durable queue.
- Ordinary CMS saves and local preview rebuilds do not queue campaigns.
- Reminder dates already passed at campaign launch are skipped. A reminder more
  than six hours overdue is skipped rather than sent late after a service outage.
  Instagram Story API publishing uses artwork, not the handoff text as a caption.
  WhatsApp reminders are manual tasks; this service does not send to communities.
- Editing an event pauses its existing campaign until reviewed. Cancel an
  unsent campaign and create a fresh one; previously attempted sends are not
  silently replayed. Follow-up/correction campaigns are not implemented yet.
- Each audience/channel is recorded separately. On an ambiguous provider
  response or interrupted send, the item is **Check provider**. Inspect the
  provider before taking further action; there is no automatic blind retry.
- All generated text is deterministic. LLM rewriting and automatic selection
  of audiences are not connected in this version.
- Manual handoffs are recorded as pending; finish in the destination app, then
  select **Mark as posted** in delivery history. Live delivery, OAuth and account permissions need testing
  with your accounts; the included tests use no real recipients or credentials.

Checks: `node --test tests/promotion.test.mjs tests/promotion-schedule.test.mjs tests/instagram.test.mjs`
(plus the existing website tests). Tests use fake credentials and make no Meta calls.
