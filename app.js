const config = window.STOCK_ADMIN_CONFIG || {};
const SUPABASE_URL = config.supabaseUrl || '';
const SUPABASE_ANON_KEY = config.anonKey || '';
const SHARED_LOGIN_EMAIL = config.adminEmail || '';
const TABLE_NAME = config.tableName || '';

const isConfigured =
  TABLE_NAME &&
  !SUPABASE_URL.includes('your-project') &&
  SUPABASE_ANON_KEY !== 'your-anon-key' &&
  SHARED_LOGIN_EMAIL !== 'your-shared-login@example.com';

const db = isConfigured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const state = {
  session: null,
  records: [],
  editingId: null,
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
  await loadRecords();
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
    await loadRecords();
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
    await loadRecords();
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
  await loadRecords();
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
els.refreshButton.addEventListener('click', loadRecords);
els.downloadButton.addEventListener('click', downloadJson);
els.addForm.addEventListener('submit', addRecord);


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
      loadRecords();
    } else {
      showLogin();
    }
  });
} else {
  showLogin();
  showStatus('请先在 config.js 中填写 Supabase URL、anon key、共享登录邮箱和表名', 'error');
}
