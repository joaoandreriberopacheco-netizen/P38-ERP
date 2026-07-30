'use client';

import P38NextRoutePage from '@/next/P38NextRoutePage';
import { P38_MAIN_PAGE } from '@/next/pageRegistry.generated';

export default function HomePage() {
  return <P38NextRoutePage pageName={P38_MAIN_PAGE} />;
}
