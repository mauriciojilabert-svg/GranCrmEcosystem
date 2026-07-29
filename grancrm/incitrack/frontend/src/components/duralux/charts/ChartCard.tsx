import React from 'react';

interface ChartAction {
  label: string;
  onClick: () => void;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: ChartAction[];
  noPad?: boolean;
  children: React.ReactNode;
}

export function ChartCard({ title, subtitle, actions = [], noPad, children }: ChartCardProps): JSX.Element {
  return (
    <div className="card stretch stretch-full border-0 shadow-sm" style={{ borderRadius: 12 }}>
      <div className="card-header bg-white border-0 pt-4 pb-0 d-flex align-items-center justify-content-between">
        <div>
          <h6 className="card-title fw-bold mb-0">{title}</h6>
          {subtitle && <p className="fs-12 text-muted mb-0 mt-1">{subtitle}</p>}
        </div>
        {actions.length > 0 && (
          <div className="dropdown">
            <button
              className="avatar-text avatar-sm bg-transparent border-0 text-muted"
              data-bs-toggle="dropdown"
              type="button"
            >
              <i className="feather-more-vertical"></i>
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              {actions.map((a, i) => (
                <li key={i}>
                  <button className="dropdown-item fs-13" onClick={a.onClick}>
                    {a.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className={`card-body${noPad ? ' p-0' : ' pt-4'}`}>
        {children}
      </div>
    </div>
  );
}
