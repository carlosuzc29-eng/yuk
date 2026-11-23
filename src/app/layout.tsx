import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { TrainingProvider } from '@/components/providers/TrainingProvider';
import { Preloader } from '@/components/layout/Preloader';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-inter',
  display: 'swap',
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: 'YUK — Entrenamiento Personalizado',
  description:
    'PWA de entrenamiento personalizado de fuerza e hipertrofia para tu grupo de amigos. Funciona sin conexión.',
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'YUK',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111211' },
  ],
};

const FOUC_SCRIPT = `
try {
  var saved = localStorage.getItem("color-scheme");
  var meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.content = saved === "dark" || saved === "light" ? saved : "light dark";
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-419"
      className={inter.variable}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
        {/* Sin JavaScript el preloader nunca se retiraría: lo ocultamos. */}
        <noscript>
          <style>{`#yuk-preloader{display:none!important}`}</style>
        </noscript>
      </head>
      <body className="antialiased selection:bg-[var(--accent)] selection:text-white">
        <ThemeProvider>
          <AuthProvider>
            <TrainingProvider>
              <Preloader />
              {children}
            </TrainingProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
