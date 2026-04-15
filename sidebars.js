/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/welcome',
        'getting-started/quickstart',
        'getting-started/installation',
        'getting-started/concepts',
      ],
    },
    {
      type: 'category',
      label: 'Platform',
      items: [
        'platform/architecture',
        'platform/services',
        'platform/data-model',
        'platform/auth',
      ],
    },
    {
      type: 'category',
      label: 'Connections',
      items: [
        'connections/index',
        'connections/clusters',
        'connections/registries',
        'connections/network',
        'connections/observability',
        'connections/source-control',
        'connections/databases',
      ],
    },
    {
      type: 'category',
      label: 'Sources',
      items: [
        'sources/index',
        'sources/kafka',
        'sources/kinesis',
        'sources/s3',
        'sources/pubsub',
        'sources/eventhub',
        'sources/postgres-cdc',
        'sources/mysql-cdc',
        'sources/http',
      ],
    },
    {
      type: 'category',
      label: 'Sinks',
      items: [
        'sinks/index',
        'sinks/s3',
        'sinks/bigquery',
        'sinks/snowflake',
        'sinks/postgres',
        'sinks/kafka',
        'sinks/elasticsearch',
        'sinks/http',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: [
        'integrations/index',
        'integrations/aws',
        'integrations/gcp',
        'integrations/azure',
        'integrations/github',
        'integrations/datadog',
        'integrations/vault',
        'integrations/terraform',
      ],
    },
    {
      type: 'category',
      label: 'GitOps & Pipelines',
      items: [
        'gitops/overview',
        'gitops/pipelines',
        'gitops/declarative',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/cloud',
        'deployment/kubernetes',
        'deployment/self-hosted',
      ],
    },
    {
      type: 'category',
      label: 'Administration',
      items: [
        'administration/users-roles',
        'administration/security',
        'administration/monitoring',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/overview',
        'api/endpoints',
        'api/sdks',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/cli',
        'reference/glossary',
        'reference/error-codes',
      ],
    },
    {
      type: 'category',
      label: 'Support',
      items: [
        {
          type: 'category',
          label: 'FAQ',
          items: [
            'support/faq/faq-general',
            'support/faq/faq-deployments',
            'support/faq/faq-sources',
            'support/faq/faq-sinks',
            'support/faq/faq-schema-evolution',
            'support/faq/faq-pipelines',
            'support/faq/faq-integrations',
          ],
        },
        'support/troubleshooting',
        'support/changelog',
      ],
    },
  ],
};

export default sidebars;
