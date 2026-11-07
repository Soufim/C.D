import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, PERMISSIONS } from '@cdms/contracts';
import type { FileDto } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { useFormat } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ConfirmDialog } from './confirm';
import { Section } from './page';

const ACCEPT = Object.values(ALLOWED_UPLOAD_TYPES).flat().join(',');

/** Upload/list/download/delete attachments for a record. Validation is repeated server-side. */
export function Attachments({
  entityType,
  entityId,
  canWrite,
}: {
  entityType: string;
  entityId: string;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const can = useCan();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const key = ['files', entityType, entityId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get<FileDto[]>(`/files?entityType=${entityType}&entityId=${entityId}`),
  });
  const upload = useApiMutation({
    fn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.upload<FileDto>(`/files/${entityType}/${entityId}`, fd);
    },
    invalidate: [key],
    success: t('files.uploaded'),
  });
  const del = useApiMutation({ fn: (id: string) => api.delete(`/files/${id}`), invalidate: [key] });
  const allowUpload = canWrite && can(PERMISSIONS.FILE_UPLOAD);
  const pick = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t('files.allowed'));
      return;
    }
    upload.mutate(file);
  };
  return (
    <Section title={t('files.title')}>
      {allowUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={cn(
            'mb-4 flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-4 text-center text-sm',
            drag && 'border-primary bg-secondary',
          )}
        >
          <Upload className="size-5 text-muted-foreground" aria-hidden />
          <p>{t('files.drop')}</p>
          <Button
            size="sm"
            variant="outline"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            {t('files.choose')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('files.allowed')}</p>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      )}
      {q.isLoading ? (
        <Skeleton className="h-10" />
      ) : !q.data?.length ? (
        <p className="text-sm text-muted-foreground">{t('files.empty')}</p>
      ) : (
        <ul className="divide-y">
          {q.data.map((file) => (
            <li key={file.id} className="flex items-center gap-3 py-2">
              <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" dir="auto">
                  {file.originalName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {f.bytes(file.sizeBytes)} · {f.date(file.createdAt)}
                  {file.uploadedByName ? ` · ${t('files.by', { name: file.uploadedByName })}` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${t('common.download')} ${file.originalName}`}
                onClick={() =>
                  api
                    .download(`/files/${file.id}/content`, file.originalName)
                    .catch(() => toast.error(t('errors.generic')))
                }
              >
                <Download />
              </Button>
              {canWrite && can(PERMISSIONS.FILE_DELETE) && (
                <ConfirmDialog
                  title={t('files.deleteConfirm')}
                  body={file.originalName}
                  confirmLabel={t('common.delete')}
                  onConfirm={() => del.mutateAsync(file.id)}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${t('common.delete')} ${file.originalName}`}
                    >
                      <Trash2 />
                    </Button>
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
