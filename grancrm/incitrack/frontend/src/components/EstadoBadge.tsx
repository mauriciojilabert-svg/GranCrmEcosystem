import type { TicketEstado } from '../apiTypes';

const ESTADO_STYLES: Record<string, string> = {
  abierto: 'background:#fee2e2;color:#dc2626',
  en_proceso: 'background:#fef3c7;color:#d97706',
  resuelto: 'background:#dcfce7;color:#16a34a',
  cerrado: 'background:#f1f5f9;color:#64748b',
};

const ESTADO_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  en_proceso: 'En Proceso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

interface Props {
  estado: TicketEstado | string;
}

export function EstadoBadge({ estado }: Props) {
  const style = ESTADO_STYLES[estado] ?? 'background:#f1f5f9;color:#64748b';
  const label = ESTADO_LABELS[estado] ?? estado.toUpperCase();
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.5px',
        ...Object.fromEntries(style.split(';').filter(Boolean).map(s => {
          const [k, v] = s.split(':');
          return [k.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v.trim()];
        })),
      }}
    >
      {label}
    </span>
  );
}
