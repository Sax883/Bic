const apiBase = '/api';

function setToken(token) {
  localStorage.setItem('bic_token', token);
  document.cookie = `bic_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function getToken() {
  return localStorage.getItem('bic_token') || getCookie('bic_token');
}

function clearToken() {
  localStorage.removeItem('bic_token');
  document.cookie = 'bic_token=; path=/; max-age=0';
}

function authFetch(url, options = {}) {
  const token = getToken();
  const headers = options.headers || {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...headers } });
}

function showMessage(message, type = 'success') {
  const messageArea = document.querySelector('#message-area');
  if (!messageArea) return;
  messageArea.textContent = message;
  messageArea.className = type === 'success' ? 'banner' : 'banner';
  messageArea.style.background = type === 'error' ? '#fdecea' : '#f3fbf7';
  messageArea.style.color = type === 'error' ? '#8c1d18' : '#15472d';
  setTimeout(() => {
    messageArea.textContent = '';
  }, 5000);
}

async function handleClientLogin() {
  const email = document.querySelector('#client-email').value.trim();
  const password = document.querySelector('#client-password').value.trim();
  if (!email || !password) return showMessage('Complete all fields before logging in.', 'error');
  const response = await fetch(`${apiBase}/auth/client/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (!response.ok) return showMessage(data.error || 'Login failed.', 'error');
  setToken(data.token);
  window.location.href = '/client-dashboard.html';
}

