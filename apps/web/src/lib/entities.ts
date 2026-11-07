import type { EntityType } from '@cdms/contracts';

/** Route for a record, used for cross-links between related records. */
export const ENTITY_ROUTES: Partial<Record<EntityType, string>> = {
  curriculum: '/curricula',
  unit: '/units',
  competency: '/competencies',
  occupation: '/occupations',
  framework: '/frameworks',
  template: '/templates',
  institution: '/institutions',
  user: '/admin/users',
};

export const entityPath = (type: string | null | undefined, id: string | null | undefined) => {
  const base = type ? ENTITY_ROUTES[type as EntityType] : undefined;
  return base && id ? `${base}/${id}` : undefined;
};

const LABEL_KEYS: Record<string, string> = {
  curriculum: 'nav.curricula', unit: 'nav.units', competency: 'nav.competencies', occupation: 'nav.occupations',
  framework: 'nav.frameworks', template: 'nav.templates', institution: 'nav.institutions', user: 'nav.users', role: 'nav.roles',
  reference_list: 'nav.referenceData', reference_item: 'nav.referenceData', file: 'common.files',
};

/** Translation key for an entity type label, falling back to a generic label. */
export const entityLabelKey = (type: string | null | undefined): string => (type && LABEL_KEYS[type]) || 'common.details';
