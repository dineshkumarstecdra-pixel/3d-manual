import { requireAdmin, secureLogout, ADMIN_EMAIL } from "./authGuard.js";
const API_BASE_URL = "https://threed-manual.onrender.com";
const API_BASE = `${API_BASE_URL}/api`;
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

const manualEditorWrap = document.getElementById("manualEditorWrap");
const newProgramTabBtn = document.getElementById("newProgramTabBtn");
const existingProgramTabBtn = document.getElementById("existingProgramTabBtn");
const newProgramPane = document.getElementById("newProgramPane");
const existingProgramPane = document.getElementById("existingProgramPane");
const newProgramSheet = document.getElementById("newProgramSheet");
const newProgramSheetUrl = document.getElementById("newProgramSheetUrl");
const newProgramImportMode = document.getElementById("newProgramImportMode");
const readNewProgramBtn = document.getElementById("readNewProgramBtn");
const newProgramSummary = document.getElementById("newProgramSummary");
const programPreview = document.getElementById("programPreview");
const existingProgramSheet = document.getElementById("existingProgramSheet");
const existingProgramSheetUrl = document.getElementById("existingProgramSheetUrl");
const readExistingProgramBtn = document.getElementById("readExistingProgramBtn");
const existingProgramSummary = document.getElementById("existingProgramSummary");
const existingProgramPreview = document.getElementById("existingProgramPreview");
const programAssetDialog = document.getElementById("programAssetDialog");
const programAssetForm = document.getElementById("programAssetForm");
const closeAssetDialogBtn = document.getElementById("closeAssetDialogBtn");
const cancelProgramAssetsBtn = document.getElementById("cancelProgramAssetsBtn");
const saveProgramAssetsBtn = document.getElementById("saveProgramAssetsBtn");
const assetDialogTitle = document.getElementById("assetDialogTitle");
const assetDialogMeta = document.getElementById("assetDialogMeta");
const assetDialogDetails = document.getElementById("assetDialogDetails");
const programCarImage = document.getElementById("programCarImage");
const programModelFile = document.getElementById("programModelFile");
const programModelDataFile = document.getElementById("programModelDataFile");
const programManualFile = document.getElementById("programManualFile");
const programCarImageName = document.getElementById("programCarImageName");
const programModelFileName = document.getElementById("programModelFileName");
const programModelDataFileName = document.getElementById("programModelDataFileName");
const programManualFileName = document.getElementById("programManualFileName");

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
let newProgramGroups = [];
let existingProgramGroups = [];
let selectedProgramGroup = null;
let latestNewProgramRows = [];
let latestExistingProgramRows = [];
let latestNewProgramHeaders = [];

const VIN_HEADER_ALIASES = [
  "VEHICLE IDENTIFICATION NUMBER", "VIN", "VIN NUMBER", "VIN NO", "CHASSIS NUMBER", "SERIAL NUMBER"
];
const SERIAL_HEADER_ALIASES = ["SI.NO", "S.NO", "SNO", "SERIAL NO", "SERIAL NUMBER", "SL NO"];
const PRODUCTION_DATE_HEADER_ALIASES = ["Production Date", "PRODUCTION DATE", "Built Date", "Build Date"];
const GROUP_EXCLUDED_HEADER_KEYS = new Set([
  ...VIN_HEADER_ALIASES,
  ...SERIAL_HEADER_ALIASES,
  ...PRODUCTION_DATE_HEADER_ALIASES
].map(normalizeHeader));

const PROGRAM_FIELD_ALIASES = {
  programId: ["Program ID", "ProgramID", "Program"],
  vinNumber: VIN_HEADER_ALIASES,
  modelName: ["MODEL", "Vehicle Model", "Car Model", "Model Name"],
  seriesLabel: ["SERIES", "Model Series", "Program Series"],
  variantName: ["VARIANT NAME", "VARIENT NAME", "Variant", "Varient", "Trim"],
  variantType: ["VARIENT TYPE", "VARIANT TYPE", "Type Code", "Variant Code"],
  bodyType: ["BODY TYPE", "Body", "Vehicle Type", "Type"],
  modelYear: ["MODEL YEAR", "Year", "MY"],
  region: ["REGION", "Market", "Country"],
  fuelType: ["FUEL TYPE", "Fuel"],
  transmission: ["TRANSMISSION", "Gearbox"],
  engine: ["ENGINE", "Engine Type"],
  emission: ["EMISSION", "Emission Norm", "Emission Standard"],
  productionDate: PRODUCTION_DATE_HEADER_ALIASES,
  effectiveDate: ["Effective Date", "Effective From", "From Date", "Start Date"],
  validDate: ["Valid Date", "Valid To", "Valid Until", "To Date", "End Date"]
};

const verifiedAdmin = await requireAdmin();
currentUser = verifiedAdmin;
adminEmail.textContent = verifiedAdmin.email || ADMIN_EMAIL;
if (authOverlay) authOverlay.style.display = "none";
if (adminApp) adminApp.hidden = false;
await loadVehicles();
await loadOrders();
initProgramUpdateUI();

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


function initProgramUpdateUI() {
  showProgramPane("new");
  resetProgramAssetLabels();
}

