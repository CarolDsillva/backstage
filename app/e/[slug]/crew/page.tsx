import { CrewApp } from '@/components/crew/CrewApp';

export default async function CrewPage({ params }: PageProps<'/e/[slug]/crew'>) {
  const { slug } = await params;
  return <CrewApp slug={slug} />;
}
