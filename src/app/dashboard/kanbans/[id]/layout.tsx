export default function KanbanDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -my-8 flex h-[calc(100vh-4rem)] w-screen flex-col">
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
