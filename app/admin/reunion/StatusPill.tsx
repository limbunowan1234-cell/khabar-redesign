import { STATUS, statusLabel } from '@/lib/reunion';
import s from './Reunion.module.css';

export default function StatusPill({ status }: { status: string }) {
  return <span className={`${s.pill} ${s['t_' + (STATUS[status]?.tone || 'new')]}`}>{statusLabel(status)}</span>;
}
