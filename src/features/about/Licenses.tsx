import licenses from '../../generated/licenses.json';
import { Page, TopBar } from '../../app/shell/AppShell';
import './about.css';

interface Entry { name: string; version: string; license: string; homepage?: string; text?: string }

export function Licenses() {
  const list = licenses as Entry[];
  return (
    <Page narrow>
      <TopBar title="Open-source licenses" back="/settings" backLabel="Settings" />
      <p className="licenses__intro">Happy PDF is built with these open-source libraries. Each keeps its own license.</p>
      <ul className="hp-group licenses">
        {list.map((entry) => (
          <li key={`${entry.name}@${entry.version}`}>
            <details className="licenses__item">
              <summary>
                <span className="licenses__name">{entry.name}</span>
                <span className="licenses__meta">{entry.version} · {entry.license}</span>
              </summary>
              {entry.text ? <pre className="licenses__text">{entry.text}</pre> : <p className="licenses__meta">License: {entry.license}</p>}
            </details>
          </li>
        ))}
      </ul>
    </Page>
  );
}
