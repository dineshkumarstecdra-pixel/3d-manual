// Put this at the VERY TOP of home.js, partscat.js, and serviceman.js
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // If no user is logged in, kick them back to login immediately
    window.location.href = "login.html";
  }
});
const typeSelect = document.getElementById("typeSelect");
const seriesSelect = document.getElementById("modelSelect");
const regionSelect = document.getElementById("regionSelect")

const regionVehicles = {

india:["BMW M3","BMW M4","BMW IX","BMW I5","Audi R8"],

europe:["BMW M3","BMW M4","BMW Z4 M40I","BMW M SPORT","BMW M8","BMW IX","BMW I5","BMW I7","BMW X3","BMW XM","Audi RS7","Audi R8"],

usa:["Audi RS7","BMW Z4 M40I"],

germany:["BMW IX","BMW I5","BMW I7","BMW X3","BMW XM"],

china:["BMW Z4 M40I","BMW M SPORT","BMW M8"]

}

let vehicleCards = document.querySelectorAll(".vehicle-card");


const seriesMap = {
  suv: ["i", "x"],
  sedan: ["r", "z"],
  coupe: ["m"]
};

function filterVehicles(){

const region = regionSelect.value
const type = typeSelect.value
const series = seriesSelect.value

vehicleCards.forEach(card=>{

const name = card.querySelector("h3").innerText
const cardType = card.dataset.type
const cardSeries = card.dataset.series

const regionMatch = !region || regionVehicles[region].includes(name)
const typeMatch = !type || type === cardType
const seriesMatch = !series || series === cardSeries

if(regionMatch && typeMatch && seriesMatch){
card.style.display="block"
}else{
card.style.display="none"
}

})

}
let availableVehicles = []

regionSelect.addEventListener("change", () => {

const region = regionSelect.value
availableVehicles = regionVehicles[region] || []
    
vehicleCards.forEach(card => {

const name = card.querySelector("h3").innerText

if(!region || availableVehicles.includes(name)){
card.style.display = "block"
}else{
card.style.display = "none"
}

})

updateAvailableTypes()

})
function updateAvailableTypes(){

const region = regionSelect.value
const types = new Set()

vehicleCards.forEach(card => {

const name = card.querySelector("h3").innerText

if(!region || regionVehicles[region].includes(name)){
types.add(card.dataset.type)
}

})

typeSelect.querySelectorAll("option").forEach(option =>{

if(option.value === ""){
option.style.display="block"
return
}

// region இல்லைனா → எல்லா type show
if(!region){
option.style.display="block"
}else{
option.style.display = types.has(option.value) ? "block":"none"
}

})

}
function updateSeriesDropdown(){

const region = regionSelect.value
const type = typeSelect.value

const availableSeries = new Set()

vehicleCards.forEach(card=>{

const name = card.querySelector("h3").innerText
const cardType = card.dataset.type
const cardSeries = card.dataset.series

if(region && !regionVehicles[region].includes(name)) return

if(!type || type === cardType){
availableSeries.add(cardSeries)
}

})

seriesSelect.querySelectorAll("option").forEach(option=>{

if(option.value === ""){
option.style.display = "block"
return
}

option.style.display = availableSeries.has(option.value) ? "block":"none"

})

seriesSelect.value=""

}
typeSelect.addEventListener("change", ()=>{

updateSeriesDropdown()
filterVehicles()

});
seriesSelect.addEventListener("change", filterVehicles);
regionSelect.addEventListener("change", ()=>{

typeSelect.value=""
seriesSelect.value=""

updateAvailableTypes()
updateSeriesDropdown()
filterVehicles()

})

//logout//
const profileMenu = document.getElementById("profileMenu");
const logoutBtn = document.getElementById("logoutBtn");

profileMenu.addEventListener("click", () => {
    profileMenu.classList.toggle("active");
});


/* logout action */

logoutBtn.addEventListener("click", () => {

   

    // redirect to login page
    window.location.href = "login.html";

});
///reset//
const resetBtn = document.getElementById("resetFilter");

resetBtn.addEventListener("click", () => {

const region = regionSelect.value

// type & series reset
typeSelect.value = ""
seriesSelect.value = ""

// region vehicles
if(!region){

vehicleCards.forEach(card=>{
card.style.display="block"
})

}else{

// region மட்டும்
vehicleCards.forEach(card=>{

const name = card.querySelector("h3").innerText

if(regionVehicles[region].includes(name)){
card.style.display="block"
}else{
card.style.display="none"
}

})

}

// series dropdown update
updateSeriesDropdown()

})

function openVehicle(vehicle){

    localStorage.setItem("selectedVehicle", vehicle) // 🔥 MAIN FIX

    window.location.href = "/car-details.html"

}
window.openVehicle = openVehicle
regionSelect.addEventListener("change", ()=>{

const region = regionSelect.value
const allowed = regionVehicles[region]

vehicleCards.forEach(card=>{

const name = card.querySelector("h3").innerText

if(!region || allowed.includes(name)){
card.style.display="block"
}else{
card.style.display="none"
}

})

})
// Add this to the very bottom of home.js

async function loadDatabaseVehicles() {
    try {
        // 1. Ask the server for the database.json file
        const res = await fetch('/database.json');
        if (!res.ok) return; 
        const newCars = await res.json();

        const grid = document.querySelector('.vehicle-grid');

        // 2. Loop through every car in the database
        newCars.forEach(car => {
            
            // Add the car to the region dictionary so the dropdown filters work!
            if (regionVehicles[car.region]) {
                if (!regionVehicles[car.region].includes(car.name)) {
                    regionVehicles[car.region].push(car.name);
                }
            }

            // Build the new HTML Card
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

            // Attach it to the screen
            grid.appendChild(cardDiv);
        });

        // 3. Update the global list of cards so your filters don't ignore the new cars
        vehicleCards = document.querySelectorAll('.vehicle-card');
        
        // 4. Refresh the dropdowns
        updateAvailableTypes();
        updateSeriesDropdown();

    } catch (err) {
        console.error("Error loading dynamic vehicles:", err);
    }
}

// Run this function immediately when the page loads
loadDatabaseVehicles();