import type { Metadata } from 'next';

type UserDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: UserDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  void id;
  return { title: 'Edit User' };
}

export default async function UserDetailPage({ params }: UserDetailPageProps): Promise<JSX.Element> {
  const { id } = await params;
  void id;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Edit User</h1>
      {/* UserEditForm Client Component goes here */}
    </div>
  );
}
