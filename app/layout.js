import './globals.css';

export const metadata = {
  title: 'Ajot',
  description: 'Yksinkertainen mobiili ajopäiväkirja',
  manifest: '/manifest.json',
  themeColor: '#111111',
  appleWebApp: {
    capable: true,
    title: 'Ajot',
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
