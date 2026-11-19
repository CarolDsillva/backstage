import { GigApp } from '@/components/GigApp';

export default async function GigPage({ params }: PageProps<'/e/[slug]'>) {
  const { slug } = await params;
  return <GigApp slug={slug} />;
}
