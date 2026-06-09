const UPLOAD_SERVER = "https://threed-manual.onrender.com";

export const BUILT_IN_VEHICLES = [
  builtInVehicle("bmw_m3", "BMW M3", "coupe", "m", "M", 2022),
  builtInVehicle("audi_rs7", "Audi RS7", "sedan", "r", "R", 2021),
  builtInVehicle("audi_r8", "Audi R8", "sedan", "r", "R", 2021),
  builtInVehicle("bmw_m4", "BMW M4", "coupe", "m", "M", 2021),
  builtInVehicle("bmw_z4", "BMW Z4 M40I", "sedan", "z", "Z", 2020),
  builtInVehicle("bmw_ms", "BMW M SPORT", "coupe", "m", "M", 2020),
  builtInVehicle("bmw_m8", "BMW M8", "coupe", "m", "M", 2020),
  builtInVehicle("bmw_ix", "BMW IX", "suv", "i", "I", 2020),
  builtInVehicle("bmw_i5", "BMW I5", "suv", "i", "I", 2020),
  builtInVehicle("bmw_i7", "BMW I7", "suv", "i", "I", 2020),
  builtInVehicle("bmw_x3", "BMW X3", "suv", "x", "X", 2020),
  builtInVehicle("bmw_xm", "BMW XM", "suv", "x", "X", 2020)
];

function builtInVehicle(id, name, type, series, seriesLabel, year) {
  return normalizeVehicle({
    id,
    name,
    vinNumber: "",
    variant: "base",
    year,
    region: "multiple",
    type,
    series,
    seriesLabel,
    imageUrl: `/images/vehicles/${id}.png`,
    modelUrl: `/models/${id}.glb`,
    modelDataUrl: "/Parts Details/Parts data.xlsx",
    manualUrl: `/manuals/${id}.pdf`,
    builtIn: true,
    storageMode: "built-in"
  });
}

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const GLOBAL_REGION_VALUES = new Set(["multiple", "all", "global"]);

export function isGlobalRegion(region) {
  return GLOBAL_REGION_VALUES.has(normalizeId(region));
}

export function matchesVehicleRegion(vehicle, selectedRegion) {
  const selected = normalizeId(selectedRegion);
  if (!selected) return true;

  const vehicleRegion = normalizeId(vehicle?.region);
  return vehicleRegion === selected;
}

export function formatVehicleName(idOrName) {
  const value = String(idOrName || "").trim();
  if (!value) return "Vehicle";
  return normalizeLabel(value);
}

export function formatSeriesLabel(series, seriesLabel = "") {
  const label = String(seriesLabel || "").trim();
  if (label) return label;
  const value = String(series || "").trim();
  if (!value) return "Other";
  if (value.length <= 2) return value.toUpperCase();
  return normalizeLabel(value);
}

export function normalizeVehicle(raw = {}) {
  const id = normalizeId(raw.id || raw.vehicleId || raw.name);
  const name = String(raw.name || raw.vehicleName || formatVehicleName(id)).trim();
  const series = normalizeId(raw.series || raw.seriesLabel || "other") || "other";
  const seriesLabel = String(raw.seriesLabel || formatSeriesLabel(series)).trim();
  const type = normalizeId(raw.type || "other") || "other";
  const region = normalizeId(raw.region || "multiple") || "multiple";
  const year = Number.parseInt(raw.year, 10) || "";
  const variant = normalizeId(raw.variant || "base") || "base";

  return {
    ...raw,
    id,
    name,
    vinNumber: String(raw.vinNumber || raw.vin || "").trim(),
    variant,
    year,
    region,
    type,
    series,
    seriesLabel,
    imageUrl: raw.imageUrl || raw.image?.url || `/images/vehicles/${id}.png`,
    modelUrl: raw.modelUrl || raw.model?.url || `/models/${id}.glb`,
    modelDataUrl: raw.modelDataUrl || raw.modelData?.url || "/Parts Details/Parts data.xlsx",
    manualUrl: raw.manualUrl || raw.manual?.url || `/manuals/${id}.pdf`,
    image: raw.image || null,
    model: raw.model || null,
    modelData: raw.modelData || null,
    manual: raw.manual || null,
    builtIn: Boolean(raw.builtIn),
    storageMode: raw.storageMode || (raw.builtIn ? "built-in" : "uploaded")
  };
}

export function mergeVehicles(uploaded = [], builtIns = BUILT_IN_VEHICLES) {
  const normalizedUploaded = (Array.isArray(uploaded) ? uploaded : [])
    .map(normalizeVehicle)
    .filter((vehicle) => vehicle.id);

  const uploadedIds = new Set(normalizedUploaded.map((vehicle) => vehicle.id));
  const missingBuiltIns = builtIns
    .map(normalizeVehicle)
    .filter((vehicle) => vehicle.id && !uploadedIds.has(vehicle.id));

  return [...normalizedUploaded, ...missingBuiltIns];
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

export async function fetchVehicles() {
  const cacheKey = Date.now();
  const sources = [
    `/api/vehicles/public?_=${cacheKey}`,
    `${UPLOAD_SERVER}/api/vehicles/public?_=${cacheKey}`,
    `${UPLOAD_SERVER}/database.json?_=${cacheKey}`,
    `/database.json?_=${cacheKey}`
  ];

  for (const url of sources) {
    try {
      const data = await fetchJson(url);
      if (Array.isArray(data)) {
        const fromPublicApi = url.includes("/api/vehicles/public");
        return fromPublicApi
          ? data.map(normalizeVehicle).filter((vehicle) => vehicle.id)
          : mergeVehicles(data);
      }
    } catch (error) {
      console.warn("Vehicle source failed:", url, error.message || error);
    }
  }

  return BUILT_IN_VEHICLES.map(normalizeVehicle);
}

export async function getVehicleById(vehicleId) {
  const id = normalizeId(vehicleId);
  const cached = readSelectedVehicleData();
  if (cached?.id === id) return normalizeVehicle(cached);

  const vehicles = await fetchVehicles();
  const vehicle = vehicles.find((item) => item.id === id) || null;
  if (vehicle) writeSelectedVehicleData(vehicle);
  return vehicle;
}

export function readSelectedVehicleData() {
  try {
    const raw = localStorage.getItem("selectedVehicleData");
    return raw ? normalizeVehicle(JSON.parse(raw)) : null;
  } catch {
    localStorage.removeItem("selectedVehicleData");
    return null;
  }
}

export function writeSelectedVehicleData(vehicle) {
  if (!vehicle?.id) return;
  localStorage.setItem("selectedVehicle", vehicle.id);
  localStorage.setItem("selectedVehicleData", JSON.stringify(normalizeVehicle(vehicle)));
}

export function uniqueSortedOptions(vehicles, key) {
  const map = new Map();
  vehicles.forEach((vehicle) => {
    const value = String(vehicle[key] || "").trim();
    if (!value) return;

    // Built-in/default vehicles use region="multiple" internally to mean
    // available in every region. It should not appear as a visible region filter.
    if (key === "region" && isGlobalRegion(value)) return;

    const label = key === "series" ? formatSeriesLabel(value, vehicle.seriesLabel) : normalizeLabel(value);
    if (!map.has(value)) map.set(value, label);
  });
  return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

export function vehicleYearText(vehicle) {
  return vehicle.year ? `${vehicle.year} Model` : "Vehicle";
}
