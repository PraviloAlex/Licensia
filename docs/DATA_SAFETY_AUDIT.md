# Data Safety Audit — Licencia AR

Date: 2026-05-29

Scope: `src`, `public`, `index.html`, `package.json`, and `vite.config.ts`.

## Summary

Based on the current code audit, the app does not include account creation, login, analytics SDKs, advertising SDKs, a backend API, or automatic personal-data network submission.

The app does store study state locally on the user's device. The project also uses a PWA service worker/cache configuration and loads the Tabler icon stylesheet from jsDelivr in `index.html`.

## Audit Findings

### Accounts and login

No account, login, registration, authentication provider, or user profile flow was found.

### Analytics

No Google Analytics, Firebase Analytics, Amplitude, Mixpanel, PostHog, Sentry, `gtag`, `sendBeacon`, or similar analytics SDK usage was found.

### Advertising

No AdMob, AdSense, advertising SDK, ad network, or ad placement code was found.

### External network requests

No `fetch`, `axios`, or `XMLHttpRequest` application API calls were found.

Known external links/resources:

- `index.html` loads Tabler icons CSS from `https://cdn.jsdelivr.net/...`.
- `src/pages/HomePage.tsx` contains a user-click outbound Ko-fi support link.
- `vite.config.ts` configures PWA runtime caching for app JSON/assets, question images, signs, and the jsDelivr icon CSS.

### Backend/API

No backend API endpoint, remote database, or cloud sync was found.

### Local storage

`localStorage` is used for app functionality, including:

- onboarding completion;
- selected UI language;
- selected theme;
- answer confirmation mode;
- font size preference;
- practice and exam progress;
- answered question state;
- mistake tracking;
- daily goal and streak-related state;
- vocabulary review and known-word state;
- practical exam checklist state.

### Session storage

`sessionStorage` is used in `src/lib/vocabularyStatus.ts` for a local vocabulary session id.

### IndexedDB

No direct `IndexedDB` usage was found in app source.

### Cookies

No explicit cookie read/write usage was found in app source.

### Service worker / PWA cache

The project uses `vite-plugin-pwa` in `vite.config.ts`. Generated service worker files cache app assets for loading/offline functionality. No personal-data sync was found.

### User-generated content

No user-generated content publishing, uploads, chat, comments, or public profile features were found.

### Personal or sensitive data

The current app does not ask the user for name, email, phone number, address, government ID, payment details, photos, contacts, location, health data, or other sensitive personal data.

## Preliminary Google Play Data Safety Recommendation

If this codebase is released as audited:

- Account required: No.
- Ads: No.
- Analytics SDKs: No.
- Personal data collection: No personal data is requested or sent to a remote server by the app code found in this audit.
- Local data: Study progress and settings are stored locally on the device for app functionality.
- Data sharing: No personal user data sharing was found.

The owner must verify the final Android wrapper/build behavior before submitting Google Play Data Safety answers.

## Update Required If Added Later

Update this audit, Privacy Policy, and Play Console Data Safety form before release if any of the following are added:

- accounts or login;
- cloud sync or backend APIs;
- analytics;
- ads;
- crash reporting SDKs;
- subscriptions, billing, or payments;
- push notifications;
- remote database;
- forms that collect email, name, documents, or other personal data.

