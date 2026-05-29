# Google Play Data Safety Draft — Licencia AR

Status: Draft, based on code audit performed on 2026-05-29.

## Account

The app does not require users to create an account.

## Personal Information

The app does not ask users to provide name, email, phone number, address, government ID, or payment information in the current version.

## Data Collection

Based on the current code audit, the app does not collect personal user data from the device and does not send personal user data to a remote server.

## Local Data

The app stores study progress locally on the user's device, such as:

- language setting;
- theme setting;
- practice progress;
- mistakes;
- vocabulary review state;
- exam practice progress;
- practical exam checklist state.

This local data is used for app functionality.

## Data Sharing

No personal user data is shared with third parties in the current version.

## Ads

The current version does not include ads.

## Analytics

The current version does not include analytics SDKs.

## Network / PWA Notes

The web/PWA build may load app assets and cache files for offline use. `index.html` currently loads the Tabler icon stylesheet from jsDelivr. No personal study progress is sent to a remote server by the audited app code.

## Security

No remote personal data transmission was found in the current version. If future versions add accounts, sync, analytics, ads, crash reporting, payments, or subscriptions, this document and the Play Console Data Safety form must be updated.

## Data Deletion

Since progress is stored locally, users can clear app data using browser/device settings. If the app has a reset progress feature, mention it in the privacy policy and store listing.

