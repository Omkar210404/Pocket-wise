import { Link } from 'react-router-dom';

import { buttonClass } from '@/ui/Button';
import { EmptyState } from '@/ui/States';

import { PageHeader } from './PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader label="Error 404" title="Page not found" />
      <EmptyState
        title="There is nothing at this address."
        action={
          <Link to="/" className={buttonClass({ variant: 'primary' })}>
            Go to the overview
          </Link>
        }
      >
        The link may be old, or the address may have a typo.
      </EmptyState>
    </>
  );
}
