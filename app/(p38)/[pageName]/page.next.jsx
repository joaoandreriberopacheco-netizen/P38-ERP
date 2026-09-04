'use client';

import { use } from 'react';
import P38LazyPage from '@/next/P38LazyPage';
import { P38_PAGE_NAMES } from '@/next/pageRegistry.generated';
import PageNotFound from '@/lib/PageNotFound';

export default function DynamicP38Page({ params }) {
  const { pageName } = use(params);

  if (!P38_PAGE_NAMES.includes(pageName)) {
    return <PageNotFound />;
  }

  return <P38LazyPage pageName={pageName} />;
}
