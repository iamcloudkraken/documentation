// @ts-check
import { themes as prismThemes } from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'STREAMINGPLUS',
  tagline: 'Cloud-native streaming infrastructure platform',
  favicon: 'img/favicon.ico',

  url: 'https://docs.streamingplus.io',
  baseUrl: '/',

  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    },
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    },
  ],

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  plugins: [
    'docusaurus-plugin-image-zoom',
    function resolveWeakPolyfill() {
      return {
        name: 'resolve-weak-polyfill',
        configureWebpack(config, isServer) {
          if (isServer) {
            return {
              plugins: [
                new (require('webpack').BannerPlugin)({
                  banner: 'if(typeof require!=="undefined"&&!require.resolveWeak){require.resolveWeak=function(id){try{return require.resolve(id);}catch(e){return undefined;}}}',
                  raw: true,
                  entryOnly: false,
                }),
              ],
            };
          }
          return {};
        },
      };
    },
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',          // Serve docs at site root
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/iamstreamingplus/docs/tree/main/',
        },
        blog: false,                   // No blog section
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'STREAMINGPLUS',
        logo: {
          alt: 'STREAMINGPLUS',
          src: 'img/logo.svg',
        },
        style: 'dark',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/iamstreamingplus',
            label: 'Community',
            position: 'right',
          },
          {
            href: '/getting-started/quickstart',
            label: 'Start Free',
            position: 'right',
            className: 'navbar--start-free',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started', to: '/' },
              { label: 'Connections', to: '/connections' },
              { label: 'Sources', to: '/sources' },
              { label: 'Sinks', to: '/sinks' },
              { label: 'CLI Reference', to: '/reference/cli' },
            ],
          },
          {
            title: 'Community',
            items: [
              { label: 'GitHub', href: 'https://github.com/iamstreamingplus' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} STREAMINGPLUS. Built with Docusaurus.`,
      },
      zoom: {
        selector: '.markdown img',
        background: {
          light: 'rgba(15, 23, 42, 0.85)',
          dark:  'rgba(0, 0, 0, 0.9)',
        },
        config: {
          margin: 32,
          scrollOffset: 40,
        },
      },
      prism: {
        theme: prismThemes.vsDark,
        darkTheme: prismThemes.vsDark,
        additionalLanguages: ['bash', 'yaml', 'hcl', 'sql', 'go', 'python', 'toml', 'json'],
      },
    }),
};

export default config;
