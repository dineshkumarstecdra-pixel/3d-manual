import { requireAdmin, secureLogout, ADMIN_EMAIL } from "./authGuard.js";

const API_BASE = "/api";
const STANDARD_SERIES = new Set(["m", "x", "i", "r", "z"]);

const allowedExtensions = {
  image: ["jpg", "jpeg", "png", "svg", "webp"],
  model: ["stp", "step", "stl", "glb", "gltf", "obj", "dwg", "dxf", "fbx"],
  modelData: ["xlsx", "xls", "csv"],
  manual: ["pdf", "xlsx", "xls", "doc", "docx", "ppt", "pptx", "txt"]
};

const authOverlay = document.getElementById("authOverlay");
const adminApp = document.getElementById("adminApp");
const adminEmail = document.getElementById("adminEmail");
const logoutBtn = document.getElementById("logoutBtn");

const form = document.getElementById("vehicleForm");
const formTitle = document.getElementById("formTitle");
const vehicleIdInput = document.getElementById("vehicleId");
const vehicleNameInput = document.getElementById("vehicleName");
const vinNumberInput = document.getElementById("vinNumber");
const variantInput = document.getElementById("variant");
const yearInput = document.getElementById("year");
const regionInput = document.getElementById("region");
const typeInput = document.getElementById("type");
const seriesInput = document.getElementById("series");
const customSeriesInput = document.getElementById("customSeries");
const carImageInput = document.getElementById("carImage");
const modelFileInput = document.getElementById("modelFile");
const modelDataFileInput = document.getElementById("modelDataFile");
const manualFileInput = document.getElementById("manualFile");
const carImageName = document.getElementById("carImageName");
const modelFileName = document.getElementById("modelFileName");
const modelDataFileName = document.getElementById("modelDataFileName");
const manualFileName = document.getElementById("manualFileName");
const currentFiles = document.getElementById("currentFiles");
const clearFormBtn = document.getElementById("clearFormBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const submitBtn = document.getElementById("submitBtn");

const statusText = document.getElementById("statusText");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const messageBox = document.getElementById("messageBox");

const vehicleTableBody = document.getElementById("vehicleTableBody");
const emptyState = document.getElementById("emptyState");
const vehicleSearch = document.getElementById("vehicleSearch");

const ordersTableBody = document.getElementById("ordersTableBody");
const ordersEmptyState = document.getElementById("ordersEmptyState");
const orderSearch = document.getElementById("orderSearch");
const orderStatusFilter = document.getElementById("orderStatusFilter");
const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");
const pendingOrderCount = document.getElementById("pendingOrderCount");
const approvedOrderCount = document.getElementById("approvedOrderCount");
const rejectedOrderCount = document.getElementById("rejectedOrderCount");
const completedOrderCount = document.getElementById("completedOrderCount");

function removeInternalRegionOptions() {
  if (!regionInput) return;
  Array.from(regionInput.options).forEach((option) => {
    if (String(option.value || "").trim().toLowerCase() === "multiple") {
      option.remove();
    }
  });
}

removeInternalRegionOptions();

let currentUser = null;
let vehicles = [];
let orders = [];
let editingId = null;
let editingVehicle = null;

const verifiedAdmin = await requireAdmin();
currentUser = verifiedAdmin;
adminEmail.textContent = verifiedAdmin.email || ADMIN_EMAIL;
if (authOverlay) authOverlay.style.display = "none";
if (adminApp) adminApp.hidden = false;
await loadVehicles();
await loadOrders();

logoutBtn.addEventListener("click", async () => {
  try {
    await secureLogout();
  } catch (error) {
    showMessage("Logout failed. Try again.", "error");
    console.error(error);
  }
});

[carImageInput, modelFileInput, modelDataFileInput, manualFileInput].forEach((input) => {
  input.addEventListener("change", updateSelectedFileLabels);
});

seriesInput.addEventListener("change", toggleCustomSeriesField);
vehicleSearch.addEventListener("input", renderVehicles);
orderSearch?.addEventListener("input", renderOrders);
orderStatusFilter?.addEventListener("change", renderOrders);
refreshOrdersBtn?.addEventListener("click", loadOrders);
clearFormBtn.addEventListener("click", resetForm);
cancelEditBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const imageFile = carImageInput.files[0] || null;
  const modelFile = modelFileInput.files[0] || null;
  const modelDataFile = modelDataFileInput.files[0] || null;
  const manualFile = manualFileInput.files[0] || null;
  const series = getSelectedSeries();

  if (!vehicleNameInput.value.trim()) {
    showMessage("Vehicle name is required.", "error");
    return;
  }

  if (!series.value) {
    showMessage(seriesInput.value === "other" ? "Please enter the custom series name." : "Please select a series.", "error");
    return;
  }

  if (!editingId && (!imageFile || !modelFile || !modelDataFile || !manualFile)) {
    showMessage("For a new vehicle, image, model file, model data Excel/CSV and service manual are required.", "error");
    return;
  }

  if (!validateFile(imageFile, "image")) return;
  if (!validateFile(modelFile, "model")) return;
  if (!validateFile(modelDataFile, "modelData")) return;
  if (!validateFile(manualFile, "manual")) return;

  submitBtn.disabled = true;
  submitBtn.textContent = editingId ? "Saving..." : "Uploading...";
  showMessage("", "");
  setProgress("Preparing local upload...", 5);

  try {
    const formData = buildFormData(series, {
      imageFile,
      modelFile,
      modelDataFile,
      manualFile
    });

    const savedVehicle = await uploadVehicleForm(formData);

    setProgress("Completed", 100);
    showMessage(editingId ? "Vehicle saved locally and is now editable." : "Vehicle uploaded locally.", "success");
    resetForm(false);
    await loadVehicles();

    if (savedVehicle?.warning) {
      showMessage(savedVehicle.warning, "error");
    }
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Local upload failed. Start the local upload server and try again.", "error");
    setProgress("Failed", 0);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingId ? "Save Changes" : "Upload Vehicle";
  }
});

