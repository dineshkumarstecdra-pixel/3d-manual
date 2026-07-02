import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { getVehicleById, writeSelectedVehicleData } from "./vehicleService.js";

const vehicleId = localStorage.getItem("selectedVehicle");
let currentVehicle = null;

const VIN_HEADER_KEYS = new Set([
  "vin",
  "vinnumber",
  "vehiclenumber",
  "vehicleidentificationnumber",
  "chassisnumber",
  "serialnumber"
]);

const SERIAL_HEADER_KEYS = new Set([
  "sino",
  "sno",
  "serialno",
  "serialnumber",
  "slno",
  "sl"
]);

const PRODUCTION_DATE_KEYS = new Set([
  "productiondate",
  "mfgdate",
  "manufacturingdate",
  "builddate"
]);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  document.documentElement.classList.remove("auth-checking");

  if (!vehicleId) {
    window.location.replace("home.html");
    return;
  }

  currentVehicle = await getVehicleById(vehicleId);
  if (!currentVehicle) {
    alert("Vehicle details not found. Please select the vehicle again.");
    window.location.replace("home.html");
    return;
  }

  writeSelectedVehicleData(currentVehicle);
  renderVehicleDetails(currentVehicle);
});

function renderVehicleDetails(vehicle) {
  setText("carName", vehicle.name);
  setText("carDesc", generateDescription(vehicle));

  const img = document.getElementById("carImg");
  if (img) {
    img.src = vehicle.imageUrl || `/images/vehicles/${vehicle.id}.png`;
    img.alt = vehicle.name;
    img.onerror = () => {
      img.onerror = null;
      img.src = `/images/vehicles/${vehicle.id}.png`;
    };
  }

  renderSpecGrid(vehicle);
}

function renderSpecGrid(vehicle) {
  const specs = document.querySelector(".specs");
  if (!specs) return;

  const rows = buildDetailRows(vehicle);
  if (!rows.length) {
    specs.innerHTML = `<div class="spec"><span>Details</span><p>No details available.</p></div>`;
    return;
  }

  specs.innerHTML = rows.map(({ label, value }) => `
    <div class="spec">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(value || "—")}</p>
    </div>
  `).join("");
}

function buildDetailRows(vehicle) {
  const selectedVin = String(vehicle.selectedVinNumber || "").trim();
  const rawRows = Array.isArray(vehicle.rawRows) ? vehicle.rawRows : [];
  const groupFields = vehicle.groupFields && typeof vehicle.groupFields === "object" ? vehicle.groupFields : {};
  const selectedRow = selectedVin ? findRowByVin(rawRows, selectedVin) : null;

  const headers = collectHeaders(vehicle, selectedRow, groupFields);
  const details = [];

  for (const header of headers) {
    const key = normalizeHeader(header);
    if (!key || isSerialHeader(key)) continue;

    // VIN should show only when user searched/opened by VIN.
    if (isVinHeader(key) && !selectedVin) continue;

    let value = "";
    if (selectedRow) {
      value = readHeaderValue(selectedRow, header);
    } else if (isProductionDateHeader(key)) {
      value = aggregateHeaderValues(rawRows, header);
    } else {
      value = readHeaderValue(groupFields, header) || aggregateHeaderValues(rawRows, header, { onlyIfSame: true });
    }

    if (!value) continue;
    details.push({ label: formatLabel(header), value });
  }

  if (!details.length) {
    return fallbackDetails(vehicle, selectedVin);
  }

  return details;
}

function collectHeaders(vehicle, selectedRow, groupFields) {
  const ordered = [];
  const add = (value) => {
    const text = String(value || "").trim();
    if (!text) return;
    const key = normalizeHeader(text);
    if (!key) return;
    if (ordered.some((item) => normalizeHeader(item) === key)) return;
    ordered.push(text);
  };

  (Array.isArray(vehicle.sheetHeaders) ? vehicle.sheetHeaders : []).forEach(add);
  Object.keys(selectedRow || {}).forEach(add);
  Object.keys(groupFields || {}).forEach(add);

  if (!ordered.length) {
    ["MODEL", "SERIES", "VARIANT NAME", "VARIENT TYPE", "BODY TYPE", "MODEL YEAR", "REGION", "FUEL TYPE", "TRANSMISSION", "ENGINE", "EMISSION"].forEach(add);
  }

  return ordered;
}

