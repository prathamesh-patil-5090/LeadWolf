import { AppMobileNav } from '@/components/app-mobile-nav';
import { AppSidebar } from '@/components/app-sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppMobileNav />
        <main className="flex flex-1 flex-col overflow-auto">{children}</main>
      </div>
    </div>
  );
}
