import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { COLS, ROWS } from './glyphs.js'

// Units: one clock cell = 1. The board's front face sits at z = 0 and the
// viewer looks down -z, so a clockwise hand angle is a negative z rotation.
const PAD = 0.4
const W = COLS + 2 * PAD
const H = ROWS + 2 * PAD
const THICK = 0.18
const BEVEL = 0.025
const DISH_R = 0.44 // radius of the recess where it meets the board
const DISH_D = 0.13 // how deep the recess goes
const HAND_LEN = 0.38
const HAND_W = 0.058
const HAND_T = 0.014
// Two hands stacked just above the dish floor, the second over the first.
const HAND_Z = [-0.085, -0.066]

export const VIEW_ASPECT = W / (H * 1.25)

const cellXY = i => [(i % COLS) - (COLS - 1) / 2, (ROWS - 1) / 2 - Math.floor(i / COLS)]

function boardGeometry() {
  const s = new THREE.Shape()
  const x = -W / 2, y = -H / 2, r = 0.16
  s.moveTo(x + r, y)
  s.lineTo(x + W - r, y)
  s.quadraticCurveTo(x + W, y, x + W, y + r)
  s.lineTo(x + W, y + H - r)
  s.quadraticCurveTo(x + W, y + H, x + W - r, y + H)
  s.lineTo(x + r, y + H)
  s.quadraticCurveTo(x, y + H, x, y + H - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  for (let i = 0; i < COLS * ROWS; i++) {
    const [cx, cy] = cellXY(i)
    const hole = new THREE.Path()
    // The bevel shrinks holes by BEVEL, so cut them that much larger.
    hole.absarc(cx, cy, DISH_R + BEVEL, 0, Math.PI * 2, true)
    s.holes.push(hole)
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: THICK,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 5,
    curveSegments: 64,
  })
  g.computeBoundingBox()
  g.translate(0, 0, -g.boundingBox.max.z)
  return g
}

// A bowl with a flat floor that curves up steeply near the rim, so the hands
// can reach almost to the edge without touching the surface.
function dishGeometry() {
  const pts = []
  const n = 48
  for (let k = 0; k <= n; k++) {
    const r = (DISH_R * k) / n
    const z = -BEVEL - DISH_D * (1 - Math.pow(r / DISH_R, 10))
    pts.push(new THREE.Vector2(r, z))
  }
  // Rim-to-center order makes the faces point into the bowl, toward the viewer.
  const g = new THREE.LatheGeometry(pts.reverse(), 96)
  g.rotateX(Math.PI / 2) // lathe height (y) becomes depth (z)
  return g
}

function handGeometry() {
  const hw = HAND_W / 2
  const s = new THREE.Shape()
  s.moveTo(-hw, 0)
  s.lineTo(-hw, HAND_LEN)
  s.absarc(0, HAND_LEN, hw, Math.PI, 0, true)
  s.lineTo(hw, 0)
  s.absarc(0, 0, hw, 0, Math.PI, true)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: HAND_T - 0.006,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 3,
    curveSegments: 16,
  })
  g.translate(0, 0, -HAND_T / 2)
  return g
}

// Khronos PBR Neutral tone mapping for a grey value (r = g = b), as in three's
// NeutralToneMapping, and its inverse by bisection.
function neutral(x) {
  const start = 0.8 - 0.04
  x -= x < 0.08 ? x - 6.25 * x * x : 0.04
  if (x < start) return x
  const d = 1 - start
  return 1 - (d * d) / (x + d - start)
}

function invertNeutral(y) {
  let lo = 0, hi = 16
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (neutral(mid) < y) lo = mid
    else hi = mid
  }
  return lo
}

