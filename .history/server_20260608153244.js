import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import fsp from "fs/promises";
import "dotenv/config";
import { MongoClient } from "mongodb";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = process.cwd();
const PORT = Number(process.env.UPLOAD_SERVER_PORT || 3001);
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@gmail.com").toLowerCase();
const ASSET_ROOT = resolveProjectPath(process.env.LOCAL_ASSET_ROOT || ".");
const DATABASE_PATH = resolveProjectPath(
  process.env.DATABASE_PATH || path.join(path.relative(PROJECT_ROOT, ASSET_ROOT), "database.json")
);
const ORDERS_PATH = resolveProjectPath(process.env.ORDERS_PATH || path.join(".local-data", "orders.json"));
const PROGRAM_REVISIONS_PATH = resolveProjectPath(process.env.PROGRAM_REVISIONS_PATH || path.join(".local-data", "program-revisions.json"));
const PROGRAM_REVISION_UPLOAD_DIR = path.join(ASSET_ROOT, "Parts Details", "BOM Revisions");
const PRODUCTION_SHEET_UPLOAD_DIR = path.join(ASSET_ROOT, "Production Sheets");
const TEMP_DIR = path.join(PROJECT_ROOT, ".upload-temp");


const BUILT_IN_VEHICLES = [
  builtInVehicle("bmw_m3", "BMW M3", "coupe", "m", "M", "2022"),
  builtInVehicle("audi_rs7", "Audi RS7", "sedan", "r", "R", "2021"),
  builtInVehicle("audi_r8", "Audi R8", "sedan", "r", "R", "2021"),
  builtInVehicle("bmw_m4", "BMW M4", "coupe", "m", "M", "2021"),
  builtInVehicle("bmw_z4", "BMW Z4 M40I", "sedan", "z", "Z", "2020"),
  builtInVehicle("bmw_ms", "BMW M SPORT", "coupe", "m", "M", "2020"),
  builtInVehicle("bmw_m8", "BMW M8", "coupe", "m", "M", "2020"),
  builtInVehicle("bmw_ix", "BMW IX", "suv", "i", "I", "2020"),
  builtInVehicle("bmw_i5", "BMW I5", "suv", "i", "I", "2020"),
  builtInVehicle("bmw_i7", "BMW I7", "suv", "i", "I", "2020"),
  builtInVehicle("bmw_x3", "BMW X3", "suv", "x", "X", "2020"),
  builtInVehicle("bmw_xm", "BMW XM", "suv", "x", "X", "2020")
];

const allowedExtensions = {
  carImage: ["jpg", "jpeg", "png", "svg", "webp"],
  modelFile: ["stp", "step", "stl", "glb", "gltf", "obj", "dwg", "dxf", "fbx"],
  modelDataFile: ["xlsx", "xls", "csv"],
  manualFile: ["pdf", "xlsx", "xls", "doc", "docx", "ppt", "pptx", "txt"],
  productionSheet: ["xlsx", "xls", "csv"]
};

const fileTargets = {
  carImage: {
    key: "image",
    folder: path.join(ASSET_ROOT, "images", "vehicles"),
    label: "Car Image"
  },
  modelFile: {
    key: "model",
    folder: path.join(ASSET_ROOT, "models"),
    label: "Model File"
  },
  modelDataFile: {
    key: "modelData",
    folder: path.join(ASSET_ROOT, "Parts Details", "Model Data"),
    label: "Model Data"
  },
  manualFile: {
    key: "manual",
    folder: path.join(ASSET_ROOT, "manuals"),
    label: "Service Manual"
  },
  productionSheet: {
    key: "productionSheet",
    folder: PRODUCTION_SHEET_UPLOAD_DIR,
    label: "Production Sheet"
  }
};

await ensureDirectories();

const upload = multer({
  dest: TEMP_DIR,
  limits: {
    files: 5,
    fileSize: 1024 * 1024 * 1024
  }
});

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.static(ASSET_ROOT));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode: "local",
    assetRoot: ASSET_ROOT,
    database: DATABASE_PATH
  });
});

