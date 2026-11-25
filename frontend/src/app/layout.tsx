import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Verifood',
  description: 'Spot the red flags before you buy.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
