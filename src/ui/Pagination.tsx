import { Button } from './Button';
import styles from './Pagination.module.css';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pages, total, pageSize, onPage }: PaginationProps) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className={styles.pagination} aria-label="Pages">
      <p className={`${styles.range} money`}>
        {first}–{last} of {total}
      </p>
      <div className={styles.controls}>
        <Button small disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className={`${styles.page} money`} aria-current="page">
          Page {page} of {pages}
        </span>
        <Button small disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
