const SUPABASE_URL = "https://cgrokfzmoiilmuqyscyf.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNncm9rZnptb2lpbG11cXlzY3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMDI1NDMsImV4cCI6MjA5Mjc3ODU0M30.L3vqMjSKWJ1K3WAdOLLPpAqxJ1uT9Ad4_49W4DaQeVw";
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: "Bearer " + SUPABASE_KEY,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

let menu = [];
let cart = {};

async function api(path, method = "GET", body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, opts);
  if (!res.ok) {
    const e = await res.text();
    throw new Error(e);
  }
  if (res.status === 204) return null;
  return res.json();
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

function switchTab(name) {
  const names = ["new-order", "menu", "daily"];
  document
    .querySelectorAll(".tab")
    .forEach((t, i) => t.classList.toggle("active", names[i] === name));
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  if (name === "daily") loadAndRenderDaily();
  if (name === "menu") renderMenu();
  if (name === "new-order") renderOrderItems();
}

async function loadMenu() {
  try {
    menu = await api("menu?order=id.asc");
    renderMenu();
    renderOrderItems();
  } catch (e) {
    document.getElementById("order-items-list").innerHTML =
      '<div class="error-msg">Failed to load menu. Check your connection.</div>';
    document.getElementById("menu-grid").innerHTML =
      '<div class="error-msg">Failed to load menu.</div>';
  }
}

function renderMenu() {
  const grid = document.getElementById("menu-grid");
  if (!menu.length) {
    grid.innerHTML = '<div class="empty-state">No menu items yet</div>';
    return;
  }
  grid.innerHTML = menu
    .map(
      (item) => `
    <div class="menu-item">
      <button class="del-item-btn" onclick="deleteMenuItem(${item.id})">×</button>
      <div class="item-name">${item.name}</div>
      <div class="price-row">
        <span class="currency">₾</span>
        <input type="number" id="price-${item.id}" value="${parseFloat(item.price).toFixed(2)}" min="0" step="0.01" style="width:80px;font-size:14px;" />
        <button class="save-btn" onclick="savePrice(${item.id})">Save</button>
        <span class="saved-tag" id="saved-${item.id}">Saved</span>
      </div>
    </div>`,
    )
    .join("");
}

async function savePrice(id) {
  const val = parseFloat(document.getElementById("price-" + id).value);
  if (isNaN(val) || val < 0) return;
  try {
    await api("menu?id=eq." + id, "PATCH", { price: val });
    const item = menu.find((i) => i.id === id);
    if (item) item.price = val;
    const tag = document.getElementById("saved-" + id);
    tag.style.display = "inline";
    setTimeout(() => {
      tag.style.display = "none";
    }, 1500);
    renderOrderItems();
  } catch (e) {
    showToast("Failed to save price");
  }
}

async function deleteMenuItem(id) {
  const item = menu.find((i) => i.id === id);
  if (!item || !confirm('Delete "' + item.name + '" from the menu?')) return;
  try {
    await api("menu?id=eq." + id, "DELETE");
    menu = menu.filter((i) => i.id !== id);
    delete cart[id];
    renderMenu();
    renderOrderItems();
    showToast(item.name + " removed");
  } catch (e) {
    showToast("Failed to delete item");
  }
}

async function addMenuItem() {
  const name = document.getElementById("new-item-name").value.trim();
  const price = parseFloat(document.getElementById("new-item-price").value);
  const err = document.getElementById("add-error");
  if (!name || isNaN(price) || price < 0) {
    err.textContent = "Enter a valid name and price";
    return;
  }
  err.textContent = "";
  try {
    const result = await api("menu", "POST", { name, price });
    menu.push(result[0]);
    document.getElementById("new-item-name").value = "";
    document.getElementById("new-item-price").value = "";
    renderMenu();
    renderOrderItems();
    showToast(name + " added");
  } catch (e) {
    err.textContent = "Failed to add item";
  }
}

function renderOrderItems() {
  const list = document.getElementById("order-items-list");
  if (!menu.length) {
    list.innerHTML = '<div class="empty-state">No menu items</div>';
    return;
  }
  list.innerHTML = menu
    .map((item) => {
      const qty = cart[item.id] || 0;
      return `<div class="order-item-row">
      <span class="item-label">${item.name}</span>
      <div class="qty-control">
        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
        <span class="qty-num">${qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
      </div>
      <span class="item-price">₾${(parseFloat(item.price) * qty).toFixed(2)}</span>
    </div>`;
    })
    .join("");
  updateSummary();
}

