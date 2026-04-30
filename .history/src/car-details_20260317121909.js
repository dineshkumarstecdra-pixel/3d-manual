const vehicle = localStorage.getItem("selectedVehicle")

const carData = {
  bmw_m3: {
    name: "BMW M3",
    img: "/images/vehicles/bmw_m3.png",
    manual: "/manuals/bmw_m3.pdf"
  },
  audi_r8: {
    name: "Audi R8",
    img: "/images/vehicles/audi_r8.png",
    manual: "/manuals/audi_r8.pdf"
  },
  audi_rs7: {
    name: "Audi RS7",
    img: "/images/vehicles/audi_rs7.png",
    manual: "/manuals/audi_rs7.pdf"
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

function openparts(vehicle){

    localStorage.setItem("selectedVehicle", vehicle) // 🔥 MAIN FIX

    window.location.href = "/index.html"

}