import type { Metadata } from 'next';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import { Theme } from '@astryxdesign/core/theme';
import { themes, defaultThemeSlug } from '../astryx-themes';

export const metadata: Metadata = {
  title: 'Megha · Live Browser Stream',
  description: 'Watch every browser action stream live while Megha drives the browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Theme theme={themes[defaultThemeSlug]}>{children}</Theme>
      </body>
    </html>
  );
}
