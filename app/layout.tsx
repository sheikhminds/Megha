import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Megha · Live Browser Stream',
  description: 'Watch every browser action stream live.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
