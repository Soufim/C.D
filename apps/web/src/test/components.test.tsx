import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import i18n from '@/lib/i18n';
import { cn, qs } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/patterns/form';
import { StatusBadge } from '@/components/patterns/status-badge';
import { DataTable } from '@/components/patterns/data-table';

describe('utils', () => {
  it('merges tailwind classes', () => expect(cn('px-2', 'px-4')).toBe('px-4'));
  it('skips empty query params', () =>
    expect(qs({ a: 1, b: '', c: undefined, d: false })).toBe('?a=1'));
});

describe('Field', () => {
  it('associates label, hint and error with the control (WCAG 1.3.1 / 3.3.1)', async () => {
    await i18n.changeLanguage('en');
    render(
      <Field label="Code" hint="Use letters" error="Required" required>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/Code/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    const described = input.getAttribute('aria-describedby')!.split(' ');
    expect(described).toHaveLength(2);
    expect(document.getElementById(described[1]!)).toHaveTextContent('Required');
  });
});

describe('StatusBadge', () => {
  it('renders a translated label, not colour alone', async () => {
    await i18n.changeLanguage('ar');
    render(<StatusBadge status="published" />);
    expect(screen.getByText('منشور')).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});

describe('DataTable', () => {
  it('shows the empty state when there are no rows', () => {
    render(
      <MemoryRouter>
        <DataTable
          caption="Things"
          columns={[{ key: 'a', header: 'A', cell: (r: { a: string }) => r.a }]}
          data={[]}
          rowKey={(r) => r.a}
          empty={<p>Nothing here</p>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
  it('renders rows with an accessible caption', () => {
    render(
      <MemoryRouter>
        <DataTable
          caption="Things"
          columns={[{ key: 'a', header: 'A', cell: (r: { a: string }) => r.a }]}
          data={[{ a: 'one' }]}
          rowKey={(r) => r.a}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('table', { name: 'Things' })).toBeInTheDocument();
    expect(screen.getAllByText('one').length).toBeGreaterThan(0);
  });
});
