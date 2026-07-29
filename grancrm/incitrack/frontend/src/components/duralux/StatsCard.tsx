import React from 'react';

export interface StatsCardTrend {
  value: string | number;
  up: boolean;
}

export interface StatsCardProgress {
  value: number;
  label: string;
  color?: string;
}

export interface StatsCardProps {
  icon: string;
  iconBg?: string;
  value: React.ReactNode;
  label: string;
  trend?: StatsCardTrend;
  progress?: StatsCardProgress;
  footer?: React.ReactNode;
  onFooter?: () => void;
  onClick?: () => void;
}

/**
 * StatsCard — tarjeta KPI con ícono, número, label y progreso/trend.
 */
export function StatsCard({ 
  icon, 
  iconBg = 'bg-gray-200 text-gray-700', 
  value, 
  label, 
  trend, 
  progress, 
  footer, 
  onFooter,
  onClick
}: StatsCardProps) {
  return (
    <div className="card stretch stretch-full border-0 shadow-sm" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', borderRadius: 12 }}>
      <div className="card-body d-flex flex-column p-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex gap-3 align-items-center">
            <div className={`avatar-text avatar-lg flex-shrink-0 ${iconBg}`} style={{ width: 48, height: 48, borderRadius: 12 }}>
              <i className={`${icon} fs-4`}></i>
            </div>
            <div>
              <div className="fs-4 fw-bolder text-dark lh-1 mb-1">{value}</div>
              <h6 className="fs-12 fw-bold text-muted text-uppercase tracking-wider mb-0">{label}</h6>
            </div>
          </div>
          {trend && (
            <span className={`fs-12 fw-bold px-2 py-1 rounded bg-${trend.up ? 'success' : 'danger'}-subtle text-${trend.up ? 'success' : 'danger'}`}>
              <i className={`feather-arrow-${trend.up ? 'up' : 'down'} fs-10 me-1`}></i>
              {trend.value}
            </span>
          )}
        </div>

        <div className="mt-auto pt-3">
          {progress && (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="fs-12 fw-semibold text-muted">{progress.label}</span>
                <span className="fs-12 fw-bold text-dark">{progress.value}%</span>
              </div>
              <div className="progress" style={{ height: 6, borderRadius: 3 }}>
                <div
                  className={`progress-bar bg-${progress.color || 'primary'}`}
                  style={{ width: `${progress.value}%`, borderRadius: 3 }}
                ></div>
              </div>
            </div>
          )}
          {footer && (
            <div className="pt-2" onClick={(e) => { if (onFooter) { e.preventDefault(); onFooter(); } }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
