'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { APP_NAV } from '@/lib/app-nav';
import { cn } from '@/lib/utils';

export function AppMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-4" />
        </Button>
        <SheetContent side="left" className="w-[min(18rem,85vw)] p-0 sm:max-w-xs">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2.5">
              <Image
                src="/leadwolf-logo.png"
                alt="LeadWolf"
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-md"
              />
              LeadWolf
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3">
            {APP_NAV.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2">
        <Image
          src="/leadwolf-logo.png"
          alt="LeadWolf"
          width={24}
          height={24}
          className="size-6 shrink-0 rounded-md"
        />
        <span className="truncate font-semibold tracking-tight">LeadWolf</span>
      </Link>
    </header>
  );
}
