import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Halloween House Map',
  description: 'Find decorated houses and trick-or-treat spots near you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
