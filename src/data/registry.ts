export type RegistryStatus = 'Active' | 'Preview' | 'Deprecated' | 'Archived';

export type RegistryCategory = 'Product' | 'API' | 'Guide' | 'Operations';

export type RegistryEntry = {
  id: string;
  title: string;
  description: string;
  category: RegistryCategory;
  audience: string;
  status: RegistryStatus;
  owner: string;
  url: string;
  updatedAt: string;
  tags: string[];
};

export const registryEntries: RegistryEntry[] = [
  {
    id: 'service-status',
    title: 'Service Status and Incidents',
    description: 'Service readiness monitoring, public status updates, and incident management operations.',
    category: 'Operations',
    audience: 'Service operators, administrators, developers',
    status: 'Active',
    owner: 'Shogun.dev',
    url: '/docs/service-status',
    updatedAt: '2026-09-07',
    tags: ['status', 'health', 'incidents', 'monitoring'],
  },
  {
    id: 'public-docs-registry',
    title: 'Public Documentation Registry',
    description:
      'Canonical index of public Shogun.dev documentation, ownership, lifecycle state, and discovery metadata.',
    category: 'Operations',
    audience: 'Customers, partners, contributors',
    status: 'Active',
    owner: 'Shogun.dev',
    url: '/docs/registry/overview',
    updatedAt: '2026-05-25',
    tags: ['registry', 'documentation', 'governance'],
  },
  {
    id: 'shogunn-dev-home',
    title: 'Shogunn.dev Website',
    description:
      'Public website and primary navigation surface for Shogun.dev products and services.',
    category: 'Product',
    audience: 'Public visitors',
    status: 'Active',
    owner: 'Shogun.dev',
    url: 'https://shogunn.dev',
    updatedAt: '2026-05-25',
    tags: ['website', 'product', 'public'],
  },
  {
    id: 'api-docs-placeholder',
    title: 'API Documentation',
    description:
      'Reserved registry entry for public API reference material once the external API surface is published.',
    category: 'API',
    audience: 'Developers',
    status: 'Preview',
    owner: 'Platform',
    url: '/docs/intro',
    updatedAt: '2026-05-25',
    tags: ['api', 'reference', 'developers'],
  },
];

export const registryStatuses: RegistryStatus[] = [
  'Active',
  'Preview',
  'Deprecated',
  'Archived',
];

export const registryCategories: RegistryCategory[] = [
  'Product',
  'API',
  'Guide',
  'Operations',
];