function changeQty(id, delta) {
  cart[id] = Math.max(0, (cart[id] || 0) + delta);
  renderOrderItems();
}

function updateSummary() {
  const lines = document.getElementById("summary-lines");
  const totalEl = document.getElementById("order-total");
  const btn = document.getElementById("place-btn");
  const items = menu.filter((i) => cart[i.id] > 0);
  if (!items.length) {
    lines.innerHTML =
      '<div style="font-size:13px;color:var(--color-text-secondary);padding:4px 0;">No items added yet</div>';
    totalEl.textContent = "₾0.00";
    btn.disabled = true;
    return;
  }
  let total = 0;
  lines.innerHTML = items
    .map((item) => {
      const sub = parseFloat(item.price) * cart[item.id];
      total += sub;
      return `<div class="summary-line"><span class="lname">${cart[item.id]}x ${item.name}</span><span>₾${sub.toFixed(2)}</span></div>`;
    })
    .join("");
  totalEl.textContent = "₾" + total.toFixed(2);
  btn.disabled = false;
}

async function placeOrder() {
  const items = menu.filter((i) => cart[i.id] > 0);
  if (!items.length) return;
  const note = document.getElementById("order-note").value.trim();
  const total = items.reduce((s, i) => s + parseFloat(i.price) * cart[i.id], 0);
  const orderItems = items.map((i) => ({
    name: i.name,
    qty: cart[i.id],
    price: parseFloat(i.price),
  }));
  const btn = document.getElementById("place-btn");
  btn.disabled = true;
  btn.textContent = "Placing...";
  try {
    await api("orders", "POST", {
      items: orderItems,
      total,
      note: note || null,
    });
    cart = {};
    document.getElementById("order-note").value = "";
    renderOrderItems();
    showToast("Order placed — ₾" + total.toFixed(2));
  } catch (e) {
    showToast("Failed to place order");
    btn.disabled = false;
  }
  btn.textContent = "Place order";
}

async function loadAndRenderDaily() {
  const list = document.getElementById("orders-list");
  list.innerHTML = '<div class="loading">Loading orders...</div>';
  try {
    const today = new Date().toISOString().split("T")[0];
    const orders = await api(
      "orders?created_at=gte." + today + "T00:00:00&order=created_at.desc",
    );
    const total = orders.reduce((s, o) => s + parseFloat(o.total), 0);
    const avg = orders.length ? total / orders.length : 0;
    document.getElementById("stat-earnings").textContent =
      "₾" + total.toFixed(2);
    document.getElementById("stat-orders").textContent = orders.length;
    document.getElementById("stat-avg").textContent = "₾" + avg.toFixed(2);
    if (!orders.length) {
      list.innerHTML = '<div class="empty-state">No orders yet today</div>';
      return;
    }
    list.innerHTML = orders
      .map((o) => {
        const time = new Date(o.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const itemsText = o.items.map((i) => i.qty + "x " + i.name).join(", ");
        return `<div class="order-card">
        <div class="order-card-header">
          <span class="order-num">Order #${o.id}</span>
          <span class="order-time">${time}</span>
          <span class="order-total-badge">₾${parseFloat(o.total).toFixed(2)}</span>
          <button class="del-order-btn" onclick="deleteOrder(${o.id})">Delete</button>
        </div>
        <div class="order-items-text">${itemsText}</div>
        ${o.note ? `<div class="order-note-text">${o.note}</div>` : ""}
      </div>`;
      })
      .join("");
  } catch (e) {
    list.innerHTML = '<div class="error-msg">Failed to load orders.</div>';
  }
}

async function deleteOrder(id) {
  if (!confirm("Delete order #" + id + "?")) return;
  try {
    await api("orders?id=eq." + id, "DELETE");
    showToast("Order #" + id + " deleted");
    loadAndRenderDaily();
  } catch (e) {
    showToast("Failed to delete order");
  }
}

async function clearDay() {
  if (!confirm("Delete ALL orders for today? This cannot be undone.")) return;
  try {
    const today = new Date().toISOString().split("T")[0];
    await api("orders?created_at=gte." + today + "T00:00:00", "DELETE");
    showToast("Day cleared");
    loadAndRenderDaily();
  } catch (e) {
    showToast("Failed to clear day");
  }
}

loadMenu();
