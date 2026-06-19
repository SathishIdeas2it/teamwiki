import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | TeamWiki',
    default: 'TeamWiki',
  },
  description: 'Internal company knowledge base',
  robots: { index: false, follow: false },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
