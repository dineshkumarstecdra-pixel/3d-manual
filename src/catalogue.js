const selectedVehicle = localStorage.getItem("selectedVehicle")

if (!selectedVehicle) {
  window.location.href = "home.html"
}

document.getElementById("vehicleName").innerText =
  "Vehicle: " + selectedVehicle.toUpperCase()

let partDescriptions = {}

fetch("/partDescriptions.json")
  .then(res => res.json())
  .then(data => {
    partDescriptions = data
    renderTable()
  })

function renderTable() {

  const tbody = document.getElementById("partsTableBody")
  tbody.innerHTML = ""

  const searchValue = document.getElementById("searchInput").value.toLowerCase()
  const categoryValue = document.getElementById("categoryFilter").value

  Object.values(partDescriptions).forEach(part => {

    if (searchValue && !part.displayName.toLowerCase().includes(searchValue))
      return

    if (categoryValue !== "all" && part.category !== categoryValue)
      return

    const row = document.createElement("tr")

    row.innerHTML = `
      <td>${part.sno}</td>
      <td>${part.displayName}</td>
      <td>${part.category}</td>
      <td>${part.qty}</td>
    `

    row.onclick = () => {
      localStorage.setItem("highlightPart", part.displayName)
      window.location.href = "index.html"
    }

    tbody.appendChild(row)
  })
}

document.getElementById("searchInput")
  .addEventListener("input", renderTable)

document.getElementById("categoryFilter")
  .addEventListener("change", renderTable)

function goTo(page) {
  window.location.href = page
}