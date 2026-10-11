import { formatMoney } from '@/lib/money';

interface MoneyProps {
  /** An amount as the API writes it, for example "249.50". */
  amount: string;
  /** `whole` drops the decimals, for large display figures. */
  kind?: 'full' | 'whole';
  className?: string;
}

/** The one way money is shown: formatted, with tabular lining numerals. */
export function Money({ amount, kind = 'full', className }: MoneyProps) {
  return (
    <span className={['money', className].filter(Boolean).join(' ')}>
      {formatMoney(amount, kind)}
    </span>
  );
}