app.get("/api/vehicles/public", async (req, res) => {
  try {
    const uploadedVehicles = await readDatabase();
    const vehicles = mergeBuiltInVehicles(uploadedVehicles);
    res.json(vehicles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Could not load vehicles." });
  }
});

app.get("/api/vehicles", requireAdmin, async (req, res) => {
  const uploadedVehicles = await readDatabase();
  const vehicles = mergeBuiltInVehicles(uploadedVehicles);
  res.json(vehicles);
});

app.post(
  "/api/vehicles",
  requireAdmin,
  upload.fields([
    { name: "carImage", maxCount: 1 },
    { name: "modelFile", maxCount: 1 },
    { name: "modelDataFile", maxCount: 1 },
    { name: "manualFile", maxCount: 1 },
    { name: "productionSheet", maxCount: 1 }
  ]),
  async (req, res) => {
    const uploadedTempFiles = flattenUploadedFiles(req.files);

    try {
      const vehicles = await readDatabase();
      const editingId = normalizeVehicleId(req.body.editingId || req.body.id);
      const uploadedPrevious = editingId ? vehicles.find((vehicle) => vehicle.id === editingId) || null : null;
      const builtInPrevious = !uploadedPrevious && editingId
        ? BUILT_IN_VEHICLES.find((vehicle) => vehicle.id === editingId) || null
        : null;
      const previous = uploadedPrevious || builtInPrevious || null;
      const isNew = !previous;
      const isBuiltInEdit = Boolean(builtInPrevious);

      let vehicleId = previous?.id || normalizeVehicleId(req.body.id);
      if (!vehicleId) {
        vehicleId = createUniqueVehicleId(req.body.name, vehicles);
      }

      if (!vehicleId || !isValidVehicleId(vehicleId)) {
        throw httpError(400, "Vehicle ID could not be generated. Please enter a valid vehicle name.");
      }

      if (isNew && (!req.files?.carImage?.[0] || !req.files?.modelFile?.[0] || !req.files?.modelDataFile?.[0] || !req.files?.manualFile?.[0])) {
        throw httpError(400, "New vehicle upload requires image, model file, model data Excel/CSV and service manual.");
      }

      validateUploadedFiles(req.files || {});

      const savedFiles = {
        image: previous?.image || null,
        model: previous?.model || null,
        modelData: previous?.modelData || null,
        manual: previous?.manual || null,
        productionSheet: previous?.productionSheet || null
      };

      for (const [fieldName, config] of Object.entries(fileTargets)) {
        const file = req.files?.[fieldName]?.[0];
        if (!file) continue;
        savedFiles[config.key] = await saveUploadedFile(vehicleId, file, config);
      }

      const now = new Date().toISOString();
      const seriesValue = normalizeSeriesValue(req.body.series || req.body.seriesLabel);
      const seriesLabel = String(req.body.seriesLabel || req.body.series || "").trim();

      const vehicle = {
        ...(previous || {}),
        id: vehicleId,
        name: String(req.body.name || "").trim(),
        vinNumber: String(req.body.vinNumber || previous?.vinNumber || "").trim(),
        vinNumbers: safeJsonArray(req.body.vinNumbers, previous?.vinNumbers || []),
        variant: String(req.body.variant || "").trim().toLowerCase(),
        year: Number(req.body.year),
        region: String(req.body.region || "").trim().toLowerCase(),
        type: String(req.body.type || "").trim().toLowerCase(),
        series: seriesValue,
        seriesLabel,
        image: savedFiles.image,
        model: savedFiles.model,
        modelData: savedFiles.modelData,
        manual: savedFiles.manual,
        imageUrl: savedFiles.image?.url || "",
        modelUrl: savedFiles.model?.url || "",
        modelDataUrl: savedFiles.modelData?.url || "",
        manualUrl: savedFiles.manual?.url || "",
        productionSheet: savedFiles.productionSheet || null,
        productionSheetUrl: savedFiles.productionSheet?.url || previous?.productionSheetUrl || "",
        productionSheetSourceUrl: String(req.body.productionSheetSourceUrl || previous?.productionSheetSourceUrl || "").trim(),
        effectiveDate: String(req.body.effectiveDate || previous?.effectiveDate || "").trim(),
        validDate: String(req.body.validDate || previous?.validDate || "").trim(),
        productionCount: Number.parseInt(req.body.productionCount || previous?.productionCount || 0, 10) || 0,
        sheetRows: safeJsonArray(req.body.sheetRows, previous?.sheetRows || []),
        createdAt: isBuiltInEdit ? now : (previous?.createdAt || now),
        updatedAt: now,
        builtIn: false,
        readOnly: false,
        source: String(req.body.source || "").trim() || (isBuiltInEdit ? "converted-from-existing-card" : (previous?.source || "uploaded")),
        storageMode: "local"
      };

      validateVehiclePayload(vehicle);

      const nextVehicles = upsertVehicle(vehicles, vehicle);
      await writeDatabase(nextVehicles);
      await cleanupTempFiles(uploadedTempFiles);

      const previewableExtensions = new Set(["glb", "gltf", "obj", "stl", "fbx", "stp", "step", "dxf"]);
      const warning = vehicle.model?.extension && !previewableExtensions.has(vehicle.model.extension)
        ? "Model uploaded locally. DWG direct preview is not available in the browser; convert DWG to DXF, STP/STEP, GLB, OBJ, STL or FBX for viewer preview."
        : "";

      res.json({ ...vehicle, warning });
    } catch (error) {
      await cleanupTempFiles(uploadedTempFiles);
      const status = error.status || 500;
      console.error(error);
      res.status(status).json({ error: error.message || "Upload failed." });
    }
  }
);

app.delete("/api/vehicles/:id", requireAdmin, async (req, res) => {
  try {
    const vehicleId = normalizeVehicleId(req.params.id);
    const vehicles = await readDatabase();
    const vehicle = vehicles.find((item) => item.id === vehicleId);

    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found." });
      return;
    }

    await Promise.all([
      deleteLocalFile(vehicle.image?.localPath),
      deleteLocalFile(vehicle.model?.localPath),
      deleteLocalFile(vehicle.modelData?.localPath),
      deleteLocalFile(vehicle.manual?.localPath),
      removeFilesByStem(fileTargets.carImage.folder, vehicleId),
      removeFilesByStem(fileTargets.modelFile.folder, vehicleId),
      removeFilesByStem(fileTargets.modelDataFile.folder, vehicleId),
      removeFilesByStem(fileTargets.manualFile.folder, vehicleId)
    ]);

    await writeDatabase(vehicles.filter((item) => item.id !== vehicleId));
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Delete failed." });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const requesterEmail = String(req.headers["x-user-email"] || req.body.requestedBy || "").trim().toLowerCase();
    if (!requesterEmail) throw httpError(401, "Login required to place order.");

    const items = sanitizeOrderItems(req.body.items);
    if (!items.length) throw httpError(400, "Order must contain at least one part.");

    const customer = req.body.customer || {};
    const now = new Date().toISOString();
    const order = {
      id: createOrderId(),
      status: "pending",
      requestedBy: requesterEmail,
      customer: {
        name: String(customer.name || "").trim(),
        contact: String(customer.contact || "").trim(),
        notes: String(customer.notes || "").trim()
      },
      totalQty: items.reduce((total, item) => total + item.qty, 0),
      vehicleSummary: [...new Set(items.map((item) => item.vehicleName || item.vehicleId).filter(Boolean))],
      items,
      adminNote: "",
      reviewedBy: "",
      createdAt: now,
      updatedAt: now,
      statusHistory: [
        { status: "pending", by: requesterEmail, at: now, note: "Order placed" }
      ]
    };

    const orders = await readOrders();
    orders.unshift(order);
    await writeOrders(orders);
    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Order creation failed." });
  }
});