export function createRenderer3D(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap // softened by shadow.radius
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.45

  // Low from the upper left, so the bowls shade and the hands throw shadows.
  const key = new THREE.DirectionalLight(0xffffff, 3.2)
  key.position.set(-4, 5, 4)
  key.castShadow = true
  key.shadow.mapSize.set(4096, 4096)
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 4, bottom: -4, near: 1, far: 20 })
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.01
  key.shadow.radius = 4
  scene.add(key)

  const white = new THREE.MeshPhysicalMaterial({
    color: 0xf3f3f1,
    roughness: 0.55,
    clearcoat: 0.25,
    clearcoatRoughness: 0.45,
  })

  const board = new THREE.Mesh(boardGeometry(), white)
  board.castShadow = board.receiveShadow = true
  scene.add(board)

  const count = COLS * ROWS
  const dishes = new THREE.InstancedMesh(dishGeometry(), white, count)
  dishes.receiveShadow = true
  const m = new THREE.Object3D()
  for (let i = 0; i < count; i++) {
    const [x, y] = cellXY(i)
    m.position.set(x, y, 0)
    m.updateMatrix()
    dishes.setMatrixAt(i, m.matrix)
  }
  scene.add(dishes)

  const black = new THREE.MeshPhysicalMaterial({
    color: 0x0c0c0c,
    roughness: 0.45,
    envMapIntensity: 0.5,
  })
  const hands = new THREE.InstancedMesh(handGeometry(), black, count * 2)
  hands.castShadow = hands.receiveShadow = true
  hands.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  scene.add(hands)

  const hubGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.012, 32)
  hubGeo.rotateX(Math.PI / 2)
  const hubs = new THREE.InstancedMesh(hubGeo, black, count)
  hubs.castShadow = true
  for (let i = 0; i < count; i++) {
    const [x, y] = cellXY(i)
    m.position.set(x, y, HAND_Z[1] + HAND_T / 2 + 0.006)
    m.rotation.set(0, 0, 0)
    m.updateMatrix()
    hubs.setMatrixAt(i, m.matrix)
  }
  scene.add(hubs)

  // Soft shadow of the board on the wall behind it.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.ShadowMaterial({ opacity: 0.12 }))
  wall.position.z = -THICK - BEVEL * 2 - 0.12
  wall.receiveShadow = true
  scene.add(wall)

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minAzimuthAngle = -0.9
  controls.maxAzimuthAngle = 0.9
  controls.minPolarAngle = Math.PI / 2 - 0.9
  controls.maxPolarAngle = Math.PI / 2 + 0.9
  controls.target.set(0, 0, -0.05)

  // Slightly from the left and below, like a board standing on a table.
  const VIEW_DIR = new THREE.Vector3(-0.1, -0.08, 1).normalize()

  function fitDistance() {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    return Math.max((H * 0.62) / t, (W * 0.56) / (t * camera.aspect))
  }

  function resetView() {
    camera.position.copy(controls.target).addScaledVector(VIEW_DIR, fitDistance())
    controls.minDistance = fitDistance() * 0.5
    controls.maxDistance = fitDistance() * 1.6
    controls.update()
  }

  // Ambient occlusion: darkens the bowl floor where it meets the wall, the
  // rims, and the spot under each hand, which plain shadow maps miss.
  // The composer renders into a multisampled target to keep antialiasing.
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
  )
  composer.addPass(new RenderPass(scene, camera))
  const gtao = new GTAOPass(scene, camera, 1, 1)
  // Radius below the board-to-wall gap, so the wall behind gets no halo, but
  // above the hand-to-floor gap, so the floor darkens under each hand.
  gtao.updateGtaoMaterial({ radius: 0.24, distanceExponent: 1.4, thickness: 1, scale: 1.8, samples: 24 })
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 8, rings: 3, samples: 24 })
  gtao.blendIntensity = 1
  composer.addPass(gtao)
  composer.addPass(new OutputPass())
  let ao = true
  let bg = new THREE.Color(0xffffff)

  // Through the composer the background gets tone mapped like the scene;
  // a direct render clears to it untouched. Pre-invert the curve so both
  // paths match the page color.
  function applyBackground() {
    if (!ao) return void (scene.background = bg)
    const lin = bg.clone() // THREE.Color is linear internally
    scene.background = new THREE.Color(...['r', 'g', 'b'].map(c => invertNeutral(lin[c])))
  }

  function setAO(on) {
    ao = on
    applyBackground()
  }

  function setBackground(color) {
    bg = new THREE.Color(color)
    applyBackground()
  }

  function resize() {
    const w = container.clientWidth
    const h = Math.round(w / VIEW_ASPECT)
    renderer.setSize(w, h)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    resetView()
  }

  function draw(angles) {
    for (let i = 0; i < count; i++) {
      const [x, y] = cellXY(i)
      for (let k = 0; k < 2; k++) {
        m.position.set(x, y, HAND_Z[k])
        m.rotation.set(0, 0, -THREE.MathUtils.degToRad(angles[i][k]))
        m.updateMatrix()
        hands.setMatrixAt(i * 2 + k, m.matrix)
      }
    }
    hands.instanceMatrix.needsUpdate = true
    controls.update()
    if (ao) composer.render()
    else renderer.render(scene, camera)
  }

  return { resize, draw, resetView, setAO, setBackground, canvas: renderer.domElement }
}
