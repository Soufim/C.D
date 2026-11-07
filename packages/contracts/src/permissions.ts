/**
 * Permission catalogue. Permissions are the ONLY thing checked in code;
 * roles are data (configurable bundles of permissions). Always check a
 * permission, never a role name.
 */
export const PERMISSIONS = {
  // Curricula
  CURRICULUM_READ: 'curriculum.read',
  CURRICULUM_WRITE: 'curriculum.write',
  CURRICULUM_REVIEW: 'curriculum.review',
  CURRICULUM_APPROVE: 'curriculum.approve',
  CURRICULUM_PUBLISH: 'curriculum.publish',
  /** Act on curricula owned by any institution (otherwise own institution only). */
  CURRICULUM_ALL_INSTITUTIONS: 'curriculum.all_institutions',
  // Standardisation catalogue: occupations, competencies, units, frameworks
  CATALOG_READ: 'catalog.read',
  CATALOG_WRITE: 'catalog.write',
  CATALOG_REVIEW: 'catalog.review',
  CATALOG_APPROVE: 'catalog.approve',
  // Templates
  TEMPLATE_READ: 'template.read',
  TEMPLATE_WRITE: 'template.write',
  TEMPLATE_APPROVE: 'template.approve',
  // Reference data & institutions
  REFERENCE_READ: 'reference.read',
  REFERENCE_WRITE: 'reference.write',
  INSTITUTION_READ: 'institution.read',
  INSTITUTION_WRITE: 'institution.write',
  // Files, import/export, reports
  FILE_UPLOAD: 'file.upload',
  FILE_DELETE: 'file.delete',
  IMPORT_RUN: 'import.run',
  EXPORT_RUN: 'export.run',
  REPORT_READ: 'report.read',
  // Administration
  USER_READ: 'user.read',
  USER_WRITE: 'user.write',
  ROLE_WRITE: 'role.write',
  AUDIT_READ: 'audit.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

/** Default role bundles created by the seed. Editable at runtime by role.write. */
export const DEFAULT_ROLES: Record<
  string,
  { nameEn: string; nameAr: string; permissions: Permission[] }
> = {
  system_admin: {
    nameEn: 'System administrator',
    nameAr: 'مسؤول النظام',
    permissions: ALL_PERMISSIONS,
  },
  standards_manager: {
    nameEn: 'Standards manager',
    nameAr: 'مدير المعايير',
    permissions: [
      'curriculum.read',
      'curriculum.review',
      'curriculum.approve',
      'curriculum.publish',
      'curriculum.all_institutions',
      'catalog.read',
      'catalog.write',
      'catalog.review',
      'catalog.approve',
      'template.read',
      'template.write',
      'template.approve',
      'reference.read',
      'reference.write',
      'institution.read',
      'file.upload',
      'file.delete',
      'import.run',
      'export.run',
      'report.read',
      'audit.read',
    ],
  },
  curriculum_developer: {
    nameEn: 'Curriculum developer',
    nameAr: 'مطور المناهج',
    permissions: [
      'curriculum.read',
      'curriculum.write',
      'catalog.read',
      'catalog.write',
      'template.read',
      'reference.read',
      'institution.read',
      'file.upload',
      'file.delete',
      'export.run',
      'report.read',
    ],
  },
  reviewer: {
    nameEn: 'Reviewer',
    nameAr: 'مراجع',
    permissions: [
      'curriculum.read',
      'curriculum.review',
      'curriculum.all_institutions',
      'catalog.read',
      'catalog.review',
      'template.read',
      'reference.read',
      'institution.read',
      'report.read',
    ],
  },
  viewer: {
    nameEn: 'Viewer',
    nameAr: 'مستعرض',
    permissions: [
      'curriculum.read',
      'catalog.read',
      'template.read',
      'reference.read',
      'institution.read',
    ],
  },
};
