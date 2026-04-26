let menu = JSON.parse(localStorage.getItem('rm_menu') || 'null') || [
  { id: 1, name: 'Cola', price: 2.50 },
  { id: 2, name: 'Burger', price: 8.00 },
  { id: 3, name: 'Fries', price: 3.50 },
  { id: 4, name: 'Water', price: 1.00 },

];
let orders = JSON.parse(localStorage.getItem('rm_orders') || '[]');
let cart = {};
let nextId = menu.reduce((m, i) => Math.max(m, i.id), 0) + 1;
let orderCount = orders.length + 1;

function save() {
  localStorage.setItem('rm_menu', JSON.stringify(menu));
  localStorage.setItem('rm_orders', JSON.stringify(orders));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    const names = ['new-order', 'menu', 'daily'];
    t.classList.toggle('active', names[i] === name);
  });
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'daily') renderDaily();
  if (name === 'menu') renderMenu();
  if (name === 'new-order') renderOrderItems();
}

function renderMenu() {
  const grid = document.getElementById('menu-grid');
  grid.innerHTML = menu.map(item => `
    <div class="menu-item">
      <button class="delete-item-btn" onclick="deleteMenuItem(${item.id})" title="Delete item">×</button>
      <div class="item-name">${item.name}</div>
      <div class="price-row">
        <span class="currency">₾</span>
        <input type="number" id="price-${item.id}" value="${item.price.toFixed(2)}" min="0" step="0.01" style="width:80px;" />
        <button class="save-btn" onclick="savePrice(${item.id})">Save</button>
        <span class="saved-tag" id="saved-${item.id}">Saved</span>
      </div>
    </div>
  `).join('');
}

function deleteMenuItem(id) {
  const item = menu.find(i => i.id === id);
  if (!item) return;
  if (!confirm('Delete "' + item.name + '" from the menu?')) return;
  menu = menu.filter(i => i.id !== id);
  delete cart[id];
  save();
  renderMenu();
  renderOrderItems();
  showToast(item.name + ' removed from menu');
}

function savePrice(id) {
  const val = parseFloat(document.getElementById('price-' + id).value);
  if (isNaN(val) || val < 0) return;
  const item = menu.find(i => i.id === id);
  if (item) { item.price = val; save(); }
  const tag = document.getElementById('saved-' + id);
  tag.style.display = 'inline';
  setTimeout(() => { tag.style.display = 'none'; }, 1500);
}

function addMenuItem() {
  const name = document.getElementById('new-item-name').value.trim();
  const price = parseFloat(document.getElementById('new-item-price').value);
  if (!name || isNaN(price) || price < 0) { showToast('Please enter a valid name and price'); return; }
  menu.push({ id: nextId++, name, price });
  save();
  document.getElementById('new-item-name').value = '';
  document.getElementById('new-item-price').value = '';
  renderMenu();
  renderOrderItems();
  showToast(name + ' added to menu');
}

function renderOrderItems() {
  const list = document.getElementById('order-items-list');
  list.innerHTML = menu.map(item => {
    const qty = cart[item.id] || 0;
    return `
      <div class="order-item-row">
        <span class="item-label">${item.name}</span>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
        </div>
        <span class="item-price">₾${(item.price * qty).toFixed(2)}</span>
      </div>
    `;
  }).join('');
  updateSummary();
}

function changeQty(id, delta) {
  cart[id] = Math.max(0, (cart[id] || 0) + delta);
  renderOrderItems();
}

function updateSummary() {
  const lines = document.getElementById('summary-lines');
  const totalEl = document.getElementById('order-total');
  const btn = document.getElementById('place-btn');
  const items = menu.filter(i => cart[i.id] > 0);
  if (!items.length) {
    lines.innerHTML = '<div style="font-size: 13px; color: var(--color-text-secondary); padding: 4px 0;">No items added yet</div>';
    totalEl.textContent = '₾0.00';
    btn.disabled = true;
    return;
  }
  let total = 0;
  lines.innerHTML = items.map(item => {
    const sub = item.price * cart[item.id];
    total += sub;
    return `<div class="summary-line"><span class="lname">${cart[item.id]}x ${item.name}</span><span>₾${sub.toFixed(2)}</span></div>`;
  }).join('');
  totalEl.textContent = '₾' + total.toFixed(2);
  btn.disabled = false;
}

function placeOrder() {
  const items = menu.filter(i => cart[i.id] > 0);
  if (!items.length) return;
  const note = document.getElementById('order-note').value.trim();
  const total = items.reduce((s, i) => s + i.price * cart[i.id], 0);
  const order = {
    id: orderCount++,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    items: items.map(i => ({ name: i.name, qty: cart[i.id], price: i.price })),
    total,
    note
  };
  orders.push(order);
  save();
  cart = {};
  document.getElementById('order-note').value = '';
  renderOrderItems();
  showToast('Order #' + order.id + ' placed — ₾' + total.toFixed(2));
}

function deleteOrder(id) {
  if (!confirm('Delete order #' + id + '?')) return;
  orders = orders.filter(o => o.id !== id);
  save();
  renderDaily();
  showToast('Order #' + id + ' deleted');
}

function renderDaily() {
  const total = orders.reduce((s, o) => s + o.total, 0);
  const avg = orders.length ? total / orders.length : 0;
  document.getElementById('stat-earnings').textContent = '₾' + total.toFixed(2);
  document.getElementById('stat-orders').textContent = orders.length;
  document.getElementById('stat-avg').textContent = '₾' + avg.toFixed(2);
  const list = document.getElementById('orders-list');
  if (!orders.length) { list.innerHTML = '<div class="empty-state">No orders yet today</div>'; return; }
  list.innerHTML = [...orders].reverse().map(o => `
    <div class="order-card">
      <div class="order-card-header">
        <span class="order-num">Order #${o.id}</span>
        <span class="order-time">${o.time}</span>
        <span class="order-total-badge">₾${o.total.toFixed(2)}</span>
        <button class="delete-order-btn" onclick="deleteOrder(${o.id})">Delete</button>
      </div>
      <div class="order-items-text">${o.items.map(i => i.qty + 'x ' + i.name).join(', ')}</div>
      ${o.note ? `<div class="order-note">${o.note}</div>` : ''}
    </div>
  `).join('');
}

function clearDay() {
  if (!confirm('Clear all orders for today?')) return;
  orders = [];
  orderCount = 1;
  save();
  renderDaily();
  showToast('Day cleared');
}

renderOrderItems();
renderMenu();