app.get("/api/orders/mine", async (req, res) => {
  try {
    const requesterEmail = String(req.headers["x-user-email"] || req.query.email || "").trim().toLowerCase();
    if (!requesterEmail) throw httpError(401, "Login required to view orders.");

    const orders = await readOrders();
    const mine = orders.filter((order) => String(order.requestedBy || "").toLowerCase() === requesterEmail);
    res.json(mine);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Could not load your orders." });
  }
});

app.get("/api/orders", requireAdmin, async (req, res) => {
  try {
    const orders = await readOrders();
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Could not load orders." });
  }
});

app.patch("/api/orders/:id", requireAdmin, async (req, res) => {
  try {
    const status = String(req.body.status || "").trim().toLowerCase();
    const allowedStatuses = new Set(["pending", "approved", "rejected", "completed"]);
    if (!allowedStatuses.has(status)) throw httpError(400, "Invalid order status.");

    const adminEmail = String(req.headers["x-admin-email"] || ADMIN_EMAIL).toLowerCase();
    const adminNote = String(req.body.adminNote || "").trim();
    const now = new Date().toISOString();
    const orders = await readOrders();
    const order = orders.find((item) => item.id === req.params.id);

    if (!order) throw httpError(404, "Order not found.");

    order.status = status;
    order.adminNote = adminNote || order.adminNote || "";
    order.reviewedBy = adminEmail;
    order.updatedAt = now;
    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    order.statusHistory.unshift({ status, by: adminEmail, at: now, note: adminNote });

    await writeOrders(orders);
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Order update failed." });
  }
});

