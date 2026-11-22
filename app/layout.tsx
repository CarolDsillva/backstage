import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Permanent_Marker, Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] });
const marker = Permanent_Marker({ variable: '--font-marker', subsets: ['latin'], weight: '400' });
const display = Bricolage_Grotesque({ variable: '--font-display', subsets: ['latin'], weight: ['600', '700', '800'] });
const mono = JetBrains_Mono({ variable: '--font-mono', subsets: ['latin'], weight: ['500', '700'] });

export const metadata: Metadata = {
  title: 'Backstage',
  description: 'The room for every gig: before the doors open, during the show, and after the encore.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#160B36',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${marker.variable} ${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
