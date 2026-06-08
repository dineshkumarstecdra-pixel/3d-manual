import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { getVehicleById, formatSeriesLabel, writeSelectedVehicleData } from "./vehicleService.js";

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

  const specParagraphs = document.querySelectorAll(".spec p");
  if (specParagraphs.length >= 5) {
    specParagraphs[0].innerText = vehicle.vinNumber || "—";
    specParagraphs[1].innerText = capitalize(vehicle.variant || "base");
    specParagraphs[2].innerText = vehicle.year || "—";
    specParagraphs[3].innerText = capitalize(vehicle.type || "—");
    specParagraphs[4].innerText = formatSeriesLabel(vehicle.series, vehicle.seriesLabel);
  }

  const specLabels = document.querySelectorAll(".spec span");
  if (specLabels.length >= 5) {
    specLabels[0].innerText = "VIN Number";
    specLabels[1].innerText = "Variant";
    specLabels[2].innerText = "Year";
    specLabels[3].innerText = "Type";
    specLabels[4].innerText = "Series";
  }
}

function generateDescription(vehicle) {
  const bits = [vehicle.name];
  if (vehicle.year) bits.push(`${vehicle.year}`);
  if (vehicle.variant) bits.push(`${capitalize(vehicle.variant)} variant`);
  if (vehicle.region && vehicle.region !== "multiple") bits.push(`${capitalize(vehicle.region)} region`);

  return `${bits.join(" · ")} vehicle details are loaded dynamically from the uploaded vehicle database and linked files.`;
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
