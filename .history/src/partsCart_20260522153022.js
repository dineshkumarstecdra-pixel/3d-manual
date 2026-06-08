import { auth } from "./firebase.js";

const CART_KEY = "partsCart";
const ORDERS_KEY = "partsOrders";
const CART_CHANGED_EVENT = "parts-cart-changed";

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toNumber(value, fallback = 1) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function formatVehicleName(value, fallbackId = "") {
  const rawName = String(value || "").trim();
  const rawId = String(fallbackId || "").trim();

  // Some older cart items were saved with names like "bmw x" because
  // the generic part formatter removed digits. If the vehicle ID still
  // has digits, rebuild the display name from the ID.
  const idHasDigits = /\d/.test(rawId);
  const nameHasDigits = /\d/.test(rawName);
  const source = (!rawName || (idHasDigits && !nameHasDigits)) ? rawId : rawName;

  const cleaned = String(source || "Vehicle")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Vehicle";

  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bBmw\b/g, "BMW")
    .replace(/\bAudi\b/g, "Audi")
    .replace(/\bVw\b/g, "VW")
    .replace(/\bSuv\b/g, "SUV");
}

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn("Invalid parts cart data. Resetting cart.", error);
    return fallback;
  }
}

function makeItemId(item) {
  const vehicleId = normalize(item.vehicleId || "vehicle");
  const partKey = normalize(item.partId && item.partId !== "-" ? item.partId : item.partName);
  return `${vehicleId}__${partKey || "part"}`;
}

function emitCartChanged() {
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: getCart() }));
}

export function getCart() {
  const cart = safeJsonParse(localStorage.getItem(CART_KEY), []);
  return Array.isArray(cart) ? cart : [];
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(Array.isArray(cart) ? cart : []));
  emitCartChanged();
}

export function getCartCount() {
  return getCart().reduce((total, item) => total + toNumber(item.qty, 0), 0);
}

export function addPartToCart(part) {
  const qty = toNumber(part.qty, 1);
  const normalized = {
    id: makeItemId(part),
    vehicleId: String(part.vehicleId || "").trim(),
    vehicleName: formatVehicleName(part.vehicleName, part.vehicleId),
    partName: String(part.partName || "Unnamed Part").trim(),
    partId: String(part.partId || "-").trim(),
    availableQty: toNumber(part.availableQty, 0),
    qty,
    addedAt: new Date().toISOString()
  };

  const cart = getCart();
  const existing = cart.find((item) => item.id === normalized.id);

  if (existing) {
    existing.qty = toNumber(existing.qty, 0) + qty;
    existing.availableQty = normalized.availableQty || existing.availableQty || 0;
    existing.addedAt = normalized.addedAt;
  } else {
    cart.push(normalized);
  }

  saveCart(cart);
  return existing || normalized;
}

export function updateCartItem(itemId, qty) {
  const nextQty = toNumber(qty, 1);
  const cart = getCart().map((item) => item.id === itemId ? { ...item, qty: nextQty } : item);
  saveCart(cart);
}

export function removeCartItem(itemId) {
  const cart = getCart().filter((item) => item.id !== itemId);
  saveCart(cart);
}

export function clearCart() {
  saveCart([]);
}

