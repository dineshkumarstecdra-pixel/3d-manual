const selectedVehicle = localStorage.getItem("selectedVehicle")

if (!selectedVehicle) {
  window.location.href = "home.html"
}

document.getElementById("vehicleName").innerText =
  "Vehicle: " + selectedVehicle.toUpperCase()

function goTo(page) {
  window.location.href = page
}

function loadProcedure(system) {

  const container = document.getElementById("procedureSection")

  container.innerHTML = `
    <h2>${system} Service Procedure</h2>

    <div class="procedure-card">

      <h3>Tools Required</h3>
      <ul>
        <li>Socket Set</li>
        <li>Torque Wrench</li>
        <li>Jack & Stand</li>
      </ul>

      <h3>Procedure Steps</h3>

      <ol>
        <li>Lift the vehicle safely.</li>
        <li>Remove the wheel.</li>
        <li>Disconnect mounting bolts.</li>
        <li>Inspect component condition.</li>
        <li>Reassemble with correct torque.</li>
      </ol>

      <button onclick="openViewer()">Open in 3D Viewer</button>

    </div>
  `
}

function openViewer() {
  window.location.href = "index.html"
}