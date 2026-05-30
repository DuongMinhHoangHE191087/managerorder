/* global React, Icon */
const { useState: useStateChrome } = React;
const OD = window.OrderData;

/* ---------- compact header ---------- */
function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
          <span className="pv-eyebrow">Order workspace</span>
          <span className="pv-chip" style={{ borderColor: 'var(--g-200)', color: 'var(--g-700)', background: 'var(--g-50)', fontWeight: 600 }}>
            <Icon name="clock" size={12} />{OD.KPI.total} đơn
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          Quản lý đơn hàng
        </h1>
      </div>
      <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
        <button className="pv-btn pv-btn-ghost"><Icon name="upload" />Import</button>
        <button className="pv-btn pv-btn-primary"><Icon name="plus" />Tạo đơn mới</button>
      </div>
    </div>
  );
}

/* ---------- compact KPI strip (one thin card, 4 cells) ---------- */
function KpiStrip() {
  const k = OD.KPI;
  const cells = [
    { icon: 'cart',  label: 'Tổng đơn',     value: k.total,             sub: <><b style={{ color: 'var(--g-700)' }}>{k.active} active</b> · {k.paid} đã TT</>, tone: 'ink' },
    { icon: 'alert', label: 'Sắp / quá hạn', value: k.expiringSoon + k.expired, sub: <><b style={{ color: 'var(--amber)' }}>{k.expiringSoon} sắp hết</b> · {k.expired} hết hạn</>, tone: 'amber' },
    { icon: 'wallet',label: 'Doanh thu',    value: OD.fmt(k.revenue),   sub: <>{k.paid} đơn đã thu</>, tone: 'ink', unit: '₫' },
    { icon: 'trend', label: 'Lợi nhuận',    value: OD.fmt(k.profit),    sub: <>biên {k.margin}% · vốn {OD.fmt(k.cost)}₫</>, tone: 'green', unit: '₫' }
  ];
  return (
    <div className="pv-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', overflow: 'hidden', marginBottom: 16, boxShadow: 'var(--shadow-1)' }}>
      {cells.map((c, i) => (
        <div key={i} style={{ padding: '15px 20px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--muted)', marginBottom: 8 }}>
            <Icon name={c.icon} size={15} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{c.label}</span>
          </div>
          <div className="pv-mono" style={{ fontSize: 25, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em',
            color: c.tone === 'green' ? 'var(--g-600)' : c.tone === 'amber' ? 'var(--amber)' : 'var(--ink)' }}>
            {c.value}{c.unit && <span style={{ fontSize: 15, fontWeight: 600, marginLeft: 3 }}>{c.unit}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- rich analytics panel: đến hạn · gia hạn · theo sản phẩm ---------- */
function Bar({ value, max, color, h = 7 }) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0;
  return (
    <div style={{ height: h, borderRadius: 999, background: 'var(--page-2)', overflow: 'hidden', flex: 1 }}>
      <div style={{ width: pct + '%', height: '100%', borderRadius: 999, background: color, transition: 'width .4s var(--ease)' }}></div>
    </div>
  );
}
function PanelHead({ icon, title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--muted)' }}>
        <Icon name={icon} size={15} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

function AnalyticsPanel() {
  const s = OD.STATS;
  const due = s.due, rn = s.renew;
  const dueRows = [
    { label: 'Quá hạn',      n: due.overdue, color: 'var(--red)' },
    { label: 'Trong 7 ngày', n: due.d7,      color: '#e0852b' },
    { label: '8 – 14 ngày',  n: due.d14,     color: 'var(--amber)' },
    { label: '15 – 30 ngày', n: due.d30,     color: 'var(--g-400)' }
  ];
  const dueMax = Math.max.apply(null, dueRows.map(r => r.n).concat(1));
  const rnTotal = (rn.renewed + rn.churned + rn.pending) || 1;
  const prodMax = Math.max.apply(null, s.byProduct.map(p => p.count).concat(1));

  const panel = { padding: '17px 19px' };
  const divider = { borderLeft: '1px solid var(--line)' };

  return (
    <div className="pv-card" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1.25fr', overflow: 'hidden', marginBottom: 16, boxShadow: 'var(--shadow-1)' }}>

      {/* 1 — Sắp đến hạn theo mốc */}
      <div style={panel}>
        <PanelHead icon="clock" title="Tài khoản đến hạn"
          right={<span className="pv-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>{due.total} nick</span>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {dueRows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)', width: 92, flex: 'none' }}>{r.label}</span>
              <Bar value={r.n} max={dueMax} color={r.color} />
              <span className="pv-mono" style={{ fontSize: 13, fontWeight: 700, color: r.n ? 'var(--ink)' : 'var(--muted)', width: 18, textAlign: 'right', flex: 'none' }}>{r.n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2 — Gia hạn vs không gia hạn */}
      <div style={Object.assign({}, panel, divider)}>
        <PanelHead icon="renew" title="Tỷ lệ gia hạn"
          right={<span className="pv-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--g-600)' }}>{rn.rate}%</span>} />
        <div style={{ display: 'flex', height: 9, borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ width: (rn.renewed / rnTotal * 100) + '%', background: 'var(--g-500)' }}></div>
          <div style={{ width: (rn.churned / rnTotal * 100) + '%', background: 'var(--red)' }}></div>
          <div style={{ width: (rn.pending / rnTotal * 100) + '%', background: 'var(--line-2)' }}></div>
        </div>
        {[
          { label: 'Đã gia hạn', n: rn.renewed, color: 'var(--g-500)' },
          { label: 'Không gia hạn', n: rn.churned, color: 'var(--red)' },
          { label: 'Chờ quyết định', n: rn.pending, color: 'var(--line-2)' }
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i ? 7 : 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flex: 'none' }}></span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>{r.label}</span>
            <span className="pv-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{r.n}</span>
          </div>
        ))}
      </div>

      {/* 3 — Theo sản phẩm */}
      <div style={Object.assign({}, panel, divider)}>
        <PanelHead icon="box" title="Bán chạy theo sản phẩm"
          right={<span className="pv-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{s.byProduct.length} loại</span>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {s.byProduct.slice(0, 4).map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="pv-tile" style={{ width: 26, height: 26, fontSize: 10, borderRadius: 7, flex: 'none' }}>{p.mono}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.sample}</span>
                  <span className="pv-mono" style={{ fontSize: 12, color: 'var(--muted)', flex: 'none', marginLeft: 8 }}>{p.count} đơn · {OD.fmt(p.revenue)}₫</span>
                </div>
                <Bar value={p.count} max={prodMax} color="var(--g-400)" h={5} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- filter bar + tabs ---------- */
const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ TT' },
  { id: 'paid', label: 'Đã TT' },
  { id: 'delivered', label: 'Cấp phát' },
  { id: 'active', label: 'Active' },
  { id: 'soon', label: 'Sắp hết hạn' },
  { id: 'expired', label: 'Hết hạn' },
  { id: 'refunded', label: 'Hoàn tiền' }
];

function FilterBar({ tab, setTab }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 13 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
            <Icon name="search" size={16} />
          </span>
          <input placeholder="Tìm mã đơn, khách hàng, sản phẩm…" className="pv-mono"
            style={{ width: '100%', height: 42, padding: '0 14px 0 38px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--line-2)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 14, color: 'var(--ink)' }} />
        </div>
        <button className="pv-btn pv-btn-ghost" style={{ height: 42 }}>
          <Icon name="calendar" />Khoảng ngày<Icon name="chevron" size={14} />
        </button>
        <button className="pv-btn pv-btn-ghost" style={{ height: 42 }}>
          <Icon name="sort" />Mới nhất<Icon name="chevron" size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const on = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab && setTab(t.id)}
              style={{ cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                padding: '7px 14px', borderRadius: 999, transition: 'all .15s var(--ease)',
                border: '1px solid ' + (on ? 'var(--g-500)' : 'var(--line-2)'),
                background: on ? 'var(--g-500)' : 'var(--surface)',
                color: on ? '#fff' : 'var(--ink-2)' }}>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Header, KpiStrip, AnalyticsPanel, FilterBar });
