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