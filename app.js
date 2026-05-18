const config = window.STOCK_ADMIN_CONFIG || {};
const SUPABASE_URL = config.supabaseUrl || '';
const SUPABASE_ANON_KEY = config.anonKey || '';
const SHARED_LOGIN_EMAIL = config.adminEmail || '';
const TABLE_NAME = config.tableName || '';
const PRICE_TABLE_NAME = config.priceTableName || 'stock_latest_prices';

const isConfigured =
  TABLE_NAME &&
  !SUPABASE_URL.includes('your-project') &&
  SUPABASE_ANON_KEY !== 'your-anon-key' &&
  SHARED_LOGIN_EMAIL !== 'your-shared-login@example.com';

const db = isConfigured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const state = {
  session: null,
  records: [],
  latestPrices: [],
  editingId: null,
  profitChart: null,
  valueChart: null,
};

const els = {
  loginView: document.querySelector('#login-view'),
  appView: document.querySelector('#app-view'),
  loginForm: document.querySelector('#login-form'),
  password: document.querySelector('#password'),
  loginButton: document.querySelector('#login-button'),
  logoutButton: document.querySelector('#logout-button'),
  refreshButton: document.querySelector('#refresh-button'),
  downloadButton: document.querySelector('#download-button'),
  addForm: document.querySelector('#add-form'),
  addButton: document.querySelector('#add-button'),
  dateInput: document.querySelector('#date'),
  loginStatus: document.querySelector('#login-status'),
  appStatus: document.querySelector('#app-status'),
  recordsBody: document.querySelector('#records-body'),
  recordCount: document.querySelector('#record-count'),
  priceCount: document.querySelector('#price-count'),
  priceList: document.querySelector('#price-list'),
  summaryCards: document.querySelector('#summary-cards'),
  profitChart: document.querySelector('#profit-chart'),
  valueChart: document.querySelector('#value-chart'),
};

function getTodayTradeDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}${day}`;
}

function setDefaultTradeDate(force = false) {
  if (!els.dateInput) return;
  if (force || !els.dateInput.value) {
    els.dateInput.value = getTodayTradeDate();
  }
}

function showStatus(message, type = 'success') {
  [els.loginStatus, els.appStatus].forEach((status) => {
    status.textContent = message;
    status.className = `status ${type}`;
  });
}

function clearStatus() {
  [els.loginStatus, els.appStatus].forEach((status) => {
    status.textContent = '';
    status.className = 'status hidden';
  });
}

function setBusy(isBusy) {
  els.loginButton.disabled = isBusy;
  els.addButton.disabled = isBusy;
}

function showLogin() {
  els.loginView.classList.remove('hidden');
  els.appView.classList.add('hidden');
}

function showApp() {
  els.loginView.classList.add('hidden');
  els.appView.classList.remove('hidden');
  setDefaultTradeDate();
}

function getFormRecord(form) {
  const formData = new FormData(form);
  const price = Number(formData.get('price'));
  const shares = Number.parseInt(String(formData.get('shares')), 10);
  const record = {
    trade_date: String(formData.get('trade_date') || '').trim(),
    stock_name: String(formData.get('stock_name') || '').trim(),
    stock_code: String(formData.get('stock_code') || '').trim().toUpperCase(),
    operation: String(formData.get('operation') || '').trim(),
    unit_price: price,
    operation_shares: shares,
  };

  if (!record.trade_date) throw new Error('请输入日期');
  if (!record.stock_name) throw new Error('请输入名称');
  if (!record.stock_code) throw new Error('请输入代码');
  if (!record.operation) throw new Error('请输入操作');
  if (!Number.isFinite(record.unit_price) || record.unit_price <= 0) throw new Error('请输入有效单价');
  if (!Number.isInteger(record.operation_shares) || record.operation_shares <= 0) throw new Error('请输入有效操作股数');

  return record;
}

function getAddRecord() {
  const price = Number(document.querySelector('#price').value);
  const shares = Number.parseInt(document.querySelector('#shares').value, 10);
  const record = {
    trade_date: document.querySelector('#date').value.trim(),
    stock_name: document.querySelector('#name').value.trim(),
    stock_code: document.querySelector('#code').value.trim().toUpperCase(),
    operation: document.querySelector('#operation').value.trim(),
    unit_price: price,
    operation_shares: shares,
  };

  if (!record.trade_date) throw new Error('请输入日期');
  if (!record.stock_name) throw new Error('请输入名称');
  if (!record.stock_code) throw new Error('请输入代码');
  if (!record.operation) throw new Error('请输入操作');
  if (!Number.isFinite(record.unit_price) || record.unit_price <= 0) throw new Error('请输入有效单价');
  if (!Number.isInteger(record.operation_shares) || record.operation_shares <= 0) throw new Error('请输入有效操作股数');

  return record;
}

function operationClass(operation) {
  if (operation === '买入' || operation === '加仓') return 'buy';
  if (operation === '卖出' || operation === '减仓') return 'sell';
  return '';
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return '--';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(2)}%`;
}

