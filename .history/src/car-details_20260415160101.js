const vehicle = localStorage.getItem("selectedVehicle")

// 🔥 Convert key → proper name
function formatName(vehicle){
  return vehicle
    .replaceAll("_", " ")
    .replace(/\b\w/g, l => l.toUpperCase())
}

// 🔥 Generate description automatically
function generateDescription(name){
  return `${name} is a premium performance vehicle designed with advanced engineering, powerful performance, and modern technology for an exceptional driving experience.`
}

// 🔥 AUTO DATA
const car = {
  name: formatName(vehicle),
  img: `/images/vehicles/${vehicle}.png`,
  manual: `/manuals/${vehicle}.pdf`,
  desc: generateDescription(formatName(vehicle))
}

// 🔥 UI UPDATE
document.getElementById("carName").innerText = car.name
document.getElementById("carImg").src = car.img
document.getElementById("carDesc").innerText = car.desc

// 🔥 BUTTONS
function openManual(){
  window.open(car.manual, "_blank")
}

function openParts(){
  localStorage.setItem("selectedVehicle", vehicle)
  window.location.href = "/index.html"
}

// 🔥 IMPORTANT
window.openManual = openManual
window.openParts = openParts
// Add this to the bottom of car-details.js

// 1. Create a dictionary of vehicle specs
const vehicleSpecs = {
  bmw_m3: { engine: "3.0L Twin-Turbo Inline-6", power: "480 HP", speed: "4.2 sec", trans: "6-Speed Manual", drive: "RWD" },
  bmw_m4: { engine: "3.0L Twin-Turbo Inline-6", power: "503 HP", speed: "3.8 sec", trans: "8-Speed Auto", drive: "RWD" },
  bmw_ix: { engine: "Dual Electric Motor", power: "516 HP", speed: "4.4 sec", trans: "Single-Speed", drive: "AWD Dual Motor" },
  audi_rs7: { engine: "4.0L Twin-Turbo V8", power: "591 HP", speed: "3.5 sec", trans: "8-Speed Auto", drive: "Quattro AWD" },
  audi_r8: { engine: "5.2L Naturally Aspirated V10", power: "602 HP", speed: "3.2 sec", trans: "7-Speed Dual-Clutch", drive: "Quattro AWD" },
  // Add more vehicles here as needed...
};

// 2. Get the specs for the currently selected vehicle (fallback to M3 if missing)
const currentSpecs = vehicleSpecs[vehicle] || vehicleSpecs["bmw_m3"];

// 3. Inject the data into the HTML <p> tags
const specParagraphs = document.querySelectorAll('.spec p');
if (specParagraphs.length >= 5) {
  specParagraphs[0].innerText = currentSpecs.engine;
  specParagraphs[1].innerText = currentSpecs.power;
  specParagraphs[2].innerText = currentSpecs.speed;
  specParagraphs[3].innerText = currentSpecs.trans;
  specParagraphs[4].innerText = currentSpecs.drive;
}