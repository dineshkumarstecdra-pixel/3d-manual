const vehicle = localStorage.getItem("selectedVehicle")

const carData = {
 if(carData[vehicle]){
  document.getElementById("carName").innerText = carData[vehicle].name
  document.getElementById("carImg").src = carData[vehicle].img
  document.getElementById("carDesc").innerText = carData[vehicle].desc
} else {
  document.getElementById("carName").innerText = vehicle
  document.getElementById("carImg").src = "/images/vehicles/default.png"
  document.getElementById("carDesc").innerText = "Details coming soon..."
}
}

if(carData[vehicle]){
  document.getElementById("carName").innerText = carData[vehicle].name
  document.getElementById("carImg").src = carData[vehicle].img
}

function openManual(){
  if(carData[vehicle]){
    window.open(carData[vehicle].manual, "_blank")
  }
}

function openParts(){
  localStorage.setItem("selectedVehicle", vehicle) // 🔥 MAIN FIX

    window.location.href = "/index.html"
}