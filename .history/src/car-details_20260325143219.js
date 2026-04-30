const vehicle = localStorage.getItem("selectedVehicle")

const carData = {
  bmw_m3: {
    name: "BMW M3",
    img: "/images/vehicles/bmw_m3.png",
    manual: "/manuals/bmw_m3.pdf",
    parts: "/parts/bmw_m3.pdf",
    desc: "BMW M3 is a high-performance sports sedan with aggressive design."
  },
  audi_r8: {
    name: "Audi R8",
    img: "/images/vehicles/audi_r8.png",
    manual: "/manuals/audi_r8.pdf",
    parts: "/parts/audi_r8.pdf",
    desc: "Audi R8 is a V10 powered supercar with extreme performance."
  },
  audi_rs7: {
    name: "Audi RS7",
    img: "/images/vehicles/audi_rs7.png",
    manual: "/manuals/audi_rs7.pdf",
    parts: "/parts/audi_rs7.pdf",
    desc: "Audi RS7 is a luxury performance sedan with sporty design."
  }
}

if(carData[vehicle]){
  document.getElementById("carName").innerText = carData[vehicle].name
  document.getElementById("carImg").src = carData[vehicle].img
  document.getElementById("carDesc").innerText = carData[vehicle].desc
} else {
  document.getElementById("carName").innerText = "Car"
  document.getElementById("carImg").src = "/images/vehicles/default.png"
  document.getElementById("carDesc").innerText = "Details coming soon..."
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