import PageClient from "@/widgets/pages/premium/accounts/[id]/page-client";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PageClient accountId={id} />;
}
