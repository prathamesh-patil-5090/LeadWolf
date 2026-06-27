'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  LayoutDashboard,
  ListTodo,
  Mail,
  Search,
  Users,
  Radar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/sent-emails', label: 'Sent emails', icon: Mail },
  { href: '/pipeline', label: 'Pipeline', icon: ListTodo },
  { href: '/companies', label: 'Companies', icon: Building2 },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Radar className="size-5" />
        <span className="font-semibold tracking-tight">LeadWolf</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3 text-xs text-muted-foreground">
        API: {process.env.NEXT_PUBLIC_API_URL ?? 'localhost:3001/api'}
      </div>
    </aside>
  );
}
