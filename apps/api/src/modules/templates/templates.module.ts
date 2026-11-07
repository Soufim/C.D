import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({ imports: [CatalogModule], controllers: [TemplatesController], providers: [TemplatesService], exports: [TemplatesService] })
export class TemplatesModule {}
