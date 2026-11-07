import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Bell, GraduationCap, Languages, LogOut, Menu, Moon, Search, Sun, User } from 'lucide-react';
import type { NotificationDto, SearchHit } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useAuth, useCan } from '@/lib/auth';
import { applyLocale } from '@/lib/i18n';
import { useBilingual, useFormat } from '@/lib/format';
import { entityPath, entityLabelKey } from '@/lib/entities';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, SheetContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { PageLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { NAV } from './nav';

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const can = useCan();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground dark:bg-sidebar-accent dark:text-sidebar-foreground"><GraduationCap className="size-5" aria-hidden /></span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">{t('app.fullName')}</p>
          <p className="text-[11px] text-sidebar-muted">{t('app.ministry')}</p>
        </div>
      </div>
      <nav aria-label={t('nav.menu')} className="flex-1 overflow-y-auto px-2 pb-4">
        {NAV.map((g, gi) => {
          const items = g.items.filter((i) => !i.perm || can(i.perm));
          if (!items.length) return null;
          return (
            <div key={gi} className="mt-4 first:mt-1">
              {g.label && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{t(g.label)}</p>}
              <ul className="flex flex-col gap-0.5">
                {items.map((i) => (
                  <li key={i.to}>
                    <NavLink to={i.to} end={i.to === '/'} onClick={onNavigate}
                      className={({ isActive }) => cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent focus-visible:outline-sidebar-foreground', isActive && 'bg-sidebar-accent font-medium')}>
                      <i.icon className="size-4 shrink-0 opacity-80" aria-hidden />
                      {t(i.label)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

function GlobalSearch() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const res = useQuery({ queryKey: ['search', dq], queryFn: () => api.get<SearchHit[]>(`/search?q=${encodeURIComponent(dq)}`), enabled: open && dq.length >= 2 });
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return (
    <>
      <Button variant="outline" className="h-9 w-9 justify-start gap-2 px-0 text-muted-foreground sm:w-64 sm:px-3 max-sm:justify-center" onClick={() => setOpen(true)} aria-label={t('common.search')}>
        <Search /><span className="hidden sm:inline">{t('common.search')}…</span><kbd className="ms-auto hidden rounded border px-1.5 text-[10px] sm:inline">Ctrl K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }}>
        <DialogContent size="md" className="sm:top-24 sm:translate-y-0">
          <DialogTitle className="sr-only">{t('common.search')}</DialogTitle>
          <div className="border-b p-3 pe-12">
            <Input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.searchPlaceholder')} aria-label={t('common.search')} />
          </div>
          <ul className="max-h-[60dvh] overflow-y-auto p-2" aria-live="polite">
            {dq.length >= 2 && res.data?.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{t('common.noResults')}</li>}
            {res.data?.map((h) => (
              <li key={h.entityType + h.id}>
                <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-start hover:bg-muted" onClick={() => { navigate(entityPath(h.entityType, h.id)!); setOpen(false); }}>
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{t(entityLabelKey(h.entityType))}</span>
                  <span className="min-w-0 flex-1 truncate text-sm"><span className="font-mono text-xs text-muted-foreground">{h.code}</span> {pick(h as never, 'title')}</span>
                  <StatusBadge status={h.status} />
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Notifications() {
  const { t } = useTranslation();
  const { t2 } = useBilingual();
  const f = useFormat();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ items: NotificationDto[]; unread: number }>('/notifications'), refetchInterval: 60_000 });
  const read = useApiMutation({ fn: (ids?: string[]) => api.post('/notifications/read', { ids }), invalidate: [['notifications']] });
  const unread = q.data?.unread ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${t('common.notifications')}${unread ? ` (${unread})` : ''}`}>
          <Bell />
          {unread > 0 && <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">{t('common.notifications')}</p>
          {unread > 0 && <Button variant="link" size="sm" onClick={() => read.mutate(undefined)}>{t('common.markAllRead')}</Button>}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {!q.data?.items.length && <li className="p-6 text-center text-sm text-muted-foreground">{t('common.noNotifications')}</li>}
          {q.data?.items.map((n) => (
            <li key={n.id}>
              <button type="button" className={cn('flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-start text-sm hover:bg-muted', !n.readAt && 'bg-secondary/50')}
                onClick={() => { if (!n.readAt) read.mutate([n.id]); if (n.link) navigate(n.link); }}>
                <span className={cn(!n.readAt && 'font-medium')}>{t2(n.titleEn, n.titleAr)}</span>
                <span className="text-xs text-muted-foreground">{f.relative(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('cdms.theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
    setDark(next);
  };
  return { dark, toggle };
}

export function AppShell() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { t2 } = useBilingual();
  const [menu, setMenu] = useState(false);
  const { dark, toggle } = useTheme();
  const location = useLocation();
  useEffect(() => setMenu(false), [location.pathname]);
  const switchLang = () => applyLocale(i18n.language === 'ar' ? 'en' : 'ar');

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-md">{t('app.skip')}</a>
      <div className="fixed inset-y-0 start-0 z-30 hidden w-64 lg:block no-print"><Sidebar /></div>
      <Dialog open={menu} onOpenChange={setMenu}>
        <SheetContent aria-describedby={undefined}>
          <DialogTitle className="sr-only">{t('nav.menu')}</DialogTitle>
          <Sidebar onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Dialog>
      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-5 no-print">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenu(true)} aria-label={t('nav.menu')}><Menu /></Button>
          <GlobalSearch />
          <div className="ms-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={switchLang} aria-label={`${t('common.language')}: ${i18n.language === 'ar' ? 'English' : 'العربية'}`}>
              <Languages /><span className="hidden sm:inline" lang={i18n.language === 'ar' ? 'en' : 'ar'}>{i18n.language === 'ar' ? 'English' : 'العربية'}</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={`${t('common.theme')}: ${dark ? t('common.light') : t('common.dark')}`}>{dark ? <Sun /> : <Moon />}</Button>
            <Notifications />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('common.profile')}><span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"><User className="size-4" /></span></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium text-foreground">{t2(user?.fullNameEn, user?.fullNameAr)}</p>
                  <p className="truncate text-xs" dir="ltr">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/settings"><User />{t('nav.settings')}</Link></DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => void logout()}><LogOut />{t('common.signOut')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 outline-none">
          <Suspense fallback={<PageLoader />}><Outlet /></Suspense>
        </main>
      </div>
    </div>
  );
}
