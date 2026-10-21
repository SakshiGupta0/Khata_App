# Khata & Hisaab — Android

Two Capacitor (Android WebView) apps built from single-file web apps.

- `apps/khata`, `apps/hisaab`: app source (`src/index.html`) + Capacitor config
- `shared/profiles.js`: profile picker, PIN lock, add/edit/remove profiles
- `shared/native.js`: Android bridge (file export via share sheet, back button, status bar)
- `android-res/`: launcher icons and splash screens
- `.github/workflows/android.yml`: builds both signed APKs on every push, attaches them to a GitHub Release

Secrets required: `KEYSTORE_B64` (base64 of the release keystore) and `KEYSTORE_PASS`. Keep the keystore backed up; apps can only be updated in place if signed with the same key.
