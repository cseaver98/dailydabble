# Auth Setup

DailyDabble uses Supabase Auth with email magic links, Google OAuth, and separate staging/production projects.

## Environments

- Staging app: `https://staging.dailydabble.app`
- Production app: `https://dailydabble.app`
- Staging Supabase ref: `nespwjnazcbazlugdsyi`
- Production Supabase ref: `junqqrrzkmgstcxcbknc`

Git pushes deploy staging automatically. Production deploys are manual with:

```sh
npm run deploy:prod:web
```

After running the prod deploy script, relink local Vercel back to staging if needed:

```sh
npx vercel link --yes --project dailydabble-web-staging --scope cseaver98-4771s-projects
```

## Support Mailbox

User-facing support email:

```text
support@dailydabble.app
```

This is a real mailbox hosted through Porkbun and is used for Google OAuth support/contact fields.

## Transactional Email

Supabase magic links send through Resend using:

```text
DailyDabble <no-reply@mail.dailydabble.app>
```

The Resend domain is:

```text
mail.dailydabble.app
```

DNS for Resend is managed in Porkbun. Keep the Resend DKIM, sending/SPF, MX, and DMARC records in place.

Supabase SMTP settings for both staging and production:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key for that environment
- Sender email: `no-reply@mail.dailydabble.app`
- Sender name: `DailyDabble`

Use separate Resend API keys for staging and production when possible.

## Supabase Auth URLs

Staging Supabase Auth URL config:

- Site URL: `https://staging.dailydabble.app`
- Redirect URL: `https://staging.dailydabble.app/auth/callback**`

Production Supabase Auth URL config:

- Site URL: `https://dailydabble.app`
- Redirect URL: `https://dailydabble.app/auth/callback**`

The signup confirmation and magic link email templates must use:

```text
{{ .ConfirmationURL }}
```

Do not hardcode `{{ .SiteURL }}` or localhost in email templates.

The repo-owned local templates live at:

```text
supabase/templates/signup-confirmation.html
supabase/templates/magic-link.html
```

For quick browser checks without sending an email, open:

```text
supabase/templates/signup-confirmation.preview.html
supabase/templates/magic-link.preview.html
```

## Google OAuth

Google Cloud project branding:

- App name: `DailyDabble`
- Support email: `support@dailydabble.app`
- Authorized domain: `dailydabble.app`
- Homepage: `https://dailydabble.app`
- Privacy policy: `https://dailydabble.app/privacy`
- Terms of service: `https://dailydabble.app/terms`

Requested scopes should stay basic:

```text
openid
email
profile
```

Create separate OAuth clients for staging and production.

Staging Google OAuth client:

- Authorized JavaScript origin: `https://staging.dailydabble.app`
- Authorized redirect URI: `https://nespwjnazcbazlugdsyi.supabase.co/auth/v1/callback`

Production Google OAuth client:

- Authorized JavaScript origin: `https://dailydabble.app`
- Authorized redirect URI: `https://junqqrrzkmgstcxcbknc.supabase.co/auth/v1/callback`

Paste each client ID and secret into the matching Supabase project under Authentication providers.

## Account Linking

Supabase links magic-link and Google sign-ins when they use the same verified email. In staging, this was verified for a Gmail test account: one auth user had both `email` and `google` providers.

DailyDabble profile display names are currently seeded from provider metadata. Later account/profile UI should let users choose a stable display name or username and avoid overwriting user-chosen profile fields on every login.
