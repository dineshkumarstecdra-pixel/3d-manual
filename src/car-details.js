import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  getVehicleById,
  writeSelectedVehicleData,
  getVehicleDisplayName,
  getVehicleImageUrl,
  VEHICLE_PLACEHOLDER_IMAGE
} from "./vehicleService.js";

const vehicleId = localStorage.getItem("selectedVehicle");
let currentVehicle = null;

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
  const displayName = getVehicleDisplayName(vehicle);

  setText("carName", displayName);
  setText("carDesc", generateDescription(vehicle, displayName));

  const img = document.getElementById("carImg");
  if (img) {
    img.src = getVehicleImageUrl(vehicle);
    img.alt = displayName;
    img.onerror = () => {
      img.onerror = null;
      img.src = VEHICLE_PLACEHOLDER_IMAGE;
    };
  }

  renderDetailCards(vehicle);
}

function renderDetailCards(vehicle) {
  const specs = document.querySelector(".specs");
  if (!specs) return;

  const rows = buildDetailRows(vehicle);

  specs.innerHTML = rows.map(([label, value]) => `
    <div class="spec">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(formatDisplayValue(value))}</p>
    </div>
  `).join("");
}

function buildDetailRows(vehicle) {
  const selectedVin = String(vehicle.selectedVinNumber || "").trim();
  const selectedRow = selectedVin ? findRowByVin(vehicle, selectedVin) : null;

  const rows = [];

  if (selectedVin) {
    rows.push(["VIN Number", selectedVin]);
  }

  rows.push(
    ["Model", readValue(vehicle, selectedRow, ["MODEL", "MODEL NAME", "VEHICLE MODEL"], vehicle.modelName)],
    ["Series", readValue(vehicle, selectedRow, ["SERIES"], vehicle.seriesLabel || vehicle.series)],
    ["Variant", readValue(vehicle, selectedRow, ["VARIANT NAME", "VARIENT NAME", "VARIANT"], vehicle.variantName || vehicle.variantType || vehicle.variant)],
    ["Body Type", readValue(vehicle, selectedRow, ["BODY TYPE", "TYPE"], vehicle.bodyTypeLabel || vehicle.bodyType || vehicle.type)],
    ["Model Year", readValue(vehicle, selectedRow, ["MODEL YEAR", "YEAR"], vehicle.year)],
    ["Region", readValue(vehicle, selectedRow, ["REGION"], vehicle.region)],
    ["Fuel Type", readValue(vehicle, selectedRow, ["FUEL TYPE"], vehicle.fuelType)],
    ["Transmission", readValue(vehicle, selectedRow, ["TRANSMISSION"], vehicle.transmission)],
    ["Engine", readValue(vehicle, selectedRow, ["ENGINE"], vehicle.engine)],
    ["Emission", readValue(vehicle, selectedRow, ["EMISSION"], vehicle.emission)],
    ["Production Date", readValue(vehicle, selectedRow, ["PRODUCTION DATE", "Production Date"], vehicle.productionDate)]
  );

  return rows.filter(([, value]) => textValue(value));
}

function readValue(vehicle, selectedRow, aliases, fallback = "") {
  return firstTextValue(
    fieldValue(selectedRow, aliases),
    fieldValue(vehicle.groupFields, aliases),
    fieldValue(vehicle.normalizedGroupFields, aliases),
    fieldValue(Array.isArray(vehicle.rawRows) ? vehicle.rawRows[0] : null, aliases),
    fieldValue(Array.isArray(vehicle.normalizedRows) ? vehicle.normalizedRows[0] : null, aliases),
    fallback
  );
}

function findRowByVin(vehicle, vin) {
  const needle = normalizeText(vin);
  const rows = Array.isArray(vehicle.rawRows) ? vehicle.rawRows : [];

  return rows.find((row) => {
    const values = [
      fieldValue(row, ["VEHICLE IDENTIFICATION NUMBER", "VIN", "VIN NUMBER", "CHASSIS NUMBER", "SERIAL NUMBER"]),
      ...Object.values(row || {})
    ];

    return values.some((value) => normalizeText(value) === needle);
  }) || null;
}

function fieldValue(source, aliases) {
  if (!source || typeof source !== "object") return "";

  for (const alias of aliases) {
    const wanted = normalizeFieldKey(alias);
    const foundKey = Object.keys(source).find((key) => normalizeFieldKey(key) === wanted);
    if (!foundKey) continue;

    const value = textValue(source[foundKey]);
    if (value) return value;
  }

  return "";
}

function firstTextValue(...values) {
  for (const value of values) {
    const text = textValue(value);
    if (text) return text;
  }
  return "";
}

function textValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return String(value).trim();
}

function normalizeFieldKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDisplayValue(value) {
  const text = textValue(value);
  const id = text.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (id === "base") return "Base";
  if (id === "plus") return "Plus";

  return text
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bBmw\b/g, "BMW")
    .replace(/\bAudi\b/g, "Audi")
    .replace(/\bVin\b/g, "VIN")
    .replace(/\bSuv\b/g, "SUV")
    .replace(/\bBs\b/g, "BS")
    .replace(/\bBs6\b/g, "BS6")
    .replace(/\bEv\b/g, "EV");
}

function generateDescription(vehicle, displayName) {
  const bits = [displayName];

  if (vehicle.year) bits.push(`${vehicle.year}`);
  if (vehicle.region && !["multiple", "all", "global"].includes(String(vehicle.region).toLowerCase())) {
    bits.push(`${formatDisplayValue(vehicle.region)} region`);
  }

  return `${bits.join(" · ")} vehicle details are loaded dynamically from the uploaded Excel sheet and linked files.`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
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
