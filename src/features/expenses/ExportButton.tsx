import { useState } from 'react';

import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/errors';
import type { ExpenseFilters } from '@/api/types';
import { downloadBlob } from '@/lib/download';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/toastContext';

interface ExportButtonProps {
  /** The filters on screen. The file holds every expense that matches them, not just this page. */
  filters: ExpenseFilters | null;
  /** How many expenses match. With none, there is nothing to export. */
  total: number;
}

export function ExportButton({ filters, total }: ExportButtonProps) {
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();

  async function exportCsv() {
    if (!filters) return;
    setBusy(true);
    try {
      const file = await api.expenses.exportCsv(filters);
      // The API names the file in a header that browsers hide from cross-origin
      // scripts, so the name is set here.
      downloadBlob(file, 'expenses.csv');
      notify(`Exported ${total} ${total === 1 ? 'expense' : 'expenses'} to expenses.csv`);
    } catch (error) {
      notify(`Export failed. ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      busy={busy}
      disabled={!filters || total === 0}
      title={total === 0 ? 'There is nothing to export' : undefined}
      onClick={() => void exportCsv()}
    >
      Export CSV
    </Button>
  );
}
