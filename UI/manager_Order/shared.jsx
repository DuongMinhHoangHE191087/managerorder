/* global React */
const { useState } = React;

/* ---------- inline Lucide-style icons (1.6 stroke) ---------- */
const ICONS = {
  search:   'M21 21l-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z',
  plus:     'M12 5v14M5 12h14',
  upload:   'M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  chevron:  'M6 9l6 6 6-6',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  eye:      'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  renew:    'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5|M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  refund:   'M3 7v6h6|M3 13a9 9 0 1 0 3-7.7L3 8',
  copy:     'M9 9V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4M5 9h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z',
  deliver:  'M16 11l2 2 4-4|M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11',
  cart:     'M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L23 6H6|M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  clock:    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z|M12 6v6l4 2',
  wallet:   'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2|M21 7H6a2 2 0 0 0 0 4h15v6|M18 12h.01',
  trend:    'M23 6l-9.5 9.5-5-5L1 18|M17 6h6v6',
  alert:    'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  phone:    'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2Z',
  user:     'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  link:     'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1|M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  filter:   'M22 3H2l8 9.5V19l4 2v-8.5L22 3Z',
  box:      'M21 8 12 3 3 8v8l9 5 9-5V8Z|M3 8l9 5 9-5|M12 13v8',
  sort:     'M3 6h18M6 12h12M10 18h4',
  dots:     'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0-7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'
};

function Icon({ name, size = 16, style, fill = false }) {
  const segs = (ICONS[name] || '').split('|');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden="true">
      {segs.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ---------- status badge ---------- */
function StatusBadge({ status }) {
  const s = window.OrderData.STATUS[status];
  return (
    <span className={'pv-badge tone-' + s.tone}>
      <span className="dot"></span>{s.label}
    </span>
  );
}

/* ---------- expiry pill: "còn X ngày" ---------- */
function ExpiryPill({ order, compact = false }) {
  const d = order.daysLeft;
  if (d === null) {
    return <span className="pv-exp none">{compact ? '—' : 'Không hạn'}</span>;
  }
  const u = order.urgency;
  if (u === 'expired' || d <= 0) {
    return (
      <span className="pv-exp expired">
        {u === 'expired' && order.status === 'expired'
          ? <>Hết hạn {Math.abs(d)}n trước</>
          : <>Quá hạn {Math.abs(d)}n</>}
      </span>
    );
  }
  return (
    <span className={'pv-exp ' + (d <= 14 ? 'soon' : 'ok')}>
      {u === 'soon' && <Icon name="alert" size={13} />}
      còn <span className="n">{d}</span> ngày
    </span>
  );
}

/* ---------- product tile ---------- */
function ProductTile({ mono, size = 38 }) {
  return (
    <span className="pv-tile" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {mono}
    </span>
  );
}

/* ---------- contact line ---------- */
function Contact({ contact, muted = true }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: muted ? 'var(--muted)' : 'var(--ink-2)', fontSize: 12.5 }}>
      <Icon name={contact.type === 'zalo' ? 'phone' : 'link'} size={13} />
      {contact.value}
    </span>
  );
}

Object.assign(window, { Icon, StatusBadge, ExpiryPill, ProductTile, Contact });
