'use client';

import P38LazyPage from '@/next/P38LazyPage';
import { P38_MAIN_PAGE } from '@/next/pageRegistry.generated';

export default function HomePage() {
  return <P38LazyPage pageName={P38_MAIN_PAGE} />;
}
