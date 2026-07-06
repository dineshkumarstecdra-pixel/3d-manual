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
    vinNumbers: [],
    variant: "base",
    variantName: "Base",
    variantType: "Base",
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

function normalizeLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bBmw\b/g, "BMW")
    .replace(/\bVin\b/g, "VIN")
    .replace(/\bSuv\b/g, "SUV")
    .replace(/\bBs\b/g, "BS");
}

function textValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) {
    return value.map(textValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    if (isLikelyFileMeta(value)) return "";
    const displayValue = value.text ?? value.label ?? value.value ?? value.w ?? value.v;
    return displayValue === value ? "" : textValue(displayValue);
  }
  return String(value).trim();
}

function isLikelyFileMeta(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value.url || value.localPath || value.storedName || value.extension || value.size || value.mimetype)
  );
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
    raw,
    raw.filterFields || {},
    raw.groupFields || {},
    raw.normalizedGroupFields || {},
    Array.isArray(raw.normalizedRows) ? raw.normalizedRows[0] || {} : {},
    Array.isArray(raw.rawRows) ? raw.rawRows[0] || {} : {}
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

function normalizeFieldKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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
  if (label) return label;
  const value = String(series || "").trim();
  if (!value) return "Other";
  if (value.length <= 2) return value.toUpperCase();
  return normalizeLabel(value);
}

export function normalizeVehicle(raw = {}) {
  const id = normalizeId(raw.id || raw.vehicleId || raw.name);

  const modelName = firstValue(
    raw.modelName,
    fieldValue(raw, ["modelName", "MODEL", "MODEL NAME", "VEHICLE MODEL"])
  );
  const seriesLabel = firstValue(
    raw.seriesLabel,
    fieldValue(raw, ["seriesLabel", "SERIES"]),
    raw.series
  );
  const series = normalizeId(firstValue(raw.series, seriesLabel, "other")) || "other";
  const variantName = firstValue(
    raw.variantName,
    fieldValue(raw, ["variantName", "VARIANT NAME", "VARIENT NAME", "VARIANT"]),
    raw.variant
  );
  const fuelType = firstValue(raw.fuelType, fieldValue(raw, ["fuelType", "FUEL TYPE"]));
  const transmission = firstValue(raw.transmission, fieldValue(raw, ["transmission", "TRANSMISSION"]));
  const derivedVariantType = deriveVariantTypeFromName(raw.name || raw.vehicleName, {
    modelName,
    seriesLabel,
    variantName,
    fuelType,
    transmission
  });
  let variantTypeCandidate = firstValue(
    raw.variantType,
    fieldValue(raw, ["variantType", "VARIENT TYPE", "VARIANT TYPE"])
  );
  if (derivedVariantType && isWeakVariantType(variantTypeCandidate, variantName)) {
    variantTypeCandidate = derivedVariantType;
  }
  const variantType = firstValue(
    variantTypeCandidate,
    derivedVariantType,
    variantName,
    raw.variant
  );
  const bodyTypeLabel = firstValue(
    raw.bodyTypeLabel,
    raw.bodyType,
    fieldValue(raw, ["bodyType", "BODY TYPE", "TYPE"]),
    raw.type,
    "other"
  );
  const type = normalizeId(firstValue(raw.type, bodyTypeLabel, "other")) || "other";
  const bodyType = normalizeId(firstValue(raw.bodyType, bodyTypeLabel, type)) || type;
  const region = normalizeId(firstValue(raw.region, fieldValue(raw, ["region", "REGION"]), "multiple")) || "multiple";
  const year = Number.parseInt(firstValue(raw.year, raw.modelYear, fieldValue(raw, ["modelYear", "MODEL YEAR", "YEAR"])), 10) || "";
  const variant = normalizeId(firstValue(raw.variant, variantName, "base")) || "base";
  const engine = firstValue(raw.engine, fieldValue(raw, ["engine", "ENGINE"]));
  const emission = firstValue(raw.emission, fieldValue(raw, ["emission", "EMISSION"]));
  const productionDate = firstValue(raw.productionDate, fieldValue(raw, ["productionDate", "PRODUCTION DATE", "Production Date"]));
  const vinNumbers = Array.isArray(raw.vinNumbers) ? raw.vinNumbers.map(String).filter(Boolean) : [];
  const vinNumber = firstValue(raw.vinNumber, raw.vin, vinNumbers[0]);
  const oemDisplayName = buildDisplayName({ modelName, seriesLabel, variantType });
  const hasOemSheetData = Boolean(raw.groupFields || raw.normalizedGroupFields || raw.sheetHeaders || raw.rawRows || raw.normalizedRows);
  const name = firstValue(
    hasOemSheetData ? oemDisplayName : "",
    raw.name,
    raw.vehicleName,
    oemDisplayName,
    formatVehicleName(id)
  );

  return {
    ...raw,
    id,
    name,
    modelName,
    vinNumber,
    vinNumbers,
    variant,
    variantName,
    variantType,
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
      variantType: normalizeId(variantType || variantName || variant),
      variantTypeLabel: variantType || variantName || formatVehicleName(variant),
      bodyType,
      bodyTypeLabel: bodyTypeLabel || formatVehicleName(bodyType),
      region,
      modelName,
      fuelType,
      transmission,
      engine,
      emission
    },
    imageUrl: assetUrl(raw.image, raw.imageUrl, `/images/vehicles/${id}.png`),
    modelUrl: assetUrl(raw.model, raw.modelUrl, `/models/${id}.glb`),
    modelDataUrl: assetUrl(raw.modelData, raw.modelDataUrl, "/Parts Details/Parts data.xlsx"),
    manualUrl: assetUrl(raw.manual, raw.manualUrl, `/manuals/${id}.pdf`),
    image: raw.image || null,
    model: raw.model || null,
    modelData: raw.modelData || null,
    manual: raw.manual || null,
    builtIn: Boolean(raw.builtIn),
    storageMode: raw.storageMode || (raw.builtIn ? "built-in" : "uploaded")
  };
}