export async function placeOrder(customer = {}) {
  const items = getCart();
  if (!items.length) throw new Error("Cart is empty.");

  const user = auth.currentUser;
  const token = await user?.getIdToken?.().catch(() => "");
  const headers = {
    "Content-Type": "application/json",
    "X-User-Email": user?.email || ""
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch("/api/orders", {
    method: "POST",
    headers,
    body: JSON.stringify({
      customer: {
        name: String(customer.name || "").trim(),
        contact: String(customer.contact || "").trim(),
        notes: String(customer.notes || "").trim()
      },
      requestedBy: user?.email || "",
      items
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Order submit failed. Start npm run upload-server and try again.");
  }

  const orders = safeJsonParse(localStorage.getItem(ORDERS_KEY), []);
  orders.unshift(data);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.slice(0, 10)));
  clearCart();
  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function getStatusText(status) {
  const map = {
    pending: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    completed: "Completed"
  };
  return map[String(status || "").toLowerCase()] || "Pending Review";
}

function getStatusClass(status) {
  const safe = String(status || "pending").toLowerCase();
  return ["pending", "approved", "rejected", "completed"].includes(safe) ? safe : "pending";
}

async function fetchMyOrders() {
  const user = auth.currentUser;
  const headers = {
    "X-User-Email": user?.email || ""
  };

  const token = await user?.getIdToken?.().catch(() => "");
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api/orders/mine?_=${Date.now()}`, { headers });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data.error || "Unable to load your orders. Start npm run upload-server and try again.");
  }

  const orders = Array.isArray(data) ? data : [];
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.slice(0, 20)));
  return orders;
}

function getCachedOrders() {
  const orders = safeJsonParse(localStorage.getItem(ORDERS_KEY), []);
  return Array.isArray(orders) ? orders : [];
}

function createCartShell() {
  if (document.getElementById("partsCartDrawer")) return;

  const overlay = document.createElement("div");
  overlay.className = "parts-cart-overlay";
  overlay.id = "partsCartOverlay";

  const drawer = document.createElement("aside");
  drawer.className = "parts-cart-drawer";
  drawer.id = "partsCartDrawer";
  drawer.setAttribute("aria-hidden", "true");
  drawer.innerHTML = `
    <div class="parts-cart-drawer-header">
      <div>
        <span class="parts-cart-eyebrow" id="partsCartEyebrow">Parts Catalogue</span>
        <h2 id="partsCartTitle">Parts Cart</h2>
      </div>
      <button type="button" class="parts-cart-close" id="partsCartClose" aria-label="Close cart">×</button>
    </div>

    <div class="parts-cart-body" id="partsCartBody"></div>

    <form class="parts-order-form" id="partsOrderForm">
      <h3>Place Order</h3>
      <label>
        Requester Name
        <input type="text" id="partsOrderName" placeholder="e.g., Arun" />
      </label>
      <label>
        Contact
        <input type="text" id="partsOrderContact" placeholder="Phone or email" />
      </label>
      <label>
        Notes
        <textarea id="partsOrderNotes" rows="3" placeholder="Delivery note / workshop note"></textarea>
      </label>
      <button type="submit" class="parts-place-order-btn">Place Order</button>
    </form>

    <div class="parts-cart-footer">
      <button type="button" class="parts-cart-clear" id="partsCartClear">Clear Bag</button>
      <div class="parts-cart-total"><span id="partsCartTotal">0</span> Qty</div>
    </div>
  `;

  document.body.append(overlay, drawer);
}

function openDrawer() {
  createCartShell();
  document.body.classList.add("parts-cart-open");
  document.getElementById("partsCartDrawer")?.setAttribute("aria-hidden", "false");
}

function openCart() {
  openDrawer();
  renderCartDrawer();
}

function openMyOrders() {
  openDrawer();
  renderMyOrdersDrawer();
}

function closeCart() {
  document.body.classList.remove("parts-cart-open");
  document.getElementById("partsCartDrawer")?.setAttribute("aria-hidden", "true");
}

function updateBadge() {
  const count = getCartCount();
  const badge = document.getElementById("partsCartBadge");
  if (badge) badge.textContent = String(count);

  const total = document.getElementById("partsCartTotal");
  if (total) total.textContent = String(count);
}

function updateOrdersBadge(orders = getCachedOrders()) {
  const badge = document.getElementById("partsOrdersBadge");
  if (!badge) return;
  const activeCount = orders.filter((order) => !["completed", "rejected"].includes(String(order.status || "pending").toLowerCase())).length;
  badge.textContent = String(activeCount || orders.length || 0);
}

function setDrawerMode(mode) {
  const title = document.getElementById("partsCartTitle");
  const eyebrow = document.getElementById("partsCartEyebrow");
  const form = document.getElementById("partsOrderForm");
  const footer = document.querySelector(".parts-cart-footer");
  const isOrders = mode === "orders";

  if (title) title.textContent = isOrders ? "My Orders" : "Parts Bag";
  if (eyebrow) eyebrow.textContent = isOrders ? "Order Status" : "Parts Catalogue";
  if (form) form.style.display = isOrders ? "none" : "grid";
  if (footer) footer.style.display = isOrders ? "none" : "flex";
}

function renderCartDrawer() {
  createCartShell();
  setDrawerMode("cart");
  const body = document.getElementById("partsCartBody");
  const cart = getCart();
  if (!body) return;

  updateBadge();

  if (!cart.length) {
    body.innerHTML = `
      <div class="parts-cart-empty">
        <div class="parts-cart-empty-icon">🛍️</div>
        <h3>Your parts cart is empty</h3>
        <p>Add parts from the 3D viewer by pressing the + button near each part.</p>
      </div>
    `;
    return;
  }

  body.innerHTML = cart.map((item) => {
    const displayVehicle = formatVehicleName(item.vehicleName, item.vehicleId);
    return `
      <div class="parts-cart-item" data-cart-id="${escapeHtml(item.id)}">
        <div class="parts-cart-item-main">
          <div class="parts-cart-vehicle-name">${escapeHtml(displayVehicle)}</div>
          <div class="parts-cart-item-title">${escapeHtml(item.partName)}</div>
          <div class="parts-cart-item-meta">
            Vehicle ID: ${escapeHtml(item.vehicleId || "-")} · Part ID: ${escapeHtml(item.partId || "-")}
            ${item.availableQty ? ` · Available: ${escapeHtml(item.availableQty)}` : ""}
          </div>
        </div>
        <div class="parts-cart-qty-control">
          <button type="button" data-cart-action="decrease" aria-label="Decrease quantity">−</button>
          <input type="number" min="1" value="${escapeHtml(item.qty)}" data-cart-action="qty" />
          <button type="button" data-cart-action="increase" aria-label="Increase quantity">+</button>
        </div>
        <button type="button" class="parts-cart-remove" data-cart-action="remove">Remove</button>
      </div>
    `;
  }).join("");
}


async function renderMyOrdersDrawer() {
  createCartShell();
  setDrawerMode("orders");
  const body = document.getElementById("partsCartBody");
  if (!body) return;

  body.innerHTML = `
    <div class="parts-cart-empty">
      <div class="parts-cart-empty-icon">⏳</div>
      <h3>Loading your orders...</h3>
      <p>Checking latest approval status from the local server.</p>
    </div>
  `;

  try {
    const orders = await fetchMyOrders();
    updateOrdersBadge(orders);

    if (!orders.length) {
      body.innerHTML = `
        <div class="parts-cart-empty">
          <div class="parts-cart-empty-icon">📦</div>
          <h3>No orders yet</h3>
          <p>Place an order from Parts Cart. Your pending, approved, rejected and completed status will appear here.</p>
        </div>
      `;
      return;
    }

    body.innerHTML = orders.map((order) => {
      const statusClass = getStatusClass(order.status);
      const items = Array.isArray(order.items) ? order.items : [];
      return `
        <article class="parts-order-card parts-order-${statusClass}">
          <div class="parts-order-card-head">
            <div>
              <div class="parts-order-id">${escapeHtml(order.id)}</div>
              <div class="parts-order-date">${escapeHtml(formatDateTime(order.createdAt))}</div>
            </div>
            <span class="parts-order-status ${statusClass}">${escapeHtml(getStatusText(order.status))}</span>
          </div>

          <div class="parts-order-summary">
            <span>Total Qty: <strong>${escapeHtml(order.totalQty || items.reduce((sum, item) => sum + toNumber(item.qty, 0), 0))}</strong></span>
            <span>Vehicle: <strong>${escapeHtml((order.vehicleSummary || []).map((name) => formatVehicleName(name)).join(", ") || formatVehicleName(items[0]?.vehicleName, items[0]?.vehicleId) || "-")}</strong></span>
          </div>

          <div class="parts-order-items">
            ${items.map((item) => `
              <div class="parts-order-item-line">
                <span>${escapeHtml(item.partName)}</span>
                <small>${escapeHtml(formatVehicleName(item.vehicleName, item.vehicleId))} · Part ID: ${escapeHtml(item.partId || "-")} · Qty: ${escapeHtml(item.qty)}</small>
              </div>
            `).join("")}
          </div>

          ${order.adminNote ? `<div class="parts-order-note"><strong>Admin note:</strong> ${escapeHtml(order.adminNote)}</div>` : ""}
        </article>
      `;
    }).join("");
  } catch (error) {
    const cached = getCachedOrders();
    updateOrdersBadge(cached);
    body.innerHTML = `
      <div class="parts-cart-empty">
        <div class="parts-cart-empty-icon">⚠️</div>
        <h3>Could not load latest status</h3>
        <p>${escapeHtml(error.message || "Start npm run upload-server and try again.")}</p>
        ${cached.length ? `<p>Showing ${cached.length} cached order(s) from this browser.</p>` : ""}
      </div>
    `;
  }
}

function bindCartDrawerEvents() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("#partsCartButton")) {
      event.preventDefault();
      openCart();
      return;
    }

    if (event.target.closest("#partsOrdersButton")) {
      event.preventDefault();
      openMyOrders();
      return;
    }

    if (event.target.closest("#partsCartClose") || event.target.closest("#partsCartOverlay")) {
      event.preventDefault();
      closeCart();
      return;
    }

    if (event.target.closest("#partsCartClear")) {
      event.preventDefault();
      clearCart();
      renderCartDrawer();
      return;
    }

    const actionButton = event.target.closest("[data-cart-action]");
    if (!actionButton) return;

    const itemEl = actionButton.closest(".parts-cart-item");
    const itemId = itemEl?.dataset.cartId;
    if (!itemId) return;

    const action = actionButton.dataset.cartAction;
    const item = getCart().find((cartItem) => cartItem.id === itemId);
    if (!item) return;

    if (action === "increase") updateCartItem(itemId, toNumber(item.qty, 1) + 1);
    if (action === "decrease") updateCartItem(itemId, Math.max(1, toNumber(item.qty, 1) - 1));
    if (action === "remove") removeCartItem(itemId);

    renderCartDrawer();
  });

  document.addEventListener("change", (event) => {
    const input = event.target.closest('[data-cart-action="qty"]');
    if (!input) return;
    const itemId = input.closest(".parts-cart-item")?.dataset.cartId;
    if (!itemId) return;
    updateCartItem(itemId, input.value);
    renderCartDrawer();
  });

  document.addEventListener("submit", async (event) => {
    if (event.target.id !== "partsOrderForm") return;
    event.preventDefault();

    const submitButton = event.target.querySelector(".parts-place-order-btn");
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    try {
      const order = await placeOrder({
        name: document.getElementById("partsOrderName")?.value,
        contact: document.getElementById("partsOrderContact")?.value,
        notes: document.getElementById("partsOrderNotes")?.value
      });

      updateOrdersBadge(getCachedOrders());
      renderCartDrawer();
      const body = document.getElementById("partsCartBody");
      if (body) {
        body.innerHTML = `
          <div class="parts-order-success">
            <div class="parts-order-success-icon">✓</div>
            <h3>Order Sent to Admin</h3>
            <p>Order ID: <strong>${escapeHtml(order.id)}</strong></p>
            <p>Status: <strong>${escapeHtml(order.status || "pending")}</strong></p>
            <p>Total Qty: ${escapeHtml(order.totalQty)}</p>
          </div>
        `;
      }
      event.target.reset();
    } catch (error) {
      alert(error.message || "Unable to place order.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Place Order";
      }
    }
  });

  window.addEventListener(CART_CHANGED_EVENT, updateBadge);
  window.addEventListener("storage", (event) => {
    if (event.key === CART_KEY) updateBadge();
  });
}

let cartMounted = false;

export function mountPartsCartUI(options = {}) {
  const host = document.querySelector(options.hostSelector || ".header") || document.body;

  const profile = host.querySelector?.(".profile");

  if (!document.getElementById("partsCartButton")) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "partsCartButton";
    button.className = "parts-cart-button";
    button.innerHTML = `
      <span class="parts-cart-icon">🛍️</span>
      <span class="parts-cart-label">Parts Cart</span>
      <span class="parts-cart-badge" id="partsCartBadge">0</span>
    `;
    host.insertBefore(button, profile || null);
  }

  if (!document.getElementById("partsOrdersButton")) {
    const ordersButton = document.createElement("button");
    ordersButton.type = "button";
    ordersButton.id = "partsOrdersButton";
    ordersButton.className = "parts-cart-button parts-orders-button";
    ordersButton.innerHTML = `
      <span class="parts-cart-icon">📦</span>
      <span class="parts-cart-label">My Orders</span>
      <span class="parts-cart-badge" id="partsOrdersBadge">0</span>
    `;
    host.insertBefore(ordersButton, profile || null);
  }

  createCartShell();

  if (!cartMounted) {
    cartMounted = true;
    bindCartDrawerEvents();
  }

  updateBadge();
  updateOrdersBadge();
  fetchMyOrders().then(updateOrdersBadge).catch(() => updateOrdersBadge());
}