newProgramTabBtn?.addEventListener("click", () => showProgramPane("new"));
existingProgramTabBtn?.addEventListener("click", () => showProgramPane("existing"));
readNewProgramBtn?.addEventListener("click", readNewProgramSheet);
readExistingProgramBtn?.addEventListener("click", readExistingProgramSheet);
clearFormBtn?.addEventListener("click", clearProgramUpdateUI);

[programCarImage, programModelFile, programModelDataFile, programManualFile].forEach((input) => {
  input?.addEventListener("change", resetProgramAssetLabels);
});

programPreview?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-program-action]");
  if (!button) return;
  const groupId = button.dataset.groupId;
  const group = newProgramGroups.find((item) => item.groupId === groupId);
  if (!group) return;
  openProgramAssetDialog(group);
});

existingProgramPreview?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-existing-action]");
  if (!button) return;
  if (button.dataset.existingAction === "save-revision") {
    await saveExistingRevision();
  }
});

closeAssetDialogBtn?.addEventListener("click", closeProgramAssetDialog);
cancelProgramAssetsBtn?.addEventListener("click", closeProgramAssetDialog);

programAssetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSelectedProgramAssets();
});

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


function showProgramPane(mode) {
  const showNew = mode !== "existing";

  newProgramTabBtn?.classList.toggle("active", showNew);
  existingProgramTabBtn?.classList.toggle("active", !showNew);
  newProgramTabBtn?.setAttribute("aria-selected", String(showNew));
  existingProgramTabBtn?.setAttribute("aria-selected", String(!showNew));

  // Author CSS had .program-pane { display: grid }, so hidden needs an explicit display override.
  if (newProgramPane) {
    newProgramPane.hidden = !showNew;
    newProgramPane.classList.toggle("active", showNew);
    newProgramPane.style.display = showNew ? "grid" : "none";
  }
  if (existingProgramPane) {
    existingProgramPane.hidden = showNew;
    existingProgramPane.classList.toggle("active", !showNew);
    existingProgramPane.style.display = showNew ? "none" : "grid";
  }

  const panel = document.querySelector(".program-update-panel");
  if (panel) {
    panel.classList.toggle("mode-new", showNew);
    panel.classList.toggle("mode-existing", !showNew);
  }
}

function clearProgramUpdateUI() {
  newProgramGroups = [];
  existingProgramGroups = [];
  latestNewProgramRows = [];
  latestExistingProgramRows = [];
  latestNewProgramHeaders = [];
  if (newProgramSheet) newProgramSheet.value = "";
  if (newProgramSheetUrl) newProgramSheetUrl.value = "";
  if (existingProgramSheet) existingProgramSheet.value = "";
  if (existingProgramSheetUrl) existingProgramSheetUrl.value = "";
  if (newProgramSummary) newProgramSummary.hidden = true;
  if (existingProgramSummary) existingProgramSummary.hidden = true;
  if (programPreview) {
    programPreview.className = "program-preview empty-preview";
    programPreview.innerHTML = `<h3>No sheet imported yet</h3><p>After reading the sheet, each unique model/series/variant/date range will appear here with an asset upload action.</p>`;
  }
  if (existingProgramPreview) {
    existingProgramPreview.className = "program-preview empty-preview";
    existingProgramPreview.innerHTML = `<h3>No update sheet imported yet</h3><p>Preview the matched programs and date ranges before saving a revision record.</p>`;
  }
}

async function readNewProgramSheet() {
  try {
    setProgress("Reading new program sheet...", 10);
    showMessage("", "");
    const rows = await readSheetInput(newProgramSheet, newProgramSheetUrl);
    latestNewProgramRows = rows;
    latestNewProgramHeaders = getSheetHeaders(rows);
    newProgramGroups = groupProgramRows(rows, "new");
    renderNewProgramGroups();
    setProgress(`Found ${newProgramGroups.length} unique OEM configuration group(s)`, 100);
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Could not read sheet.", "error");
    setProgress("Failed", 0);
  }
}

async function readExistingProgramSheet() {
  try {
    setProgress("Reading existing program update sheet...", 10);
    showMessage("", "");
    const rows = await readSheetInput(existingProgramSheet, existingProgramSheetUrl);
    latestExistingProgramRows = rows;
    existingProgramGroups = groupProgramRows(rows, "existing").map((group) => ({
      ...group,
      matchedVehicle: findMatchingVehicle(group)
    }));
    renderExistingProgramGroups();
    setProgress(`Previewed ${existingProgramGroups.length} update group(s)`, 100);
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Could not read update sheet.", "error");
    setProgress("Failed", 0);
  }
}

