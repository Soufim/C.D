import { Module } from '@nestjs/common';
import { CompetenciesController, OccupationsController, UnitsController } from './catalog.controller';
import { CompetenciesService } from './competencies.service';
import { ImpactService } from './impact.service';
import { OccupationsService } from './occupations.service';
import { UnitsService } from './units.service';

/** Standardisation catalogue: occupational classification, competency standards, units. */
@Module({
  controllers: [OccupationsController, CompetenciesController, UnitsController],
  providers: [OccupationsService, CompetenciesService, UnitsService, ImpactService],
  exports: [OccupationsService, CompetenciesService, UnitsService, ImpactService],
})
export class CatalogModule {}
