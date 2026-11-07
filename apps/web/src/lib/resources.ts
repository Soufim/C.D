import type {
  CompetencyDto,
  CompetencyInput,
  FrameworkDto,
  FrameworkInput,
  InstitutionDto,
  InstitutionInput,
  OccupationDto,
  OccupationInput,
  TemplateDto,
  TemplateInput,
  UnitDto,
  UnitInput,
} from '@cdms/contracts';
import { createResource } from './resource';

export const occupations = createResource<OccupationDto, OccupationInput>(
  '/occupations',
  'occupations',
);
export const competencies = createResource<CompetencyDto, CompetencyInput>(
  '/competencies',
  'competencies',
);
export const units = createResource<UnitDto, UnitInput>('/units', 'units');
export const frameworks = createResource<FrameworkDto, FrameworkInput>('/frameworks', 'frameworks');
export const templates = createResource<TemplateDto, TemplateInput>('/templates', 'templates');
export const institutions = createResource<InstitutionDto, InstitutionInput>(
  '/institutions',
  'institutions',
);