async function readSheetInput(fileInput, urlInput) {
  const file = fileInput?.files?.[0] || null;
  const url = urlInput?.value?.trim() || "";

  if (!file && !url) {
    throw new Error("Upload an Excel/CSV file or paste a Google Sheet CSV URL.");
  }

  if (url) {
    const csvUrl = toCsvUrl(url);
    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not fetch Google Sheet / CSV URL. Publish the sheet or use a CSV export link.");
    const text = await response.text();
    return normalizeSheetRows(parseCsv(text));
  }

  const extension = getExtension(file.name);
  if (extension === "csv") {
    const text = await file.text();
    return normalizeSheetRows(parseCsv(text));
  }

  if (!["xlsx", "xls"].includes(extension)) {
    throw new Error("Supported sheet formats: Excel .xlsx/.xls, CSV, or Google Sheet CSV link.");
  }

  if (!window.XLSX) {
    throw new Error("Sheet parser did not load. Check internet connection for SheetJS CDN.");
  }

  const buffer = await file.arrayBuffer();

  // Keep Excel dates exactly as displayed in the sheet.
  // Using raw:false avoids JS timezone conversion such as 2027-01-01 -> 2026-12-31.
  const workbook = window.XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    dateNF: "yyyy-mm-dd"
  });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = window.XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
    dateNF: "yyyy-mm-dd"
  });
  return normalizeSheetRows(rawRows);
}

function toCsvUrl(url) {
  const value = String(url || "").trim();
  if (!value) return value;
  if (value.includes("docs.google.com/spreadsheets") && value.includes("/edit")) {
    const gidMatch = value.match(/[?&#]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return value.replace(/\/edit.*$/, `/export?format=csv&gid=${gid}`);
  }
  return value;
}

function normalizeSheetRows(rows) {
  const seenHeaders = new Set();
  const headers = [];

  const normalizedRows = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const rawRow = {};
      const normalized = {};

      for (const [key, value] of Object.entries(row || {})) {
        const rawKey = String(key || "").trim();
        if (!rawKey) continue;

        const normalizedKey = normalizeHeader(rawKey);
        const cellValue = normalizeCell(value);

        rawRow[rawKey] = cellValue;
        normalized[normalizedKey] = cellValue;

        if (!seenHeaders.has(rawKey)) {
          seenHeaders.add(rawKey);
          headers.push(rawKey);
        }
      }

      return {
        ...normalized,
        __rawRow: rawRow,
        __normalizedRow: normalized,
        __headers: headers
      };
    })
    .filter((row) => Object.values(row.__rawRow || {}).some((value) => String(value || "").trim()));

  normalizedRows.forEach((row) => {
    row.__headers = [...headers];
  });

  return normalizedRows;
}

function getSheetHeaders(rows) {
  return Array.from(new Set((Array.isArray(rows) ? rows : []).flatMap((row) => row.__headers || Object.keys(row.__rawRow || {}))));
}

function getRawRow(row) {
  return row?.__rawRow || row || {};
}

function getNormalizedRow(row) {
  return row?.__normalizedRow || row || {};
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-\/]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeCell(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatSheetDate(value);
  }
  return String(value ?? "").trim();
}

function formatSheetDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const source = String(text || "");

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  rows.push(row);

  const headers = (rows.shift() || []).map((header, index) => String(header || `Column ${index + 1}`).trim());
  return rows.map((values) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header || `Column ${index + 1}`] = values[index] || "";
    });
    return obj;
  });
}

function sheetValue(row, aliases) {
  const normalized = getNormalizedRow(row);
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (normalized[key] !== undefined && normalized[key] !== null && String(normalized[key]).trim() !== "") return String(normalized[key]).trim();
  }
  return "";
}

function getProgramValue(row, fieldName) {
  return sheetValue(row, PROGRAM_FIELD_ALIASES[fieldName] || [fieldName]);
}

function rowChangeType(row) {
  return sheetValue(row, [
    "Change Type", "ChangeType", "Action", "Revision Action", "Update Type",
    "BOM Action", "Status", "Change"
  ]);
}

function detectRevisionModeFromRows(rows) {
  return (Array.isArray(rows) ? rows : []).some((row) => rowChangeType(row)) ? "delta" : "full";
}

function describeRevisionMode(mode) {
  return mode === "delta"
    ? "Delta / Change Sheet: only added, changed, and removed parts are required."
    : "Full BOM Replacement: sheet must contain the complete valid BOM for this date range.";
}

function countChangeActions(rows) {
  const counts = { added: 0, changed: 0, removed: 0, blank: 0 };
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const value = normalizeSelectValue(rowChangeType(row));
    if (!value) { counts.blank += 1; return; }
    if (value.includes("remove") || value.includes("delete") || value.includes("obsolete")) counts.removed += 1;
    else if (value.includes("add") || value.includes("new")) counts.added += 1;
    else counts.changed += 1;
  });
  return counts;
}

