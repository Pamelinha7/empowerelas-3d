// Visor 3D das páginas das cartas (EmPowerCards).
// Lê os modelos no mesmo formato do gêmeo digital (modelos.json) ou monta uma cena simples.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const RECOR = { '#86583b': '#2b2f33' };            // isoladores em grafite, como no gêmeo

function falhar(el, erro) {
  console.warn(erro);
  el.classList.add('sem-3d');
  const img = el.dataset.fallback;
  el.querySelector('.carregando')?.remove();
  if (img) el.insertAdjacentHTML('beforeend', `<img class="fallback" src="${img}" alt="">`);
  else el.insertAdjacentHTML('beforeend', '<p class="aviso">Este aparelho não conseguiu mostrar o 3D.</p>');
}

async function iniciar(el) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) { throw new Error('sem WebGL'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  el.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight(0xffffff, 0xb9b4aa, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.7);
  sol.position.set(1.2, 2.2, 1.6);
  cena.add(sol);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

  const tipo = el.dataset.visor;
  const animar = [];
  let grupo;
  if (tipo === 'modelo') grupo = await modelos(el.dataset.modelos.split(','));
  else if (tipo === 'mu') grupo = mu(animar);
  else if (tipo === 'supervisorio') grupo = supervisorio(animar);
  else if (tipo === 'fibra') grupo = fibra(animar);
  cena.add(grupo);

  // enquadra o objeto
  const bb = new THREE.Box3().setFromObject(grupo);
  const centro = bb.getCenter(new THREE.Vector3());
  grupo.position.sub(centro);
  const raio = bb.getSize(new THREE.Vector3()).length() / 2;
  const dist = raio / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.02;
  const dir = new THREE.Vector3(...(el.dataset.vista || '1,0.55,1.25').split(',').map(Number)).normalize();
  camera.position.copy(dir.multiplyScalar(dist));
  camera.near = dist / 100; camera.far = dist * 10; camera.updateProjectionMatrix();

  const ctrl = new OrbitControls(camera, renderer.domElement);
  ctrl.enableDamping = true;
  ctrl.autoRotate = true;
  ctrl.autoRotateSpeed = 1.4;
  ctrl.enablePan = false;
  ctrl.minDistance = dist * 0.35;
  ctrl.maxDistance = dist * 2.2;
  ctrl.addEventListener('start', () => { ctrl.autoRotate = false; });

  function ajustar() {
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(ajustar).observe(el);
  ajustar();
  el.querySelector('.carregando')?.remove();
  el.classList.add('pronto');

  const relogio = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = relogio.getElapsedTime();
    for (const f of animar) f(t);
    ctrl.update();
    renderer.render(cena, camera);
  });
}

// ------------------------------------------------------------ modelos do gêmeo
const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function modelos(chaves) {
  const todos = await (await fetch('../comum/modelos.json')).json();
  const g = new THREE.Group();
  for (const ch of chaves) g.add(malha(todos[ch]));
  return g;
}
function malha(m) {
  const q = new Uint16Array(bytes(m.pos).buffer);
  const ib = bytes(m.idx);
  const I = m.i32 ? new Uint32Array(ib.buffer) : new Uint16Array(ib.buffer);
  const fc = bytes(m.fc);
  const pal = m.pal.map(h => new THREE.Color(RECOR[h.toLowerCase()] || h));
  const pos = new Float32Array(m.nf * 9), cor = new Float32Array(m.nf * 9);
  const esc = [0, 1, 2].map(j => (m.max[j] - m.min[j]) / 65535);
  for (let f = 0; f < m.nf; f++) {
    const c = pal[Math.min(fc[f], pal.length - 1)];
    for (let k = 0; k < 3; k++) {
      const v = I[f * 3 + k], o = f * 9 + k * 3;
      for (let j = 0; j < 3; j++) pos[o + j] = m.min[j] + q[v * 3 + j] * esc[j];
      cor[o] = c.r; cor[o + 1] = c.g; cor[o + 2] = c.b;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0.05 }));
}

// ------------------------------------------------------------ cenas simples
const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, metalness: 0.05, ...extra });
function tubo(pontos, raio, material) {
  const curva = new THREE.CatmullRomCurve3(pontos.map(p => new THREE.Vector3(...p)));
  return { curva, mesh: new THREE.Mesh(new THREE.TubeGeometry(curva, 80, raio, 10), material) };
}
function pulsos(g, curva, cor, n, vel, animar, sentido = 1) {
  const bolas = [];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), new THREE.MeshBasicMaterial({ color: cor }));
    g.add(b); bolas.push(b);
  }
  animar.push(t => bolas.forEach((b, i) => {
    let u = (t * vel + i / n) % 1;
    if (sentido < 0) u = 1 - u;
    b.position.copy(curva.getPointAt(u));
  }));
}

