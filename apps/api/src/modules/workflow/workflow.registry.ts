import type { AnyPgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { Permission, WorkflowAction, WorkflowEntityType } from '@cdms/contracts';
import { PERMISSIONS as P } from '@cdms/contracts';
import {
  competencies,
  curricula,
  frameworks,
  occupations,
  templates,
  units,
} from '../../database/schema';

type WorkflowTable = AnyPgTable & {
  id: PgColumn;
  code: PgColumn;
  status: PgColumn;
  rowVersion: PgColumn;
  updatedAt: PgColumn;
  updatedById: PgColumn;
  createdById: PgColumn;
};

interface WorkflowConfig {
  table: WorkflowTable;
  titleEn: PgColumn;
  titleAr: PgColumn;
  /** Permission required per action. */
  permissions: Record<WorkflowAction, Permission>;
  /** Frontend route for notifications. */
  route: string;
  labelEn: string;
  labelAr: string;
}

const catalogPerms: Record<WorkflowAction, Permission> = {
  submit: P.CATALOG_WRITE,
  return: P.CATALOG_REVIEW,
  approve: P.CATALOG_APPROVE,
  publish: P.CATALOG_APPROVE,
  archive: P.CATALOG_APPROVE,
  restore: P.CATALOG_WRITE,
};

export const WORKFLOW_REGISTRY: Record<WorkflowEntityType, WorkflowConfig> = {
  curriculum: {
    table: curricula as unknown as WorkflowTable,
    titleEn: curricula.titleEn,
    titleAr: curricula.titleAr,
    route: '/curricula',
    labelEn: 'Curriculum',
    labelAr: 'المنهج',
    permissions: {
      submit: P.CURRICULUM_WRITE,
      return: P.CURRICULUM_REVIEW,
      approve: P.CURRICULUM_APPROVE,
      publish: P.CURRICULUM_PUBLISH,
      archive: P.CURRICULUM_PUBLISH,
      restore: P.CURRICULUM_WRITE,
    },
  },
  unit: {
    table: units as unknown as WorkflowTable,
    titleEn: units.titleEn,
    titleAr: units.titleAr,
    route: '/units',
    labelEn: 'Unit',
    labelAr: 'الوحدة',
    permissions: catalogPerms,
  },
  competency: {
    table: competencies as unknown as WorkflowTable,
    titleEn: competencies.titleEn,
    titleAr: competencies.titleAr,
    route: '/competencies',
    labelEn: 'Competency',
    labelAr: 'الجدارة',
    permissions: catalogPerms,
  },
  occupation: {
    table: occupations as unknown as WorkflowTable,
    titleEn: occupations.titleEn,
    titleAr: occupations.titleAr,
    route: '/occupations',
    labelEn: 'Occupation',
    labelAr: 'المهنة',
    permissions: catalogPerms,
  },
  framework: {
    table: frameworks as unknown as WorkflowTable,
    titleEn: frameworks.nameEn,
    titleAr: frameworks.nameAr,
    route: '/frameworks',
    labelEn: 'Framework',
    labelAr: 'الإطار',
    permissions: catalogPerms,
  },
  template: {
    table: templates as unknown as WorkflowTable,
    titleEn: templates.nameEn,
    titleAr: templates.nameAr,
    route: '/templates',
    labelEn: 'Template',
    labelAr: 'القالب',
    permissions: {
      submit: P.TEMPLATE_WRITE,
      return: P.TEMPLATE_APPROVE,
      approve: P.TEMPLATE_APPROVE,
      publish: P.TEMPLATE_APPROVE,
      archive: P.TEMPLATE_APPROVE,
      restore: P.TEMPLATE_WRITE,
    },
  },
};
