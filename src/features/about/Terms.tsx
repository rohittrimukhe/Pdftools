import { Page, TopBar } from '../../app/shell/AppShell';
import { Link } from '../../app/router';
import { FEEDBACK_URL } from '../../app/links';
import './about.css';

/** Plain-language terms of use. */
export function Terms() {
  return (
    <Page narrow>
      <TopBar title="Terms of use" back="/settings" backLabel="Settings" />
      <article className="hp-card prose">
        <p className="prose__updated">Last updated 25 October 2026</p>
        <h2>Using Happy PDF</h2>
        <p>Happy PDF is free to use, for personal and work documents, with no account. You may use the website and the apps to work on your own files and files you are allowed to work on.</p>
        <h2>Your documents</h2>
        <p>Your files stay on your device and remain yours. You are responsible for having the right to change them: for example, only remove a password from a PDF you own or have permission to open.</p>
        <h2>No warranty</h2>
        <p>Happy PDF is provided as it is. We test every tool, but conversions can differ from the original (for example fonts, spacing and charts in Office files), and text recognition can misread words. Keep your originals and check important results. To the extent the law allows, we are not liable for loss arising from using the app.</p>
        <h2>The app itself</h2>
        <p>The Happy PDF name, logo, design and code belong to Rohit Trimukhe. You may not copy, resell, or publish them as your own product. Open-source components keep their own licenses, listed on <Link to="/licenses">Open-source licenses</Link>.</p>
        <h2>Changes</h2>
        <p>We may update these terms as the app grows. The date above shows the latest version.</p>
        <h2>Contact</h2>
        <p>Questions, problems or ideas: <a href={FEEDBACK_URL} target="_blank" rel="noreferrer">open an issue on GitHub</a>.</p>
      </article>
    </Page>
  );
}
