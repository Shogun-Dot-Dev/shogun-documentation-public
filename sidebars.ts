import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'shogun-accounts',
    {
      type: 'category',
      label: 'Registry',
      items: ['registry/overview', 'registry/schema', 'registry/lifecycle'],
    },
    'service-status',
    'contributing',
  ],
};

export default sidebars;
