/* Shared data for all order-management layout variations.
   Digital-account / subscription resale business (Duolingo, Canva, etc.) */
(function () {
  // Fixed "today" so the demo is deterministic.
  var TODAY = new Date('2026-05-30T00:00:00');
  var DAY = 86400000;

  function daysBetween(iso) {
    if (!iso) return null;
    return Math.round((new Date(iso + 'T00:00:00') - TODAY) / DAY);
  }
  function fmt(n) {
    return n.toLocaleString('vi-VN');
  }
  function fmtVnd(n) {
    return n.toLocaleString('vi-VN') + ' ₫';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  // status lifecycle: pending | paid | delivered | active | expired | refunded | draft
  var STATUS = {
    pending:   { label: 'Chờ TT',     tone: 'amber'  },
    paid:      { label: 'Đã TT',      tone: 'blue'   },
    delivered: { label: 'Đã cấp phát', tone: 'teal'   },
    active:    { label: 'Active',     tone: 'green'  },
    expired:   { label: 'Hết hạn',    tone: 'red'    },
    refunded:  { label: 'Hoàn tiền',  tone: 'gray'   },
    draft:     { label: 'Nháp',       tone: 'gray'   }
  };

  // product -> monogram + family bucket (for the small tile)
  function productMeta(name) {
    var n = name.toLowerCase();
    if (n.indexOf('duolingo') > -1) return { mono: 'Du', key: 'duo' };
    if (n.indexOf('canva') > -1)    return { mono: 'Ca', key: 'canva' };
    if (n.indexOf('youtube') > -1)  return { mono: 'Yt', key: 'yt' };
    if (n.indexOf('netflix') > -1)  return { mono: 'Nf', key: 'nflx' };
    if (n.indexOf('spotify') > -1)  return { mono: 'Sp', key: 'spot' };
    if (n.indexOf('chatgpt') > -1)  return { mono: 'Gpt', key: 'gpt' };
    if (n.indexOf('capcut') > -1)   return { mono: 'Cc', key: 'cc' };
    if (n.indexOf('grammarly') > -1)return { mono: 'Gr', key: 'gram' };
    return { mono: name.slice(0, 2), key: 'misc' };
  }

  var RAW = [
    { code: 'DMH_UB8XRS_221026', customer: 'Thắm',        contact: { type: 'fb',   value: 'fb.com/100007276480586' }, product: 'Duolingo Super 6 Months',  status: 'active',    orderDate: '2026-04-22', expiry: '2026-10-22', price: 68000,  cost: 0,      pay: 'MB Bank' },
    { code: 'DMH_637X3T_150427', customer: 'Nguyễn Hiếu', contact: { type: 'zalo', value: '0394497949' },           product: 'Canva Pro 1 Year',        status: 'active',    orderDate: '2026-04-15', expiry: '2027-04-15', price: 168000, cost: 100000, pay: 'MB Bank' },
    { code: 'DMH_SFG4WE_091026', customer: 'Nhẫn',        contact: { type: 'zalo', value: '0585793330' },           product: 'Duolingo Super 6 Months',  status: 'active',    orderDate: '2026-04-09', expiry: '2026-10-09', price: 68000,  cost: 0,      pay: 'MB Bank' },
    { code: 'DMH_9KD2LM_120626', customer: 'Minh Anh',    contact: { type: 'zalo', value: '0901234567' },           product: 'YouTube Premium 12 Months',status: 'active',    orderDate: '2025-06-12', expiry: '2026-06-12', price: 120000, cost: 35000,  pay: 'MB Bank' },
    { code: 'DMH_PQ7R2X_010626', customer: 'Hoàng Long',  contact: { type: 'fb',   value: 'fb.com/hoanglong.91' },   product: 'Netflix Premium 1 Month',  status: 'active',    orderDate: '2026-05-05', expiry: '2026-06-05', price: 55000,  cost: 30000,  pay: 'MoMo' },
    { code: 'DMH_ZX8N4K_250526', customer: 'Thu Hà',      contact: { type: 'zalo', value: '0938112233' },           product: 'ChatGPT Plus 1 Month',     status: 'expired',   orderDate: '2026-04-25', expiry: '2026-05-25', price: 250000, cost: 180000, pay: 'MB Bank' },
    { code: 'DMH_AB3C9D_300526', customer: 'Tuấn',        contact: { type: 'zalo', value: '0907654321' },           product: 'Spotify Premium 12 Months',status: 'paid',      orderDate: '2026-05-30', expiry: null,         price: 99000,  cost: 40000,  pay: 'MB Bank' },
    { code: 'DMH_MN5K8L_280526', customer: 'Lan Phương',  contact: { type: 'fb',   value: 'fb.com/lanphuong.vn' },   product: 'Canva Pro 1 Month',        status: 'pending',   orderDate: '2026-05-28', expiry: null,         price: 35000,  cost: 12000,  pay: 'MoMo' },
    { code: 'DMH_QW2E6R_100526', customer: 'Đức',         contact: { type: 'zalo', value: '0912345678' },           product: 'Duolingo Super 12 Months', status: 'active',    orderDate: '2026-05-10', expiry: '2027-05-10', price: 120000, cost: 0,      pay: 'MB Bank' },
    { code: 'DMH_TY7U3I_180526', customer: 'Bảo Ngọc',    contact: { type: 'zalo', value: '0976543210' },           product: 'CapCut Pro 1 Year',        status: 'active',    orderDate: '2026-05-18', expiry: '2027-05-18', price: 85000,  cost: 25000,  pay: 'MB Bank' },
    { code: 'DMH_VB4N8M_200426', customer: 'Khánh',       contact: { type: 'fb',   value: 'fb.com/khanh.tran' },     product: 'Grammarly Premium 1 Year', status: 'active',    orderDate: '2026-04-20', expiry: '2026-06-09', price: 150000, cost: 60000,  pay: 'MB Bank' },
    { code: 'DMH_LK9J2H_150526', customer: 'Quân',        contact: { type: 'zalo', value: '0888777666' },           product: 'Netflix Premium 1 Month',  status: 'refunded',  orderDate: '2026-05-15', expiry: null,         price: 55000,  cost: 30000,  pay: 'MoMo' },
    { code: 'DMH_RT6Y4U_220526', customer: 'Vy',          contact: { type: 'zalo', value: '0855443322' },           product: 'Duolingo Super 6 Months',  status: 'delivered', orderDate: '2026-05-22', expiry: '2026-11-22', price: 68000,  cost: 0,      pay: 'MB Bank' },
    { code: 'DMH_GH8F5D_010526', customer: 'Phát',        contact: { type: 'fb',   value: 'fb.com/phat.nguyen' },    product: 'YouTube Premium 12 Months',status: 'draft',     orderDate: '2026-05-01', expiry: null,         price: 120000, cost: 35000,  pay: '—' }
  ];

  // renewal outcome per order code:
  //   renewed = khách đã gia hạn · churned = không gia hạn · pending = chưa tới quyết định · null = không áp dụng
  var RENEW = {
    DMH_UB8XRS_221026: 'pending',  DMH_637X3T_150427: 'pending',
    DMH_SFG4WE_091026: 'pending',  DMH_9KD2LM_120626: 'pending',
    DMH_PQ7R2X_010626: 'churned',  DMH_ZX8N4K_250526: 'churned',
    DMH_AB3C9D_300526: null,       DMH_MN5K8L_280526: null,
    DMH_QW2E6R_100526: 'pending',  DMH_TY7U3I_180526: 'pending',
    DMH_VB4N8M_200426: 'renewed',  DMH_LK9J2H_150526: null,
    DMH_RT6Y4U_220526: 'pending',  DMH_GH8F5D_010526: null
  };

  // ---- synthetic fill so pagination is meaningful (deterministic) ----
  var NAMES = ['Mai','Hùng','Trang','Sơn','Linh','Phong','Hà','Dũng','Ngọc','Tài','Yến','Bình','Thảo','Cường','Hương','Nam','Hạnh','Lộc','Vân','Kiên','Oanh','Trí','Diễm','Huy','Nga','Toàn','Như','Đạt','Quỳnh','Bảo','Thanh','Phúc','Ánh','Tú','Lý','Hậu','Vinh','Chi','Khoa','Tiên'];
  var PRODS = [
    { name: 'Duolingo Super 6 Months', price: 68000, cost: 0, dur: 182 },
    { name: 'Duolingo Super 12 Months', price: 120000, cost: 0, dur: 365 },
    { name: 'Canva Pro 1 Year', price: 168000, cost: 100000, dur: 365 },
    { name: 'Canva Pro 1 Month', price: 35000, cost: 12000, dur: 30 },
    { name: 'YouTube Premium 12 Months', price: 120000, cost: 35000, dur: 365 },
    { name: 'Netflix Premium 1 Month', price: 55000, cost: 30000, dur: 30 },
    { name: 'ChatGPT Plus 1 Month', price: 250000, cost: 180000, dur: 30 },
    { name: 'Spotify Premium 12 Months', price: 99000, cost: 40000, dur: 365 },
    { name: 'CapCut Pro 1 Year', price: 85000, cost: 25000, dur: 365 },
    { name: 'Grammarly Premium 1 Year', price: 150000, cost: 60000, dur: 365 }
  ];
  var PAYS = ['MB Bank', 'MoMo', 'MB Bank', 'Vietcombank', 'MB Bank'];
  // simple deterministic PRNG
  var seed = 1337;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isoShift(base, days) { var d = new Date(base.getTime() + days * DAY); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  function rcode() { var s = ''; for (var i = 0; i < 6; i++) s += ALNUM[Math.floor(rnd() * ALNUM.length)]; return s; }

  for (var g = 0; g < 50; g++) {
    var p = pick(PRODS);
    var orderedDaysAgo = Math.floor(rnd() * 330) + 1;          // 1..330 days ago
    var orderBase = new Date(TODAY.getTime() - orderedDaysAgo * DAY);
    var orderIso = isoShift(orderBase, 0);
    var r = rnd();
    var status, expiry = null;
    if (r < 0.06) { status = 'pending'; }
    else if (r < 0.12) { status = 'paid'; }
    else if (r < 0.18) { status = 'delivered'; expiry = isoShift(orderBase, p.dur); }
    else if (r < 0.24) { status = 'refunded'; }
    else {
      expiry = isoShift(orderBase, p.dur);
      var dleft = Math.round((new Date(expiry + 'T00:00:00') - TODAY) / DAY);
      status = dleft <= 0 ? 'expired' : 'active';
    }
    var contact = rnd() < 0.55
      ? { type: 'zalo', value: '0' + (Math.floor(rnd() * 9) + 3) + ('' + Math.floor(rnd() * 1e8)).padStart(8, '0') }
      : { type: 'fb', value: 'fb.com/' + pick(NAMES).toLowerCase() + '.' + Math.floor(rnd() * 99) };
    var code = 'DMH_' + rcode() + '_' + pad(orderBase.getDate()) + pad(orderBase.getMonth() + 1) + ('' + orderBase.getFullYear()).slice(2);
    RAW.push({ code: code, customer: pick(NAMES), contact: contact, product: p.name, status: status, orderDate: orderIso, expiry: expiry, price: p.price, cost: p.cost, pay: status === 'draft' ? '—' : pick(PAYS) });
  }

  // deterministic renewal outcome for any order not explicitly mapped
  function renewFor(o) {
    if (RENEW.hasOwnProperty(o.code)) return RENEW[o.code];
    if (o.status === 'pending' || o.status === 'paid' || o.status === 'refunded' || o.status === 'draft') return null;
    if (o.status === 'expired') return rnd() < 0.45 ? 'renewed' : 'churned';
    // active: pending until close to expiry
    return null;
  }

  var ORDERS = RAW.map(function (o) {
    var days = o.expiry ? daysBetween(o.expiry) : null;
    var meta = productMeta(o.product);
    var rnw = renewFor(o);
    // active orders near expiry -> some already decided
    if (rnw === null && o.status === 'active' && days !== null && days <= 30) {
      rnw = rnd() < 0.5 ? 'pending' : (rnd() < 0.6 ? 'renewed' : 'churned');
    } else if (rnw === null && o.status === 'active') {
      rnw = 'pending';
    }
    return Object.assign({}, o, {
      daysLeft: days,
      profit: o.price - o.cost,
      mono: meta.mono,
      pkey: meta.key,
      renew: rnw,
      // urgency derived from days remaining (only meaningful while active)
      urgency: (o.status === 'active' && days !== null)
        ? (days <= 0 ? 'expired' : days <= 14 ? 'soon' : 'ok')
        : (o.status === 'expired' ? 'expired' : 'none')
    });
  });

  // KPI roll-up
  var paidStatuses = ['paid', 'delivered', 'active', 'expired'];
  var revenue = ORDERS.filter(function (o) { return paidStatuses.indexOf(o.status) > -1; })
                      .reduce(function (s, o) { return s + o.price; }, 0);
  var cost = ORDERS.filter(function (o) { return paidStatuses.indexOf(o.status) > -1; })
                   .reduce(function (s, o) { return s + o.cost; }, 0);
  var profit = revenue - cost;
  var KPI = {
    total: ORDERS.length,
    active: ORDERS.filter(function (o) { return o.status === 'active'; }).length,
    paid: ORDERS.filter(function (o) { return paidStatuses.indexOf(o.status) > -1; }).length,
    pending: ORDERS.filter(function (o) { return o.status === 'pending'; }).length,
    expiringSoon: ORDERS.filter(function (o) { return o.urgency === 'soon'; }).length,
    expired: ORDERS.filter(function (o) { return o.urgency === 'expired'; }).length,
    revenue: revenue,
    cost: cost,
    profit: profit,
    margin: revenue ? Math.round(profit / revenue * 100) : 0
  };

  // ---------- richer analytics ----------
  // accounts approaching / past expiry (active + expired w/ expiry date)
  var withExpiry = ORDERS.filter(function (o) { return o.expiry && (o.status === 'active' || o.status === 'expired' || o.status === 'delivered'); });
  function inBucket(o, lo, hi) { return o.daysLeft > lo && o.daysLeft <= hi; }
  var due = {
    overdue: ORDERS.filter(function (o) { return o.status === 'expired' || (o.daysLeft !== null && o.daysLeft <= 0 && o.status === 'active'); }).length,
    d7:  withExpiry.filter(function (o) { return inBucket(o, 0, 7); }).length,
    d14: withExpiry.filter(function (o) { return inBucket(o, 7, 14); }).length,
    d30: withExpiry.filter(function (o) { return inBucket(o, 14, 30); }).length
  };
  due.total = due.overdue + due.d7 + due.d14 + due.d30;

  // renewal outcomes
  var renewed = ORDERS.filter(function (o) { return o.renew === 'renewed'; }).length;
  var churned = ORDERS.filter(function (o) { return o.renew === 'churned'; }).length;
  var renewPending = ORDERS.filter(function (o) { return o.renew === 'pending'; }).length;
  var renew = {
    renewed: renewed, churned: churned, pending: renewPending,
    decided: renewed + churned,
    rate: (renewed + churned) ? Math.round(renewed / (renewed + churned) * 100) : 0
  };

  // by product family
  var pmap = {};
  ORDERS.forEach(function (o) {
    var k = o.pkey;
    if (!pmap[k]) pmap[k] = { key: k, mono: o.mono, count: 0, revenue: 0, sample: o.product.split(' ').slice(0, 2).join(' ') };
    pmap[k].count += 1;
    if (paidStatuses.indexOf(o.status) > -1) pmap[k].revenue += o.price;
  });
  var byProduct = Object.keys(pmap).map(function (k) { return pmap[k]; })
    .sort(function (a, b) { return b.count - a.count || b.revenue - a.revenue; });

  // by status (for the chip-distribution)
  var byStatus = Object.keys(STATUS).map(function (s) {
    return { status: s, count: ORDERS.filter(function (o) { return o.status === s; }).length };
  }).filter(function (x) { return x.count > 0; });

  var STATS = { due: due, renew: renew, byProduct: byProduct, byStatus: byStatus };

  window.OrderData = {
    ORDERS: ORDERS, KPI: KPI, STATS: STATS, STATUS: STATUS,
    fmt: fmt, fmtVnd: fmtVnd, fmtDate: fmtDate
  };
})();
