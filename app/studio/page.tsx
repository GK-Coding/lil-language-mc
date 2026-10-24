import type { Metadata } from 'next';
import LiveStudio from '@/components/studio/LiveStudio';
import './studio.css';

export const metadata: Metadata = { title: 'Live rhyme studio · LLMC', description: 'Watch the sound of your freestyle become a living rhyme map.' };

export default function StudioPage() { return <LiveStudio />; }
