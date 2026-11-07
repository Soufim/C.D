import { lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/lib/auth';
import { PageLoader } from '@/components/patterns/states';
import { AppShell } from './AppShell';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = <M extends Record<string, any>>(load: () => Promise<M>, name: keyof M & string) =>
  lazy(() => load().then((m) => ({ default: m[name] as React.ComponentType })));

const LoginPage = page(() => import('@/features/auth/LoginPage'), 'LoginPage');
const DashboardPage = page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage');
const CurriculaListPage = page(() => import('@/features/curricula/CurriculaListPage'), 'CurriculaListPage');
const CurriculumDetailPage = page(() => import('@/features/curricula/CurriculumDetailPage'), 'CurriculumDetailPage');
const CurriculumPrintPage = page(() => import('@/features/curricula/CurriculumPrintPage'), 'CurriculumPrintPage');
const ReviewQueuePage = page(() => import('@/features/reviews/ReviewQueuePage'), 'ReviewQueuePage');
const OccupationsPage = page(() => import('@/features/occupations/OccupationsPage'), 'OccupationsPage');
const OccupationDetailPage = page(() => import('@/features/occupations/OccupationDetailPage'), 'OccupationDetailPage');
const CompetenciesPage = page(() => import('@/features/competencies/CompetenciesPage'), 'CompetenciesPage');
const CompetencyDetailPage = page(() => import('@/features/competencies/CompetencyDetailPage'), 'CompetencyDetailPage');
const UnitsPage = page(() => import('@/features/units/UnitsPage'), 'UnitsPage');
const UnitDetailPage = page(() => import('@/features/units/UnitDetailPage'), 'UnitDetailPage');
const FrameworksPage = page(() => import('@/features/frameworks/FrameworksPage'), 'FrameworksPage');
const FrameworkDetailPage = page(() => import('@/features/frameworks/FrameworkDetailPage'), 'FrameworkDetailPage');
const TemplatesPage = page(() => import('@/features/templates/TemplatesPage'), 'TemplatesPage');
const TemplateDetailPage = page(() => import('@/features/templates/TemplateDetailPage'), 'TemplateDetailPage');
const ReferenceDataPage = page(() => import('@/features/reference-data/ReferenceDataPage'), 'ReferenceDataPage');
const InstitutionsPage = page(() => import('@/features/institutions/InstitutionsPage'), 'InstitutionsPage');
const ImportExportPage = page(() => import('@/features/import-export/ImportExportPage'), 'ImportExportPage');
const ReportsPage = page(() => import('@/features/reports/ReportsPage'), 'ReportsPage');
const UsersPage = page(() => import('@/features/admin/UsersPage'), 'UsersPage');
const RolesPage = page(() => import('@/features/admin/RolesPage'), 'RolesPage');
const AuditPage = page(() => import('@/features/admin/AuditPage'), 'AuditPage');
const SettingsPage = page(() => import('@/features/settings/SettingsPage'), 'SettingsPage');
const DesignSystemPage = page(() => import('@/features/design-system/DesignSystemPage'), 'DesignSystemPage');
const NotFoundPage = page(() => import('@/features/misc/NotFoundPage'), 'NotFoundPage');

function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="p-6"><PageLoader /></div>;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/curricula/:id/print', element: <CurriculumPrintPage /> },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'curricula', element: <CurriculaListPage /> },
          { path: 'curricula/:id', element: <CurriculumDetailPage /> },
          { path: 'reviews', element: <ReviewQueuePage /> },
          { path: 'occupations', element: <OccupationsPage /> },
          { path: 'occupations/:id', element: <OccupationDetailPage /> },
          { path: 'competencies', element: <CompetenciesPage /> },
          { path: 'competencies/:id', element: <CompetencyDetailPage /> },
          { path: 'units', element: <UnitsPage /> },
          { path: 'units/:id', element: <UnitDetailPage /> },
          { path: 'frameworks', element: <FrameworksPage /> },
          { path: 'frameworks/:id', element: <FrameworkDetailPage /> },
          { path: 'templates', element: <TemplatesPage /> },
          { path: 'templates/:id', element: <TemplateDetailPage /> },
          { path: 'reference-data', element: <ReferenceDataPage /> },
          { path: 'institutions', element: <InstitutionsPage /> },
          { path: 'institutions/:id', element: <InstitutionsPage /> },
          { path: 'import-export', element: <ImportExportPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'admin/users', element: <UsersPage /> },
          { path: 'admin/users/:id', element: <UsersPage /> },
          { path: 'admin/roles', element: <RolesPage /> },
          { path: 'admin/audit', element: <AuditPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'design-system', element: <DesignSystemPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