function rowToProgram(row) {
  const programId = getProgramValue(row, "programId");
  const modelName = getProgramValue(row, "modelName");
  const seriesLabel = getProgramValue(row, "seriesLabel");
  const variantName = getProgramValue(row, "variantName") || "BASE";
  const variantType = getProgramValue(row, "variantType") || variantName;
  const bodyTypeLabel = getProgramValue(row, "bodyType");
  const year = getProgramValue(row, "modelYear") || sheetValue(row, ["Model Year", "MODEL YEAR", "Year"]);
  const regionLabel = getProgramValue(row, "region");
  const fuelType = getProgramValue(row, "fuelType");
  const transmission = getProgramValue(row, "transmission");
  const engine = getProgramValue(row, "engine");
  const emission = getProgramValue(row, "emission");
  const productionDate = getProgramValue(row, "productionDate");
  const effectiveDate = getProgramValue(row, "effectiveDate");
  const validDate = getProgramValue(row, "validDate");
  const vinNumber = getProgramValue(row, "vinNumber");
  const displayName = buildOemDisplayName({ modelName, seriesLabel, variantName, variantType, fuelType, transmission }) || programId;

  return {
    programId,
    vehicleName: displayName,
    model: modelName || displayName,
    modelName,
    displayName,
    seriesLabel,
    series: normalizeSeriesValue(seriesLabel),
    variant: normalizeVariant(variantName),
    variantName,
    variantType,
    year,
    region: normalizeSelectValue(regionLabel),
    regionLabel,
    type: normalizeSelectValue(bodyTypeLabel),
    typeLabel: bodyTypeLabel,
    bodyType: normalizeSelectValue(bodyTypeLabel),
    bodyTypeLabel,
    fuelType,
    transmission,
    engine,
    emission,
    productionDate,
    effectiveDate,
    validDate,
    vinNumber,
    raw: getRawRow(row),
    normalized: getNormalizedRow(row)
  };
}

function buildOemDisplayName(program) {
  return [
    program.modelName,
    program.seriesLabel,
    program.variantName,
    program.variantType,
    program.fuelType,
    program.transmission
  ].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
}

function groupProgramRows(rows, mode) {
  if (mode !== "new") return groupRevisionRows(rows, mode);

  validateDuplicateVinRows(rows);
  const map = new Map();
  const headers = getSheetHeaders(rows);

  rows.forEach((row, index) => {
    const program = rowToProgram(row);
    if (!program.displayName || !program.series || !program.variant || !program.year || !program.region || !program.type) return;

    const key = buildConfigurationKey(row);
    if (!key) return;

    if (!map.has(key)) {
      const groupFields = buildGroupFields(row);
      const normalizedGroupFields = buildNormalizedGroupFields(row);
      const groupId = createProgramId(program, normalizedGroupFields);
      map.set(key, {
        ...program,
        groupKey: key,
        groupId,
        groupFields,
        normalizedGroupFields,
        sheetHeaders: headers,
        filterFields: {
          series: program.series,
          seriesLabel: program.seriesLabel,
          variantType: normalizeSelectValue(program.variantType || program.variantName),
          variantTypeLabel: program.variantType || program.variantName,
          bodyType: program.bodyType,
          bodyTypeLabel: program.bodyTypeLabel,
          region: program.region,
          modelName: program.modelName,
          fuelType: program.fuelType,
          transmission: program.transmission,
          engine: program.engine,
          emission: program.emission
        },
        rows: [],
        rawRows: [],
        normalizedRows: [],
        rowIndexes: [],
        vinNumbers: [],
        saved: false,
        mode
      });
    }

    const group = map.get(key);
    group.rows.push(row);
    group.rawRows.push(getRawRow(row));
    group.normalizedRows.push(getNormalizedRow(row));
    group.rowIndexes.push(index + 2);
    if (program.vinNumber && !group.vinNumbers.includes(program.vinNumber)) {
      group.vinNumbers.push(program.vinNumber);
    }
  });

  return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function groupRevisionRows(rows, mode) {
  const map = new Map();

  rows.forEach((row, index) => {
    const program = rowToProgram(row);
    const programIdFromRow = program.programId || sheetValue(row, ["Program ID", "ProgramID", "Program"]);
    const key = programIdFromRow
      ? normalizeSelectValue(programIdFromRow)
      : [
          program.displayName,
          program.series,
          program.variant,
          program.year,
          program.region,
          program.type,
          program.effectiveDate,
          program.validDate
        ].map((part) => String(part || "").toLowerCase()).join("|");

    if (!key || key === "|||||||") return;

    if (!map.has(key)) {
      const groupId = createProgramId({ ...program, programId: programIdFromRow }, buildNormalizedGroupFields(row));
      map.set(key, {
        ...program,
        programId: programIdFromRow,
        groupId,
        displayName: program.displayName || programIdFromRow,
        vehicleName: program.vehicleName || programIdFromRow,
        rows: [],
        rawRows: [],
        normalizedRows: [],
        rowIndexes: [],
        vinNumbers: [],
        saved: false,
        mode
      });
    }

    const group = map.get(key);
    group.rows.push(row);
    group.rawRows.push(getRawRow(row));
    group.normalizedRows.push(getNormalizedRow(row));
    group.rowIndexes.push(index + 2);
    if (program.vinNumber && !group.vinNumbers.includes(program.vinNumber)) {
      group.vinNumbers.push(program.vinNumber);
    }
  });

  return Array.from(map.values()).sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));
}


