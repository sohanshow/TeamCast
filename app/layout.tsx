import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TeamCast - Super Bowl Pre-Game Live Podcast',
  description: 'Join the ultimate Super Bowl pre-game experience. Listen to live analysis, predictions, and engage with fellow fans in real-time.',
  keywords: ['Super Bowl', 'podcast', 'live', 'NFL', 'football', 'analysis', 'predictions'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
