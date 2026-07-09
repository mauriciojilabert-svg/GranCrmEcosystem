import React from 'react';

interface ColoredStatCardProps {
  icon?: string;
  value: React.ReactNode;
  label: string;
  trend?: string;
  trendUp?: boolean;
  bg?: string;
  chart?: React.ReactNode;
}

export function ColoredStatCard({ 
  icon, 
  value, 
  label, 
  trend, 
  trendUp, 
  bg = 'bg-primary', 
  chart 
}: ColoredStatCardProps): JSX.Element {
  return (
    <div className={`card stretch stretch-full ${bg} text-white`}>
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between mb-3">
          <div>
            {trend && (
              <span className="badge mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                <i className={`feather-arrow-${trendUp ? 'up' : 'down'} me-1 fs-10`}></i>
                {trend}
              </span>
            )}
            <div className="fs-3 fw-bolder lh-1 mb-1">{value}</div>
            <p className="fs-12 mb-0 opacity-75 fw-medium">{label}</p>
          </div>
          {icon && (
            <div className="avatar-text avatar-lg text-white" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <i className={`${icon} fs-4`}></i>
            </div>
          )}
        </div>
      </div>
      {chart && <div className="pb-0">{chart}</div>}
    </div>
  )
}