function getOperationKind(operation) {
  const value = String(operation || '');
  if (value.includes('\u4e70') || value.includes('\u52a0') || value.includes('æ¶”') || value.includes('é”')) {
    return 'buy';
  }
  if (value.includes('\u5356') || value.includes('\u51cf') || value.includes('é—') || value.includes('é‘')) {
    return 'sell';
  }
  return 'other';
}

function getPriceMap() {
  return new Map(state.latestPrices.map((price) => [price.stock_code, price]));
}

function calculateHoldings() {
  const holdings = new Map();
  const sorted = [...state.records].sort((a, b) => {
    const dateCompare = String(a.trade_date || '').localeCompare(String(b.trade_date || ''));
    if (dateCompare !== 0) return dateCompare;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });

  sorted.forEach((record) => {
    const stockCode = String(record.stock_code || '').trim().toUpperCase();
    if (!stockCode) return;

    const current =
      holdings.get(stockCode) ||
      {
        stock_code: stockCode,
        stock_name: record.stock_name || stockCode,
        shares: 0,
        cost: 0,
      };

    current.stock_name = record.stock_name || current.stock_name;

    const shares = Number(record.operation_shares) || 0;
    const unitPrice = Number(record.unit_price) || 0;
    const kind = getOperationKind(record.operation);

    if (kind === 'buy') {
      current.cost += unitPrice * shares;
      current.shares += shares;
    }

    if (kind === 'sell' && current.shares > 0) {
      const reduceShares = Math.min(shares, current.shares);
      const averageCost = current.cost / current.shares;
      current.cost -= averageCost * reduceShares;
      current.shares -= reduceShares;

      if (current.shares <= 0.000001) {
        current.shares = 0;
        current.cost = 0;
      }
    }

    holdings.set(stockCode, current);
  });

  const priceMap = getPriceMap();

  return [...holdings.values()]
    .filter((holding) => holding.shares > 0)
    .map((holding) => {
      const latestPrice = priceMap.get(holding.stock_code);
      const currentPrice = latestPrice ? Number(latestPrice.current_price) : null;
      const marketValue = Number.isFinite(currentPrice) ? currentPrice * holding.shares : null;
      const profit = Number.isFinite(marketValue) ? marketValue - holding.cost : null;
      const profitRate = Number.isFinite(profit) && holding.cost > 0 ? (profit / holding.cost) * 100 : null;

      return {
        ...holding,
        average_cost: holding.shares > 0 ? holding.cost / holding.shares : 0,
        current_price: currentPrice,
        market_value: marketValue,
        profit,
        profit_rate: profitRate,
        quoted_at: latestPrice ? latestPrice.quoted_at : null,
      };
    });
}

function renderDashboard() {
  const holdings = calculateHoldings();
  renderSummary(holdings);
  renderPriceEditor(holdings);
  renderCharts(holdings);
}

