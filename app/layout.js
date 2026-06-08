import './globals.css';

export const metadata = {
  title: 'Ajopäiväkirja',
  description: 'Yksinkertainen mobiili ajopäiväkirja',
  manifest: '/manifest.json',
  themeColor: '#111111',
  appleWebApp: {
    capable: true,
    title: 'Ajopäiväkirja',
    statusBarStyle: 'black-translucent'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="fi">
      <body>{children}</body>
    </html>
  );
}
