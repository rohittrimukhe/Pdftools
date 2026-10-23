import type { ReactNode } from 'react';
import { Page, TopBar } from '../../app/shell/AppShell';
import type { Tool } from '../../features/tools/catalog';
import './kit.css';

export function ToolLayout({ tool, children }: { tool: Tool; children: ReactNode }) {
  return (
    <Page narrow>
      <TopBar title={tool.name} />
      <div className="tool">
        <p className="tool__blurb">{tool.blurb}</p>
        {children}
      </div>
    </Page>
  );
}