function renderSummary(holdings) {
  const priced = holdings.filter((holding) => Number.isFinite(holding.market_value));
  const totalValue = priced.reduce((sum, holding) => sum + holding.market_value, 0);
  const totalCost = priced.reduce((sum, holding) => sum + holding.cost, 0);
  const totalProfit = totalValue - totalCost;
  const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : null;
  const missingCount = holdings.length - priced.length;

  els.summaryCards.innerHTML = [
    ['\u603b\u5e02\u503c', formatMoney(totalValue)],
    ['\u603b\u6210\u672c', formatMoney(totalCost)],
    ['\u6d6e\u52a8\u76c8\u4e8f', formatMoney(totalProfit), totalProfit >= 0 ? 'positive' : 'negative'],
    ['\u76c8\u4e8f\u7387', formatPercent(totalProfitRate), totalProfit >= 0 ? 'positive' : 'negative'],
  ]
    .map(
      ([label, value, tone]) => `
        <div class="summary-card ${tone || ''}">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join('');

  els.priceCount.textContent = `${holdings.length} \u53ea\u6301\u4ed3 / ${missingCount} \u53ea\u5f85\u8865\u4ef7`;
}

function renderPriceEditor(holdings) {
  if (holdings.length === 0) {
    els.priceList.innerHTML = '<p class="empty-note">\u6682\u65e0\u6301\u4ed3\u80a1\u7968</p>';
    return;
  }

  els.priceList.innerHTML = holdings
    .map((holding) => {
      const currentPrice = Number.isFinite(holding.current_price) ? holding.current_price : '';
      const quotedAt = holding.quoted_at ? new Date(holding.quoted_at).toLocaleString('zh-CN') : '\u672a\u4fdd\u5b58';

      return `
        <div class="price-row" data-code="${escapeHtml(holding.stock_code)}" data-name="${escapeHtml(holding.stock_name)}">
          <div>
            <strong>${escapeHtml(holding.stock_name)}</strong>
            <span>${escapeHtml(holding.stock_code)} · ${holding.shares} \u80a1</span>
          </div>
          <label>
            \u5f53\u524d\u4ef7
            <input class="latest-price-input" type="number" min="0" step="0.0001" value="${currentPrice}" placeholder="0.0000" />
          </label>
          <span class="quote-time">${quotedAt}</span>
          <button class="action-button" data-action="save-price" type="button">\u4fdd\u5b58</button>
        </div>
      `;
    })
    .join('');
}

function renderCharts(holdings) {
  if (!window.Chart || !els.profitChart || !els.valueChart) return;

  const priced = holdings.filter((holding) => Number.isFinite(holding.market_value));
  const labels = priced.map((holding) => holding.stock_name || holding.stock_code);
  const profits = priced.map((holding) => Number(holding.profit.toFixed(2)));
  const values = priced.map((holding) => Number(holding.market_value.toFixed(2)));

  if (state.profitChart) state.profitChart.destroy();
  if (state.valueChart) state.valueChart.destroy();

  state.profitChart = new Chart(els.profitChart, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '\u6d6e\u52a8\u76c8\u4e8f',
          data: profits,
          backgroundColor: profits.map((value) => (value >= 0 ? '#1f8a63' : '#c24135')),
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { ticks: { callback: (value) => formatMoney(Number(value)) } },
      },
    },
  });

  state.valueChart = new Chart(els.valueChart, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ['#166853', '#2d7dd2', '#d19a2a', '#8b5cf6', '#d14f72', '#2f9e9b'],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
      },
    },
  });
}

function renderRecords() {
  els.recordCount.textContent = `${state.records.length} 条`;

  if (state.records.length === 0) {
    els.recordsBody.innerHTML = '<tr><td class="empty-cell" colspan="7">暂无记录</td></tr>';
    return;
  }

  els.recordsBody.innerHTML = state.records
    .map((record) => {
      const isEditing = state.editingId === record.id;

      if (isEditing) {
        return `
          <tr data-id="${record.id}">
            <td><input name="trade_date" value="${escapeHtml(record.trade_date)}" /></td>
            <td><input name="stock_name" value="${escapeHtml(record.stock_name)}" /></td>
            <td><input name="stock_code" value="${escapeHtml(record.stock_code)}" /></td>
            <td>
              <select name="operation">
                ${['买入', '卖出', '加仓', '减仓', '观察']
                  .map((item) => `<option value="${item}" ${item === record.operation ? 'selected' : ''}>${item}</option>`)
                  .join('')}
              </select>
            </td>
            <td><input name="price" type="number" min="0" step="0.0001" value="${record.unit_price}" /></td>
            <td><input name="shares" type="number" min="1" step="1" value="${record.operation_shares}" /></td>
            <td>
              <div class="row-actions">
                <button class="action-button" data-action="save" type="button">保存</button>
                <button class="action-button" data-action="cancel" type="button">取消</button>
              </div>
            </td>
          </tr>
        `;
      }

      return `
        <tr data-id="${record.id}">
          <td>${escapeHtml(record.trade_date)}</td>
          <td>${escapeHtml(record.stock_name)}</td>
          <td><span class="code-text">${escapeHtml(record.stock_code)}</span></td>
          <td><span class="operation-tag ${operationClass(record.operation)}">${escapeHtml(record.operation)}</span></td>
          <td>${record.unit_price}</td>
          <td>${record.operation_shares}</td>
          <td>
            <div class="row-actions">
              <button class="action-button" data-action="edit" type="button">编辑</button>
              <button class="action-button danger" data-action="delete" type="button">删除</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadRecords() {
  if (!db) {
    showStatus('请先在 config.js 中填写 Supabase URL、anon key、共享登录邮箱和表名', 'error');
    return;
  }

  clearStatus();
  els.recordsBody.innerHTML = '<tr><td class="empty-cell" colspan="7">正在加载...</td></tr>';

  const { data, error } = await db
    .from(TABLE_NAME)
    .select('*')
    .order('trade_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    showStatus(error.message, 'error');
    state.records = [];
  } else {
    state.records = data || [];
  }

  renderRecords();
}

async function loadLatestPrices() {
  if (!db) return;

  const { data, error } = await db.from(PRICE_TABLE_NAME).select('*');

  if (error) {
    state.latestPrices = [];
    showStatus(error.message, 'error');
    return;
  }

  state.latestPrices = data || [];
}

async function loadDashboard() {
  await loadRecords();
  await loadLatestPrices();
  renderDashboard();
}

async function login(password) {
  if (!db) {
    showStatus('请先在 config.js 中填写 Supabase URL、anon key、共享登录邮箱和表名', 'error');
    return;
  }

  setBusy(true);
  clearStatus();

  const { data, error } = await db.auth.signInWithPassword({
    email: SHARED_LOGIN_EMAIL,
    password,
  });

  setBusy(false);

  if (error) {
    showStatus('密码不正确或 Supabase 登录配置有误', 'error');
    return;
  }

  state.session = data.session;
  els.password.value = '';
  showApp();
  await loadDashboard();
}

async function logout() {
  if (!db) return;
  await db.auth.signOut();
  state.session = null;
  state.records = [];
  state.editingId = null;
  showLogin();
}

async function addRecord(event) {
  event.preventDefault();
  if (!db) {
    showStatus('请先完成 Supabase 配置', 'error');
    return;
  }

  setBusy(true);

  try {
    const payload = getAddRecord();
    const { error } = await db.from(TABLE_NAME).insert(payload);
    if (error) throw error;

    els.addForm.reset();
    setDefaultTradeDate(true);
    document.querySelector('#operation').value = '买入';
    showStatus('记录已添加');
    await loadDashboard();
  } catch (error) {
    showStatus(error.message || '添加失败', 'error');
  } finally {
    setBusy(false);
  }
}

async function saveRecord(row, id) {
  if (!db) {
    showStatus('请先完成 Supabase 配置', 'error');
    return;
  }

  setBusy(true);

  try {
    const form = document.createElement('form');
    row.querySelectorAll('input, select').forEach((field) => {
      const clone = document.createElement('input');
      clone.name = field.name;
      clone.value = field.value;
      form.appendChild(clone);
    });

    const payload = getFormRecord(form);
    const { error } = await db.from(TABLE_NAME).update(payload).eq('id', id);
    if (error) throw error;

    state.editingId = null;
    showStatus('修改已保存');
    await loadDashboard();
  } catch (error) {
    showStatus(error.message || '保存失败', 'error');
  } finally {
    setBusy(false);
  }
}

async function deleteRecord(record) {
  if (!db) {
    showStatus('请先完成 Supabase 配置', 'error');
    return;
  }

  if (!window.confirm(`确定删除 ${record.trade_date} ${record.stock_name} 的记录吗？`)) return;
  setBusy(true);

  const { error } = await db.from(TABLE_NAME).delete().eq('id', record.id);
  setBusy(false);

  if (error) {
    showStatus(error.message, 'error');
    return;
  }

  showStatus('记录已删除');
  await loadDashboard();
}

async function saveLatestPrice(row) {
  if (!db) {
    showStatus('\u8bf7\u5148\u5b8c\u6210 Supabase \u914d\u7f6e', 'error');
    return;
  }

  const stockCode = row.dataset.code;
  const stockName = row.dataset.name;
  const input = row.querySelector('.latest-price-input');
  const currentPrice = Number(input.value);

  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    showStatus('\u8bf7\u8f93\u5165\u6709\u6548\u5f53\u524d\u4ef7', 'error');
    return;
  }

  const { error } = await db.from(PRICE_TABLE_NAME).upsert(
    {
      stock_code: stockCode,
      stock_name: stockName,
      current_price: currentPrice,
      quoted_at: new Date().toISOString(),
    },
    { onConflict: 'stock_code' },
  );

  if (error) {
    showStatus(error.message, 'error');
    return;
  }

  showStatus('\u5f53\u524d\u4ef7\u5df2\u4fdd\u5b58');
  await loadLatestPrices();
  renderDashboard();
}

function downloadJson() {
  const rows = state.records.map(({ trade_date, stock_name, stock_code, operation, unit_price, operation_shares }) => ({
    date: trade_date,
    name: stock_name,
    code: stock_code,
    operation,
    unit_price,
    operation_shares,
  }));
  const blob = new Blob([JSON.stringify(rows, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'stock-operations.json';
  link.click();
  URL.revokeObjectURL(url);
}

els.loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  login(els.password.value);
});

els.logoutButton.addEventListener('click', logout);
els.refreshButton.addEventListener('click', loadDashboard);
els.downloadButton.addEventListener('click', downloadJson);
els.addForm.addEventListener('submit', addRecord);

els.priceList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="save-price"]');
  if (!button) return;

  const row = button.closest('.price-row');
  saveLatestPrice(row);
});

els.recordsBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const row = button.closest('tr');
  const id = row.dataset.id;
  const record = state.records.find((item) => item.id === id);
  const action = button.dataset.action;

  if (action === 'edit') {
    state.editingId = id;
    renderRecords();
  }

  if (action === 'cancel') {
    state.editingId = null;
    renderRecords();
  }

  if (action === 'save') {
    saveRecord(row, id);
  }

  if (action === 'delete' && record) {
    deleteRecord(record);
  }
});

if (db) {
  db.auth.getSession().then(({ data }) => {
    state.session = data.session;
    if (state.session) {
      showApp();
      loadDashboard();
    } else {
      showLogin();
    }
  });
} else {
  showLogin();
  showStatus('请先在 config.js 中填写 Supabase URL、anon key、共享登录邮箱和表名', 'error');
}