function buildFormData(series, files) {
  const formData = new FormData();
  const vehicleName = vehicleNameInput.value.trim();
  const generatedId = editingId || createVehicleIdFromName(vehicleName);

  formData.append("id", generatedId);
  formData.append("name", vehicleName);
  formData.append("vinNumber", vinNumberInput.value.trim());
  formData.append("variant", variantInput.value);
  formData.append("year", yearInput.value.trim());
  formData.append("region", regionInput.value);
  formData.append("type", typeInput.value);
  formData.append("series", series.value);
  formData.append("seriesLabel", series.label);
  formData.append("editingId", editingId || "");

  if (files.imageFile) formData.append("carImage", files.imageFile);
  if (files.modelFile) formData.append("modelFile", files.modelFile);
  if (files.modelDataFile) formData.append("modelDataFile", files.modelDataFile);
  if (files.manualFile) formData.append("manualFile", files.manualFile);

  return formData;
}

async function loadVehicles() {
  try {
    const response = await fetch(`${API_BASE}/vehicles`, {
      headers: await getAdminHeaders()
    });

    if (!response.ok) throw new Error("Could not load local vehicle list.");

    vehicles = await response.json();
    vehicles.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    renderVehicles();
    setProgress("Ready", 0);
  } catch (error) {
    console.error(error);
    vehicles = [];
    renderVehicles();
    showMessage("Local upload server not running. Start it with: npm run upload-server", "error");
  }
}

