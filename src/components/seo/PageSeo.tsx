import { Helmet } from 'react-helmet-async';

export const SITE_URL = 'https://socmind.lovable.app';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

interface PageSeoProps {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export function PageSeo({
  title,
  description,
  path,
  type = 'website',
  image,
  jsonLd,
}: PageSeoProps) {
  const url = `${SITE_URL}${path}`;
  const ogImage = image
    ? image.startsWith('http')
      ? image
      : `${SITE_URL}${image}`
    : DEFAULT_OG_IMAGE;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}

export default PageSeo;
