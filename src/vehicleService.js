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

export const VEHICLE_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" rx="28" fill="#eef1f6"/>
      <rect x="170" y="115" width="300" height="130" rx="20" fill="#ffffff" stroke="#d8dee9"/>
      <path d="M215 210h210l-35-55H250l-35 55Z" fill="#d8dee9"/>
      <circle cx="255" cy="225" r="24" fill="#c8d0dc"/>
      <circle cx="385" cy="225" r="24" fill="#c8d0dc"/>
      <text x="320" y="295" text-anchor="middle" font-family="Arial" font-size="24" fill="#667085">Vehicle image not available</text>
    </svg>
  `);

function builtInVehicle(id, name, type, series, seriesLabel, year) {
  return normalizeVehicle({
    id,
    name,
    vinNumber: "",
    vinNumbers: [],
    variant: "base",
    variantName: "Base",
    variantType: "Base",
    variantCode: "",
    year,
    region: "multiple",
    type,
    bodyType: type,
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

function normalizeFieldKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bBmw\b/g, "BMW")
    .replace(/\bAudi\b/g, "Audi")
    .replace(/\bVw\b/g, "VW")
    .replace(/\bVin\b/g, "VIN")
    .replace(/\bSuv\b/g, "SUV")
    .replace(/\bBs\b/g, "BS")
    .replace(/\bBs6\b/g, "BS6")
    .replace(/\bEv\b/g, "EV");
}

function textValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return String(value).trim();
}

function firstValue(...values) {
  for (const value of values) {
    const text = textValue(value);
    if (text) return text;
  }
  return "";
}

function fieldValue(raw = {}, aliases = []) {
  const keys = Array.isArray(aliases) ? aliases : [aliases];
  const sources = [
    raw.groupFields || {},
    raw.filterFields || {},
    raw.normalizedGroupFields || {},
    Array.isArray(raw.normalizedRows) ? raw.normalizedRows[0] || {} : {},
    Array.isArray(raw.rawRows) ? raw.rawRows[0] || {} : {},
    raw
  ];

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;

    for (const alias of keys) {
      const wanted = normalizeFieldKey(alias);
      const foundKey = Object.keys(source).find((key) => normalizeFieldKey(key) === wanted);
      if (!foundKey) continue;

      const value = textValue(source[foundKey]);
      if (value) return value;
    }
  }

  return "";
}

function splitNameTokens(raw = {}) {
  const source = firstValue(raw.name, raw.vehicleName, raw.id);
  return String(source || "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function guessFromName(raw = {}) {
  const tokens = splitNameTokens(raw);
  const lower = tokens.map((token) => token.toLowerCase());

  const variantIndex = lower.findIndex((token) => token === "base" || token === "plus");

  const modelName = tokens[0] || "";
  const seriesLabel = tokens[1] || "";

  const variantName = variantIndex >= 0 ? tokens[variantIndex] : "";
  const variantCode = variantIndex >= 0 ? tokens[variantIndex + 1] || "" : "";

  const fuelType = variantIndex >= 0 ? tokens[variantIndex + 2] || "" : "";
  const transmission = variantIndex >= 0 ? tokens[variantIndex + 3] || "" : "";

  return {
    modelName,
    seriesLabel,
    variantName,
    variantCode,
    fuelType,
    transmission
  };
}

function normalizeVariantDisplay(value) {
  const text = String(value || "").trim();
  const id = normalizeId(text);

  if (!text) return "";
  if (id === "base") return "Base";
  if (id === "plus") return "Plus";

  return normalizeLabel(text);
}

function isBadVariantCode(value, modelName, seriesLabel, variantName) {
  const id = normalizeId(value);
  if (!id) return true;

  return [
    normalizeId(modelName),
    normalizeId(seriesLabel),
    normalizeId(variantName),
    "base",
    "plus",
    "manual",
    "automatic",
    "auto",
    "hybrid",
    "petrol",
    "diesel",
    "electric",
    "ev"
  ].includes(id);
}

const GLOBAL_REGION_VALUES = new Set(["multiple", "all", "global"]);

export function isGlobalRegion(region) {
  return GLOBAL_REGION_VALUES.has(normalizeId(region));
}

export function matchesVehicleRegion(vehicle, selectedRegion) {
  const selected = normalizeId(selectedRegion);
  if (!selected) return true;

  const vehicleRegion = normalizeId(vehicle?.region || vehicle?.filterFields?.region);
  return vehicleRegion === selected;
}

export function formatVehicleName(idOrName) {
  const value = String(idOrName || "").trim();
  if (!value) return "Vehicle";
  return normalizeLabel(value);
}

export function formatSeriesLabel(series, seriesLabel = "") {
  const label = String(seriesLabel || "").trim();
  if (label) return normalizeLabel(label);

  const value = String(series || "").trim();
  if (!value) return "Other";
  if (value.length <= 2) return value.toUpperCase();

  return normalizeLabel(value);
}

export function normalizeVehicle(raw = {}) {
  const guessed = guessFromName(raw);
  const id = normalizeId(raw.id || raw.vehicleId || raw.name);

  const modelName = normalizeLabel(firstValue(
    raw.modelName,
    fieldValue(raw, ["modelName", "MODEL", "MODEL NAME", "VEHICLE MODEL"]),
    guessed.modelName
  ));

  const seriesLabel = normalizeLabel(firstValue(
    raw.seriesLabel,
    fieldValue(raw, ["seriesLabel", "SERIES"]),
    guessed.seriesLabel,
    raw.series
  ));

  const series = normalizeId(firstValue(raw.series, seriesLabel, "other")) || "other";

  const variantName = normalizeVariantDisplay(firstValue(
    raw.variantName,
    fieldValue(raw, ["variantName", "VARIANT NAME", "VARIENT NAME", "VARIANT"]),
    guessed.variantName,
    raw.variant,
    "base"
  ));

  const variant = normalizeId(firstValue(raw.variant, variantName, "base")) || "base";

  const variantTypeRaw = firstValue(
    fieldValue(raw, ["variantType", "VARIENT TYPE", "VARIANT TYPE"]),
    raw.variantType
  );

  let variantCode = normalizeLabel(firstValue(
    raw.variantCode,
    raw.oemVariantCode,
    fieldValue(raw, ["variantCode", "VARIANT CODE", "CONFIGURATION CODE", "EMISSION"]),
    variantTypeRaw,
    guessed.variantCode
  ));

  if (isBadVariantCode(variantCode, modelName, seriesLabel, variantName)) {
    variantCode = normalizeLabel(guessed.variantCode);
  }

  const variantType = variantName || normalizeVariantDisplay(variant);

  const bodyTypeLabel = normalizeLabel(firstValue(
    raw.bodyTypeLabel,
    raw.bodyType,
    fieldValue(raw, ["bodyType", "BODY TYPE", "TYPE"]),
    raw.type,
    "other"
  ));

  const type = normalizeId(firstValue(raw.type, bodyTypeLabel, "other")) || "other";
  const bodyType = normalizeId(firstValue(raw.bodyType, bodyTypeLabel, type)) || type;

  const region = normalizeId(firstValue(
    raw.region,
    fieldValue(raw, ["region", "REGION"]),
    "multiple"
  )) || "multiple";

  const year = Number.parseInt(firstValue(
    raw.year,
    raw.modelYear,
    fieldValue(raw, ["modelYear", "MODEL YEAR", "YEAR"])
  ), 10) || "";

  const fuelType = normalizeLabel(firstValue(
    raw.fuelType,
    fieldValue(raw, ["fuelType", "FUEL TYPE"]),
    guessed.fuelType
  ));

  const transmission = normalizeLabel(firstValue(
    raw.transmission,
    fieldValue(raw, ["transmission", "TRANSMISSION"]),
    guessed.transmission
  ));

  const engine = firstValue(raw.engine, fieldValue(raw, ["engine", "ENGINE"]));
  const emission = firstValue(raw.emission, fieldValue(raw, ["emission", "EMISSION"]));
  const productionDate = firstValue(raw.productionDate, fieldValue(raw, ["productionDate", "PRODUCTION DATE", "Production Date"]));

  const vinNumbers = Array.isArray(raw.vinNumbers)
    ? raw.vinNumbers.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const vinNumber = firstValue(raw.vinNumber, raw.vin, vinNumbers[0]);

  const hasOemSheetData = Boolean(
    raw.groupFields ||
    raw.normalizedGroupFields ||
    raw.sheetHeaders ||
    raw.rawRows ||
    raw.normalizedRows
  );

  const oemDisplayName = buildDisplayName({ modelName, seriesLabel, variantCode });

  const name = firstValue(
    hasOemSheetData ? oemDisplayName : "",
    oemDisplayName,
    raw.name,
    raw.vehicleName,
    formatVehicleName(id)
  );

  return {
    ...raw,
    id,
    name,
    displayName: oemDisplayName || name,
    modelName,
    vinNumber,
    vinNumbers,
    variant,
    variantName,
    variantType,
    variantCode,
    year,
    region,
    type,
    bodyType,
    bodyTypeLabel,
    series,
    seriesLabel: seriesLabel || formatSeriesLabel(series),
    fuelType,
    transmission,
    engine,
    emission,
    productionDate,
    filterFields: {
      ...(raw.filterFields || {}),
      series,
      seriesLabel: seriesLabel || formatSeriesLabel(series),
      variantType: normalizeId(variantType),
      variantTypeLabel: variantType,
      variantCode,
      bodyType,
      bodyTypeLabel: bodyTypeLabel || formatVehicleName(bodyType),
      region,
      modelName,
      fuelType,
      transmission,
      engine,
      emission
    },
    imageUrl: firstValue(raw.imageUrl, raw.image?.url, raw.thumbnailUrl, `/images/vehicles/${id}.png`),
    modelUrl: firstValue(raw.modelUrl, raw.model?.url, `/models/${id}.glb`),
    modelDataUrl: firstValue(raw.modelDataUrl, raw.modelData?.url, "/Parts Details/Parts data.xlsx"),
    manualUrl: firstValue(raw.manualUrl, raw.manual?.url, `/manuals/${id}.pdf`),
    image: raw.image || null,
    model: raw.model || null,
    modelData: raw.modelData || null,
    manual: raw.manual || null,
    builtIn: Boolean(raw.builtIn),
    storageMode: raw.storageMode || (raw.builtIn ? "built-in" : "uploaded")
  };
}

function buildDisplayName({ modelName, seriesLabel, variantCode }) {
  return [modelName, seriesLabel, variantCode]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

export function getVehicleDisplayName(vehicle) {
  const normalized = normalizeVehicle(vehicle || {});
  return normalized.displayName || normalized.name || "Vehicle";
}

export function getVehicleImageUrl(vehicle) {
  const normalized = normalizeVehicle(vehicle || {});
  return normalized.imageUrl || VEHICLE_PLACEHOLDER_IMAGE;
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
  const selectedVinNumber = cached?.id === id ? String(cached.selectedVinNumber || "").trim() : "";

  try {
    const vehicles = await fetchVehicles();
    const freshVehicle = vehicles.find((item) => item.id === id) || null;
    if (freshVehicle) {
      const normalized = normalizeVehicle({
        ...freshVehicle,
        selectedVinNumber
      });
      writeSelectedVehicleData(normalized);
      return normalized;
    }
  } catch (error) {
    console.warn("Fresh vehicle lookup failed:", error.message || error);
  }

  return cached?.id === id ? normalizeVehicle(cached) : null;
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
  const normalized = normalizeVehicle(vehicle);
  localStorage.setItem("selectedVehicle", normalized.id);
  localStorage.setItem("selectedVehicleData", JSON.stringify(normalized));
}

export function uniqueSortedOptions(vehicles, key) {
  const map = new Map();
  vehicles.forEach((vehicle) => {
    const normalized = normalizeVehicle(vehicle);
    const value = optionValue(normalized, key);
    if (!value) return;

    if (key === "region" && isGlobalRegion(value)) return;

    const label = optionLabel(normalized, key, value);
    if (!map.has(value)) map.set(value, label);
  });

  return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

function optionValue(vehicle, key) {
  if (key === "variantType") return normalizeId(vehicle.variantType || vehicle.variantName || vehicle.variant);
  if (key === "bodyType") return normalizeId(vehicle.bodyType || vehicle.type);
  return String(vehicle[key] || vehicle.filterFields?.[key] || "").trim();
}

function optionLabel(vehicle, key, value) {
  if (key === "series") return formatSeriesLabel(value, vehicle.seriesLabel || vehicle.filterFields?.seriesLabel);
  if (key === "variantType") return String(vehicle.variantType || vehicle.variantName || normalizeLabel(value));
  if (key === "bodyType") return String(vehicle.bodyTypeLabel || normalizeLabel(value));
  return normalizeLabel(value);
}

export function matchesVehicleVin(vehicle, query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return true;

  const values = [
    vehicle.vinNumber,
    ...(Array.isArray(vehicle.vinNumbers) ? vehicle.vinNumbers : []),
    ...(Array.isArray(vehicle.rawRows) ? vehicle.rawRows.flatMap((row) => Object.values(row || {})) : [])
  ];

  return values.some((value) => String(value || "").toLowerCase().includes(text));
}

export function vehicleYearText(vehicle) {
  const normalized = normalizeVehicle(vehicle || {});
  const bits = [];

  if (normalized.year) bits.push(`${normalized.year} Model`);
  if (normalized.region && !isGlobalRegion(normalized.region)) bits.push(normalizeLabel(normalized.region));

  return bits.join(" · ") || "Vehicle";
}
