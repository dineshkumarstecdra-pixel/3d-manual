import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { mountPartsCartUI } from "./partsCart.js";
import {
  fetchVehicles,
  writeSelectedVehicleData,
  uniqueSortedOptions,
  matchesVehicleRegion,
  matchesVehicleVin,
  vehicleYearText
} from "./vehicleService.js";

const typeSelect = document.getElementById("typeSelect");
const seriesSelect = document.getElementById("modelSelect");
const variantTypeSelect = document.getElementById("variantTypeSelect");
const regionSelect = document.getElementById("regionSelect");
const vinSearchInput = document.getElementById("vinSearchInput");
const resetBtn = document.getElementById("resetFilter");
const grid = document.querySelector(".vehicle-grid");
const profileMenu = document.getElementById("profileMenu");
const logoutBtn = document.getElementById("logoutBtn");

let allVehicles = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }
  mountPartsCartUI({ hostSelector: ".header" });
  document.documentElement.classList.remove("auth-checking");
  await initVehicles();
});

async function initVehicles() {
  if (grid) grid.innerHTML = `<div class="vehicle-empty">Loading vehicles...</div>`;
  try {
    allVehicles = await fetchVehicles();
    hydrateDropdowns(allVehicles);
    renderVehicles(allVehicles);
  } catch (error) {
    console.error(error);
    if (grid) grid.innerHTML = `<div class="vehicle-empty">Unable to load vehicles. Start <strong>npm run upload-server</strong> and refresh.</div>`;
  }
}

function hydrateDropdowns(vehicles) {
  fillSelect(regionSelect, "", "All Regions", uniqueSortedOptions(vehicles, "region"));
  fillSelect(seriesSelect, "", "Select the Series", uniqueSortedOptions(vehicles, "series"));
  fillSelect(variantTypeSelect, "", "Select Variant Type", uniqueSortedOptions(vehicles, "variantType"));
  fillSelect(typeSelect, "", "Select Body Type", uniqueSortedOptions(vehicles, "bodyType"));
}

function fillSelect(select, emptyValue, emptyLabel, options) {
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `<option value="${emptyValue}">${emptyLabel}</option>`;
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === currentValue)) select.value = currentValue;
}

function getFilteredVehicles() {
  const region = regionSelect?.value || "";
  const type = typeSelect?.value || "";
  const series = seriesSelect?.value || "";
  const variantType = variantTypeSelect?.value || "";
  const vinQuery = vinSearchInput?.value || "";

  return allVehicles.filter((vehicle) => {
    const regionMatch = matchesVehicleRegion(vehicle, region);
    const typeMatch = !type || vehicle.bodyType === type || vehicle.type === type || vehicle.filterFields?.bodyType === type;
    const seriesMatch = !series || vehicle.series === series;
    const variantTypeMatch = !variantType || vehicle.filterFields?.variantType === variantType || vehicle.variantType === variantType;
    const vinMatch = matchesVehicleVin(vehicle, vinQuery);
    return regionMatch && typeMatch && seriesMatch && variantTypeMatch && vinMatch;
  });
}

function updateDependentDropdowns() {
  const region = regionSelect?.value || "";
  const type = typeSelect?.value || "";
  const series = seriesSelect?.value || "";
  const variantType = variantTypeSelect?.value || "";

  const regionVehicles = allVehicles.filter((vehicle) => matchesVehicleRegion(vehicle, region));
  const seriesVehicles = regionVehicles.filter((vehicle) => !type || vehicle.bodyType === type || vehicle.type === type || vehicle.filterFields?.bodyType === type);
  const variantVehicles = seriesVehicles.filter((vehicle) => !series || vehicle.series === series);

  const currentType = type;
  const currentSeries = series;
  const currentVariantType = variantType;

  fillSelect(seriesSelect, "", "Select the Series", uniqueSortedOptions(regionVehicles, "series"));
  if (currentSeries && [...seriesSelect.options].some((option) => option.value === currentSeries)) seriesSelect.value = currentSeries;

  fillSelect(variantTypeSelect, "", "Select Variant Type", uniqueSortedOptions(variantVehicles, "variantType"));
  if (currentVariantType && [...variantTypeSelect.options].some((option) => option.value === currentVariantType)) variantTypeSelect.value = currentVariantType;

  fillSelect(typeSelect, "", "Select Body Type", uniqueSortedOptions(regionVehicles, "bodyType"));
  if (currentType && [...typeSelect.options].some((option) => option.value === currentType)) typeSelect.value = currentType;
}

function renderVehicles(vehicles) {
  if (!grid) return;
  grid.innerHTML = "";

  if (!vehicles.length) {
    grid.innerHTML = `<div class="vehicle-empty">No vehicles match this filter.</div>`;
    return;
  }

  vehicles.forEach((vehicle) => {
    const card = document.createElement("div");
    card.className = "vehicle-card";
    card.dataset.type = vehicle.type;
    card.dataset.bodyType = vehicle.bodyType || vehicle.type;
    card.dataset.variantType = vehicle.filterFields?.variantType || vehicle.variantType || "";
    card.dataset.series = vehicle.series;
    card.dataset.region = vehicle.region;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open parts catalogue for ${vehicle.name}`);
    card.innerHTML = `
      <img src="${escapeAttr(vehicle.imageUrl)}" alt="${escapeAttr(vehicle.name)}" onerror="this.src='/images/vehicles/${escapeAttr(vehicle.id)}.png'">
      <div class="vehicle-info">
        <h3>${escapeHtml(vehicle.name)}</h3>
        <p>${escapeHtml(vehicleYearText(vehicle))}</p>
        <button type="button">Open</button>
      </div>
    `;

    card.addEventListener("click", () => openVehicle(vehicle));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openVehicle(vehicle);
      }
    });

    grid.appendChild(card);
  });
}

function applyFilters() {
  updateDependentDropdowns();
  renderVehicles(getFilteredVehicles());
}

function openVehicle(vehicle) {
  writeSelectedVehicleData(vehicle);
  window.location.href = "/index.html";
}

regionSelect?.addEventListener("change", () => {
  if (typeSelect) typeSelect.value = "";
  if (seriesSelect) seriesSelect.value = "";
  if (variantTypeSelect) variantTypeSelect.value = "";
  applyFilters();
});

typeSelect?.addEventListener("change", applyFilters);
seriesSelect?.addEventListener("change", applyFilters);
variantTypeSelect?.addEventListener("change", applyFilters);
vinSearchInput?.addEventListener("input", applyFilters);

resetBtn?.addEventListener("click", () => {
  if (regionSelect) regionSelect.value = "";
  if (typeSelect) typeSelect.value = "";
  if (seriesSelect) seriesSelect.value = "";
  if (variantTypeSelect) variantTypeSelect.value = "";
  if (vinSearchInput) vinSearchInput.value = "";
  hydrateDropdowns(allVehicles);
  renderVehicles(allVehicles);
});

profileMenu?.addEventListener("click", (event) => {
  event.stopPropagation();
  profileMenu.classList.toggle("active");
});

document.addEventListener("click", () => profileMenu?.classList.remove("active"));

logoutBtn?.addEventListener("click", async (event) => {
  event.stopPropagation();
  await signOut(auth);
  localStorage.removeItem("selectedVehicle");
  localStorage.removeItem("selectedVehicleData");
  window.location.href = "login.html";
});

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
