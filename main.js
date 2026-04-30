import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const container = document.getElementById('viewer')

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xf0f0f0)

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
)
camera.position.set(0, 2, 5)

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(container.clientWidth, container.clientHeight)
container.appendChild(renderer.domElement)

// Controls
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

// Lights
const light1 = new THREE.DirectionalLight(0xffffff, 1)
light1.position.set(5, 5, 5)
scene.add(light1)

const ambient = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambient)

// Load Model
const loader = new GLTFLoader()
let model
let parts = []
let exploded = false

loader.load('/model.glb', (gltf) => {
  model = gltf.scene
  scene.add(model)

  model.traverse((child) => {
    if (child.isMesh) {
      parts.push(child)
      child.userData.originalPosition = child.position.clone()
    }
  })
})

// Raycaster
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

window.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(parts)

  if (intersects.length > 0) {
    const selected = intersects[0].object

    document.getElementById('partName').innerText = selected.name
    document.getElementById('partInfo').innerText =
      "Technical details for " + selected.name

    selected.material.emissive = new THREE.Color(0xff0000)
  }
})

// Explode Button
document.getElementById('explodeBtn').addEventListener('click', () => {
  exploded = !exploded

  parts.forEach((part, index) => {
    if (exploded) {
      part.position.x += (index % 3 - 1) * 1.5
      part.position.y += Math.floor(index / 3) * 0.5
    } else {
      part.position.copy(part.userData.originalPosition)
    }
  })
})

// Reset Camera
document.getElementById('resetBtn').addEventListener('click', () => {
  camera.position.set(0, 2, 5)
  controls.reset()
})

// Resize
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.clientWidth, container.clientHeight)
})

// Animate
function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}
animate()