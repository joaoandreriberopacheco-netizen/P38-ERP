'use client';

import { use } from 'react';
import P38NextRoutePage from '@/next/P38NextRoutePage';
import { P38_PAGE_NAMES } from '@/next/pageRegistry.generated';
import PageNotFound from '@/lib/PageNotFound';

export default function DynamicP38Page({ params }) {
  const { pageName } = use(params);

  if (!P38_PAGE_NAMES.includes(pageName)) {
    return <PageNotFound />;
  }

  return <P38NextRoutePage pageName={pageName} />;
}
