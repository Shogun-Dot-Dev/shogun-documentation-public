import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {registryEntries} from '../data/registry';

const activeCount = registryEntries.filter((entry) => entry.status === 'Active').length;

export default function Home() {
  return (
    <Layout
      title="Public Documentation Registry"
      description="Public documentation registry for Shogun.dev">
      <main>
        <section className="hero hero--registry">
          <div className="container hero__inner">
            <div className="hero__copy">
              <Heading as="h1" className="hero__title">
                Shogun Public Documentation
              </Heading>
              <p className="hero__subtitle">
                A governed registry for public product, API, and operations documentation.
              </p>
              <div className="hero__actions">
                <Link className="button button--primary button--lg" to="/registry">
                  Browse registry
                </Link>
                <Link className="button button--secondary button--lg" to="/docs/intro">
                  Read docs
                </Link>
              </div>
            </div>
            <div className="registry-summary" aria-label="Registry summary">
              <span className="registry-summary__value">{registryEntries.length}</span>
              <span className="registry-summary__label">public entries</span>
              <span className="registry-summary__meta">{activeCount} active today</span>
            </div>
          </div>
        </section>
        <section className="home-band">
          <div className="container home-band__grid">
            <article>
              <h2>Find the canonical surface</h2>
              <p>
                Every registry entry includes ownership, status, audience, and the public destination
                users should trust.
              </p>
            </article>
            <article>
              <h2>Keep lifecycle visible</h2>
              <p>
                Preview, active, deprecated, and archived documentation can coexist without making
                readers guess what is current.
              </p>
            </article>
            <article>
              <h2>Ship as static docs</h2>
              <p>
                Docusaurus builds this registry into a fast static documentation site ready for
                Railway deployment.
              </p>
            </article>
          </div>
        </section>
      </main>
    </Layout>
  );
}
