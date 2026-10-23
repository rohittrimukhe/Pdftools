import { useDeferredValue, useMemo, useState } from 'react';
import { ChevronRight, Search, ShieldCheck, X } from 'lucide-react';
import { Chip } from '../../design/ui';
import { LargeTitle, Page } from '../../app/shell/AppShell';
import { Link } from '../../app/router';
import { CATEGORIES, QUICK_TOOL_IDS, TOOLS, findTool, isReady, searchTools, toolPath, type Category, type Tool } from '../tools/catalog';
import './home.css';

type Filter = 'All' | Category;

// Remembered for this visit, so Back from a tool returns to the same search and filter.
const remembered: { query: string; filter: Filter } = { query: '', filter: 'All' };

export function Home() {
  const [query, setQuery] = useState(remembered.query);
  const [filter, setFilter] = useState<Filter>(remembered.filter);
  const deferred = useDeferredValue(query);
  remembered.query = query;
  remembered.filter = filter;

  const searching = deferred.trim().length > 0;
  const results = useMemo(
    () => searchTools(deferred).filter((tool) => filter === 'All' || tool.category === filter),
    [deferred, filter],
  );
  const quick = QUICK_TOOL_IDS.map((id) => findTool(id)).filter((t): t is Tool => Boolean(t));

  return (
    <Page>
      <LargeTitle
        title="Happy PDF"
        subtitle={
          <span className="home__promise">
            <ShieldCheck aria-hidden size={18} />
            <span><strong>Every document tool.</strong> Free, private, and nothing is uploaded.</span>
          </span>
        }
      />

      <div className="home__search" role="search">
        <Search aria-hidden size={20} className="home__search-icon" />
        <input
          type="search"
          className="home__search-input"
          placeholder="Search tools"
          aria-label={`Search ${TOOLS.length} tools`}
          aria-describedby="home-results"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button type="button" className="home__search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
            <X aria-hidden size={20} />
          </button>
        )}
      </div>
      <p id="home-results" className={searching ? 'home__count' : 'hp-sr-only'} role="status">
        {searching ? `${results.length} ${results.length === 1 ? 'tool matches' : 'tools match'} “${deferred.trim()}”` : ''}
      </p>

      <div className="home__chips" role="group" aria-label="Filter tools by kind">
        {(['All', ...CATEGORIES] as Filter[]).map((name) => (
          <Chip key={name} selected={filter === name} onClick={() => setFilter(name)}>{name}</Chip>
        ))}
      </div>

      {!searching && filter === 'All' && (
        <section aria-labelledby="home-quick" className="home__quick">
          <h2 id="home-quick" className="hp-group__title">Popular</h2>
          <ul className="quick">
            {quick.map((tool) => (
              <li key={tool.id}>
                <Link to={toolPath(tool)} className="quick__tile">
                  <span className="quick__icon"><tool.icon aria-hidden size={26} /></span>
                  <span className="quick__name">{tool.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.length === 0 ? (
        <div className="home__empty">
          <p className="home__empty-title">No tool matches that yet</p>
          <p>Try a simpler word, like “merge”, “compress” or “jpg”.</p>
          <button type="button" className="hp-btn hp-btn--tonal" onClick={() => { setQuery(''); setFilter('All'); }}>Show all tools</button>
        </div>
      ) : searching || filter !== 'All' ? (
        <ToolGroup tools={results} />
      ) : (
        CATEGORIES.map((category) => (
          <section key={category} aria-labelledby={`cat-${category}`}>
            <h2 id={`cat-${category}`} className="hp-group__title">{category}</h2>
            <ToolGroup tools={TOOLS.filter((tool) => tool.category === category)} />
          </section>
        ))
      )}
    </Page>
  );
}

function ToolGroup({ tools }: { tools: readonly Tool[] }) {
  return (
    <ul className="hp-group tool-list">
      {tools.map((tool) => (
        <li key={tool.id}>
          <Link to={toolPath(tool)} className="hp-row">
            <span className="hp-row__icon"><tool.icon aria-hidden size={22} /></span>
            <span className="hp-row__body">
              <span className="hp-row__title">
                {tool.name}
                {!isReady(tool) && <span className="hp-badge tool-list__soon">Soon</span>}
              </span>
              <span className="hp-row__sub">{tool.blurb}</span>
            </span>
            <ChevronRight aria-hidden className="hp-row__end tool-list__chevron" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
