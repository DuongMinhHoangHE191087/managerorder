/* global React, Icon, StatusBadge, ExpiryPill, ProductTile, Contact, Header, KpiStrip, AnalyticsPanel, FilterBar */
const { useState: useV } = React;
const ODv = window.OrderData;

/* filter by tab */
function applyTab(orders, tab) {
  if (tab === 'all') return orders;
  if (tab === 'soon') return orders.filter(o => o.urgency === 'soon');
  if (tab === 'active') return orders.filter(o => o.status === 'active');
  if (tab === 'expired') return orders.filter(o => o.urgency === 'expired' || o.status === 'expired');
  return orders.filter(o => o.status === tab);
}

/* urgency left/top accent color */
function accent(o) {
  if (o.urgency === 'expired' || o.status === 'expired') return 'var(--red)';
  if (o.urgency === 'soon') return 'var(--amber)';
  return 'transparent';
}

/* row action icon buttons */
function RowActions({ small = false }) {
  const sz = small ? 14 : 16;
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      <button className="pv-iconbtn" title="Sao chép thông tin tài khoản"><Icon name="copy" size={sz} /></button>
      <button className="pv-iconbtn" title="Gia hạn"><Icon name="renew" size={sz} /></button>
      <button className="pv-iconbtn" title="Xem chi tiết"><Icon name="eye" size={sz} /></button>
      <button className="pv-iconbtn" title="Thêm"><Icon name="dots" size={sz} /></button>
    </div>
  );
}

/* ============================================================
   LIST (table) body — dày đặc
   ============================================================ */