function buildConfigurationKey(row) {
  const normalized = getNormalizedRow(row);
  return Object.entries(normalized)
    .filter(([key]) => !GROUP_EXCLUDED_HEADER_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${normalizeComparisonValue(value)}`)
    .join("|");
}

function buildGroupFields(row) {
  const raw = getRawRow(row);
  const fields = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!GROUP_EXCLUDED_HEADER_KEYS.has(normalizeHeader(key))) fields[key] = value;
  }
  return fields;
}

function buildNormalizedGroupFields(row) {
  const normalized = getNormalizedRow(row);
  const fields = {};
  for (const [key, value] of Object.entries(normalized)) {
    if (!GROUP_EXCLUDED_HEADER_KEYS.has(key)) fields[key] = value;
  }
  return fields;
}

function normalizeComparisonValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function validateDuplicateVinRows(rows) {
  const seen = new Map();
  const duplicates = [];
  rows.forEach((row, index) => {
    const vin = getProgramValue(row, "vinNumber");
    if (!vin) return;
    const key = normalizeComparisonValue(vin);
    if (seen.has(key)) duplicates.push(`${vin} (rows ${seen.get(key)}, ${index + 2})`);
    else seen.set(key, index + 2);
  });
  if (duplicates.length) {
    throw new Error(`Duplicate VIN found in uploaded sheet: ${duplicates.slice(0, 8).join(", ")}`);
  }
}

function createProgramId(program, normalizedGroupFields = {}) {
  if (program.programId) return createVehicleIdFromName(program.programId);
  return createVehicleIdFromName([
    program.displayName,
    program.modelName,
    program.seriesLabel || program.series,
    program.variantName || program.variant,
    program.variantType,
    program.bodyTypeLabel || program.type,
    program.year,
    program.region,
    program.fuelType,
    program.transmission,
    program.engine,
    program.emission,
    Object.values(normalizedGroupFields).join(" ")
  ].filter(Boolean).join(" "));
}

function normalizeVariant(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v.includes("plus")) return "plus";
  return "base";
}

function normalizeSelectValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function renderNewProgramGroups() {
  if (!programPreview) return;

  if (newProgramSummary) {
    newProgramSummary.hidden = false;
    newProgramSummary.innerHTML = `
      <strong>${newProgramGroups.length}</strong> unique program(s) found from
      <strong>${latestNewProgramRows.length}</strong> sheet row(s). Upload assets for each program on the right side.
    `;
  }

  if (!newProgramGroups.length) {
    programPreview.className = "program-preview empty-preview";
    programPreview.innerHTML = `<h3>No valid programs found</h3><p>Check the sheet columns: Vehicle Name, Model, Series, Variant, Year, Region, Type, Effective Date, Valid Date.</p>`;
    return;
  }

  programPreview.className = "program-preview program-card-grid";
  programPreview.innerHTML = newProgramGroups.map((group) => buildProgramCard(group)).join("");
}

function buildProgramCard(group) {
  const badge = group.saved ? `<span class="program-status saved">Saved</span>` : `<span class="program-status pending">Assets Needed</span>`;
  const vinPreview = (group.vinNumbers || []).slice(0, 3).join(", ");
  return `
    <article class="program-card ${group.saved ? "saved" : ""}">
      <div class="program-card-main">
        <div>
          <h3>${escapeHtml(group.displayName)}</h3>
          <p>${escapeHtml(group.year || "-")} · ${escapeHtml(formatTitle(group.regionLabel || group.region))} · ${escapeHtml(group.vinNumbers?.length || 0)} VIN(s)</p>
        </div>
        ${badge}
      </div>
      <div class="program-meta-grid">
        <span><strong>Model</strong>${escapeHtml(group.modelName || group.model || group.displayName)}</span>
        <span><strong>Series</strong>${escapeHtml(formatSeriesLabel(group.seriesLabel || group.series))}</span>
        <span><strong>Variant Type</strong>${escapeHtml(group.variantType || group.variantName || "-")}</span>
        <span><strong>Body Type</strong>${escapeHtml(formatTitle(group.bodyTypeLabel || group.typeLabel || group.type))}</span>
        <span><strong>Fuel</strong>${escapeHtml(group.fuelType || "-")}</span>
        <span><strong>Transmission</strong>${escapeHtml(group.transmission || "-")}</span>
        <span><strong>Rows</strong>${escapeHtml(group.rows.length)}</span>
        <span><strong>VINs</strong>${escapeHtml(vinPreview || "-")}${group.vinNumbers?.length > 3 ? "..." : ""}</span>
      </div>
      <button class="primary-btn program-card-btn" data-program-action="assets" data-group-id="${escapeAttr(group.groupId)}" type="button">
        ${group.saved ? "Replace Assets / Re-save" : "Upload Assets"}
      </button>
    </article>
  `;
}

function renderExistingProgramGroups() {
  if (!existingProgramPreview) return;

  const revisionMode = detectRevisionModeFromRows(latestExistingProgramRows);
  const changeCounts = countChangeActions(latestExistingProgramRows);

  if (existingProgramSummary) {
    const matched = existingProgramGroups.filter((group) => group.matchedVehicle).length;
    existingProgramSummary.hidden = false;
    existingProgramSummary.innerHTML = `
      <strong>${existingProgramGroups.length}</strong> update group(s), <strong>${matched}</strong> matched to existing programs.
      <span class="revision-mode-pill ${revisionMode}">${revisionMode === "delta" ? "Delta Change Sheet" : "Full BOM Replacement"}</span>
    `;
  }

  if (!existingProgramGroups.length) {
    existingProgramPreview.className = "program-preview empty-preview";
    existingProgramPreview.innerHTML = `<h3>No valid update groups found</h3><p>Check the sheet columns and include Effective Date / Valid Date.</p>`;
    return;
  }

  existingProgramPreview.className = "program-preview existing-preview";
  existingProgramPreview.innerHTML = `
    <div class="revision-toolbar">
      <div>
        <h3>BOM Revision Preview</h3>
        <p>${escapeHtml(describeRevisionMode(revisionMode))} The 3D viewer will load the matching BOM by Effective Date / Valid Date.</p>
      </div>
      <div class="revision-action-summary">
        ${revisionMode === "delta" ? `
          <span>Added ${changeCounts.added}</span>
          <span>Changed ${changeCounts.changed}</span>
          <span>Removed ${changeCounts.removed}</span>
        ` : `<span>Rows ${latestExistingProgramRows.length}</span>`}
      </div>
      <button class="primary-btn" data-existing-action="save-revision" type="button">Save Revision Record</button>
    </div>
    <div class="revision-list">
      ${existingProgramGroups.map((group) => `
        <article class="revision-card ${group.matchedVehicle ? "matched" : "unmatched"}">
          <div>
            <h4>${escapeHtml(group.displayName)}</h4>
            <p>${escapeHtml(group.year || group.matchedVehicle?.year || "-")} · ${escapeHtml(formatTitle(group.variant))} · ${escapeHtml(formatSeriesLabel(group.seriesLabel || group.series))}</p>
          </div>
          <div class="program-meta-grid">
            <span><strong>Effective</strong>${escapeHtml(group.effectiveDate || "-")}</span>
            <span><strong>Valid</strong>${escapeHtml(group.validDate || "-")}</span>
            <span><strong>Rows</strong>${escapeHtml(group.rows.length)}</span>
            <span><strong>Mode</strong>${revisionMode === "delta" ? "Delta" : "Full BOM"}</span>
            <span><strong>Match</strong>${group.matchedVehicle ? escapeHtml(group.matchedVehicle.name) : "Not found"}</span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function findMatchingVehicle(group) {
  const groupId = createVehicleIdFromName(group.programId || group.groupId || "");
  const groupName = normalizeSelectValue(group.displayName);
  const groupSeries = String(group.series || "").toLowerCase();
  const groupVariant = String(group.variant || "").toLowerCase();

  return vehicles.find((vehicle) => {
    if (groupId && String(vehicle.id || "").toLowerCase() === groupId) return true;
    const vehicleProgramId = createVehicleIdFromName(vehicle.programId || vehicle.groupId || vehicle.groupFields?.["Program ID"] || "");
    if (groupId && vehicleProgramId === groupId) return true;
    const vehicleName = normalizeSelectValue(vehicle.name);
    const vehicleSeries = String(vehicle.series || "").toLowerCase();
    const vehicleVariant = String(vehicle.variant || "").toLowerCase();
    return vehicleName === groupName && (!groupSeries || vehicleSeries === groupSeries) && (!groupVariant || vehicleVariant === groupVariant);
  }) || null;
}


function openProgramAssetDialog(group) {
  selectedProgramGroup = group;
  resetProgramAssetFileInputs();
  if (assetDialogTitle) assetDialogTitle.textContent = `Upload Assets: ${group.displayName}`;
  if (assetDialogMeta) assetDialogMeta.textContent = `${group.year || "-"} · ${group.regionLabel || group.region || "-"} · ${group.vinNumbers?.length || 0} VIN(s) · ${newProgramImportMode?.value || "append"} mode`;
  if (assetDialogDetails) {
    assetDialogDetails.innerHTML = `
      <span><strong>Program ID</strong>${escapeHtml(group.groupId)}</span>
      <span><strong>Series</strong>${escapeHtml(formatSeriesLabel(group.seriesLabel || group.series))}</span>
      <span><strong>Variant Type</strong>${escapeHtml(group.variantType || group.variantName || "-")}</span>
      <span><strong>Body Type</strong>${escapeHtml(formatTitle(group.bodyTypeLabel || group.typeLabel || group.type))}</span>
      <span><strong>Fuel</strong>${escapeHtml(group.fuelType || "-")}</span>
      <span><strong>Transmission</strong>${escapeHtml(group.transmission || "-")}</span>
      <span><strong>Engine</strong>${escapeHtml(group.engine || "-")}</span>
      <span><strong>Emission</strong>${escapeHtml(group.emission || "-")}</span>
    `;
  }
  programAssetDialog?.showModal?.();
}

function closeProgramAssetDialog() {
  selectedProgramGroup = null;
  programAssetDialog?.close?.();
}

function resetProgramAssetFileInputs() {
  [programCarImage, programModelFile, programModelDataFile, programManualFile].forEach((input) => {
    if (input) input.value = "";
  });
  resetProgramAssetLabels();
}

function resetProgramAssetLabels() {
  if (programCarImageName) programCarImageName.textContent = programCarImage?.files?.[0]?.name || "No file selected";
  if (programModelFileName) programModelFileName.textContent = programModelFile?.files?.[0]?.name || "No file selected";
  if (programModelDataFileName) programModelDataFileName.textContent = programModelDataFile?.files?.[0]?.name || "No file selected";
  if (programManualFileName) programManualFileName.textContent = programManualFile?.files?.[0]?.name || "No file selected";
}

async function saveSelectedProgramAssets() {
  if (!selectedProgramGroup) return;

  const imageFile = programCarImage?.files?.[0] || null;
  const modelFile = programModelFile?.files?.[0] || null;
  const modelDataFile = programModelDataFile?.files?.[0] || null;
  const manualFile = programManualFile?.files?.[0] || null;

  if (!imageFile || !modelFile || !modelDataFile || !manualFile) {
    showMessage("For each program, upload car image, model file, model data/BOM and service manual.", "error");
    return;
  }

  if (!validateFile(imageFile, "image")) return;
  if (!validateFile(modelFile, "model")) return;
  if (!validateFile(modelDataFile, "modelData")) return;
  if (!validateFile(manualFile, "manual")) return;

  saveProgramAssetsBtn.disabled = true;
  saveProgramAssetsBtn.textContent = "Saving...";
  setProgress("Uploading program assets...", 10);

  try {
    const importMode = newProgramImportMode?.value || "append";
    const existingVehicle = vehicles.find((vehicle) => vehicle.id === selectedProgramGroup.groupId) || null;
    const merged = buildMergedProgramRows(selectedProgramGroup, existingVehicle, importMode);

    const formData = new FormData();
    formData.append("id", selectedProgramGroup.groupId);
    formData.append("programId", selectedProgramGroup.programId || selectedProgramGroup.groupId);
    formData.append("editingId", existingVehicle ? selectedProgramGroup.groupId : "");
    formData.append("name", selectedProgramGroup.displayName);
    formData.append("modelName", selectedProgramGroup.modelName || selectedProgramGroup.model || "");
    formData.append("vinNumber", merged.vinNumbers?.[0] || "");
    formData.append("vinNumbers", JSON.stringify(merged.vinNumbers || []));
    formData.append("variant", selectedProgramGroup.variant || "base");
    formData.append("variantName", selectedProgramGroup.variantName || "");
    formData.append("variantType", selectedProgramGroup.variantType || selectedProgramGroup.variantName || "");
    formData.append("year", selectedProgramGroup.year || "");
    formData.append("region", selectedProgramGroup.region || "");
    formData.append("type", selectedProgramGroup.type || selectedProgramGroup.bodyType || "");
    formData.append("bodyType", selectedProgramGroup.bodyType || selectedProgramGroup.type || "");
    formData.append("bodyTypeLabel", selectedProgramGroup.bodyTypeLabel || selectedProgramGroup.typeLabel || "");
    formData.append("series", selectedProgramGroup.series || "");
    formData.append("seriesLabel", selectedProgramGroup.seriesLabel || formatSeriesLabel(selectedProgramGroup.series));
    formData.append("fuelType", selectedProgramGroup.fuelType || "");
    formData.append("transmission", selectedProgramGroup.transmission || "");
    formData.append("engine", selectedProgramGroup.engine || "");
    formData.append("emission", selectedProgramGroup.emission || "");
    formData.append("productionDate", selectedProgramGroup.productionDate || "");
    formData.append("effectiveDate", selectedProgramGroup.effectiveDate || "");
    formData.append("validDate", selectedProgramGroup.validDate || "");
    formData.append("productionCount", String(merged.rawRows.length));
    formData.append("source", "oem-monthly-production-sheet");
    formData.append("sheetRows", JSON.stringify(merged.rawRows));
    formData.append("rawRows", JSON.stringify(merged.rawRows));
    formData.append("normalizedRows", JSON.stringify(merged.normalizedRows));
    formData.append("sheetHeaders", JSON.stringify(selectedProgramGroup.sheetHeaders || latestNewProgramHeaders || []));
    formData.append("groupFields", JSON.stringify(selectedProgramGroup.groupFields || {}));
    formData.append("normalizedGroupFields", JSON.stringify(selectedProgramGroup.normalizedGroupFields || {}));
    formData.append("filterFields", JSON.stringify(selectedProgramGroup.filterFields || {}));
    formData.append("groupKey", selectedProgramGroup.groupKey || "");
    formData.append("groupByHeaders", JSON.stringify((selectedProgramGroup.sheetHeaders || latestNewProgramHeaders || []).filter((header) => !GROUP_EXCLUDED_HEADER_KEYS.has(normalizeHeader(header)))));
    formData.append("vinColumn", findFirstHeaderName(selectedProgramGroup.sheetHeaders || latestNewProgramHeaders, VIN_HEADER_ALIASES));
    formData.append("productionDateColumn", findFirstHeaderName(selectedProgramGroup.sheetHeaders || latestNewProgramHeaders, PRODUCTION_DATE_HEADER_ALIASES));
    formData.append("excelImportMode", importMode);
    formData.append("sheetName", newProgramSheet?.files?.[0]?.name || "Google Sheet / CSV URL");

    const originalProductionSheet = newProgramSheet?.files?.[0] || null;
    const productionSheetUrl = newProgramSheetUrl?.value?.trim() || "";
    if (originalProductionSheet) {
      formData.append("productionSheet", originalProductionSheet);
    }
    if (productionSheetUrl) {
      formData.append("productionSheetSourceUrl", productionSheetUrl);
    }
    formData.append("carImage", imageFile);
    formData.append("modelFile", modelFile);
    formData.append("modelDataFile", modelDataFile);
    formData.append("manualFile", manualFile);

    const saved = await uploadVehicleForm(formData);
    const savedGroupName = selectedProgramGroup.displayName;

    selectedProgramGroup.saved = true;
    selectedProgramGroup.savedVehicle = saved;
    renderNewProgramGroups();
    await loadVehicles();
    closeProgramAssetDialog();
    setProgress("Program saved", 100);
    showMessage(`${savedGroupName} saved with ${merged.vinNumbers.length} VIN(s) in ${importMode} mode.`, "success");
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Program save failed.", "error");
    setProgress("Failed", 0);
  } finally {
    saveProgramAssetsBtn.disabled = false;
    saveProgramAssetsBtn.textContent = "Save Program";
  }
}

function buildMergedProgramRows(group, existingVehicle, importMode) {
  const newRawRows = group.rawRows || group.rows.map(getRawRow);
  const newNormalizedRows = group.normalizedRows || group.rows.map(getNormalizedRow);
  const newVinNumbers = Array.from(new Set((group.vinNumbers || []).filter(Boolean)));

  if (!existingVehicle) {
    return { rawRows: newRawRows, normalizedRows: newNormalizedRows, vinNumbers: newVinNumbers };
  }

  const existingRawRows = Array.isArray(existingVehicle.rawRows)
    ? existingVehicle.rawRows
    : (Array.isArray(existingVehicle.sheetRows) ? existingVehicle.sheetRows : []);
  const existingNormalizedRows = Array.isArray(existingVehicle.normalizedRows) ? existingVehicle.normalizedRows : [];
  const existingVinNumbers = Array.from(new Set([
    ...(Array.isArray(existingVehicle.vinNumbers) ? existingVehicle.vinNumbers : []),
    existingVehicle.vinNumber
  ].filter(Boolean)));

  const duplicateVins = newVinNumbers.filter((vin) => existingVinNumbers.some((existing) => normalizeComparisonValue(existing) === normalizeComparisonValue(vin)));

  if (importMode === "append" && duplicateVins.length) {
    throw new Error(`These VINs already exist in this program: ${duplicateVins.slice(0, 10).join(", ")}. Change Import Mode to Replace existing group to update them.`);
  }

  if (importMode === "replace") {
    return { rawRows: newRawRows, normalizedRows: newNormalizedRows, vinNumbers: newVinNumbers };
  }

  return {
    rawRows: [...existingRawRows, ...newRawRows],
    normalizedRows: [...existingNormalizedRows, ...newNormalizedRows],
    vinNumbers: Array.from(new Set([...existingVinNumbers, ...newVinNumbers]))
  };
}

function findFirstHeaderName(headers, aliases) {
  const normalizedAliases = new Set((aliases || []).map(normalizeHeader));
  return (headers || []).find((header) => normalizedAliases.has(normalizeHeader(header))) || "";
}

async function saveExistingRevision() {
  if (!existingProgramGroups.length) {
    showMessage("Preview an existing program update sheet first.", "error");
    return;
  }

  const file = existingProgramSheet?.files?.[0] || null;
  const url = existingProgramSheetUrl?.value?.trim() || "";
  const formData = new FormData();
  formData.append("groups", JSON.stringify(existingProgramGroups.map((group) => ({
    groupId: group.groupId,
    programId: group.programId || group.groupId,
    vehicleId: group.matchedVehicle?.id || "",
    vehicleName: group.displayName,
    model: group.model,
    series: group.series,
    seriesLabel: group.seriesLabel,
    variant: group.variant,
    year: group.year,
    region: group.region,
    type: group.type,
    effectiveDate: group.effectiveDate,
    validDate: group.validDate,
    rowCount: group.rows.length,
    matched: Boolean(group.matchedVehicle)
  }))));
  const revisionMode = detectRevisionModeFromRows(latestExistingProgramRows);
  formData.append("sourceUrl", url);
  formData.append("revisionMode", revisionMode);
  formData.append("note", revisionMode === "delta"
    ? "Existing program delta BOM update imported from admin dashboard."
    : "Existing program full BOM replacement imported from admin dashboard."
  );
  if (file) formData.append("revisionSheet", file);

  try {
    setProgress("Saving revision metadata...", 10);
    const response = await fetch(`${API_BASE}/program-revisions`, {
      method: "POST",
      headers: await getAdminHeaders(),
      body: formData
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Revision save failed.");
    setProgress("Revision saved", 100);
    showMessage(`${revisionMode === "delta" ? "Delta" : "Full BOM"} revision saved. The viewer will load the correct BOM automatically for the matching effective/valid date.`, "success");
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Revision save failed.", "error");
    setProgress("Failed", 0);
  }
}

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
  formData.append("effectiveDate", editingVehicle?.effectiveDate || "");
  formData.append("validDate", editingVehicle?.validDate || "");

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
  if (manualEditorWrap) manualEditorWrap.hidden = false;
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
  formTitle.textContent = "Manual / Edit Program";
  submitBtn.textContent = "Upload Vehicle";
  cancelEditBtn.hidden = true;
  currentFiles.hidden = true;
  currentFiles.innerHTML = "";
  updateSelectedFileLabels();
  setProgress("Ready", 0);
  if (manualEditorWrap) manualEditorWrap.hidden = true;
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
