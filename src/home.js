import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  fetchVehicles,
  writeSelectedVehicleData,
  uniqueSortedOptions,
  matchesVehicleRegion,
  matchesVehicleVin,
  vehicleYearText,
  getVehicleDisplayName,
  getVehicleImageUrl,
  VEHICLE_PLACEHOLDER_IMAGE
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

  document.documentElement.classList.remove("auth-checking");
  await initVehicles();
});

async function initVehicles() {
  showLoadingCards();

  try {
    allVehicles = await fetchVehicles();
    hydrateDropdowns(allVehicles);
    renderVehicles(allVehicles);
  } catch (error) {
    console.error(error);
    if (grid) {
      grid.innerHTML = `<div class="vehicle-empty">Unable to load vehicles. Please refresh and try again.</div>`;
    }
  }
}

function showLoadingCards() {
  if (!grid) return;
  grid.innerHTML = `<div class="vehicle-empty">Loading vehicles...</div>`;
}

function hydrateDropdowns(vehicles) {
  fillSelect(regionSelect, "", "All Regions", uniqueSortedOptions(vehicles, "region"));
  fillSelect(seriesSelect, "", "Select the Series", uniqueSortedOptions(vehicles, "series"));
  fillSelect(variantTypeSelect, "", "Select Variant", uniqueSortedOptions(vehicles, "variantType"));
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

  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
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
    const variantTypeMatch = !variantType || vehicle.filterFields?.variantType === variantType || vehicle.variantType === variantType || vehicle.variant === variantType;
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

  fillSelect(seriesSelect, "", "Select the Series", uniqueSortedOptions(regionVehicles, "series"));
  if (series && [...seriesSelect.options].some((option) => option.value === series)) {
    seriesSelect.value = series;
  }

  fillSelect(variantTypeSelect, "", "Select Variant", uniqueSortedOptions(variantVehicles, "variantType"));
  if (variantType && [...variantTypeSelect.options].some((option) => option.value === variantType)) {
    variantTypeSelect.value = variantType;
  }

  fillSelect(typeSelect, "", "Select Body Type", uniqueSortedOptions(regionVehicles, "bodyType"));
  if (type && [...typeSelect.options].some((option) => option.value === type)) {
    typeSelect.value = type;
  }
}

function renderVehicles(vehicles) {
  if (!grid) return;

  grid.innerHTML = "";

  if (!vehicles.length) {
    grid.innerHTML = `<div class="vehicle-empty">No vehicles match this filter.</div>`;
    return;
  }

  vehicles.forEach((vehicle) => {
    const displayName = getVehicleDisplayName(vehicle);
    const imageUrl = getVehicleImageUrl(vehicle);

    const card = document.createElement("div");
    card.className = "vehicle-card";
    card.dataset.type = vehicle.type || "";
    card.dataset.bodyType = vehicle.bodyType || vehicle.type || "";
    card.dataset.variantType = vehicle.filterFields?.variantType || vehicle.variantType || vehicle.variant || "";
    card.dataset.series = vehicle.series || "";
    card.dataset.region = vehicle.region || "";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open ${displayName}`);

    card.innerHTML = `
      <img alt="${escapeAttr(displayName)}">
      <div class="vehicle-info">
        <h3>${escapeHtml(displayName)}</h3>
        <p>${escapeHtml(vehicleYearText(vehicle))}</p>
        <button type="button">Open</button>
      </div>
    `;

    const img = card.querySelector("img");
    if (img) {
      img.src = imageUrl;
      img.onerror = () => {
        img.onerror = null;
        img.src = VEHICLE_PLACEHOLDER_IMAGE;
      };
    }

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
  const selectedVinNumber = resolveSearchedVin(vehicle, vinSearchInput?.value || "");

  writeSelectedVehicleData({
    ...vehicle,
    selectedVinNumber
  });

  window.location.href = "/car-details.html";
}

function resolveSearchedVin(vehicle, query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return "";

  const vins = [
    vehicle.vinNumber,
    ...(Array.isArray(vehicle.vinNumbers) ? vehicle.vinNumbers : [])
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return vins.find((vin) => vin.toLowerCase() === text)
    || vins.find((vin) => vin.toLowerCase().includes(text))
    || "";
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