// Merging unit: painel no pátio, cobre chegando, fibra saindo
function mu(animar) {
  const g = new THREE.Group();
  const painel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.42), mat(0xc9cdd1));
  painel.position.y = 0.75; g.add(painel);
  const porta = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.98, 0.02), mat(0xb3b8bd));
  porta.position.set(0, 0.75, 0.22); g.add(porta);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.02), mat(0x1d2a33, { emissive: 0x0b2b3b }));
  visor.position.set(0, 1.02, 0.235); g.add(visor);
  [[-0.08, 0xe71c73], [0, 0x3a9e5c], [0.08, 0x3a9e5c]].forEach(([x, c]) => {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: c }));
    led.position.set(x, 0.86, 0.24); g.add(led);
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.6), mat(0xb9b4aa));
  base.position.y = 0.1; g.add(base);
  const cobre = mat(0xd9822b);
  [-0.12, 0, 0.12].forEach((z, i) => {
    const { curva, mesh } = tubo([[-1.5, 0.22, z], [-0.9, 0.24, z], [-0.5, 0.35, z * 0.6], [-0.36, 0.45 + i * 0.05, z * 0.4]], 0.018, cobre);
    g.add(mesh); pulsos(g, curva, 0xffb066, 3, 0.35, animar);
  });
  const { curva, mesh } = tubo([[0.36, 1.15, 0], [0.7, 1.2, 0], [1.0, 1.0, 0], [1.5, 0.95, 0]], 0.02, mat(0x7a3fb5));
  g.add(mesh); pulsos(g, curva, 0xd9b8ff, 6, 0.6, animar);
  return g;
}

// Supervisório: monitor com um diagrama unifilar simples
function supervisorio(animar) {
  const g = new THREE.Group();
  const tela = document.createElement('canvas'); tela.width = 800; tela.height = 470;
  const ctx = tela.getContext('2d');
  const tex = new THREE.CanvasTexture(tela); tex.colorSpace = THREE.SRGBColorSpace;
  function desenhar(alarme) {
    ctx.fillStyle = '#10181f'; ctx.fillRect(0, 0, 800, 470);
    ctx.fillStyle = '#1b2833'; ctx.fillRect(0, 0, 800, 54);
    ctx.fillStyle = '#e8eef2'; ctx.font = 'bold 26px sans-serif'; ctx.fillText('SUBESTAÇÃO · VISÃO GERAL', 24, 36);
    ctx.strokeStyle = '#cfd8de'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(60, 150); ctx.lineTo(740, 150); ctx.stroke();
    [[160, true], [400, true], [640, false]].forEach(([x, fechado], i) => {
      ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x, 400); ctx.stroke();
      ctx.fillStyle = fechado ? '#e23b3b' : '#33b36b';
      ctx.fillRect(x - 28, 240, 56, 56);
      ctx.fillStyle = '#e8eef2'; ctx.font = '22px sans-serif'; ctx.fillText('DJ' + (i + 1), x - 20, 330);
      ctx.fillText((i === 2 ? '0' : '812') + ' A', x + 40, 275);
    });
    ctx.fillStyle = alarme ? '#f2b705' : '#2a3a46';
    ctx.fillRect(24, 410, 360, 42);
    ctx.fillStyle = alarme ? '#10181f' : '#8aa0ad'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText('ALARME: DJ3 ABERTO', 40, 439);
    tex.needsUpdate = true;
  }
  desenhar(true);
  let ultimo = true;
  animar.push(t => { const a = Math.floor(t * 1.4) % 2 === 0; if (a !== ultimo) { ultimo = a; desenhar(a); } });
  const moldura = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.04, 0.07), mat(0x23282d));
  moldura.position.y = 1.0; g.add(moldura);
  const vidro = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.94), new THREE.MeshBasicMaterial({ map: tex }));
  vidro.position.set(0, 1.0, 0.037); g.add(vidro);
  const haste = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.06), mat(0x30363c));
  haste.position.set(0, 0.32, -0.04); g.add(haste);
  const pe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.34), mat(0x30363c));
  pe.position.set(0, 0.12, 0); g.add(pe);
  const teclado = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.34), mat(0x3a4147));
  teclado.position.set(0, 0.12, 0.5); g.add(teclado);
  return g;
}

// Fibra óptica: fio de vidro em corte, com a luz refletindo por dentro
function fibra(animar) {
  const g = new THREE.Group();
  const L = 3, R = 0.22;
  const casca = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 48, 1, true),
    mat(0xbfe3f2, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  casca.rotation.z = Math.PI / 2; g.add(casca);
  const capa = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.35, R * 1.35, 0.9, 48), mat(0x7a3fb5));
  capa.rotation.z = Math.PI / 2; capa.position.x = -L / 2 - 0.3; g.add(capa);
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3(-L / 2 + (L * i) / n, (i % 2 ? 1 : -1) * R * 0.86, 0));
  const caminho = new THREE.CurvePath();
  for (let i = 0; i < n; i++) caminho.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  const raio = new THREE.Mesh(new THREE.TubeGeometry(caminho, 200, 0.016, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.85 }));
  g.add(raio);
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }));
  g.add(luz);
  const brilho = new THREE.PointLight(0xffd36b, 2.5, 1.2); luz.add(brilho);
  animar.push(t => luz.position.copy(caminho.getPointAt((t * 0.18) % 1)));
  return g;
}

// começa depois de tudo definido
const caixa = document.getElementById('visor');
if (caixa) iniciar(caixa).catch(erro => falhar(caixa, erro));
