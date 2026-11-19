import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Permanent_Marker } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'] });
const marker = Permanent_Marker({ variable: '--font-marker', subsets: ['latin'], weight: '400' });

export const metadata: Metadata = {
  title: 'Backstage',
  description: 'The room for every gig: before the doors open, during the show, and after the encore.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#17122a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${marker.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
