import { Page, TopBar } from '../../app/shell/AppShell';
import { adsOn } from '../../ads/config';
import { FEEDBACK_URL } from '../../app/links';
import './about.css';

/** Plain-language privacy policy. Update it in the same change that adds anything it describes. */
export function Privacy() {
  return (
    <Page narrow>
      <TopBar title="Privacy policy" back="/settings" backLabel="Settings" />
      <article className="hp-card prose">
        <p className="prose__updated">Last updated 25 October 2026</p>
        <h2>Your files</h2>
        <p>Happy PDF processes your documents, images, scans and resumes on your own device, in the browser or in the app. Files are never sent to us or to anyone else. The “0 bytes uploaded” badge under each result measures this: it counts everything the page sends anywhere.</p>
        <h2>What stays on your device</h2>
        <p>We have no accounts and no servers that hold your data. These are kept only on your device, and you can remove them at any time:</p>
        <ul>
          <li>Recent files: for 7 days, then removed automatically. Turn this off or clear them in Settings.</li>
          <li>Your resume draft, so it survives a reload. “Start over” in the Resume builder deletes it.</li>
          <li>Settings such as your theme.</li>
        </ul>
        <p>Clearing this site’s data in your browser, or uninstalling the app, removes all of it.</p>
        <h2>Camera</h2>
        <p>“Take a photo” in Scan document opens your camera only when you tap it. The photo goes straight into the scanner on your device and is not saved anywhere else.</p>
        <h2>Network use</h2>
        <p>Your device downloads the app itself (pages, scripts, fonts) from our website. The text-recognition engine and its English and Hindi language files (about 16 MB) download from our website the first time you use OCR, and are then kept for offline use. After that, the tools work without internet. We do not use analytics or tracking.</p>
        <p>The Android app has no internet permission at all. The desktop app is built to block every network address.</p>
        <h2>Advertising</h2>
        {adsOn() ? (
          <>
            <p>To keep Happy PDF free, some screens show ads from Google AdSense: Home, Recent, and under a finished file. Ads never appear while a document is open or being processed, and they never receive your files or their contents.</p>
            <p>Google may use cookies to show and measure ads, and to personalise them unless you choose “Non-personalised ads only” in Settings. Visitors in the EU, UK and Switzerland are asked for consent first. See how Google uses information at policies.google.com/technologies/partner-sites.</p>
          </>
        ) : (
          <p>Happy PDF currently shows no ads. If we add ads to keep the app free, they will only appear outside your work (never while a document is open), you will be asked for consent where the law requires it, and this policy will be updated first.</p>
        )}
        <h2>Changes</h2>
        <p>If we change how Happy PDF handles data, we update this page first and change the date at the top.</p>
        <h2>Contact</h2>
        <p>Questions about privacy: <a href={FEEDBACK_URL} target="_blank" rel="noreferrer">open an issue on GitHub</a>.</p>
      </article>
    </Page>
  );
}