async function handleClientSignup() {
  const full_name = document.querySelector('#signup-name').value.trim();
  const email = document.querySelector('#signup-email').value.trim();
  const password = document.querySelector('#signup-password').value.trim();
  const enrollment_type = document.querySelector('#signup-track').value;
  const refund_amount = Number(document.querySelector('#signup-refund-amount').value || 0);
  if (!full_name || !email || !password || !enrollment_type || refund_amount <= 0) return showMessage('Please complete all signup fields and enter a refund amount.', 'error');
  const response = await fetch(`${apiBase}/auth/client/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name, email, password, enrollment_type, refund_amount })
  });
  const data = await response.json();
  if (!response.ok) return showMessage(data.error || 'Unable to register.', 'error');
  showMessage(`${data.message} Your case ID is ${data.client_id}.`, 'success');
  setTimeout(() => {
    window.location.href = '/client-login.html';
  }, 2000);
}

async function handleForgotPassword() {
  const email = document.querySelector('#forgot-email').value.trim();
  if (!email) return showMessage('Enter your registered email.', 'error');
  const response = await fetch(`${apiBase}/auth/client/forgot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  if (!response.ok) return showMessage(data.error || 'Unable to process request.', 'error');
  showMessage(data.message, 'success');
}

async function handleAdminLogin() {
  const email = document.querySelector('#admin-email').value.trim();
  const password = document.querySelector('#admin-password').value.trim();
  if (!email || !password) return showMessage('Complete all fields before logging in.', 'error');
  const response = await fetch(`${apiBase}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (!response.ok) return showMessage(data.error || 'Admin login failed.', 'error');
  setToken(data.token);
  window.location.href = '/admin-dashboard.html';
}

async function loadClientDashboard() {
  const response = await authFetch(`${apiBase}/client/dashboard`);
  if (response.status === 401) return window.location.href = '/client-login.html';
  const data = await response.json();
  if (!response.ok) return showMessage(data.error || 'Unable to load dashboard.', 'error');
  const client = data.client;
  document.querySelector('#client-welcome').textContent = `${client.full_name}`;
  document.querySelector('#client-id').textContent = client.client_id;
  document.querySelector('#client-track').textContent = client.enrollment_type;
  document.querySelector('#client-track-label').textContent = `Enrollment type: ${client.enrollment_type}`;
  document.querySelector('#client-status').textContent = client.status;
  document.querySelector('#client-status').className = `status-pill status-${client.status.toLowerCase().replace(/ /g, '-')}`;
  document.querySelector('#office-agent').textContent = 'Case Officer: Maria Nguyen';
  document.querySelector('#updated-at').textContent = new Date(client.updated_at || Date.now()).toLocaleDateString('en-CA');
  document.querySelector('#total-initiated-value').textContent = `CAD ${Number(client.financials.total_refund_initiated || 0).toLocaleString('en-CA', {minimumFractionDigits:2})}`;
  document.querySelector('#total-pending-value').textContent = `CAD ${Number(client.financials.total_refund_pending || 0).toLocaleString('en-CA', {minimumFractionDigits:2})}`;
  document.querySelector('#total-activated-value').textContent = `CAD ${Number(client.financials.total_refund_activated || 0).toLocaleString('en-CA', {minimumFractionDigits:2})}`;
  document.querySelector('#total-settled-value').textContent = `CAD ${Number(client.financials.total_refund_settled || 0).toLocaleString('en-CA', {minimumFractionDigits:2})}`;
  document.querySelector('#paid-value').textContent = `CAD ${Number(client.financials.paid_to_date || 0).toLocaleString('en-CA', {minimumFractionDigits:2})}`;
  document.querySelector('#balance-value').textContent = `CAD ${Number(client.financials.outstanding_balance || client.financials.remaining_balance || 0).toLocaleString('en-CA', {minimumFractionDigits:2})}`;

  const payoutInfo = client.payout_info || {};
  document.querySelector('#payout-method').value = payoutInfo.payout_method || '';
  document.querySelector('#payout-currency').value = payoutInfo.payout_currency || 'CAD (Canadian Dollar)';
  document.querySelector('#payout-account-name').value = payoutInfo.account_name || '';
  document.querySelector('#payout-bank-name').value = payoutInfo.bank_name || '';
  document.querySelector('#payout-account-number').value = payoutInfo.account_number || '';
  document.querySelector('#payout-swift-code').value = payoutInfo.swift_code || '';
  document.querySelector('#payout-postal-code').value = payoutInfo.postal_code || '';
  document.querySelector('#payout-country').value = payoutInfo.country || '';
  document.querySelector('#payout-notes').value = payoutInfo.notes || '';

  const progressOrder = ['audit_completed', 'refund_authorized', 'processing', 'funds_disbursed'];
  const displayedSteps = document.querySelectorAll('.step');
  displayedSteps.forEach((step, index) => {
    step.classList.toggle('active', client.progress && client.progress[progressOrder[index]]);
  });
  const ledger = document.querySelector('#history-body');
  ledger.innerHTML = client.refund_history.map(item => `
    <tr>
      <td>${item.transaction_id}</td>
      <td>${item.date}</td>
      <td>CAD ${item.amount.toLocaleString('en-CA', {minimumFractionDigits:2})}</td>
      <td>${item.method}</td>
      <td>${item.status}</td>
    </tr>
  `).join('');
}

function renderAdminClientRows(list) {
  const table = document.querySelector('#admin-clients-body');
  if (!table) return;
  table.innerHTML = list.map(client => {
    const paymentMethod = client.payout_info?.payout_method || 'Not provided';
    const updatedAt = client.payout_info?.updated_at ? new Date(client.payout_info.updated_at).toLocaleDateString('en-CA') : '—';
    return `
      <tr>
        <td data-label="Name">${client.full_name}</td>
        <td data-label="Case ID">${client.client_id}</td>
        <td data-label="Email">${client.email}</td>
        <td data-label="Track">${client.enrollment_type}</td>
        <td data-label="Payment Method">${paymentMethod}</td>
        <td data-label="Balance">CAD ${Number(client.financials.outstanding_balance || client.financials.remaining_balance || 0).toLocaleString('en-CA', {minimumFractionDigits:2})}</td>
        <td data-label="Updated">${updatedAt}</td>
        <td data-label="Action"><a class="button-secondary" href="/admin-client-edit.html?client_id=${client.client_id}">Review</a></td>
      </tr>
    `;
  }).join('');
}

function applyAdminSearch() {
  const query = document.querySelector('#admin-search')?.value.toLowerCase() || '';
  const list = window.adminClientList || [];
  const filtered = list.filter(client => {
    return [client.full_name, client.client_id, client.email, client.enrollment_type]
      .some(value => value.toLowerCase().includes(query));
  });
  renderAdminClientRows(filtered);
}

async function loadAdminDashboard() {
  const response = await authFetch(`${apiBase}/admin/clients`);
  if (response.status === 401) return window.location.href = '/admin-login.html';
  const data = await response.json();
  if (!response.ok) return showMessage(data.error || 'Unable to load clients.', 'error');
  const list = data.clients;
  window.adminClientList = list;
  renderAdminClientRows(list);
}

async function loadAdminClient() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id');
  if (!clientId) return showMessage('Missing client identifier.', 'error');
  const response = await authFetch(`${apiBase}/admin/client/${clientId}`);
  if (response.status === 401) return window.location.href = '/admin-login.html';
  const data = await response.json();
  if (!response.ok) return showMessage(data.error || 'Unable to load client.', 'error');
  const client = data.client;
  document.querySelector('#edit-client-name').textContent = client.full_name;
  document.querySelector('#edit-client-id').textContent = client.client_id;
  document.querySelector('#edit-client-track').textContent = client.enrollment_type;
  document.querySelector('#input-total-initiated').value = client.financials.total_refund_initiated;
  document.querySelector('#input-total-pending').value = client.financials.total_refund_pending;
  document.querySelector('#input-total-activated').value = client.financials.total_refund_activated;
  document.querySelector('#input-total-settled').value = client.financials.total_refund_settled;
  document.querySelector('#input-paid-to-date').value = client.financials.paid_to_date;
  document.querySelector('#input-outstanding-balance').value = client.financials.outstanding_balance || client.financials.remaining_balance;
  document.querySelector('#input-total-eligible').value = client.financials.total_refund_eligible;
  document.querySelector('#input-amount-refunded').value = client.financials.amount_refunded;
  document.querySelector('#input-remaining-balance').textContent = `CAD ${Number(client.financials.outstanding_balance || client.financials.remaining_balance || 0).toLocaleString('en-CA', {minimumFractionDigits:2})}`;
  document.querySelector('#input-status').value = client.status;
  document.querySelector('#input-notes').value = client.admin_notes || '';
  document.querySelector('#input-transaction-method').value = client.transaction_method || 'Direct Bank Transfer';
  document.querySelector('#client-id-hidden').value = client.client_id;
  document.querySelector('#client-case-status').textContent = client.status;
  document.querySelector('#client-case-status').className = `status-pill status-${client.status.toLowerCase().replace(/ /g, '-')}`;
  document.querySelector('#progress-audit').checked = Boolean(client.progress?.audit_completed);
  document.querySelector('#progress-authorized').checked = Boolean(client.progress?.refund_authorized);
  document.querySelector('#progress-processing').checked = Boolean(client.progress?.processing);
  document.querySelector('#progress-disbursed').checked = Boolean(client.progress?.funds_disbursed);
  document.querySelector('#cancel-update').addEventListener('click', () => { window.location.href = '/admin-dashboard.html'; });
}

function attachBalanceCalculator() {
  const eligible = document.querySelector('#input-total-eligible');
  const refunded = document.querySelector('#input-amount-refunded');
  const balance = document.querySelector('#input-remaining-balance');
  if (!eligible || !refunded || !balance) return;
  function updateBalance() {
    const total = Number(eligible.value || 0);
    const paid = Number(refunded.value || 0);
    const remaining = Number((total - paid).toFixed(2));
    balance.textContent = `CAD ${remaining.toLocaleString('en-CA', {minimumFractionDigits:2})}`;
  }
  eligible.addEventListener('input', updateBalance);
  refunded.addEventListener('input', updateBalance);
}

async function handleAdminUpdate() {
  const client_id = document.querySelector('#client-id-hidden')?.value || document.querySelector('#edit-client-id')?.textContent.trim();
  const total_refund_initiated = Number(document.querySelector('#input-total-initiated').value);
  const total_refund_pending = Number(document.querySelector('#input-total-pending').value);
  const total_refund_activated = Number(document.querySelector('#input-total-activated').value);
  const total_refund_settled = Number(document.querySelector('#input-total-settled').value);
  const paid_to_date = Number(document.querySelector('#input-paid-to-date').value);
  const outstanding_balance = Number(document.querySelector('#input-outstanding-balance').value);
  const total_refund_eligible = Number(document.querySelector('#input-total-eligible').value);
  const amount_to_refund = Number(document.querySelector('#input-amount-refunded').value);
  const status = document.querySelector('#input-status').value;
  const admin_notes = document.querySelector('#input-notes').value;
  const transaction_method = document.querySelector('#input-transaction-method').value;
  const progress = {
    audit_completed: document.querySelector('#progress-audit').checked,
    refund_authorized: document.querySelector('#progress-authorized').checked,
    processing: document.querySelector('#progress-processing').checked,
    funds_disbursed: document.querySelector('#progress-disbursed').checked
  };
  if (!client_id) return showMessage('Client reference missing.', 'error');
  try {
    const response = await authFetch(`${apiBase}/admin/update-refund`, {
      method: 'POST',
      body: JSON.stringify({ client_id, total_refund_initiated, total_refund_pending, total_refund_activated, total_refund_settled, paid_to_date, outstanding_balance, total_refund_eligible, amount_to_refund, status, admin_notes, transaction_method, progress })
    });
    const data = await response.json();
    if (!response.ok) return showMessage(data.error || 'Unable to update client.', 'error');
    document.querySelector('#client-id-hidden').value = client_id;
    showMessage(data.message, 'success');
  } catch (error) {
    showMessage('Unable to save client update. Try again.', 'error');
    console.error('Admin update error', error);
  }
}

function handleLogout() {
  clearToken();
  window.location.href = '/';
}

async function loadClientMessages() {
  const response = await authFetch(`${apiBase}/client/messages`);
  if (response.status === 401) return;
  const data = await response.json();
  if (!response.ok) return;
  const messagesContainer = document.querySelector('#messages-container');
  if (!messagesContainer) return;
  if (data.messages.length === 0) {
    messagesContainer.innerHTML = '<div style="text-align:center; color:var(--muted);">No messages yet</div>';
    return;
  }
  messagesContainer.innerHTML = data.messages.map(msg => `
    <div style="margin-bottom:1rem; padding:0.75rem; border-left:4px solid var(--primary); background:white; border-radius:4px;">
      <div style="font-size:0.85rem; color:var(--muted); margin-bottom:0.25rem;">${msg.sender === 'client' ? 'You' : 'Admin'} • ${new Date(msg.created_at).toLocaleDateString('en-CA')}</div>
      <p style="margin:0.5rem 0;">${msg.message_text}</p>
      ${msg.admin_reply ? `<div style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid var(--border);"><div style="font-size:0.85rem; color:#c41e3a; font-weight:700; margin-bottom:0.25rem;">Admin Reply</div><p style="margin:0;">${msg.admin_reply}</p></div>` : ''}
    </div>
  `).join('');
}

async function handleSendClientMessage() {
  const input = document.querySelector('#client-message-input');
  const message_text = input?.value.trim();
  if (!message_text) return showMessage('Message cannot be empty.', 'error');
  const response = await authFetch(`${apiBase}/client/send-message`, {
    method: 'POST',
    body: JSON.stringify({ message_text })
  });
  const data = await response.json();
  if (!response.ok) return showMessage(data.error || 'Unable to send message.', 'error');
  input.value = '';
  showMessage(data.message, 'success');
  loadClientMessages();
  loadClientDashboard();
}

async function loadAdminMessages() {
  const response = await authFetch(`${apiBase}/admin/messages`);
  if (response.status === 401) return;
  const data = await response.json();
  if (!response.ok) return;
  const messagesList = document.querySelector('#admin-messages-list');
  if (!messagesList) return;
  if (data.messages.length === 0) {
    messagesList.innerHTML = '<div style="text-align:center; color:var(--muted);">No messages yet</div>';
    return;
  }
  messagesList.innerHTML = data.messages.map(msg => `
    <div style="margin-bottom:1rem; padding:1rem; border:1px solid var(--border); border-radius:8px; background:var(--surface-secondary);">
      <div style="font-weight:700; color:var(--primary);">${msg.client_name}</div>
      <div style="font-size:0.85rem; color:var(--muted); margin-bottom:0.5rem;">Client ID: ${msg.client_id} • ${new Date(msg.created_at).toLocaleDateString('en-CA')}</div>
      <p style="margin:0.5rem 0; color:var(--text);">${msg.message_text}</p>
      ${msg.admin_reply ? `<div style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid var(--border);"><div style="font-size:0.85rem; color:#c41e3a; font-weight:700; margin-bottom:0.25rem;">Your Reply</div><p style="margin:0;">${msg.admin_reply}</p></div>` : `
        <div style="margin-top:0.75rem; display:flex; gap:0.5rem;">
          <input type="text" id="reply-${msg._id}" placeholder="Type reply..." style="flex:1; padding:0.5rem; border:1px solid var(--border); border-radius:4px; font-size:0.9rem;" />
          <button style="padding:0.5rem 1rem; background:#c41e3a; color:white; border:none; border-radius:4px; cursor:pointer; font-size:0.9rem;" onclick="handleAdminReply('${msg._id}')">Reply</button>
        </div>
      `}
    </div>
  `).join('');
}

async function handleAdminReply(messageId) {
  const replyInput = document.querySelector(`#reply-${messageId}`);
  const reply_text = replyInput?.value.trim();
  if (!reply_text) return showMessage('Reply cannot be empty.', 'error');
  const response = await authFetch(`${apiBase}/admin/reply-message`, {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId, reply_text })
  });
  const data = await response.json();
  if (!response.ok) return showMessage(data.error || 'Unable to send reply.', 'error');
  showMessage(data.message, 'success');
  loadAdminMessages();
}