function findRowByVin(rows, selectedVin) {
  const target = String(selectedVin || "").trim().toLowerCase();
  if (!target) return null;

  return rows.find((row) => {
    const vinValue = findVinValue(row);
    return String(vinValue || "").trim().toLowerCase() === target;
  }) || rows.find((row) => {
    const vinValue = findVinValue(row);
    return String(vinValue || "").trim().toLowerCase().includes(target);
  }) || null;
}

function findVinValue(row = {}) {
  for (const [key, value] of Object.entries(row || {})) {
    if (isVinHeader(normalizeHeader(key))) return value;
  }
  return "";
}

function readHeaderValue(obj = {}, header) {
  if (!obj || typeof obj !== "object") return "";
  if (Object.prototype.hasOwnProperty.call(obj, header)) return formatValue(obj[header]);

  const target = normalizeHeader(header);
  const matchedKey = Object.keys(obj).find((key) => normalizeHeader(key) === target);
  return matchedKey ? formatValue(obj[matchedKey]) : "";
}

function aggregateHeaderValues(rows, header, options = {}) {
  const values = [];
  const seen = new Set();
  for (const row of rows) {
    const value = readHeaderValue(row, header);
    const key = String(value || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }

  if (options.onlyIfSame && values.length > 1) return "";
  if (!values.length) return "";
  if (values.length <= 4) return values.join(", ");
  return `${values.slice(0, 4).join(", ")} +${values.length - 4} more`;
}

function fallbackDetails(vehicle, selectedVin) {
  const rows = [];
  if (selectedVin) rows.push({ label: "VIN Number", value: selectedVin });
  if (vehicle.modelName) rows.push({ label: "MODEL", value: vehicle.modelName });
  if (vehicle.seriesLabel || vehicle.series) rows.push({ label: "SERIES", value: vehicle.seriesLabel || vehicle.series });
  if (vehicle.variantName) rows.push({ label: "VARIANT NAME", value: vehicle.variantName });
  if (vehicle.variantType) rows.push({ label: "VARIENT TYPE", value: vehicle.variantType });
  if (vehicle.bodyTypeLabel || vehicle.bodyType || vehicle.type) rows.push({ label: "BODY TYPE", value: vehicle.bodyTypeLabel || vehicle.bodyType || vehicle.type });
  if (vehicle.year) rows.push({ label: "MODEL YEAR", value: String(vehicle.year) });
  if (vehicle.region) rows.push({ label: "REGION", value: capitalize(vehicle.region) });
  if (vehicle.fuelType) rows.push({ label: "FUEL TYPE", value: vehicle.fuelType });
  if (vehicle.transmission) rows.push({ label: "TRANSMISSION", value: vehicle.transmission });
  if (vehicle.engine) rows.push({ label: "ENGINE", value: vehicle.engine });
  if (vehicle.emission) rows.push({ label: "EMISSION", value: vehicle.emission });
  return rows;
}

function generateDescription(vehicle) {
  const bits = [vehicle.name];
  if (vehicle.year) bits.push(`${vehicle.year}`);
  if (vehicle.region && vehicle.region !== "multiple") bits.push(`${capitalize(vehicle.region)} region`);

  const selectedVin = String(vehicle.selectedVinNumber || "").trim();
  if (selectedVin) bits.push(`VIN ${selectedVin}`);

  return `${bits.join(" · ")} vehicle details are loaded dynamically from the uploaded Excel sheet and linked files.`;
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isVinHeader(key) {
  return VIN_HEADER_KEYS.has(key) || key.includes("vehicleidentificationnumber") || key === "vinno";
}

function isSerialHeader(key) {
  return SERIAL_HEADER_KEYS.has(key) || key === "sino" || key === "slno";
}

function isProductionDateHeader(key) {
  return PRODUCTION_DATE_KEYS.has(key);
}

function formatLabel(label) {
  const text = String(label || "").trim();
  if (!text) return "Detail";
  const key = normalizeHeader(text);
  if (key === "vehiclenidentificationnumber" || isVinHeader(key)) return "VIN Number";
  return text;
}

function formatValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value || "";
}

function capitalize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openManual() {
  if (!currentVehicle) return;
  window.open(currentVehicle.manualUrl || `/manuals/${currentVehicle.id}.pdf`, "_blank");
}

function openParts() {
  if (!currentVehicle) return;
  writeSelectedVehicleData(currentVehicle);
  window.location.href = "/index.html";
}

window.openManual = openManual;
window.openParts = openParts;
