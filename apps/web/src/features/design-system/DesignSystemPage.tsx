import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Inbox, Plus, Trash2 } from 'lucide-react';
import { RECORD_STATUSES } from '@cdms/contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from '@/components/ui/menu';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader, Section, KeyValue } from '@/components/patterns/page';
import { BilingualField, Field, FormGrid } from '@/components/patterns/form';
import { EmptyState, ErrorState, Notice } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { ConfirmDialog } from '@/components/patterns/confirm';
import { ApiError } from '@/lib/api';

const TOKENS = ['background', 'card', 'muted', 'border', 'primary', 'secondary', 'accent', 'destructive', 'success', 'warning', 'info', 'sidebar'];

/**
 * Living reference of the design system. Every component shown here is the production
 * component — if it looks wrong here it looks wrong everywhere. See docs/design-system.md.
 */
export function DesignSystemPage() {
  const { t } = useTranslation();
  const { register, formState: { errors } } = useForm({ defaultValues: { titleEn: '', titleAr: '' } });
  const [sw, setSw] = useState(true);
  return (
    <>
      <PageHeader title={t('ds.title')} description={t('ds.subtitle')} crumbs={[{ label: t('nav.admin') }, { label: t('ds.title') }]} />
      <div className="flex flex-col gap-5">
        <Section title="Colour tokens" description="Semantic tokens only. Light/dark values are defined in index.css.">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {TOKENS.map((c) => (
              <li key={c} className="overflow-hidden rounded-md border">
                <div className="h-14" style={{ background: `var(--${c})` }} />
                <p className="px-2 py-1.5 font-mono text-xs">--{c}</p>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Typography" description="Inter (Latin) + IBM Plex Sans Arabic, self-hosted. Scale: xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 24.">
          <div className="flex flex-col gap-2">
            <p className="text-2xl font-semibold">Page title — عنوان الصفحة</p>
            <p className="text-lg font-semibold">Section heading — عنوان القسم</p>
            <p className="text-base">Body text for forms and content. نص المحتوى الأساسي للنماذج.</p>
            <p className="text-sm text-muted-foreground">Secondary / helper text. نص مساعد.</p>
            <p className="font-mono text-xs">CUR-ELEC-BLD · UNT-OSH-101 (codes are monospace, always LTR)</p>
          </div>
        </Section>
        <Section title="Buttons" description="One primary action per view. Destructive actions always confirm.">
          <div className="flex flex-wrap items-center gap-2">
            <Button><Plus />Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button><Button variant="destructive"><Trash2 />Destructive</Button><Button variant="link">Link</Button>
            <Button loading>Saving</Button><Button size="sm">Small</Button>
            <Tooltip content="Icon-only buttons need aria-label + tooltip"><Button size="icon" variant="outline" aria-label="Add"><Plus /></Button></Tooltip>
          </div>
        </Section>
        <Section title="Badges & status" description="StatusBadge is the only way to render a workflow status (icon + label, never colour alone).">
          <div className="flex flex-wrap gap-2">
            {RECORD_STATUSES.map((s) => <StatusBadge key={s} status={s} />)}
            <Badge tone="primary">primary</Badge><Badge tone="success">success</Badge><Badge tone="warning">warning</Badge><Badge tone="danger">danger</Badge><Badge tone="info">info</Badge><Badge tone="outline">outline</Badge>
          </div>
        </Section>
        <Section title="Form controls" description="Always wrap controls in <Field>. Bilingual attributes use <BilingualField> (EN always LTR, AR always RTL).">
          <FormGrid>
            <Field label="Code" required hint="Letters, digits, dot, dash."><Input dir="ltr" className="font-mono" placeholder="CMP-ELEC-01" /></Field>
            <Field label="Select" required><NativeSelect><option>Option A</option><option>Option B</option></NativeSelect></Field>
            <Field label="With error" required error="This field is required"><Input /></Field>
            <Field label="Disabled"><Input disabled value="Locked value" /></Field>
            <BilingualField base="title" labelEn="Title (English)" labelAr="العنوان (بالعربية)" register={register} errors={errors} required />
            <Field label="Long text" className="sm:col-span-full"><Textarea rows={3} /></Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked />Checkbox</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={sw} onCheckedChange={setSw} />Switch</label>
          </FormGrid>
        </Section>
        <Section title="Feedback & states">
          <div className="flex flex-col gap-3">
            <Notice tone="info">Info notice — e.g. record locked.</Notice>
            <Notice tone="warning">Warning notice — e.g. unsaved changes.</Notice>
            <Notice tone="danger">Danger notice — e.g. failed import.</Notice>
            <Notice tone="success">Success notice.</Notice>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border"><EmptyState icon={<Inbox />} title="Empty state" body="Explain why it is empty and what to do." action={<Button size="sm">Create</Button>} /></div>
              <div className="rounded-md border"><ErrorState error={new ApiError({ type: 'x', title: 'Server error', status: 500, detail: 'Example failure' })} onRetry={() => undefined} /></div>
              <div className="flex flex-col gap-2 rounded-md border p-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-20" /></div>
            </div>
          </div>
        </Section>
        <Section title="Overlays & navigation">
          <div className="flex flex-wrap gap-2">
            <Dialog><DialogTrigger asChild><Button variant="outline">Open dialog</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Dialog title</DialogTitle></DialogHeader><DialogBody>Forms open in dialogs on desktop and bottom sheets on phones.</DialogBody><DialogFooter><Button>OK</Button></DialogFooter></DialogContent></Dialog>
            <ConfirmDialog title="Delete this record?" body="This cannot be undone." onConfirm={() => undefined} trigger={<Button variant="destructive">Confirm dialog</Button>} />
          </div>
          <Tabs defaultValue="a" className="mt-4"><TabsList><TabsTrigger value="a">Overview</TabsTrigger><TabsTrigger value="b">Structure</TabsTrigger></TabsList>
            <TabsContent value="a"><KeyValue items={[{ label: 'Label', value: 'Value' }, { label: 'التسمية', value: 'القيمة' }]} /></TabsContent><TabsContent value="b">Tab B</TabsContent></Tabs>
        </Section>
      </div>
    </>
  );
}
