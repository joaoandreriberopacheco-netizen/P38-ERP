import RootLayoutClient from './root-layout-client.next';

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }) {
  return <RootLayoutClient>{children}</RootLayoutClient>;
}
