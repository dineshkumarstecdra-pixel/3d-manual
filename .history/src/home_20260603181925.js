import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  fetchVehicles,
  writeSelectedVehicleData,
  uniqueSortedOptions,
  matchesVehicleRegion,
  vehicleYearText,
  formatSeriesLabel
} from "./vehicleService.js";

const typeSelect = document.getElementById("typeSelect");
const seriesSelect = document.getElementById("modelSelect");
const regionSelect = document.getElementById("regionSelect");
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
    if (grid) grid.innerHTML = `<div class="vehicle-empty">Unable to load vehicles. Start <strong>npm run upload-server</strong> and refresh.</div>`;
  }
}

function showLoadingCards() {
  if (!grid) return;
  grid.innerHTML = `<div class="vehicle-empty">Loading vehicles...</div>`;
}

function hydrateDropdowns(vehicles) {
  fillSelect(regionSelect, "", "All Regions", uniqueSortedOptions(vehicles, "region"));
  fillSelect(typeSelect, "", "Select the Type", uniqueSortedOptions(vehicles, "type"));
  fillSelect(seriesSelect, "", "Select the series", uniqueSortedOptions(vehicles, "series"));
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

  return allVehicles.filter((vehicle) => {
    const regionMatch = matchesVehicleRegion(vehicle, region);
    const typeMatch = !type || vehicle.type === type;
    const seriesMatch = !series || vehicle.series === series;
    return regionMatch && typeMatch && seriesMatch;
  });
}

function updateDependentDropdowns() {
  const region = regionSelect?.value || "";
  const type = typeSelect?.value || "";
  const regionVehicles = allVehicles.filter((vehicle) => matchesVehicleRegion(vehicle, region));
  const seriesVehicles = regionVehicles.filter((vehicle) => !type || vehicle.type === type);

  const currentType = typeSelect?.value || "";
  const currentSeries = seriesSelect?.value || "";

  fillSelect(typeSelect, "", "Select the Type", uniqueSortedOptions(regionVehicles, "type"));
  if (currentType && [...typeSelect.options].some((option) => option.value === currentType)) typeSelect.value = currentType;

  fillSelect(seriesSelect, "", "Select the series", uniqueSortedOptions(seriesVehicles, "series"));
  if (currentSeries && [...seriesSelect.options].some((option) => option.value === currentSeries)) seriesSelect.value = currentSeries;
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
    card.dataset.series = vehicle.series;
    card.dataset.region = vehicle.region;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open ${vehicle.name}`);
    card.innerHTML = `
      <img src="${escapeAttr(vehicle.imageUrl)}" alt="${escapeAttr(vehicle.name)}" onerror="this.src='/images/vehicles/${escapeAttr(vehicle.id)}.png'">
      <div class="vehicle-info">
        <h3>${escapeHtml(vehicle.name)}</h3>
        <p>${escapeHtml(vehicleYearText(vehicle))}${vehicle.variant ? ` · ${escapeHtml(capitalize(vehicle.variant))}` : ""}</p>
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
  window.location.href = "/car-details.html";
}

regionSelect?.addEventListener("change", () => {
  typeSelect.value = "";
  seriesSelect.value = "";
  applyFilters();
});

typeSelect?.addEventListener("change", () => {
  seriesSelect.value = "";
  applyFilters();
});

seriesSelect?.addEventListener("change", applyFilters);

resetBtn?.addEventListener("click", () => {
  if (regionSelect) regionSelect.value = "";
  if (typeSelect) typeSelect.value = "";
  if (seriesSelect) seriesSelect.value = "";
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

function capitalize(value) {
  return String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
