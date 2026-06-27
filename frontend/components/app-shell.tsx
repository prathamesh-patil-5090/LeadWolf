import { AppSidebar } from '@/components/app-sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-auto">{children}</main>
    </div>
  );
}
