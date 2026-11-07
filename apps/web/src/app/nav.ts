import type { LucideIcon } from 'lucide-react';
import {
  BookOpenCheck,
  Boxes,
  Building2,
  ClipboardCheck,
  FileStack,
  Gauge,
  Layers,
  ListTree,
  Palette,
  Puzzle,
  ScrollText,
  Settings,
  Shield,
  Upload,
  Users,
  Workflow,
  BarChart3,
  Target,
} from 'lucide-react';
import { PERMISSIONS as P } from '@cdms/contracts';
import type { Permission } from '@cdms/contracts';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  perm?: Permission;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/** Single source of truth for navigation. Items are hidden when the user lacks the permission. */
export const NAV: NavGroup[] = [
  {
    items: [
      { to: '/', label: 'nav.dashboard', icon: Gauge },
      { to: '/curricula', label: 'nav.curricula', icon: BookOpenCheck, perm: P.CURRICULUM_READ },
      { to: '/reviews', label: 'nav.reviews', icon: ClipboardCheck },
    ],
  },
  {
    label: 'nav.standards',
    items: [
      { to: '/occupations', label: 'nav.occupations', icon: ListTree, perm: P.CATALOG_READ },
      { to: '/competencies', label: 'nav.competencies', icon: Target, perm: P.CATALOG_READ },
      { to: '/units', label: 'nav.units', icon: Puzzle, perm: P.CATALOG_READ },
      { to: '/frameworks', label: 'nav.frameworks', icon: Layers, perm: P.CATALOG_READ },
      { to: '/templates', label: 'nav.templates', icon: FileStack, perm: P.TEMPLATE_READ },
    ],
  },
  {
    label: 'nav.data',
    items: [
      { to: '/reference-data', label: 'nav.referenceData', icon: Boxes, perm: P.REFERENCE_READ },
      { to: '/institutions', label: 'nav.institutions', icon: Building2, perm: P.INSTITUTION_READ },
      { to: '/import-export', label: 'nav.importExport', icon: Upload, perm: P.EXPORT_RUN },
      { to: '/reports', label: 'nav.reports', icon: BarChart3, perm: P.REPORT_READ },
    ],
  },
  {
    label: 'nav.admin',
    items: [
      { to: '/admin/users', label: 'nav.users', icon: Users, perm: P.USER_READ },
      { to: '/admin/roles', label: 'nav.roles', icon: Shield, perm: P.USER_READ },
      { to: '/admin/audit', label: 'nav.audit', icon: ScrollText, perm: P.AUDIT_READ },
      { to: '/design-system', label: 'nav.designSystem', icon: Palette },
      { to: '/settings', label: 'nav.settings', icon: Settings },
    ],
  },
];
export const WorkflowIcon = Workflow;