function renderVehicles() {
  const queryText = vehicleSearch.value.trim().toLowerCase();
  const filtered = vehicles.filter((vehicle) => {
    const text = [
      vehicle.id,
      vehicle.name,
      vehicle.vinNumber,
      vehicle.variant,
      vehicle.year,
      vehicle.region,
      vehicle.type,
      vehicle.series,
      vehicle.seriesLabel,
      vehicle.storageMode,
      vehicle.builtIn ? "built in default existing static card" : "uploaded local vehicle",
      vehicle.image?.name,
      vehicle.model?.name,
      vehicle.modelData?.name,
      vehicle.manual?.name
    ].join(" ").toLowerCase();

    return text.includes(queryText);
  });

  vehicleTableBody.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  filtered.forEach((vehicle) => {
    const isBuiltIn = isBuiltInVehicle(vehicle);
    const row = document.createElement("tr");
    if (isBuiltIn) row.classList.add("built-in-row");

    row.innerHTML = `
      <td>
        <div class="vehicle-cell">
          <img class="vehicle-thumb" src="${escapeAttr(vehicle.imageUrl || vehicle.image?.url || "/images/icon.svg")}" alt="${escapeAttr(vehicle.name || vehicle.id)}" />
          <div class="vehicle-meta">
            <strong>${escapeHtml(vehicle.name || "-")}</strong>
            <span class="vehicle-source ${isBuiltIn ? "built-in" : "uploaded"}">${isBuiltIn ? "Existing card" : "Uploaded"}</span>
          </div>
        </div>
      </td>
      <td>${escapeHtml(vehicle.vinNumber || "-")}</td>
      <td>${escapeHtml(formatTitle(vehicle.variant || "-"))}</td>
      <td>${escapeHtml(String(vehicle.year || "-"))}</td>
      <td>${escapeHtml(displayRegion(vehicle.region))}</td>
      <td>${escapeHtml(formatTitle(vehicle.type || "-"))}</td>
      <td><span class="badge">${escapeHtml(vehicle.seriesLabel || formatSeriesLabel(vehicle.series) || "-")}</span></td>
      <td>${buildFileLinks(vehicle)}</td>
      <td>
        <div class="action-buttons">
          ${isBuiltIn
            ? `<button class="table-btn edit-btn convert-btn" data-action="edit" data-id="${escapeAttr(vehicle.id)}" type="button" title="Save this existing card once to convert it into an editable database record.">Edit</button>`
            : `<button class="table-btn edit-btn" data-action="edit" data-id="${escapeAttr(vehicle.id)}" type="button">Edit</button>
               <button class="table-btn delete-btn" data-action="delete" data-id="${escapeAttr(vehicle.id)}" type="button">Delete</button>`}
        </div>
      </td>
    `;

    vehicleTableBody.appendChild(row);
  });
}

function isBuiltInVehicle(vehicle) {
  return Boolean(vehicle?.builtIn || vehicle?.readOnly || vehicle?.storageMode === "built-in");
}

vehicleTableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const vehicle = vehicles.find((item) => item.id === id);
  if (!vehicle) return;

  if (button.dataset.action === "edit") {
    startEdit(vehicle);
    return;
  }

  if (button.dataset.action === "delete") {
    if (isBuiltInVehicle(vehicle)) {
      showMessage("Existing cards cannot be deleted. Edit and save once to create a database override.", "error");
      return;
    }
    await deleteVehicle(vehicle);
  }
});

