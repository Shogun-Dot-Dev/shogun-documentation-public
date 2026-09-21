import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Shogun Public Documentation',
  tagline: 'A registry of public product, API, and operations documentation.',
  favicon: 'img/favicon.svg',

  url: 'https://docs.shogunn.dev',
  baseUrl: '/',

  organizationName: 'shogun-dev',
  projectName: 'shogun-documentation-public',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
          editUrl:
            'https://github.com/shogun-dev/shogun-documentation-public/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.svg',
    navbar: {
      title: 'Shogun Docs',
      logo: {
        alt: 'Shogun Documentation',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/registry', label: 'Registry', position: 'left'},
        {
          href: 'https://shogunn.dev',
          label: 'Shogunn.dev',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Registry',
          items: [
            {label: 'Browse documentation', to: '/registry'},
            {label: 'Contribution guide', to: '/docs/contributing'},
          ],
        },
        {
          title: 'Shogun.dev',
          items: [
            {label: 'Website', href: 'https://shogunn.dev'},
            {label: 'Shogun Account', href: 'https://shogunn.dev/account'},
            {label: 'Service status', href: 'https://shogunn.dev/status'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Shogun.dev.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
