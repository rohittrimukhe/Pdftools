# Build the desktop and phone apps

**Who:** maintainer  **When:** before a release, or to try a change in a native app  **Time:** 10 minutes to download CI builds; about an hour the first time you set up store signing

All five apps run the same web build (`npm run build` → `dist/`). The desktop app wraps it
with [Tauri](https://tauri.app) (`src-tauri/`); the Android and iOS apps wrap it with
[Capacitor](https://capacitorjs.com) (`android/`, `ios/`, `capacitor.config.ts`).
Inside a native app, saving a file goes to the system instead of the browser
(`src/platform/native.ts`); ads and the offline service worker are website-only.

## Get the installers from CI (easiest)
1. Open the repository's **Actions** tab → **Apps** workflow → the latest green run.
   Expected result: five artifacts at the bottom of the page.
2. Download what you need:
   - `happy-pdf-Windows`: `.exe` (NSIS) and `.msi` installers
   - `happy-pdf-Linux`: `.deb`, `.rpm` and `.AppImage`
   - `happy-pdf-macOS`: universal `.dmg` (Apple silicon and Intel)
   - `happy-pdf-Android`: debug `.apk` you can sideload for testing
   - `happy-pdf-iOS-simulator`: `App.app` for the Xcode simulator
3. These builds are **unsigned**. Windows SmartScreen and macOS Gatekeeper will warn;
   that's expected until signing is set up (below).

## Build on your own computer
| App | Needs | Command |
|---|---|---|
| Desktop (your OS) | Node 22, Rust (`rustup`), and on Linux `libwebkit2gtk-4.1-dev librsvg2-dev patchelf` | `npm run desktop:build` |
| Desktop, live reload | same | `npm run desktop:dev` |
| Android | Android Studio (JDK 21, SDK 36) | `npm run build && npx cap sync android && npx cap open android` |
| iOS | macOS with Xcode 16+ | `npm run build && npx cap sync ios && npx cap open ios` |

Changed the logo? Run `npm run app:assets` to redraw every app icon and splash screen.

## Check it worked
- The app opens on Home. Pick a PDF, run any tool, press **Save**.
  - Desktop: the system Save dialog opens with the file name filled in.
  - Android: the toast says **Saved … to Documents/Happy PDF**.
  - iOS: the toast says **Saved … to Files › Happy PDF** (Files app → On My iPhone → Happy PDF).
- The badge under the result still reads **0 bytes uploaded**.
- Desktop CI also runs `cargo test` (`src-tauri/tests/served_types.rs`): it fails if any
  web file would be served with the wrong type, which shows up as a blank screen.

## Privacy guarantees built into the apps
- **Android** asks for no internet permission at all, and turns off Android cloud backup
  (`AndroidManifest.xml`). CI fails if the internet permission ever comes back.
- **Desktop** runs with a content security policy that blocks every network address
  (`src-tauri/tauri.conf.json`); it may only show the Save dialog and write the file you chose
  (`src-tauri/capabilities/default.json`).

## Store releases (when the developer accounts are ready)
1. **Google Play** — create an upload key once:
   `keytool -genkey -v -keystore happy-pdf-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`.
   Keep the `.jks` file and passwords in a password manager, never in the repository.
   Build a signed bundle in Android Studio (**Build → Generate Signed App Bundle**) and
   upload the `.aab` in Play Console. Data safety form: *no data collected, no data shared*.
2. **Apple App Store** — in Xcode set the team on the **App** target, then
   **Product → Archive → Distribute App**. Privacy label: *Data Not Collected*.
3. **Windows / macOS signing** — buy a code-signing certificate (Windows) and join the Apple
   Developer Program (macOS), store them as repository secrets, and follow Tauri's
   [code signing guide](https://v2.tauri.app/distribute/sign/) to pass them to the Apps workflow
   (macOS uses the `APPLE_CERTIFICATE`, `APPLE_ID` and related variables). Until then, publish
   unsigned builds on GitHub Releases with a note.

## If something goes wrong
- Blank window after choosing a file (desktop) → run `cargo test --release` in `src-tauri`
  after `npm run build`; it names the file served with the wrong type. Don't write the text
  `%PDF` into app code; use `PDF_MAGIC` from `src/files/detect.ts`.
- Linux build fails with `webkit2gtk-4.1 not found` → install the libraries in the table above.
- Android build says `SDK location not found` → open the project once in Android Studio, or
  create `android/local.properties` with `sdk.dir=/path/to/Android/sdk`.
- iOS build can't find packages → in Xcode, **File → Packages → Reset Package Caches**.