async function loadOrders() {
  if (!ordersTableBody) return;

  try {
    const response = await fetch(`${API_BASE}/orders`, {
      headers: await getAdminHeaders(),
      cache: "no-store"
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not load orders.");
    }

    orders = await response.json();
    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    renderOrders();
  } catch (error) {
    console.error(error);
    orders = [];
    renderOrders();
    showMessage("Could not load orders. Start upload server and refresh.", "error");
  }
}

function renderOrders() {
  if (!ordersTableBody) return;

  updateOrderSummary();

  const queryText = (orderSearch?.value || "").trim().toLowerCase();
  const statusFilter = (orderStatusFilter?.value || "").trim().toLowerCase();

  const filtered = orders.filter((order) => {
    const text = [
      order.id,
      order.status,
      order.requestedBy,
      order.customer?.name,
      order.customer?.contact,
      order.customer?.notes,
      order.adminNote,
      ...(order.vehicleSummary || []),
      ...(order.items || []).flatMap((item) => [item.vehicleName, item.partName, item.partId])
    ].join(" ").toLowerCase();

    const statusMatch = !statusFilter || String(order.status || "").toLowerCase() === statusFilter;
    const searchMatch = !queryText || text.includes(queryText);
    return statusMatch && searchMatch;
  });

  ordersTableBody.innerHTML = "";
  ordersEmptyState.hidden = filtered.length > 0;

  filtered.forEach((order) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="order-id-block">
          <strong>${escapeHtml(order.id || "-")}</strong>
          <span>Updated: ${escapeHtml(formatDate(order.updatedAt))}</span>
        </div>
      </td>
      <td>
        <div class="order-requester">
          <strong>${escapeHtml(order.customer?.name || order.requestedBy || "-")}</strong>
          <span>${escapeHtml(order.customer?.contact || order.requestedBy || "-")}</span>
          ${order.customer?.notes ? `<em>${escapeHtml(order.customer.notes)}</em>` : ""}
        </div>
      </td>
      <td>${buildOrderItems(order)}</td>
      <td><strong>${escapeHtml(order.totalQty || 0)}</strong></td>
      <td>
        <span class="order-status ${escapeAttr(order.status || "pending")}">${escapeHtml(formatTitle(order.status || "pending"))}</span>
        ${order.adminNote ? `<div class="admin-note">${escapeHtml(order.adminNote)}</div>` : ""}
      </td>
      <td>${escapeHtml(formatDate(order.createdAt))}</td>
      <td>${buildOrderActions(order)}</td>
    `;

    ordersTableBody.appendChild(row);
  });
}

function buildOrderItems(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return "-";

  return `
    <div class="order-items-list">
      ${items.map((item) => `
        <div class="order-item-line">
          <strong>${escapeHtml(item.partName || "-")}</strong>
          <span>${escapeHtml(item.vehicleName || item.vehicleId || "Vehicle")} · Part ID: ${escapeHtml(item.partId || "-")} · Qty: ${escapeHtml(item.qty || 1)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function buildOrderActions(order) {
  const status = String(order.status || "pending").toLowerCase();
  const id = escapeAttr(order.id || "");
  const buttons = [];

  if (status === "pending") {
    buttons.push(`<button class="table-btn approve-btn" data-order-action="approved" data-order-id="${id}" type="button">Approve</button>`);
    buttons.push(`<button class="table-btn reject-btn" data-order-action="rejected" data-order-id="${id}" type="button">Reject</button>`);
  }

  if (status === "approved") {
    buttons.push(`<button class="table-btn complete-btn" data-order-action="completed" data-order-id="${id}" type="button">Complete</button>`);
  }

  buttons.push(`<button class="table-btn delete-btn" data-order-action="delete" data-order-id="${id}" type="button">Delete</button>`);

  return `<div class="action-buttons order-action-buttons">${buttons.join("")}</div>`;
}

ordersTableBody?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-order-action]");
  if (!button) return;

  const orderId = button.dataset.orderId;
  const action = button.dataset.orderAction;
  if (!orderId || !action) return;

  if (action === "delete") {
    await deleteOrder(orderId);
    return;
  }

  let note = "";
  if (action === "rejected") {
    note = prompt("Reason for rejecting this order?") || "";
  } else if (action === "approved") {
    note = prompt("Approval note, optional:") || "";
  } else if (action === "completed") {
    note = prompt("Completion note, optional:") || "";
  }

  await updateOrderStatus(orderId, action, note);
});

async function updateOrderStatus(orderId, status, adminNote = "") {
  try {
    const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: {
        ...(await getAdminHeaders()),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status, adminNote })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Order update failed.");

    orders = orders.map((order) => order.id === data.id ? data : order);
    renderOrders();
    showMessage(`Order ${formatTitle(status)}.`, "success");
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Order update failed.", "error");
  }
}

async function deleteOrder(orderId) {
  const ok = confirm(`Delete order ${orderId}?`);
  if (!ok) return;

  try {
    const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}`, {
      method: "DELETE",
      headers: await getAdminHeaders()
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Order delete failed.");

    orders = orders.filter((order) => order.id !== orderId);
    renderOrders();
    showMessage("Order deleted.", "success");
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Order delete failed.", "error");
  }
}

function updateOrderSummary() {
  const counts = orders.reduce((acc, order) => {
    const status = String(order.status || "pending").toLowerCase();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  if (pendingOrderCount) pendingOrderCount.textContent = String(counts.pending || 0);
  if (approvedOrderCount) approvedOrderCount.textContent = String(counts.approved || 0);
  if (rejectedOrderCount) rejectedOrderCount.textContent = String(counts.rejected || 0);
  if (completedOrderCount) completedOrderCount.textContent = String(counts.completed || 0);
}


function isInternalMultipleRegion(value) {
  return String(value || "").trim().toLowerCase() === "multiple";
}

function displayRegion(value) {
  return isInternalMultipleRegion(value) ? "All Regions" : formatTitle(value || "-");
}

function editRegionValue(value) {
  return isInternalMultipleRegion(value) ? "" : String(value || "").trim();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}


function startEdit(vehicle) {
  editingId = vehicle.id;
  editingVehicle = vehicle;
  const isBuiltIn = isBuiltInVehicle(vehicle);

  formTitle.textContent = isBuiltIn ? "Edit Existing Card" : "Edit Vehicle";
  submitBtn.textContent = isBuiltIn ? "Save as Editable" : "Save Changes";
  cancelEditBtn.hidden = false;

  vehicleIdInput.value = vehicle.id || "";
  vehicleNameInput.value = vehicle.name || "";
  vinNumberInput.value = vehicle.vinNumber || "";
  variantInput.value = vehicle.variant || "";
  yearInput.value = vehicle.year || "";
  const editableRegion = editRegionValue(vehicle.region);
  ensureSelectOption(regionInput, editableRegion, displayRegion(editableRegion));
  ensureSelectOption(typeInput, vehicle.type, formatTitle(vehicle.type || ""));
  regionInput.value = editableRegion;
  typeInput.value = vehicle.type || "";

  const seriesValue = String(vehicle.series || "").toLowerCase();
  if (STANDARD_SERIES.has(seriesValue)) {
    seriesInput.value = seriesValue;
    customSeriesInput.value = "";
  } else if (seriesValue) {
    seriesInput.value = "other";
    customSeriesInput.value = vehicle.seriesLabel || vehicle.series || "";
  } else {
    seriesInput.value = "";
    customSeriesInput.value = "";
  }
  toggleCustomSeriesField();

  carImageInput.value = "";
  modelFileInput.value = "";
  modelDataFileInput.value = "";
  manualFileInput.value = "";
  updateSelectedFileLabels();
  renderCurrentFiles(vehicle);

  setProgress(isBuiltIn ? "Converting existing card" : "Editing mode", 0);
  showMessage(
    isBuiltIn
      ? "Existing card edit mode: save once to create an editable database record. If Region is blank, choose the correct region before saving. Choose new files only if you want to replace existing files."
      : "Editing mode: choose new files only when you want to replace old files.",
    "success"
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function ensureSelectOption(select, value, label) {
  const safeValue = String(value || "").trim();
  if (!select || !safeValue || isInternalMultipleRegion(safeValue)) return;
  const exists = Array.from(select.options).some((option) => option.value === safeValue);
  if (exists) return;
  const option = document.createElement("option");
  option.value = safeValue;
  option.textContent = label || formatTitle(safeValue);
  select.appendChild(option);
}

async function deleteVehicle(vehicle) {
  const ok = confirm(`Delete ${vehicle.name || vehicle.id}? This removes local metadata and uploaded local files.`);
  if (!ok) return;

  try {
    const response = await fetch(`${API_BASE}/vehicles/${encodeURIComponent(vehicle.id)}`, {
      method: "DELETE",
      headers: await getAdminHeaders()
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Delete failed.");
    }

    showMessage("Vehicle deleted locally.", "success");
    if (editingId === vehicle.id) resetForm();
    await loadVehicles();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Delete failed.", "error");
  }
}

function renderCurrentFiles(vehicle) {
  const links = [];
  if (vehicle.imageUrl || vehicle.image?.url) links.push(`<div>Image: <a href="${escapeAttr(vehicle.imageUrl || vehicle.image.url)}" target="_blank" rel="noreferrer">View current file</a></div>`);
  if (vehicle.modelUrl || vehicle.model?.url) links.push(`<div>Model: <a href="${escapeAttr(vehicle.modelUrl || vehicle.model.url)}" target="_blank" rel="noreferrer">View current file</a></div>`);
  if (vehicle.modelDataUrl || vehicle.modelData?.url) links.push(`<div>Model Data: <a href="${escapeAttr(vehicle.modelDataUrl || vehicle.modelData.url)}" target="_blank" rel="noreferrer">View current file</a></div>`);
  if (vehicle.manualUrl || vehicle.manual?.url) links.push(`<div>Manual: <a href="${escapeAttr(vehicle.manualUrl || vehicle.manual.url)}" target="_blank" rel="noreferrer">View current file</a></div>`);

  currentFiles.innerHTML = links.length ? links.join("") : "No files uploaded yet.";
  currentFiles.hidden = false;
}

function buildFileLinks(vehicle) {
  const links = [];
  const imageUrl = vehicle.imageUrl || vehicle.image?.url;
  const modelUrl = vehicle.modelUrl || vehicle.model?.url;
  const modelDataUrl = vehicle.modelDataUrl || vehicle.modelData?.url;
  const manualUrl = vehicle.manualUrl || vehicle.manual?.url;

  if (imageUrl) links.push(`<a href="${escapeAttr(imageUrl)}" target="_blank" rel="noreferrer">Image</a>`);
  if (modelUrl) links.push(`<a href="${escapeAttr(modelUrl)}" target="_blank" rel="noreferrer">Model</a>`);
  if (modelDataUrl) links.push(`<a href="${escapeAttr(modelDataUrl)}" target="_blank" rel="noreferrer">Model Data</a>`);
  if (manualUrl) links.push(`<a href="${escapeAttr(manualUrl)}" target="_blank" rel="noreferrer">Manual</a>`);

  return `<div class="file-links">${links.length ? links.join("") : "-"}</div>`;
}

function uploadVehicleForm(formData) {
  return new Promise(async (resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", `${API_BASE}/vehicles`, true);

    const token = await currentUser.getIdToken().catch(() => "");
    xhr.setRequestHeader("X-Admin-Email", currentUser.email || ADMIN_EMAIL);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 80) + 10;
      setProgress(`Uploading local files: ${Math.min(percent, 90)}%`, Math.min(percent, 90));
    });

    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(data.error || "Upload failed."));
          return;
        }
        resolve(data);
      } catch (error) {
        reject(new Error("Server returned an invalid response."));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Cannot reach local upload server. Start it with: npm run upload-server"));
    });

    xhr.send(formData);
  });
}

async function getAdminHeaders() {
  const headers = {
    "X-Admin-Email": currentUser?.email || ADMIN_EMAIL
  };

  const token = await currentUser?.getIdToken?.().catch(() => "");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function resetForm(clearMessage = true) {
  editingId = null;
  editingVehicle = null;
  form.reset();
  vehicleIdInput.value = "";
  customSeriesInput.value = "";
  toggleCustomSeriesField();
  formTitle.textContent = "Upload New Vehicle";
  submitBtn.textContent = "Upload Vehicle";
  cancelEditBtn.hidden = true;
  currentFiles.hidden = true;
  currentFiles.innerHTML = "";
  updateSelectedFileLabels();
  setProgress("Ready", 0);
  if (clearMessage) showMessage("", "");
}

function updateSelectedFileLabels() {
  carImageName.textContent = carImageInput.files[0]?.name || "No file selected";
  modelFileName.textContent = modelFileInput.files[0]?.name || "No file selected";
  modelDataFileName.textContent = modelDataFileInput.files[0]?.name || "No file selected";
  manualFileName.textContent = manualFileInput.files[0]?.name || "No file selected";
}

function toggleCustomSeriesField() {
  const isOther = seriesInput.value === "other";
  customSeriesInput.hidden = !isOther;
  customSeriesInput.required = isOther;
  if (isOther) {
    customSeriesInput.focus();
  } else {
    customSeriesInput.value = "";
  }
}

function getSelectedSeries() {
  if (seriesInput.value === "other") {
    const label = customSeriesInput.value.trim();
    return {
      value: normalizeSeriesValue(label),
      label
    };
  }

  const option = seriesInput.selectedOptions[0];
  return {
    value: seriesInput.value,
    label: option && option.value ? option.textContent.trim() : ""
  };
}


function createVehicleIdFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function validateFile(file, type) {
  if (!file) return true;

  const extension = getExtension(file.name);
  if (!allowedExtensions[type].includes(extension)) {
    showMessage(`Invalid ${type} file. Allowed: ${allowedExtensions[type].join(", ")}`, "error");
    return false;
  }

  return true;
}

function getExtension(fileName) {
  return String(fileName || "").split(".").pop().toLowerCase();
}

function normalizeSeriesValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatSeriesLabel(value) {
  if (!value) return "";
  if (STANDARD_SERIES.has(String(value).toLowerCase())) {
    return `${String(value).toUpperCase()} Series`;
  }
  return formatTitle(String(value).replace(/_/g, " "));
}

function formatTitle(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function setProgress(text, percent) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  statusText.textContent = text;
  progressPercent.textContent = `${safePercent}%`;
  progressFill.style.width = `${safePercent}%`;
}

function showMessage(message, type) {
  messageBox.textContent = message;
  messageBox.className = "message-box";
  if (type) messageBox.classList.add(type);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