app.delete("/api/orders/:id", requireAdmin, async (req, res) => {
  try {
    const orders = await readOrders();
    const next = orders.filter((order) => order.id !== req.params.id);
    if (next.length === orders.length) throw httpError(404, "Order not found.");
    await writeOrders(next);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Order delete failed." });
  }
});



app.get("/api/program-revisions/public", async (req, res) => {
  try {
    const revisions = await readProgramRevisions();
    res.json(revisions.map(toPublicRevision));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Could not load program revisions." });
  }
});

app.get("/api/program-revisions/active", async (req, res) => {
  try {
    const vehicleId = normalizeVehicleId(req.query.vehicleId);
    const requestedDate = normalizeDateOnly(req.query.date) || todayDateOnly();
    if (!vehicleId) throw httpError(400, "vehicleId is required.");

    const uploadedVehicles = await readDatabase();
    const vehicles = mergeBuiltInVehicles(uploadedVehicles);
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) throw httpError(404, "Vehicle/program not found.");

    const revisions = await readProgramRevisions();
    const matches = findRevisionMatches(vehicle, revisions, requestedDate);
    const active = matches[0] || null;

    res.json({
      active: Boolean(active),
      targetDate: requestedDate,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      baseModelDataUrl: vehicle.modelDataUrl || vehicle.modelData?.url || "",
      revision: active ? toPublicRevision(active.revision) : null,
      group: active ? active.group : null,
      sheet: active ? getRevisionSheet(active.revision) : null,
      matchesCount: matches.length
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Could not resolve active BOM revision." });
  }
});

app.get("/api/program-revisions", requireAdmin, async (req, res) => {
  try {
    const revisions = await readProgramRevisions();
    res.json(revisions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Could not load program revisions." });
  }
});

app.post("/api/program-revisions", requireAdmin, upload.single("revisionSheet"), async (req, res) => {
  const uploadedTempFiles = flattenUploadedFiles({ revisionSheet: req.file ? [req.file] : [] });
  try {
    const now = new Date().toISOString();
    const revisionId = createRevisionId();
    const groups = safeJsonArray(req.body.groups, []);
    if (!groups.length) throw httpError(400, "Revision must include at least one program group.");

    let savedSheet = null;
    if (req.file) {
      const ext = getExtension(req.file.originalname);
      if (!["xlsx", "xls", "csv"].includes(ext)) {
        throw httpError(400, "Revision sheet must be Excel or CSV.");
      }
      const finalName = `${revisionId}.${ext}`;
      const finalPath = path.join(PROGRAM_REVISION_UPLOAD_DIR, finalName);
      await fsp.rename(req.file.path, finalPath);
      const localPath = path.relative(ASSET_ROOT, finalPath).split(path.sep).join("/");
      savedSheet = {
        name: req.file.originalname,
        storedName: finalName,
        localPath,
        url: toPublicUrl(localPath),
        size: req.file.size,
        type: req.file.mimetype || "",
        extension: ext
      };
    }

    const adminEmail = String(req.headers["x-admin-email"] || ADMIN_EMAIL).toLowerCase();
    const revision = {
      id: revisionId,
      groups,
      sourceUrl: String(req.body.sourceUrl || "").trim(),
      note: String(req.body.note || "").trim(),
      revisionMode: String(req.body.revisionMode || "auto").trim().toLowerCase(),
      sheet: savedSheet,
      createdBy: adminEmail,
      createdAt: now,
      updatedAt: now,
      status: "saved"
    };

    const revisions = await readProgramRevisions();
    revisions.unshift(revision);
    await writeProgramRevisions(revisions);
    await cleanupTempFiles(uploadedTempFiles.filter((file) => file.path && (!savedSheet || !file.originalname)));
    res.status(201).json(revision);
  } catch (error) {
    await cleanupTempFiles(uploadedTempFiles);
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Program revision save failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Local upload server running on http://localhost:${PORT}`);
  console.log(`Asset root: ${ASSET_ROOT}`);
  console.log(`Database: ${DATABASE_PATH}`);
  console.log(`Orders: ${ORDERS_PATH}`);
  console.log(`Program revisions: ${PROGRAM_REVISIONS_PATH}`);
});

function builtInVehicle(id, name, type, series, seriesLabel, year) {
  const now = "built-in";
  return {
    id,
    name,
    vinNumber: "—",
    variant: "base",
    year: Number(year) || "—",
    region: "multiple",
    type,
    series,
    seriesLabel,
    imageUrl: `/images/vehicles/${id}.png`,
    modelUrl: `/models/${id}.glb`,
    modelDataUrl: "/Parts Details/Parts data.xlsx",
    manualUrl: `/manuals/${id}.pdf`,
    image: { url: `/images/vehicles/${id}.png`, storedName: `${id}.png`, extension: "png", name: `${id}.png` },
    model: { url: `/models/${id}.glb`, storedName: `${id}.glb`, extension: "glb", name: `${id}.glb` },
    modelData: { url: "/Parts Details/Parts data.xlsx", storedName: "Parts data.xlsx", extension: "xlsx", name: "Parts data.xlsx" },
    manual: { url: `/manuals/${id}.pdf`, storedName: `${id}.pdf`, extension: "pdf", name: `${id}.pdf` },
    builtIn: true,
    readOnly: true,
    storageMode: "built-in",
    createdAt: now,
    updatedAt: now
  };
}

function mergeBuiltInVehicles(uploadedVehicles) {
  const uploaded = Array.isArray(uploadedVehicles) ? uploadedVehicles : [];
  const uploadedIds = new Set(uploaded.map((vehicle) => String(vehicle.id || "").trim()).filter(Boolean));
  const builtIns = BUILT_IN_VEHICLES.filter((vehicle) => !uploadedIds.has(vehicle.id));
  return [...uploaded, ...builtIns];
}

function requireAdmin(req, res, next) {
  const email = String(req.headers["x-admin-email"] || "").toLowerCase();
  if (email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "Admin access only." });
    return;
  }
  next();
}

function resolveProjectPath(value) {
  if (!value || value === ".") return PROJECT_ROOT;
  return path.isAbsolute(value) ? value : path.resolve(PROJECT_ROOT, value);
}

async function ensureDirectories() {
  await Promise.all([
    fsp.mkdir(TEMP_DIR, { recursive: true }),
    fsp.mkdir(path.dirname(DATABASE_PATH), { recursive: true }),
    fsp.mkdir(path.dirname(ORDERS_PATH), { recursive: true }),
    fsp.mkdir(path.dirname(PROGRAM_REVISIONS_PATH), { recursive: true }),
    fsp.mkdir(PROGRAM_REVISION_UPLOAD_DIR, { recursive: true }),
    fsp.mkdir(PRODUCTION_SHEET_UPLOAD_DIR, { recursive: true }),
    ...Object.values(fileTargets).map((target) => fsp.mkdir(target.folder, { recursive: true }))
  ]);

  if (!fs.existsSync(DATABASE_PATH)) {
    await fsp.writeFile(DATABASE_PATH, "[]\n", "utf8");
  }

  if (!fs.existsSync(ORDERS_PATH)) {
    await fsp.writeFile(ORDERS_PATH, "[]\n", "utf8");
  }

  if (!fs.existsSync(PROGRAM_REVISIONS_PATH)) {
    await fsp.writeFile(PROGRAM_REVISIONS_PATH, "[]\n", "utf8");
  }
}

async function readDatabase() {
  try {
    const raw = await fsp.readFile(DATABASE_PATH, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeDatabase(vehicles) {
  await fsp.writeFile(DATABASE_PATH, `${JSON.stringify(vehicles, null, 2)}\n`, "utf8");
}

async function readOrders() {
  try {
    const raw = await fsp.readFile(ORDERS_PATH, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeOrders(orders) {
  await fsp.writeFile(ORDERS_PATH, `${JSON.stringify(Array.isArray(orders) ? orders : [], null, 2)}\n`, "utf8");
}


async function readProgramRevisions() {
  try {
    const raw = await fsp.readFile(PROGRAM_REVISIONS_PATH, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeProgramRevisions(revisions) {
  await fsp.writeFile(PROGRAM_REVISIONS_PATH, `${JSON.stringify(Array.isArray(revisions) ? revisions : [], null, 2)}\n`, "utf8");
}

function sanitizeOrderItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      id: String(item.id || "").trim(),
      vehicleId: String(item.vehicleId || "").trim(),
      vehicleName: String(item.vehicleName || item.vehicleId || "Vehicle").trim(),
      partName: String(item.partName || "").trim(),
      partId: String(item.partId || "-").trim(),
      availableQty: Number.parseInt(item.availableQty || 0, 10) || 0,
      qty: Math.max(1, Number.parseInt(item.qty || 1, 10) || 1),
      addedAt: item.addedAt || ""
    }))
    .filter((item) => item.partName && item.vehicleId);
}

function createOrderId() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${stamp}-${suffix}`;
}

function upsertVehicle(vehicles, vehicle) {
  const next = [];
  let inserted = false;

  for (const item of vehicles) {
    if (item.id === vehicle.id) {
      if (!inserted) {
        next.push(vehicle);
        inserted = true;
      }
      continue;
    }
    next.push(item);
  }

  if (!inserted) next.push(vehicle);
  return next;
}

function validateVehiclePayload(vehicle) {
  const required = ["id", "name", "variant", "year", "region", "type", "series"];
  for (const key of required) {
    if (vehicle[key] === "" || vehicle[key] === null || Number.isNaN(vehicle[key])) {
      throw httpError(400, `${key} is required.`);
    }
  }

  if (!["base", "plus"].includes(vehicle.variant)) {
    throw httpError(400, "Variant must be Base or Plus.");
  }
}

function validateUploadedFiles(files) {
  for (const [fieldName, fileList] of Object.entries(files)) {
    const file = fileList?.[0];
    if (!file) continue;

    const extension = getExtension(file.originalname);
    const allowed = allowedExtensions[fieldName];
    if (!allowed?.includes(extension)) {
      throw httpError(400, `${fileTargets[fieldName]?.label || fieldName} extension must be one of: ${allowed.join(", ")}`);
    }
  }
}

async function saveUploadedFile(vehicleId, file, config) {
  await removeFilesByStem(config.folder, vehicleId);

  const extension = getExtension(file.originalname);
  const finalName = `${vehicleId}.${extension}`;
  const finalPath = path.join(config.folder, finalName);

  await fsp.rename(file.path, finalPath);

  const localPath = path.relative(ASSET_ROOT, finalPath).split(path.sep).join("/");
  const url = toPublicUrl(localPath);

  return {
    name: file.originalname,
    storedName: finalName,
    localPath,
    url,
    size: file.size,
    type: file.mimetype || "",
    extension
  };
}

async function removeFilesByStem(folder, stem) {
  try {
    const files = await fsp.readdir(folder);
    await Promise.all(
      files
        .filter((file) => file === stem || file.startsWith(`${stem}.`))
        .map((file) => fsp.unlink(path.join(folder, file)).catch(() => {}))
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function deleteLocalFile(localPath) {
  if (!localPath) return;
  const fullPath = path.resolve(ASSET_ROOT, localPath);
  const rootPath = path.resolve(ASSET_ROOT);
  if (!fullPath.startsWith(rootPath)) return;
  await fsp.unlink(fullPath).catch(() => {});
}

async function cleanupTempFiles(files) {
  await Promise.all(files.map((file) => fsp.unlink(file.path).catch(() => {})));
}

function flattenUploadedFiles(files = {}) {
  return Object.values(files).flat().filter(Boolean);
}

function createUniqueVehicleId(name, vehicles) {
  const base = normalizeVehicleId(name) || "vehicle";
  const existingIds = new Set(vehicles.map((vehicle) => vehicle.id));
  let candidate = base;
  let counter = 2;

  while (existingIds.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter += 1;
  }

  return candidate;
}

function toPublicUrl(localPath) {
  return `/${localPath.split("/").map(encodeURIComponent).join("/")}`;
}

function getExtension(fileName) {
  return String(fileName || "").split(".").pop().toLowerCase();
}

function normalizeVehicleId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSeriesValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isValidVehicleId(value) {
  return /^[a-z0-9_-]+$/.test(value);
}


function safeJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (!value) return Array.isArray(fallback) ? fallback : [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : (Array.isArray(fallback) ? fallback : []);
  } catch {
    return Array.isArray(fallback) ? fallback : [];
  }
}

function createRevisionId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REV-${stamp}-${suffix}`;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toPublicRevision(revision) {
  if (!revision) return null;
  return {
    id: revision.id,
    groups: Array.isArray(revision.groups) ? revision.groups : [],
    sourceUrl: revision.sourceUrl || "",
    note: revision.note || "",
    revisionMode: revision.revisionMode || "auto",
    sheet: getRevisionSheet(revision),
    createdBy: revision.createdBy || "",
    createdAt: revision.createdAt || "",
    updatedAt: revision.updatedAt || "",
    status: revision.status || "saved"
  };
}

function getRevisionSheet(revision) {
  if (!revision) return null;
  if (revision.sheet?.url) return revision.sheet;
  const sourceUrl = String(revision.sourceUrl || "").trim();
  if (!sourceUrl) return null;
  return {
    name: "Google Sheet / external sheet",
    url: sourceUrl,
    extension: sourceUrl.toLowerCase().includes("csv") ? "csv" : "xlsx",
    external: true
  };
}

function findRevisionMatches(vehicle, revisions, requestedDate) {
  const matches = [];

  for (const revision of Array.isArray(revisions) ? revisions : []) {
    const sheet = getRevisionSheet(revision);
    if (!sheet?.url) continue;

    for (const group of Array.isArray(revision.groups) ? revision.groups : []) {
      if (!matchesVehicleProgram(vehicle, group)) continue;
      if (!dateInRevisionRange(requestedDate, group.effectiveDate, group.validDate)) continue;
      matches.push({ revision, group });
    }
  }

  return matches.sort((a, b) => {
    const aDate = Date.parse(a.group.effectiveDate || a.revision.createdAt || "") || 0;
    const bDate = Date.parse(b.group.effectiveDate || b.revision.createdAt || "") || 0;
    if (aDate !== bDate) return bDate - aDate;
    return String(b.revision.createdAt || "").localeCompare(String(a.revision.createdAt || ""));
  });
}

function matchesVehicleProgram(vehicle, group) {
  if (!vehicle || !group) return false;

  const vehicleId = normalizeVehicleId(vehicle.id);
  const groupVehicleId = normalizeVehicleId(group.vehicleId || group.groupId);
  if (groupVehicleId && groupVehicleId === vehicleId) return true;

  const vehicleName = normalizeComparisonText(vehicle.name || vehicle.vehicleName || "");
  const groupName = normalizeComparisonText(group.vehicleName || group.displayName || group.model || "");
  const vehicleModel = normalizeComparisonText(vehicle.model || vehicle.name || "");
  const groupModel = normalizeComparisonText(group.model || group.vehicleName || group.displayName || "");

  const nameMatches = Boolean(groupName && (groupName === vehicleName || groupName === vehicleModel || vehicleName.includes(groupName) || groupName.includes(vehicleName)));
  const modelMatches = Boolean(groupModel && (groupModel === vehicleModel || groupModel === vehicleName || vehicleModel.includes(groupModel) || groupModel.includes(vehicleModel)));

  const vehicleSeries = normalizeSeriesValue(vehicle.series || vehicle.seriesLabel || "");
  const groupSeries = normalizeSeriesValue(group.series || group.seriesLabel || "");
  const vehicleVariant = String(vehicle.variant || "").trim().toLowerCase();
  const groupVariant = String(group.variant || "").trim().toLowerCase();

  const seriesMatches = !groupSeries || !vehicleSeries || groupSeries === vehicleSeries;
  const variantMatches = !groupVariant || !vehicleVariant || groupVariant === vehicleVariant;

  return (nameMatches || modelMatches) && seriesMatches && variantMatches;
}

function dateInRevisionRange(targetDate, effectiveDate, validDate) {
  const target = dateValue(targetDate);
  if (!target) return true;

  const from = dateValue(effectiveDate);
  const to = dateValue(validDate);

  if (from && target < from) return false;
  if (to && target > to) return false;
  return true;
}

function dateValue(value) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return 0;
  return Date.parse(`${normalized}T00:00:00Z`) || 0;
}

function normalizeDateOnly(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeComparisonText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
