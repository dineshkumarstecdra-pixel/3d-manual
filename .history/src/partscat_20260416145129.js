import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

// 1. AUTHENTICATION CHECK
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  }
});

// 2. DOM ELEMENTS
const typeSelect = document.getElementById("typeSelect");
const seriesSelect = document.getElementById("modelSelect");
const regionSelect = document.getElementById("regionSelect");
const resetBtn = document.getElementById("resetFilter");
let vehicleCards = document.querySelectorAll(".vehicle-card");

// 3. REGION DATA
const regionVehicles = {
  india: ["BMW M3", "BMW M4", "BMW IX", "BMW I5", "Audi R8"],
  europe: ["BMW M3", "BMW M4", "BMW Z4 M40I", "BMW M SPORT", "BMW M8", "BMW IX", "BMW I5", "BMW I7", "BMW X3", "BMW XM", "Audi RS7", "Audi R8"],
  usa: ["Audi RS7", "BMW Z4 M40I"],
  germany: ["BMW IX", "BMW I5", "BMW I7", "BMW X3", "BMW XM"],
  china: ["BMW Z4 M40I", "BMW M SPORT", "BMW M8"]
};

// 4. MASTER FILTER FUNCTION
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

  updateDropdownOptions();
}

// 5. UPDATE DROPDOWN OPTIONS DYNAMICALLY
function updateDropdownOptions() {
  const region = regionSelect.value;
  const type = typeSelect.value;
  const availableTypes = new Set();
  const availableSeries = new Set();

  vehicleCards.forEach(card => {
    const name = card.querySelector("h3").innerText;
    const cardType = card.dataset.type;
    const cardSeries = card.dataset.series;
    const regionMatch = !region || (regionVehicles[region] && regionVehicles[region].includes(name));

    if (regionMatch) availableTypes.add(cardType);
    if (regionMatch && (!type || type === cardType)) availableSeries.add(cardSeries);
  });

  Array.from(typeSelect.options).forEach(opt => {
    if (opt.value === "") { opt.style.display = "block"; return; }
    opt.style.display = availableTypes.has(opt.value) ? "block" : "none";
  });

  Array.from(seriesSelect.options).forEach(opt => {
    if (opt.value === "") { opt.style.display = "block"; return; }
    opt.style.display = availableSeries.has(opt.value) ? "block" : "none";
  });
}

// 6. EVENT LISTENERS
regionSelect.addEventListener("change", () => {
  typeSelect.value = ""; 
  seriesSelect.value = "";
  filterVehicles();
});

typeSelect.addEventListener("change", () => {
  seriesSelect.value = ""; 
  filterVehicles();
});

seriesSelect.addEventListener("change", filterVehicles);

resetBtn.addEventListener("click", () => {
  regionSelect.value = "";
  typeSelect.value = "";
  seriesSelect.value = "";
  filterVehicles();
});

// 7. PROFILE LOGOUT MENU FIX
const profileMenu = document.getElementById("profileMenu");
const logoutBtn = document.getElementById("logoutBtn");

profileMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle("active");
});

document.addEventListener("click", (e) => {
    if (!profileMenu.contains(e.target)) {
        profileMenu.classList.remove("active");
    }
});

logoutBtn.addEventListener("click", () => {
    window.location.href = "login.html";
});

// 8. OPEN VEHICLE ROUTING (Parts Cat routes to index.html 3D Viewer)
window.openVehicle = function(vehicle) {
    localStorage.setItem("selectedVehicle", vehicle);
    window.location.href = "/index.html";
}

// 9. DYNAMIC DATABASE LOAD
async function loadDatabaseVehicles() {
    try {
        const res = await fetch('/database.json');
        if (!res.ok) return; 
        const newCars = await res.json();
        const grid = document.querySelector('.vehicle-grid');

        newCars.forEach(car => {
            if (regionVehicles[car.region]) {
                if (!regionVehicles[car.region].includes(car.name)) {
                    regionVehicles[car.region].push(car.name);
                }
            }
            const cardDiv = document.createElement('div');
            cardDiv.className = 'vehicle-card';
            cardDiv.dataset.type = car.type.toLowerCase();
            cardDiv.dataset.series = car.series.toLowerCase();
            cardDiv.innerHTML = `
              <img src="/images/vehicles/${car.id}.png" alt="${car.name}">
              <div class="vehicle-info">
                <h3>${car.name}</h3>
                <p>New Arrival</p>
                <button onclick="openVehicle('${car.id}')">Open</button>
              </div>
            `;
            grid.appendChild(cardDiv);
        });

        vehicleCards = document.querySelectorAll('.vehicle-card');
        updateDropdownOptions();

    } catch (err) {
        console.error("Error loading dynamic vehicles:", err);
    }
}

loadDatabaseVehicles();