async function handleSavePayoutInfo() {
  const payout_method = document.querySelector('#payout-method')?.value;
  const payout_currency = document.querySelector('#payout-currency')?.value;
  const account_name = document.querySelector('#payout-account-name')?.value.trim();
  const bank_name = document.querySelector('#payout-bank-name')?.value.trim();
  const account_number = document.querySelector('#payout-account-number')?.value.trim();
  const swift_code = document.querySelector('#payout-swift-code')?.value.trim();
  const postal_code = document.querySelector('#payout-postal-code')?.value.trim();
  const country = document.querySelector('#payout-country')?.value.trim();
  const notes = document.querySelector('#payout-notes')?.value.trim();
  if (!payout_method) return showMessage('Please select a payment method.', 'error');
  const response = await authFetch(`${apiBase}/client/save-payout`, {
    method: 'POST',
    body: JSON.stringify({ payout_method, payout_currency, account_name, bank_name, account_number, swift_code, postal_code, country, notes })
  });
  const data = await response.json();
  if (!response.ok) return showMessage(data.error || 'Unable to save payment details.', 'error');
  showMessage(data.message, 'success');
  loadClientDashboard();
}

function handleLogout() {
  clearToken();
  window.location.href = '/';
}

function bindEvents() {
  document.querySelector('#client-login-form')?.addEventListener('submit', e => { e.preventDefault(); handleClientLogin(); });
  document.querySelector('#client-signup-form')?.addEventListener('submit', e => { e.preventDefault(); handleClientSignup(); });
  document.querySelector('#client-payout-form')?.addEventListener('submit', e => { e.preventDefault(); handleSavePayoutInfo(); });
  document.querySelector('#client-message-form')?.addEventListener('submit', e => { e.preventDefault(); handleSendClientMessage(); });
  document.querySelector('#forgot-form')?.addEventListener('submit', e => { e.preventDefault(); handleForgotPassword(); });
  document.querySelector('#admin-login-form')?.addEventListener('submit', e => { e.preventDefault(); handleAdminLogin(); });
  document.querySelector('#admin-update-form')?.addEventListener('submit', e => { e.preventDefault(); handleAdminUpdate(); });
  document.querySelector('#admin-search')?.addEventListener('input', applyAdminSearch);
  document.querySelector('#logout-button')?.addEventListener('click', handleLogout);
  document.querySelector('#send-message-btn')?.addEventListener('click', handleSendClientMessage);
  document.querySelector('#client-message-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendClientMessage(); });
  document.querySelector('#save-payout-btn')?.addEventListener('click', handleSavePayoutInfo);
  document.querySelector('#nav-toggle')?.addEventListener('click', () => {
    document.querySelector('.header')?.classList.toggle('nav-open');
  });

  // Robust handlers for critical buttons (click, pointerdown, touchstart)
  const attachFastHandlers = (el, handler) => {
    try {
      el.addEventListener('click', handler);
    } catch (e) {}
    try {
      el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); handler(); });
    } catch (e) {}
    try {
      el.addEventListener('touchstart', (ev) => { ev.preventDefault(); handler(); }, { passive: false });
    } catch (e) {}
    // expose that handler is attached for debugging
    try { console.info('Attached fast handlers to', el.id); } catch(e){}
  };

  const loginBtn = document.querySelector('#client-login-btn');
  if (loginBtn) attachFastHandlers(loginBtn, handleClientLogin);
  const registerBtn = document.querySelector('#client-register-btn');
  if (registerBtn) attachFastHandlers(registerBtn, handleClientSignup);
}

window.handleClientLogin = handleClientLogin;
window.handleClientSignup = handleClientSignup;
window.handleForgotPassword = handleForgotPassword;
window.handleAdminLogin = handleAdminLogin;
window.handleAdminUpdate = handleAdminUpdate;
window.handleSavePayoutInfo = handleSavePayoutInfo;
window.handleSendClientMessage = handleSendClientMessage;
window.handleLogout = handleLogout;
window.handleAdminReply = handleAdminReply;

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  if (document.body.dataset.page === 'client-dashboard') {
    loadClientDashboard();
    loadClientMessages();
    setInterval(() => {
      loadClientDashboard();
      loadClientMessages();
    }, 5000);
  }
  if (document.body.dataset.page === 'admin-dashboard') {
    loadAdminDashboard();
    loadAdminMessages();
    setInterval(() => {
      loadAdminDashboard();
      loadAdminMessages();
    }, 5000);
  }
  if (document.body.dataset.page === 'admin-edit') {
    loadAdminClient();
    attachBalanceCalculator();
  }
});
