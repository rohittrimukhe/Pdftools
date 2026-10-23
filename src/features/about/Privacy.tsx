import { Page, TopBar } from '../../app/shell/AppShell';
import './about.css';

/** Plain-language privacy policy. Update it in the same change that adds anything it describes. */
export function Privacy() {
  return (
    <Page narrow>
      <TopBar title="Privacy policy" back="/settings" backLabel="Settings" />
      <article className="hp-card prose">
        <p className="prose__updated">Last updated 23 October 2026</p>
        <h2>Your files</h2>
        <p>Happy PDF processes your documents, images and resumes on your own device, in the browser or in the app. Files are never sent to us or to anyone else.</p>
        <h2>What we store</h2>
        <p>We have no accounts and no servers that hold your data. Settings such as your theme are saved only on your device, and you can clear them by clearing this site's data or uninstalling the app.</p>
        <h2>Network use</h2>
        <p>Your device downloads the app itself (pages, scripts, fonts) from our website. After that, the tools work without internet. We do not use analytics or tracking.</p>
        <h2>Advertising</h2>
        <p>Happy PDF currently shows no ads. If we add ads to keep the app free, they will only appear outside your work (never while a document is open), you will be asked for consent where the law requires it, and this policy will be updated first.</p>
        <h2>Contact</h2>
        <p>Questions about privacy: open an issue at github.com/rohittrimukhe/Pdftools.</p>
      </article>
    </Page>
  );
}