const COLS = '34px minmax(230px,1.5fr) minmax(150px,1fr) 116px 150px 132px 132px';
function ListBody({ rows }) {
  return (
    <div className="pv-card" style={{ overflow: 'hidden', boxShadow: 'var(--shadow-1)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12,
        padding: '10px 18px', borderBottom: '1px solid var(--line)', background: 'var(--page-2)',
        fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        <span></span><span>Sản phẩm / Mã đơn</span><span>Khách hàng</span><span>Trạng thái</span>
        <span>Hạn dùng</span><span style={{ textAlign: 'right' }}>Giá / Lãi</span><span style={{ textAlign: 'right' }}>Thao tác</span>
      </div>
      {rows.map((o, i) => (
        <div key={o.code} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12,
          padding: '11px 18px 11px 15px', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none',
          borderLeft: '3px solid ' + accent(o), transition: 'background .15s var(--ease)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--g-50)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <input type="checkbox" style={{ width: 15, height: 15, accentColor: 'var(--g-500)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <ProductTile mono={o.mono} size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.product}</div>
              <div className="pv-mono" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>#{o.code}</div>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{o.customer}</div>
            <div style={{ marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><Contact contact={o.contact} /></div>
          </div>
          <div><StatusBadge status={o.status} /></div>
          <div>
            <div style={{ fontSize: 13.5 }}><ExpiryPill order={o} /></div>
            <div className="pv-mono" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{ODv.fmtDate(o.expiry)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="pv-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{ODv.fmt(o.price)}₫</div>
            <div className="pv-mono" style={{ fontSize: 11.5, fontWeight: 600, color: o.profit >= 0 ? 'var(--g-600)' : 'var(--red)', marginTop: 1 }}>
              {o.profit >= 0 ? '+' : ''}{ODv.fmt(o.profit)}₫
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><RowActions small /></div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   CARD (grid) body — mặc định
   ============================================================ */
function CardBody({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 13 }}>
      {rows.map(o => (
        <div key={o.code} className="pv-card" style={{ padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-1)',
          borderTop: '3px solid ' + accent(o), transition: 'transform .18s var(--ease), box-shadow .18s var(--ease)' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-1)'; }}>
          <div style={{ padding: '14px 15px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <ProductTile mono={o.mono} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{o.product}</div>
                  <div className="pv-mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>#{o.code}</div>
                </div>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <Icon name="user" size={14} style={{ color: 'var(--muted)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{o.customer}</span>
              <span style={{ color: 'var(--line-2)' }}>·</span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Contact contact={o.contact} /></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: o.urgency === 'soon' ? 'var(--amber-bg)' : (o.urgency === 'expired' || o.status === 'expired') ? 'var(--red-bg)' : 'var(--page-2)',
              borderRadius: 10, padding: '9px 12px' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}><ExpiryPill order={o} /></span>
              <span className="pv-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{ODv.fmtDate(o.expiry)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 15px', borderTop: '1px solid var(--line)', background: 'var(--page)' }}>
            <div>
              <span className="pv-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{ODv.fmt(o.price)}₫</span>
              <span className="pv-mono" style={{ fontSize: 12, fontWeight: 600, marginLeft: 8, color: o.profit >= 0 ? 'var(--g-600)' : 'var(--red)' }}>
                {o.profit >= 0 ? '+' : ''}{ODv.fmt(o.profit)}₫
              </span>
            </div>
            <RowActions small />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   View toggle (Card / List)
   ============================================================ */
function ViewToggle({ mode, setMode }) {
  const opts = [
    { id: 'card', label: 'Thẻ', icon: 'box' },
    { id: 'list', label: 'Danh sách', icon: 'sort' }
  ];
  return (
    <div style={{ display: 'inline-flex', background: 'var(--page-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 3, gap: 2 }}>
      {opts.map(o => {
        const on = o.id === mode;
        return (
          <button key={o.id} onClick={() => setMode(o.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: 'none',
              transition: 'all .15s var(--ease)',
              background: on ? 'var(--surface)' : 'transparent',
              color: on ? 'var(--g-700)' : 'var(--muted)',
              boxShadow: on ? 'var(--shadow-1)' : 'none' }}>
            <Icon name={o.icon} size={15} />{o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   Pagination footer — chọn 20/50/100/500 đơn/trang
   ============================================================ */
const PAGE_SIZES = [20, 50, 100, 500];
function Pagination({ total, page, pageSize, setPage, setPageSize }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // page number window
  let nums = [];
  if (pageCount <= 7) { for (let i = 1; i <= pageCount; i++) nums.push(i); }
  else {
    nums = [1];
    const lo = Math.max(2, page - 1), hi = Math.min(pageCount - 1, page + 1);
    if (lo > 2) nums.push('…');
    for (let i = lo; i <= hi; i++) nums.push(i);
    if (hi < pageCount - 1) nums.push('…');
    nums.push(pageCount);
  }

  const navBtn = (extra) => Object.assign({
    minWidth: 34, height: 34, padding: '0 9px', borderRadius: 8, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, border: '1px solid var(--line-2)',
    background: 'var(--surface)', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
  }, extra || {});

  return (
    <div className="pv-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 14, padding: '13px 18px', marginTop: 14, boxShadow: 'var(--shadow-1)' }}>
      {/* left: page size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Hiển thị</span>
        <div style={{ display: 'inline-flex', background: 'var(--page-2)', border: '1px solid var(--line-2)', borderRadius: 9, padding: 3, gap: 2 }}>
          {PAGE_SIZES.map(s => {
            const on = s === pageSize;
            return (
              <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
                className="pv-mono"
                style={{ minWidth: 42, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', border: 'none',
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, transition: 'all .15s var(--ease)',
                  background: on ? 'var(--g-500)' : 'transparent', color: on ? '#fff' : 'var(--muted)' }}>
                {s}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>đơn / trang</span>
      </div>

      {/* right: range + nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          <b className="pv-mono" style={{ color: 'var(--ink)' }}>{from}–{to}</b> trên <b className="pv-mono" style={{ color: 'var(--ink)' }}>{total}</b> đơn
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            style={navBtn({ opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'default' : 'pointer' })}>
            <Icon name="chevron" size={15} style={{ transform: 'rotate(90deg)' }} />
          </button>
          {nums.map((n, i) => n === '…'
            ? <span key={'e' + i} style={{ minWidth: 20, textAlign: 'center', color: 'var(--muted)', alignSelf: 'center' }}>…</span>
            : <button key={n} onClick={() => setPage(n)}
                className="pv-mono"
                style={navBtn(n === page
                  ? { background: 'var(--g-500)', borderColor: 'var(--g-500)', color: '#fff' }
                  : {})}>{n}</button>
          )}
          <button onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page === pageCount}
            style={navBtn({ opacity: page === pageCount ? 0.4 : 1, cursor: page === pageCount ? 'default' : 'pointer' })}>
            <Icon name="chevron" size={15} style={{ transform: 'rotate(-90deg)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Unified app — toggle Card/List + pagination, mặc định Card
   ============================================================ */
function OrderApp() {
  const [tab, setTab] = useV('all');
  const [mode, setMode] = useV('card');     // default = card
  const [pageSize, setPageSize] = useV(20);
  const [page, setPage] = useV(1);

  // reset page when filter changes
  React.useEffect(() => { setPage(1); }, [tab]);

  const filtered = applyTab(ODv.ORDERS, tab);
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="pv-root">
      <div className="pv-page">
        <Header />
        <KpiStrip />
        <AnalyticsPanel />
        <FilterBar tab={tab} setTab={setTab} />

        {/* list controls: select-all + count + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px 11px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 15, height: 15, accentColor: 'var(--g-500)' }} />
            Chọn tất cả
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Hiển thị <b style={{ color: 'var(--ink)' }}>{rows.length}</b> / {total} đơn</span>
            <ViewToggle mode={mode} setMode={setMode} />
          </div>
        </div>

        {mode === 'card' ? <CardBody rows={rows} /> : <ListBody rows={rows} />}

        <Pagination total={total} page={safePage} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} />
      </div>
    </div>
  );
}

Object.assign(window, { OrderApp, ListBody, CardBody, ViewToggle, Pagination });
