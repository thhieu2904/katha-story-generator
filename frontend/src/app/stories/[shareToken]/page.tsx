import type { Metadata } from 'next';
import { SharedStoryPageClient } from './SharedStoryPageClient';

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

export default async function SharedStoryPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  return <SharedStoryPageClient shareToken={shareToken} />;
}
