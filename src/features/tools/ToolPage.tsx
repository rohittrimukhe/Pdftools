import { Hourglass } from 'lucide-react';
import { Page, TopBar } from '../../app/shell/AppShell';
import { Link } from '../../app/router';
import { findTool, isReady } from './catalog';
import { NotFound } from '../../app/NotFound';
import { TOOL_SCREENS } from '../../tools/registry';

/** Shell for one tool. Tools that are not built yet say so plainly. */
export function ToolPage({ id }: { id: string }) {
  const tool = findTool(id);
  if (!tool) return <NotFound />;
  const Screen = isReady(tool) ? TOOL_SCREENS[tool.id] : undefined;
  if (Screen) return <Screen key={tool.id} tool={tool} />;
  return (
    <Page narrow>
      <TopBar title={tool.name} />
      <p className="tool__blurb">{tool.blurb}</p>
      {!isReady(tool) && (
        <div className="hp-card empty-state">
          <span className="empty-state__icon"><Hourglass aria-hidden size={28} /></span>
          <p className="empty-state__title">Coming soon</p>
          <p className="empty-state__body">{tool.name} is being built. Like every Happy PDF tool, it will run on your device and upload nothing.</p>
          <Link to="/" className="hp-btn hp-btn--tonal">Browse tools</Link>
        </div>
      )}
    </Page>
  );
}