function buildDisplayName({ modelName, seriesLabel, variantType }) {
  // Client card title should stay OEM-readable and short.
  // Example: BMW M3 BS.
  return [modelName, seriesLabel, variantType]
    .map((part) => textValue(part))
    .filter(Boolean)
    .join(" ");
}

function assetUrl(fileMeta, fallbackUrl = "", defaultUrl = "") {
  const directUrl = firstValue(fallbackUrl, fileMeta?.url);
  if (directUrl) return directUrl;

  const localPath = textValue(fileMeta?.localPath);
  if (localPath) {
    return `${UPLOAD_SERVER}/${localPath.split("/").map(encodeURIComponent).join("/")}`;
  }

  return defaultUrl;
}

function deriveVariantTypeFromName(name, context = {}) {
  const text = textValue(name);
  if (!text) return "";

  const removeWords = new Set([
    ...splitWords(context.modelName),
    ...splitWords(context.seriesLabel),
    ...splitWords(context.variantName),
    ...splitWords(context.fuelType),
    ...splitWords(context.transmission),
    "BASE",
    "PLUS",
    "MID",
    "HIGH",
    "PETROL",
    "DIESEL",
    "HYBRID",
    "EV",
    "ELECTRIC",
    "MANUAL",
    "AUTOMATIC",
    "AUTO",
    "AT",
    "MT"
  ]);

  return splitWords(text).find((word) => word && !removeWords.has(word)) || "";
}

function splitWords(value) {
  return textValue(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function isWeakVariantType(variantType, variantName) {
  const typeText = normalizeFieldKey(variantType);
  const nameText = normalizeFieldKey(variantName);
  return !typeText || typeText === nameText || ["base", "plus", "mid"].includes(typeText);
}

export function getVehicleCardName(vehicle) {
  const normalized = normalizeVehicle(vehicle || {});
  const title = buildDisplayName({
    modelName: normalized.modelName,
    seriesLabel: normalized.seriesLabel,
    variantType: normalized.variantType
  });

  return title || normalized.name || "Vehicle";
}

export function getVehicleDisplayName(vehicle) {
  return getVehicleCardName(vehicle);
}

export function getVehicleImageUrl(vehicle) {
  const normalized = normalizeVehicle(vehicle || {});
  return firstValue(
    vehicle?.imageUrl,
    vehicle?.image?.url,
    vehicle?.image?.localPath ? `${UPLOAD_SERVER}/${String(vehicle.image.localPath).split("/").map(encodeURIComponent).join("/")}` : "",
    normalized.imageUrl,
    `/images/vehicles/${normalized.id}.png`
  );
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
  localStorage.setItem("selectedVehicle", vehicle.id);
  localStorage.setItem("selectedVehicleData", JSON.stringify(normalizeVehicle(vehicle)));
}

export function uniqueSortedOptions(vehicles, key) {
  const map = new Map();
  vehicles.forEach((vehicle) => {
    const value = optionValue(vehicle, key);
    if (!value) return;

    if (key === "region" && isGlobalRegion(value)) return;

    const label = optionLabel(vehicle, key, value);
    if (!map.has(value)) map.set(value, label);
  });
  return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

function optionValue(vehicle, key) {
  if (key === "variantType") return normalizeId(vehicle.variantType || vehicle.filterFields?.variantType || vehicle.variantName || vehicle.variant);
  if (key === "bodyType") return normalizeId(vehicle.bodyType || vehicle.filterFields?.bodyType || vehicle.type);
  return String(vehicle[key] || vehicle.filterFields?.[key] || "").trim();
}

function optionLabel(vehicle, key, value) {
  if (key === "series") return formatSeriesLabel(value, vehicle.seriesLabel || vehicle.filterFields?.seriesLabel);
  if (key === "variantType") return String(vehicle.variantType || vehicle.filterFields?.variantTypeLabel || vehicle.variantName || normalizeLabel(value));
  if (key === "bodyType") return String(vehicle.bodyTypeLabel || vehicle.filterFields?.bodyTypeLabel || normalizeLabel(value));
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
  const bits = [];
  if (vehicle.year) bits.push(`${vehicle.year} Model`);
  if (vehicle.region && !isGlobalRegion(vehicle.region)) bits.push(normalizeLabel(vehicle.region));
  return bits.join(" · ") || "Vehicle";
}
