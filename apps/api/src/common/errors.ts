import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

export const notFound = (entity: string) =>
  new NotFoundException({ title: 'Not found', detail: `${entity} not found` });

export const forbidden = (detail = 'You do not have permission to perform this action') =>
  new ForbiddenException({ title: 'Forbidden', detail });

/** Thrown when the client's rowVersion is stale (someone else saved first). */
export const staleRecord = () =>
  new ConflictException({
    title: 'Edit conflict',
    type: 'urn:cdms:edit-conflict',
    detail: 'This record was changed by someone else. Reload it and re-apply your changes.',
  });

export const notEditable = (status: string) =>
  new ConflictException({
    title: 'Record is locked',
    type: 'urn:cdms:locked',
    detail: `Records in status "${status}" cannot be edited. Return to draft or create a new version first.`,
  });

export const businessRule = (detail: string, errors?: { path: string; message: string }[]) =>
  new UnprocessableEntityException({ title: 'Business rule violated', detail, errors });
