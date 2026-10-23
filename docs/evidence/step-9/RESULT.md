# Step 9 — Desktop and phone apps

**Date:** 2026-10-23  **Result:** desktop app built and checked by hand on Linux; Windows, macOS, Android and iOS build in CI (Apps workflow)

## What was built
- **One codebase, five apps.** The website build runs inside:
  - **Tauri 2** (`src-tauri/`) for Windows (`.exe`, `.msi`), Linux (`.deb`, `.rpm`, `.AppImage`) and macOS (universal `.dmg`). The Linux `.deb` is 5.7 MB.
  - **Capacitor 8** (`android/`, `ios/`, `capacitor.config.ts`) for Android and iOS.
- **Native save.** `src/platform/runtime.ts` detects the shell; `src/platform/native.ts` swaps the browser download for:
  - desktop: the system **Save as** dialog, writing only the file the person picked;
  - Android: `Documents/Happy PDF` (a repeat name becomes `report (2).pdf`), plus the system share sheet;
  - iOS: the app's Documents folder, shown in the Files app under *On My iPhone › Happy PDF*.
  The toast says where the file went, and says nothing when the Save dialog is cancelled.
- **Android back button** walks back through the app and closes it from the first screen.
- **Website-only features stay off in the apps:** web ads and the offline service worker.
- **Privacy built in:**
  - Android asks for **no internet permission** and turns cloud backup off. CI fails if the permission ever comes back.
  - The desktop app runs under a content security policy that blocks every network address. It may only show the Save dialog and write the chosen file.
- **Crash screen** (`src/app/ErrorBoundary.tsx`): if a screen fails, people see what happened and a Reload button instead of a blank window.
- **App icons and splash screens** for Android and iOS, drawn from our logo (`npm run app:assets`).
- **CI:** `.github/workflows/apps.yml` builds all five apps on every pull request and keeps the installers as downloads.
- **SOP:** `docs/sop/native-apps.md` covers downloading builds, local builds, checks, store publishing and fixes.

## Checks
| Check | Result |
|---|---|
| Unit tests | 63 of 63 passed (`unit-tests.txt`) |
| Browser tests | 134 of 134 passed, phone and desktop (`browser-tests.txt`); new: desktop save, cancelled save, no service worker in apps |
| Desktop type check (`cargo test`) | Every script, style, page and data file is served with its own type (`served-types-test.txt`) |
| Linux desktop app, by hand | Opened `report.pdf` with the system file picker, ran Watermark, saved with the system Save dialog (`desktop-linux-*.png`) |
| Saved file | Every page reads "Desktop page N CONFIDENTIAL" (`desktop-saved-file-text.txt`) |
| Upload badge after a desktop save | **0 bytes uploaded** (`desktop-linux-saved-0-bytes.png`) |

Android and iOS can't be built in this workspace: the Android SDK download is blocked and iOS needs a Mac. Their builds run in the Apps workflow; see its run on the pull request.

## Bugs found and fixed
1. **Blank window after picking a file (desktop).** Tauri guesses a file's type from its first kilobyte before it looks at the extension. The Open screen's script contained the text `%PDF`, so the shell served it as a PDF and the screen never loaded (`bug-desktop-open-crash.png`, shown by the new crash screen).
   - Fix: the PDF signature is now written as bytes (`PDF_MAGIC`).
   - Guard: a Rust test checks every file of the build the way the shell does. It failed on the old build and passes on the new one.
2. **Badge said "1.9 KB sent" after a desktop save.** The desktop shell passes the file to the Save dialog over its own local channel (`ipc://localhost`), and the upload monitor counted that (`bug-desktop-badge-ipc.png`). That channel never leaves the computer, so it is no longer counted.
   - Covered by unit tests and a browser test, which failed before the fix and pass after.
3. **Test build replaced the desktop app.** `cargo test --release` rebuilds the app binary in development mode. CI now runs that check before packaging, so installers always contain the release binary.
