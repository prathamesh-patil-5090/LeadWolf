import {
  Building2,
  LayoutDashboard,
  ListTodo,
  Mail,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const APP_NAV: AppNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/sent-emails', label: 'Sent emails', icon: Mail },
  { href: '/pipeline', label: 'Pipeline', icon: ListTodo },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];
