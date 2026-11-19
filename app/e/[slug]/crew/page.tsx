import { CrewConsole } from './CrewConsole';

export default async function CrewPage({ params }: PageProps<'/e/[slug]/crew'>) {
  const { slug } = await params;
  return <CrewConsole slug={slug} />;
}
