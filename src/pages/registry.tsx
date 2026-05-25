import {useMemo, useState} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {
  registryCategories,
  registryEntries,
  registryStatuses,
  type RegistryCategory,
  type RegistryStatus,
} from '../data/registry';

type FilterValue<T extends string> = 'All' | T;

const statusClassName: Record<RegistryStatus, string> = {
  Active: 'status-pill status-pill--active',
  Preview: 'status-pill status-pill--preview',
  Deprecated: 'status-pill status-pill--deprecated',
  Archived: 'status-pill status-pill--archived',
};

export default function RegistryPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<FilterValue<RegistryStatus>>('All');
  const [category, setCategory] = useState<FilterValue<RegistryCategory>>('All');

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return registryEntries.filter((entry) => {
      const matchesStatus = status === 'All' || entry.status === status;
      const matchesCategory = category === 'All' || entry.category === category;
      const searchable = [
        entry.title,
        entry.description,
        entry.category,
        entry.audience,
        entry.owner,
        entry.status,
        ...entry.tags,
      ]
        .join(' ')
        .toLowerCase();

      return (
        matchesStatus &&
        matchesCategory &&
        (!normalizedQuery || searchable.includes(normalizedQuery))
      );
    });
  }, [category, query, status]);

  return (
    <Layout
      title="Registry"
      description="Search and filter Shogun.dev public documentation entries.">
      <main className="registry-page">
        <section className="registry-header">
          <div className="container">
            <Heading as="h1">Documentation Registry</Heading>
            <p>
              Search public documentation by lifecycle status, category, owner, and audience.
            </p>
          </div>
        </section>

        <section className="container registry-tools" aria-label="Registry filters">
          <label className="registry-search">
            <span>Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search docs, owners, tags"
              type="search"
            />
          </label>

          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as FilterValue<RegistryStatus>)}>
              <option value="All">All statuses</option>
              {registryStatuses.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Category</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as FilterValue<RegistryCategory>)
              }>
              <option value="All">All categories</option>
              {registryCategories.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="container registry-results" aria-live="polite">
          <div className="registry-count">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          </div>

          <div className="registry-grid">
            {filteredEntries.map((entry) => (
              <article className="registry-card" key={entry.id}>
                <div className="registry-card__topline">
                  <span className={statusClassName[entry.status]}>{entry.status}</span>
                  <span>{entry.category}</span>
                </div>
                <Heading as="h2">{entry.title}</Heading>
                <p>{entry.description}</p>
                <dl className="registry-card__meta">
                  <div>
                    <dt>Audience</dt>
                    <dd>{entry.audience}</dd>
                  </div>
                  <div>
                    <dt>Owner</dt>
                    <dd>{entry.owner}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{entry.updatedAt}</dd>
                  </div>
                </dl>
                <div className="registry-card__tags">
                  {entry.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <a className="registry-card__link" href={entry.url}>
                  Open documentation
                </a>
              </article>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
