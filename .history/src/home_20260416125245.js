// ==========================================
// 1. FIREBASE AUTHENTICATION (Security Guard)
// ==========================================
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  }
});

// ==========================================
// 2. DOM ELEMENTS & ORIGINAL DATA
// ==========================================
const typeSelect = document.getElementById("typeSelect");
const seriesSelect = document.getElementById("modelSelect");
const regionSelect = document.getElementById("regionSelect");
const grid = document.querySelector('.vehicle-grid');

// Use 'let' so we can update it when new cars arrive from the database
let vehicleCards = document.querySelectorAll(".vehicle-card");

const regionVehicles = {
  india: ["BMW M3", "BMW M4", "BMW IX", "BMW I5", "Audi R8"],
  europe: ["BMW M3", "BMW M4", "BMW Z4 M40I", "BMW M SPORT", "BMW M8", "BMW IX", "BMW I5", "BMW I7", "BMW X3", "BMW XM", "Audi RS7", "Audi R8"],
  usa: ["Audi RS7", "BMW Z4 M40I"],
  germany: ["BMW IX", "BMW I5", "BMW I7", "BMW X3", "BMW XM"],
  china: ["BMW Z4 M40I", "BMW M SPORT", "BMW M8"]
};

// ==========================================
// 3. FETCH DYNAMIC CARS FROM LOCAL DATABASE
// ==========================================
async function loadDatabaseVehicles() {
  try {
    const res = await fetch('/database.json');
    if (!res.ok) return; 
    const newCars = await res.json();

    newCars.forEach(car => {
      // Add the new car to the region list so filters know it exists
      if (!regionVehicles[car.region]) regionVehicles[car.region] = [];
      if (!regionVehicles[car.region].includes(car.name)) {
        regionVehicles[car.region].push(car.name);
      }

      // Create the HTML for the new car
      const cardDiv = document.createElement('div');
      cardDiv.className = 'vehicle-card';
      cardDiv.dataset.type = car.type.toLowerCase();
      cardDiv.dataset.series = car.series.toLowerCase();

      cardDiv.innerHTML = `
        <img src="/images/vehicles/${car.id}.png" alt="${car.name}">
        <div class="vehicle-info">
          <h3>${car.name}</h3>
          <p>Custom Upload</p>
          <button onclick="openVehicle('${car.id}')">Open</button>
        </div>
      `;

      // Add it to the screen
      grid.appendChild(cardDiv);
    });

    // Update the global variables so the dropdown filters work with the new cars
    vehicleCards = document.querySelectorAll(".vehicle-card");
    updateAvailableTypes();
    updateSeriesDropdown();

  } catch (err) {
    console.error("No database.json found or error loading.", err);
  }
}

// ==========================================
// 4. FILTERING LOGIC
// ==========================================
function filterVehicles() {
  const region = regionSelect.value;
  const type = typeSelect.value;
  const series = seriesSelect.value;

  vehicleCards.forEach(card => {
    const name = card.querySelector("h3").innerText;
    const cardType = card.dataset.type;
    const cardSeries = card.dataset.series;

    const regionMatch = !region || (regionVehicles[region] && regionVehicles[region].includes(name));
    const typeMatch = !type || type === cardType;
    const seriesMatch = !series || series === cardSeries;

    if (regionMatch && typeMatch && seriesMatch) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

function updateAvailableTypes() {
  const region = regionSelect.value;
  const types = new Set();

  vehicleCards.forEach(card => {
    const name = card.querySelector("h3").innerText;
    if (!region || (regionVehicles[region] && regionVehicles[region].includes(name))) {
      types.add(card.dataset.type);
    }
  });

  typeSelect.querySelectorAll("option").forEach(option => {
    if (option.value === "") {
      option.style.display = "block";
      return;
    }
    if (!region) {
      option.style.display = "block";
    } else {
      option.style.display = types.has(option.value) ? "block" : "none";
    }
  });
}

function updateSeriesDropdown() {
  const region = regionSelect.value;
  const type = typeSelect.value;
  const availableSeries = new Set();

  vehicleCards.forEach(card => {
    const name = card.querySelector("h3").innerText;
    const cardType = card.dataset.type;
    const cardSeries = card.dataset.series;

    if (region && (!regionVehicles[region] || !regionVehicles[region].includes(name))) return;

    if (!type || type === cardType) {
      availableSeries.add(cardSeries);
    }
  });

  seriesSelect.querySelectorAll("option").forEach(option => {
    if (option.value === "") {
      option.style.display = "block";
      return;
    }
    option.style.display = availableSeries.has(option.value) ? "block" : "none";
  });
  seriesSelect.value = "";
}

// ==========================================
// 5. EVENT LISTENERS
// ==========================================
typeSelect.addEventListener("change", () => {
  updateSeriesDropdown();
  filterVehicles();
});

seriesSelect.addEventListener("change", filterVehicles);

regionSelect.addEventListener("change", () => {
  typeSelect.value = "";
  seriesSelect.value = "";
  updateAvailableTypes();
  updateSeriesDropdown();
  filterVehicles();
});

const resetBtn = document.getElementById("resetFilter");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    regionSelect.value = "";
    typeSelect.value = "";
    seriesSelect.value = "";
    updateAvailableTypes();
    updateSeriesDropdown();
    filterVehicles();
  });
}

// ==========================================
// 6. ROUTING & LOGOUT
// ==========================================
const profileMenu = document.getElementById("profileMenu");
const logoutBtn = document.getElementById("logoutBtn");

if (profileMenu) {
  profileMenu.addEventListener("click", () => {
    profileMenu.classList.toggle("active");
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    window.location.href = "login.html";
  });
}

window.openVehicle = function(vehicleId) {
  localStorage.setItem("selectedVehicle", vehicleId);
  window.location.href = "/car-details.html";
}

// ==========================================
// 7. INITIALIZE PAGE
// ==========================================
// Fetch the cars as soon as the file runs!
loadDatabaseVehicles();