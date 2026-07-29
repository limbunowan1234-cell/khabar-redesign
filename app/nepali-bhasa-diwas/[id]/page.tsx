import BhasaDiwasSubmissionDetail from '@/components/bhasa-diwas/BhasaDiwasSubmissionDetail';

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BhasaDiwasSubmissionDetail id={id} />;
}