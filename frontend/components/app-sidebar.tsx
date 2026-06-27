'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAV } from '@/lib/app-nav';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <Link
        href="/dashboard"
        className="flex h-14 items-center gap-2.5 border-b px-4 transition-colors hover:bg-sidebar-accent/40"
      >
        <Image
          src="/leadwolf-logo.png"
          alt="LeadWolf"
          width={28}
          height={28}
          className="size-7 shrink-0 rounded-md"
          priority
        />
        <span className="font-semibold tracking-tight">LeadWolf</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {APP_NAV.map(({ href, label, icon: Icon }) => {
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
      <div className="hidden border-t p-3 text-xs text-muted-foreground lg:block">
        <p className="truncate" title={process.env.NEXT_PUBLIC_API_URL}>
          API: {process.env.NEXT_PUBLIC_API_URL ?? 'localhost:3001/api'}
        </p>
      </div>
    </aside>
  );
}
