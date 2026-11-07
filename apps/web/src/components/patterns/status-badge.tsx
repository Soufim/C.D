import { useTranslation } from 'react-i18next';
import { Archive, CheckCircle2, CircleDashed, Eye, Globe } from 'lucide-react';
import type { RecordStatus } from '@cdms/contracts';
import { Badge } from '@/components/ui/badge';

const TONE = { draft: 'neutral', in_review: 'info', approved: 'warning', published: 'success', archived: 'outline' } as const;
const ICON = { draft: CircleDashed, in_review: Eye, approved: CheckCircle2, published: Globe, archived: Archive };

/** The only way to display a record status. Colour is never the sole indicator (icon + text). */
export function StatusBadge({ status }: { status: RecordStatus }) {
  const { t } = useTranslation();
  const Icon = ICON[status];
  return (
    <Badge tone={TONE[status]}>
      <Icon className="size-3" aria-hidden />
      {t(`status.${status}`)}
    </Badge>
  );
}
