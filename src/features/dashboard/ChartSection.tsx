import { useState, type ReactNode } from 'react';

import { Button } from '@/ui/Button';
import { Section } from '@/ui/Section';

import styles from './Dashboard.module.css';

interface ChartSectionProps {
  label: string;
  title: string;
  /** One line under the title that says how to read the chart. */
  note?: string;
  /** What the chart shows, in a sentence, for screen readers. */
  summary: string;
  /** The same data as a table. Nothing on a chart is readable only by hovering. */
  table: ReactNode;
  children: ReactNode;
}

/** A chart with its twin: a switch swaps the drawing for a plain table of the same numbers. */
export function ChartSection({ label, title, note, summary, table, children }: ChartSectionProps) {
  const [asTable, setAsTable] = useState(false);

  return (
    <Section
      label={label}
      title={title}
      actions={
        <Button
          variant="quiet"
          small
          aria-pressed={asTable}
          onClick={() => setAsTable((current) => !current)}
        >
          {asTable ? 'Show chart' : 'Show table'}
        </Button>
      }
    >
      {note && <p className={styles.note}>{note}</p>}
      {asTable ? (
        table
      ) : (
        <figure className={styles.chart}>
          <figcaption className="visually-hidden">{summary}</figcaption>
          {children}
        </figure>
      )}
    </Section>
  );
}

interface TooltipRow {
  name: string;
  display: string;
  detail?: string;
}

/** The hover card: the value first and strong, the name second. */
export function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
}) {
  const row = payload?.[0]?.payload as TooltipRow | undefined;
  if (!active || !row) return null;
  return (
    <div className={styles.tooltip}>
      <p className={`${styles.tooltipValue} money`}>{row.display}</p>
      <p className={styles.tooltipName}>{row.name}</p>
      {row.detail && <p className={styles.tooltipName}>{row.detail}</p>}
    </div>
  );
}
