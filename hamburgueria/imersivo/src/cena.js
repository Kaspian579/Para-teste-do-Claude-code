/*
  Brasa 41 por dentro: o salão da hamburgueria em 3D, com o Brasa Duplo
  desmontado sobre o balcão. A rolagem leva a câmera da porta até o balcão
  e cada movimento põe uma camada no lugar.

  Este é o código-fonte. O arquivo publicado é ../cena.min.js, gerado com:
    npm install && npm run build
*/
import {
  ACESFilmicToneMapping, BoxGeometry, BufferAttribute, CanvasTexture, CatmullRomCurve3, Color,
  CylinderGeometry, DirectionalLight, DoubleSide, Euler, ExtrudeGeometry, Fog, Group, HemisphereLight,
  InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, Quaternion, RepeatWrapping, Scene, Shape,
  SphereGeometry, SRGBColorSpace, TorusGeometry, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const html = document.documentElement;
const canvas = document.getElementById('cena');
const busca = new URLSearchParams(location.search);
const TESTE = busca.has('teste');
const MOSTRAR_FPS = busca.has('fps');
const toque = matchMedia('(pointer: coarse)').matches;
const mqReduzir = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- utilidades ---------- */
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const c01 = (x) => clamp(x, 0, 1);
const suave = (t) => t * t * (3 - 2 * t);
const maisSuave = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const amortecer = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const ruido = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
function sorteio(semente) {
  let s = semente | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COR = {
  noite: 0x170506, vinho: 0x7d0c14, vinhoEscuro: 0x4b070c, papel: 0xe6e3dd, mostarda: 0xe0a526,
  madeira: 0x6b3f24, tabua: 0xb07a45, aco: 0x9d9893, acoFosco: 0x7a7570, acoEscuro: 0x2c2826,
};
const FONTE = '"Archivo", "Arial Narrow", Arial, sans-serif';

function iniciar() {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  } catch (erro) {
    return false;
  }
  if (!renderer.getContext()) return false;

  let reduzir = mqReduzir.matches;
  let ambiente = !reduzir; // animação contínua (flutuar, balançar): pausável
  // a animação de fundo some devagar quando a pessoa para de mexer e volta no próximo gesto
  let forcaAmb = ambiente ? 1 : 0, ultimaAcao = performance.now();
  const OCIOSO_MS = 9000;
  const acordar = () => { ultimaAcao = performance.now(); };
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const dprMax = Math.min(window.devicePixelRatio || 1, 2);
  let dpr = Math.min(dprMax, toque ? 1.5 : 2);
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  scene.background = new Color(COR.noite);
  scene.fog = new Fog(COR.noite, 6.5, 14);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();

  const camera = new PerspectiveCamera(42, 1, 0.05, 40);

  /* ---------- texturas desenhadas em canvas ---------- */
  const texturas = [];
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function textura(w, h, desenhar, repetir) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    desenhar(g, w, h);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (repetir) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(repetir[0], repetir[1]); }
    t.userData.redesenhar = () => { g.clearRect(0, 0, w, h); desenhar(g, w, h); t.needsUpdate = true; };
    texturas.push(t);
    return t;
  }
  function fonte(g, peso, px, estreita) {
    g.font = `${peso} ${px}px ${FONTE}`;
    if ('fontStretch' in g) g.fontStretch = estreita ? 'extra-condensed' : 'normal';
  }

  const texPiso = textura(256, 256, (g, w, h) => {
    const s = w / 2, r = sorteio(3);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#5c0a10' : '#d3cdc3';
      g.fillRect(i * s, j * s, s, s);
    }
    g.globalAlpha = 0.07;
    for (let k = 0; k < 420; k++) {
      g.fillStyle = r() < 0.5 ? '#000' : '#fff';
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2);
    }
    g.globalAlpha = 1;
  });
  const texAzulejo = textura(512, 256, (g, w, h) => {
    const r = sorteio(7), tw = 128, th = 64;
    g.fillStyle = '#b1a99d'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) for (let col = -1; col < 5; col++) {
      const x = col * tw + (row % 2 ? tw / 2 : 0), y = row * th;
      g.fillStyle = `hsl(36, 16%, ${85 + r() * 5}%)`;
      g.fillRect(x + 3, y + 3, tw - 6, th - 6);
    }
  });
  const texSombra = textura(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.7)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  const texLetreiro = textura(1024, 216, (g, w, h) => {
    g.fillStyle = '#e0a526'; fonte(g, 800, 190, true);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('BRASA 41', w / 2, h / 2 + 10);
  });
  function quadroMenu(titulo, itens) {
    return textura(1024, 700, (g, w, h) => {
      g.fillStyle = '#1e1617'; g.fillRect(0, 0, w, h);
      g.textBaseline = 'top';
      g.fillStyle = '#e0a526'; fonte(g, 800, 120, true); g.textAlign = 'left';
      g.fillText(titulo.toUpperCase(), 56, 48);
      fonte(g, 500, 48, false);
      itens.forEach(([nome, preco], i) => {
        const y = 214 + i * 76;
        g.fillStyle = '#e6e3dd';
        g.textAlign = 'left'; g.fillText(nome, 56, y);
        g.textAlign = 'right'; g.fillText(preco, w - 56, y);
      });
    });
  }
  const texMenu1 = quadroMenu('Lanches', [['Brasa', 'R$ 26'], ['Brasa Duplo', 'R$ 34'], ['Bacon 41', 'R$ 38'], ['Cebolão', 'R$ 36'], ['Picante', 'R$ 37'], ['Verde', 'R$ 30']]);
  const texMenu2 = quadroMenu('Para acompanhar', [['Batata frita', 'R$ 16'], ['Anéis de cebola', 'R$ 19'], ['Limonada da casa', 'R$ 11'], ['Chá de hibisco', 'R$ 10'], ['Milk-shake', 'R$ 22'], ['Brownie na chapa', 'R$ 15']]);
  function comanda(linhas) {
    return textura(256, 368, (g, w, h) => {
      g.fillStyle = '#ece9e3'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#cfc9bf';
      for (let x = 12; x < w; x += 18) { g.beginPath(); g.arc(x, 14, 4, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#7d0c14'; g.textBaseline = 'top'; g.textAlign = 'left';
      fonte(g, 800, 48, true); g.fillText('COMANDA', 18, 36);
      fonte(g, 500, 30, false);
      linhas.forEach((l, i) => g.fillText(l, 18, 112 + i * 46));
    });
  }
  const texComandas = [
    comanda(['2x Duplo', '1x Batata', 'Balcão']), comanda(['1x Bacon 41', '1x Limonada', 'Entrega']),
    comanda(['3x Brasa', '2x Anéis', 'Balcão']), comanda(['1x Verde', '1x Chá', 'Entrega']),
  ];
  const texCartaz1 = textura(512, 680, (g, w, h) => {
    g.fillStyle = '#e6e3dd'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7d0c14'; g.textBaseline = 'top'; g.textAlign = 'left';
    fonte(g, 800, 210, true); g.fillText('160', 40, 40);
    fonte(g, 800, 92, true); g.fillText('POR NOITE.', 40, 260); g.fillText('ACABOU,', 40, 360); g.fillText('FECHOU.', 40, 460);
    fonte(g, 500, 30, false); g.fillText('Carne moída às 16h, todo dia.', 40, 600);
  });
  const texCartaz2 = textura(512, 680, (g, w, h) => {
    g.fillStyle = '#7d0c14'; g.fillRect(0, 0, w, h);
    g.textBaseline = 'top'; g.textAlign = 'left';
    g.fillStyle = '#e0a526'; fonte(g, 800, 120, true);
    g.fillText('SMASH', 40, 60); g.fillText('QUER DIZER', 40, 190); g.fillText('AMASSAR.', 40, 320);
    g.fillStyle = '#e6e3dd'; fonte(g, 500, 32, false);
    g.fillText('Bola de 90 g, chapa a 230 °C,', 40, 520); g.fillText('crosta em 90 segundos.', 40, 566);
  });

  /* ---------- materiais ---------- */
  const matMostarda = new MeshStandardMaterial({ color: COR.mostarda, roughness: 0.45, metalness: 0.1 });
  const matAco = new MeshStandardMaterial({ color: COR.aco, roughness: 0.3, metalness: 0.85 });
  const matAcoFosco = new MeshStandardMaterial({ color: COR.acoFosco, roughness: 0.5, metalness: 0.7 });
  const matVinho = new MeshStandardMaterial({ color: COR.vinho, roughness: 0.5 });
  const matSombra = (opacidade) => new MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false, opacity: opacidade });

  const fixo = (obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, pai = scene) => {
    obj.position.set(x, y, z);
    obj.rotation.set(rx, ry, rz);
    obj.matrixAutoUpdate = false;
    obj.updateMatrix();
    pai.add(obj);
    return obj;
  };

  /* ---------- o lanche: geometrias ---------- */
  const R = 0.26; // raio do pão (o lanche é maior que o real, para caber na cena)
  const _c = new Color();
  function pintar(g, fn) {
    const p = g.attributes.position, n = p.count, cores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      fn(p.getX(i), p.getY(i), p.getZ(i), _c);
      cores[i * 3] = _c.r; cores[i * 3 + 1] = _c.g; cores[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new BufferAttribute(cores, 3));
  }
  const MIOLO = new Color(0xecd3a0), TOSTADO = new Color(0xc4843d), CASCA = new Color(0xc27a33);
  const CASCA_ESC = new Color(0x8f4c1c), DOURADO = new Color(0xd59a4b), MARROM = new Color(0x9a511f);
  const matPao = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });

  function paoBaixo() {
    const perfil = [[0, 0], [0.8, 0], [0.93, 0.006], [0.99, 0.02], [1, 0.04], [0.985, 0.064], [0.95, 0.079], [0.86, 0.086], [0.5, 0.087], [0, 0.087]];
    const g = new LatheGeometry(perfil.map(([x, y]) => new Vector2(x * R, y)), 64);
    pintar(g, (x, y, z, c) => {
      const r = Math.hypot(x, z) / R;
      if (y > 0.083 && r < 0.9) c.copy(MIOLO).lerp(TOSTADO, 0.5 + 0.3 * ruido(x * 30, z * 30));
      else c.copy(CASCA).lerp(CASCA_ESC, c01(1 - Math.abs(y - 0.035) * 30) * 0.5);
    });
    return new Mesh(g, matPao);
  }

  const geoGergelim = new SphereGeometry(1, 8, 6);
  const matGergelim = new MeshStandardMaterial({ color: 0xf3e4c0, roughness: 0.55 });
  function paoCima() {
    const H = 0.15, B = 0.022, A = R * 1.02;
    const pts = [new Vector2(0, 0), new Vector2(R * 0.9, 0), new Vector2(R * 0.99, 0.007), new Vector2(A, B)];
    for (let k = 15; k >= 0; k--) {
      const a = (k / 16) * Math.PI / 2;
      pts.push(new Vector2(A * Math.sin(a), B + H * Math.pow(Math.cos(a), 0.8)));
    }
    const g = new LatheGeometry(pts, 64);
    pintar(g, (x, y, z, c) => {
      if (y < 0.004) { c.copy(MIOLO).lerp(TOSTADO, 0.5 + 0.3 * ruido(x * 40, z * 40)); return; }
      const t = c01((y - B) / H);
      c.copy(DOURADO).lerp(MARROM, Math.pow(t, 1.5) * 0.85);
      if (ruido(x * 25, z * 25) > 0.86) c.lerp(CASCA_ESC, 0.25);
    });
    const grupo = new Group();
    grupo.add(new Mesh(g, matPao));
    const N = 46, sementes = new InstancedMesh(geoGergelim, matGergelim, N);
    const m4 = new Matrix4(), q = new Quaternion(), qGiro = new Quaternion();
    const pos = new Vector3(), nrm = new Vector3(), esc = new Vector3(0.0092, 0.0042, 0.0056), up = new Vector3(0, 1, 0);
    for (let i = 0; i < N; i++) {
      const phi = i * 2.39996, f = Math.sqrt((i + 0.5) / N) * 0.86, a = f * Math.PI / 2;
      const rr = A * Math.sin(a), y = B + H * Math.pow(Math.cos(a), 0.8);
      pos.set(Math.cos(phi) * rr, y + 0.0015, Math.sin(phi) * rr);
      nrm.set(pos.x / (A * A), (y - B) / (H * H), pos.z / (A * A)).normalize();
      q.setFromUnitVectors(up, nrm);
      qGiro.setFromAxisAngle(up, ruido(i, 3) * Math.PI * 2);
      q.multiply(qGiro);
      m4.compose(pos, q, esc);
      sementes.setMatrixAt(i, m4);
    }
    grupo.add(sementes);
    return grupo;
  }

  const matMolho = new MeshStandardMaterial({ color: 0xe39a45, roughness: 0.22 });
  function molho() {
    const forma = new Shape(), N = 72;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const r = R * (0.95 + 0.035 * Math.sin(5 * a + 1) + 0.02 * Math.sin(9 * a + 2.3));
      if (k) forma.lineTo(Math.cos(a) * r, Math.sin(a) * r); else forma.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new ExtrudeGeometry(forma, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 2, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.004, 0);
    const grupo = new Group();
    grupo.add(new Mesh(g, matMolho));
    const gota = new SphereGeometry(1, 10, 8);
    for (const a of [0.7, 2.4, 4.1, 5.3]) {
      const m = new Mesh(gota, matMolho);
      const r = R * (0.95 + 0.035 * Math.sin(5 * a + 1));
      m.position.set(Math.cos(a) * r, -0.004, -Math.sin(a) * r);
      m.scale.set(0.014, 0.024, 0.014);
      grupo.add(m);
    }
    return grupo;
  }

  const BASE_CARNE = new Color(0x5d2b15), CROSTA = new Color(0x2b1209), CLARO = new Color(0x8a4720);
  const matCarne = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
  const geoCarne = (() => {
    // carne em torno (lathe) com anéis no topo e no fundo: a superfície irregular fica orgânica
    const h = 0.056, Rr = R * 1.06, aneis = 8, perfil = [];
    for (let k = 0; k <= aneis; k++) perfil.push(new Vector2(Rr * 0.93 * (k / aneis), -h / 2));
    for (let k = 1; k < 6; k++) { const a = -Math.PI / 2 + (k / 6) * Math.PI; perfil.push(new Vector2(Rr * 0.93 + Math.cos(a) * Rr * 0.07, (Math.sin(a) * h) / 2)); }
    for (let k = aneis; k >= 0; k--) perfil.push(new Vector2(Rr * 0.93 * (k / aneis), h / 2));
    const g = new LatheGeometry(perfil, 96);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const th = Math.atan2(z, x), e = Math.hypot(x, z) / (R * 1.06);
      const n = 0.03 * Math.sin(7 * th + 1.3) + 0.02 * Math.sin(13 * th + 0.4) + 0.012 * Math.sin(29 * th + 2.1) + 0.007 * Math.sin(53 * th + 0.7);
      const k = 1 + n * suave(c01((e - 0.55) / 0.45));
      x *= k; z *= k;
      const lado = y > 0 ? 1 : -1;
      y *= 1 - 0.4 * suave(c01((e - 0.78) / 0.22));
      y += lado * 0.003 * (Math.sin(x * 48 + 1) * Math.cos(z * 43) + 0.5 * Math.sin(x * 97 + z * 71));
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    pintar(g, (x, y, z, c) => {
      const e = Math.hypot(x, z) / (R * 1.06);
      c.copy(BASE_CARNE).lerp(CROSTA, Math.min(1, suave(c01((e - 0.7) / 0.3)) * 0.9 + (y < 0 ? 0.2 : 0)));
      const sp = ruido(x * 90, z * 90);
      if (sp > 0.82) c.lerp(CLARO, 0.55); else if (sp < 0.12) c.lerp(CROSTA, 0.5);
    });
    return g;
  })();
  const carne = () => new Mesh(geoCarne, matCarne);

  const matQueijo = new MeshStandardMaterial({ color: 0xf1c457, roughness: 0.36, side: DoubleSide });
  function queijo() {
    const S = R * 1.9;
    const g = new PlaneGeometry(S, S, 18, 18);
    g.rotateX(-Math.PI / 2);
    const base = g.attributes.position.array.slice();
    const derreter = (m) => {
      const a = g.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        const x0 = base[i], z0 = base[i + 2], r = Math.hypot(x0, z0);
        const sobra = Math.max(0, r - R * 0.9);
        const puxa = r > 0 ? 1 - (m * 0.32 * sobra) / r : 1;
        a[i] = x0 * puxa;
        a[i + 2] = z0 * puxa;
        a[i + 1] = -m * (sobra * 0.4 + sobra * sobra * 2.2) + m * 0.0025 * Math.sin(x0 * 45 + 1) * Math.cos(z0 * 41) + 0.0015;
      }
      g.attributes.position.needsUpdate = true;
      g.computeVertexNormals();
    };
    derreter(0.12);
    return { malha: new Mesh(g, matQueijo), derreter };
  }

  const matPicles = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3 });
  const geoPicles = (() => {
    const g = new CylinderGeometry(0.046, 0.046, 0.007, 28, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      if (r > 0.04) { const k = 1 + 0.06 * Math.sin(14 * Math.atan2(z, x)); p.setX(i, x * k); p.setZ(i, z * k); }
    }
    g.computeVertexNormals();
    const centro = new Color(0xc2cc72), borda = new Color(0x56651b);
    pintar(g, (x, y, z, c) => c.copy(centro).lerp(borda, Math.min(1, (Math.hypot(x, z) / 0.046) ** 2)));
    return g;
  })();
  function picles() {
    const grupo = new Group();
    for (let k = 0; k < 7; k++) {
      const m = new Mesh(geoPicles, matPicles);
      const a = (k / 6) * Math.PI * 2 + 0.3, r = k === 6 ? 0 : 0.12 + (k % 2) * 0.035;
      m.position.set(Math.cos(a) * r, 0.0035 + k * 0.0006, Math.sin(a) * r);
      m.rotation.set((ruido(k, 1) - 0.5) * 0.14, k, (ruido(k, 2) - 0.5) * 0.14);
      grupo.add(m);
    }
    return grupo;
  }

  /* ---------- o salão ---------- */
  const XW = 3.4, ZF = 2.7, ZB = -6, HT = 3.2;
  const larg = XW * 2, prof = ZF - ZB, zMeio = (ZF + ZB) / 2;
  texPiso.wrapS = texPiso.wrapT = RepeatWrapping;
  texPiso.repeat.set(larg / 0.9, prof / 0.9);
  fixo(new Mesh(new PlaneGeometry(larg, prof), new MeshStandardMaterial({ map: texPiso, roughness: 0.42 })), 0, 0, zMeio, -Math.PI / 2);
  fixo(new Mesh(new PlaneGeometry(larg, prof), new MeshLambertMaterial({ color: 0x33100f })), 0, HT, zMeio, Math.PI / 2);
  const geoViga = new BoxGeometry(larg, 0.14, 0.2), matViga = new MeshLambertMaterial({ color: 0x4a2617 });
  for (let z = ZF - 0.9; z > ZB; z -= 1.6) fixo(new Mesh(geoViga, matViga), 0, HT - 0.07, z);

  const matPintura = new MeshLambertMaterial({ color: 0x3b0a0e });
  const ALTO_AZULEJO = 1.5;
  function parede(comp, x, z, ry) {
    const t = texAzulejo.clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(comp / 0.8, ALTO_AZULEJO / 0.4);
    fixo(new Mesh(new PlaneGeometry(comp, ALTO_AZULEJO), new MeshStandardMaterial({ map: t, roughness: 0.32 })), x, ALTO_AZULEJO / 2, z, 0, ry);
    fixo(new Mesh(new PlaneGeometry(comp, HT - ALTO_AZULEJO), matPintura), x, ALTO_AZULEJO + (HT - ALTO_AZULEJO) / 2, z, 0, ry);
    fixo(new Mesh(new BoxGeometry(comp, 0.06, 0.03), matMostarda), x, ALTO_AZULEJO, z, 0, ry);
  }
  parede(larg, 0, ZB, 0);
  parede(prof, -XW, zMeio, Math.PI / 2);
  parede(prof, XW, zMeio, -Math.PI / 2);

  // balcão
  const ZBAL = -3.2;
  fixo(new Mesh(new BoxGeometry(5.0, 0.98, 0.7), matVinho), 0, 0.49, ZBAL);
  fixo(new Mesh(new BoxGeometry(5.02, 0.05, 0.72), matMostarda), 0, 0.86, ZBAL);
  fixo(new Mesh(new BoxGeometry(4.96, 0.1, 0.66), new MeshLambertMaterial({ color: 0x2a0508 })), 0, 0.05, ZBAL + 0.03);
  fixo(new Mesh(new BoxGeometry(5.2, 0.07, 0.86), new MeshStandardMaterial({ color: COR.madeira, roughness: 0.5 })), 0, 1.015, ZBAL);
  fixo(new Mesh(new PlaneGeometry(2.6, 0.55), new MeshStandardMaterial({ map: texLetreiro, alphaTest: 0.5, roughness: 0.5 })), 0, 0.5, ZBAL + 0.352);

  // banquetas
  const geoPe = new CylinderGeometry(0.03, 0.03, 0.78, 12);
  const geoAssento = new CylinderGeometry(0.2, 0.19, 0.08, 28);
  const geoAro = new TorusGeometry(0.15, 0.012, 8, 28);
  const geoPeBase = new CylinderGeometry(0.2, 0.23, 0.03, 28);
  for (const x of [-2.1, -1.25, 1.25, 2.1]) {
    fixo(new Mesh(geoPe, matAco), x, 0.39, -2.45);
    fixo(new Mesh(geoAssento, matVinho), x, 0.79, -2.45);
    fixo(new Mesh(geoAro, matAco), x, 0.3, -2.45, Math.PI / 2);
    fixo(new Mesh(geoPeBase, matAco), x, 0.015, -2.45);
  }

  // a chapa, com carnes e a coifa
  fixo(new Mesh(new BoxGeometry(3.0, 0.9, 0.8), matAcoFosco), 0, 0.45, -5.45);
  fixo(new Mesh(new BoxGeometry(2.5, 0.05, 0.62), new MeshStandardMaterial({ color: COR.acoEscuro, roughness: 0.42, metalness: 0.6 })), 0, 0.925, -5.45);
  fixo(new Mesh(new BoxGeometry(2.5, 0.02, 0.02), new MeshBasicMaterial({ color: 0xff6a2a })), 0, 0.89, -5.13);
  for (const [x, z] of [[-0.85, -5.4], [-0.3, -5.56], [0.5, -5.36], [1.0, -5.55]]) {
    const m = new Mesh(geoCarne, matCarne);
    m.scale.setScalar(0.38);
    fixo(m, x, 0.962, z, 0, x * 3);
  }
  fixo(new Mesh(new BoxGeometry(2.8, 0.5, 0.9), new MeshStandardMaterial({ color: 0x221e1d, roughness: 0.6, metalness: 0.35 })), 0, 2.52, -5.5);
  fixo(new Mesh(new BoxGeometry(2.8, 0.025, 0.02), new MeshBasicMaterial({ color: 0xffd9a0 })), 0, 2.28, -5.045);

  // parede do fundo: letreiro e cardápios
  for (const [x, tex] of [[-2.45, texMenu1], [2.45, texMenu2]]) {
    fixo(new Mesh(new BoxGeometry(1.6, 1.1, 0.03), matMostarda), x, 1.95, ZB + 0.015);
    fixo(new Mesh(new PlaneGeometry(1.5, 1.025), new MeshBasicMaterial({ map: tex })), x, 1.95, ZB + 0.035);
  }

  // cartazes e prateleira nas laterais
  fixo(new Mesh(new PlaneGeometry(0.9, 1.2), new MeshBasicMaterial({ map: texCartaz1 })), -XW + 0.015, 1.98, -1.3, 0, Math.PI / 2);
  fixo(new Mesh(new PlaneGeometry(0.9, 1.2), new MeshBasicMaterial({ map: texCartaz2 })), XW - 0.015, 1.98, -1.1, 0, -Math.PI / 2);
  fixo(new Mesh(new BoxGeometry(0.3, 0.05, 3.4), new MeshStandardMaterial({ color: COR.madeira, roughness: 0.55 })), -XW + 0.15, 1.05, -0.2);
  const geoFrasco = new CylinderGeometry(0.03, 0.034, 0.17, 16);
  const matKetchup = new MeshStandardMaterial({ color: 0xa8121a, roughness: 0.3 });
  for (const z of [-1.3, 0.5]) {
    fixo(new Mesh(geoFrasco, matKetchup), -XW + 0.13, 1.16, z);
    fixo(new Mesh(geoFrasco, matMostarda), -XW + 0.13, 1.16, z + 0.09);
    fixo(new Mesh(new BoxGeometry(0.06, 0.12, 0.11), matAco), -XW + 0.13, 1.135, z + 0.2);
  }

  // luminárias pendentes
  const geoCupula = new CylinderGeometry(0.07, 0.25, 0.24, 28, 1, true);
  const matCupula = new MeshStandardMaterial({ color: COR.mostarda, roughness: 0.4, metalness: 0.2, side: DoubleSide });
  const geoFio = new CylinderGeometry(0.006, 0.006, 0.75, 6);
  const geoLampada = new SphereGeometry(0.05, 16, 12);
  const matLampada = new MeshBasicMaterial({ color: 0xfff0d0 });
  for (const x of [-1.7, 1.7]) {
    fixo(new Mesh(geoFio, matAco), x, HT - 0.375, ZBAL);
    fixo(new Mesh(geoCupula, matCupula), x, 2.33, ZBAL);
    fixo(new Mesh(geoLampada, matLampada), x, 2.27, ZBAL);
    const luz = new PointLight(0xffb066, 10, 6, 2);
    luz.position.set(x, 2.25, ZBAL);
    scene.add(luz);
  }

  // trilho das comandas (balançam com o movimento)
  fixo(new Mesh(new CylinderGeometry(0.012, 0.012, 4.4, 8), matAco), 0, 1.95, -3.74, 0, 0, Math.PI / 2);
  const geoComanda = new PlaneGeometry(0.13, 0.19);
  geoComanda.translate(0, -0.095, 0);
  const comandas = [];
  [-1.95, -1.55, -1.1, -0.72, 0.74, 1.15, 1.58, 1.98].forEach((x, i) => {
    const m = new Mesh(geoComanda, new MeshLambertMaterial({ map: texComandas[i % 4], side: DoubleSide }));
    m.position.set(x, 1.94, -3.73 + (i % 2) * 0.005);
    m.userData.base = (ruido(i, 9) - 0.5) * 0.12;
    m.userData.fase = i * 1.7;
    scene.add(m);
    comandas.push(m);
  });

  // luzes
  scene.add(new HemisphereLight(0xffe3c4, 0x3a080c, 0.3));
  const chave = new DirectionalLight(0xfff1de, 2.4);
  chave.position.set(-2.2, 3.6, 0.8);
  chave.target.position.set(0, 1.2, ZBAL);
  scene.add(chave, chave.target);
  const contraluz = new PointLight(0xff9a4a, 4, 5, 2);
  contraluz.position.set(0, 1.6, -4.7);
  scene.add(contraluz);

  /* ---------- o lanche sobre o balcão ---------- */
  const raizLanche = new Group();
  raizLanche.position.set(0, 1.08, ZBAL);
  scene.add(raizLanche);
  const tabua = new Mesh(new CylinderGeometry(0.4, 0.4, 0.03, 48), new MeshStandardMaterial({ color: COR.tabua, roughness: 0.62 }));
  tabua.position.y = -0.015;
  raizLanche.add(tabua);
  fixo(new Mesh(new PlaneGeometry(1.15, 1.15), matSombra(0.5)), 0, 1.0515, ZBAL, -Math.PI / 2);
  const matSombraLanche = matSombra(0);
  const sombraLanche = new Mesh(new PlaneGeometry(0.72, 0.72), matSombraLanche);
  sombraLanche.rotation.x = -Math.PI / 2;
  sombraLanche.position.y = 0.001;
  raizLanche.add(sombraLanche);

  const receita = [
    { feito: paoBaixo, y: 0 },
    { feito: molho, y: 0.087 },
    { feito: carne, y: 0.101 + 0.026 },
    { feito: queijo, y: 0.155, yaw: 0.35 },
    { feito: carne, y: 0.158 + 0.026 },
    { feito: queijo, y: 0.212, yaw: 1.2 },
    { feito: picles, y: 0.216 },
    { feito: paoCima, y: 0.228, yaw: 0.6 },
  ];
  const camadas = receita.map((r, i) => {
    const grupo = new Group();
    const feito = r.feito();
    let q = null;
    if (feito.malha) { q = feito; grupo.add(feito.malha); } else grupo.add(feito);
    raizLanche.add(grupo);
    const a = 0.5 + i * 1.15, raio = 0.13 + 0.06 * Math.sin(i * 1.3);
    const s = 0.07 + i * 0.1;
    return {
      obj: grupo, queijo: q, mAnt: 0.12, y: r.y, yaw: r.yaw || i * 0.7,
      fx: Math.cos(a) * raio, fy: 0.5 + i * 0.18, fz: Math.sin(a) * raio * 0.8,
      rx: Math.sin(i * 2.3) * 0.38, ry: i * 0.9, rz: Math.cos(i * 1.7) * 0.3,
      giro: i % 2 ? 1 : -1, twirl: (i % 2 ? 1 : -1) * (2.2 + (i % 3) * 0.5), fase: i * 1.37,
      s, e: s + 0.15, t: 0, px: 0, pz: 0, vx: 0, vz: 0,
    };
  });
  const TOTAL = camadas.length;

  /* ---------- caminho da câmera ---------- */
  const centroLanche = new Vector3(0, 1.27, ZBAL);
  const centroNuvem = new Vector3(0, 2.05, ZBAL);
  const dirFinal = new Vector3(0.2, 0.3, 1).normalize();
  const camParada = new Vector3(1.0, 1.8, -0.55), olharParado = new Vector3(0, 1.75, ZBAL);
  let curva;
  function montarCaminho(aspecto) {
    const dist = aspecto < 0.8 ? 1.5 : aspecto < 1.2 ? 1.45 : 1.6;
    const fim = centroLanche.clone().addScaledVector(dirFinal, dist);
    curva = new CatmullRomCurve3([
      new Vector3(0, 1.74, 1.45), new Vector3(0.85, 1.68, 0.35), new Vector3(-0.62, 1.6, -0.7),
      new Vector3(0.45, 1.55, -1.5), fim,
    ], false, 'centripetal');
  }

  /* ---------- tamanho da tela ---------- */
  let W = 0, H = 0, formato = '', maxRolagem = 1;
  function ajustar(forcar) {
    maxRolagem = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (!forcar && w === W && Math.abs(h - H) < 120) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    const asp = w / h;
    camera.aspect = asp;
    camera.fov = asp < 0.8 ? 60 : asp < 1.2 ? 50 : 42;
    const desloc = asp < 0.8 ? 0.15 : asp < 1.2 ? 0.08 : 0.03;
    const lado = asp < 0.8 ? 0 : asp < 1.2 ? -0.06 : -0.13;
    camera.setViewOffset(w, h, w * lado, h * desloc, w, h);
    camera.updateProjectionMatrix();
    const f = asp < 0.8 ? 'retrato' : asp < 1.2 ? 'quadrado' : 'paisagem';
    if (f !== formato) { formato = f; montarCaminho(asp); }
    sujo = true;
  }

  /* ---------- entrada do usuário ---------- */
  let parX = 0, parY = 0, parAlvoX = 0, parAlvoY = 0;
  let yaw = 0, yawSuave = 0, giroVel = 0, arrastando = false, ultimoX = 0, ultimoT = 0, inicioX = 0, inicioY = 0, modoGiro = false;
  window.addEventListener('pointermove', (e) => {
    acordar();
    if (e.pointerType === 'mouse' && !arrastando) {
      parAlvoX = (e.clientX / window.innerWidth) * 2 - 1;
      parAlvoY = (e.clientY / window.innerHeight) * 2 - 1;
    }
    if (!arrastando) return;
    const dx = e.clientX - ultimoX;
    if (!modoGiro) {
      if (Math.abs(e.clientX - inicioX) > 8 && Math.abs(e.clientX - inicioX) > Math.abs(e.clientY - inicioY)) modoGiro = true;
      else return;
    }
    const agora = performance.now(), dtE = Math.max(8, agora - ultimoT) / 1000;
    yaw += dx * 0.008;
    giroVel = clamp(giroVel * 0.7 + ((dx * 0.008) / dtE) * 0.3, -6, 6);
    ultimoX = e.clientX; ultimoT = agora;
    sujo = true;
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    acordar();
    const alvo = e.target;
    if (alvo && alvo.closest && alvo.closest('a, button')) return;
    arrastando = true; modoGiro = false;
    inicioX = ultimoX = e.clientX; inicioY = e.clientY; ultimoT = performance.now(); giroVel = 0;
  }, { passive: true });
  const soltar = () => { arrastando = false; if (!modoGiro) giroVel = 0; };
  window.addEventListener('pointerup', soltar, { passive: true });
  window.addEventListener('pointercancel', soltar, { passive: true });
  if (toque) {
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null || reduzir) return;
      const nx = clamp(e.gamma / 25, -1, 1), ny = clamp((e.beta - 50) / 25, -1, 1);
      if (Math.abs(nx - parAlvoX) + Math.abs(ny - parAlvoY) > 0.08) acordar();
      parAlvoX = nx; parAlvoY = ny;
    }, { passive: true });
  }

  /* ---------- interface por cima da cena ---------- */
  const cartoes = [...document.querySelectorAll('.cartao')];
  const contas = [...document.querySelectorAll('[data-conta]')];
  const anuncio = document.getElementById('anuncio');
  const botaoPausa = document.getElementById('pausa');
  const fpsEl = document.getElementById('fps');
  const LIMITES = [0, 0.08, 0.3, 0.5, 0.7, 0.92];
  let capitulo = -1, contaAnt = -1;
  function mostrarCapitulo(i) {
    if (i === capitulo) return;
    cartoes.forEach((c, k) => {
      const on = k === i;
      c.classList.toggle('on', on);
      c.inert = !on;
      c.setAttribute('aria-hidden', String(!on));
    });
    if (capitulo !== -1 && anuncio) anuncio.textContent = cartoes[i].querySelector('h1, h2').textContent;
    capitulo = i;
  }
  function atualizarUI(p, noLugar) {
    let i = 0;
    for (let k = 0; k < LIMITES.length; k++) if (p >= LIMITES[k]) i = k;
    mostrarCapitulo(i);
    if (noLugar !== contaAnt) {
      contaAnt = noLugar;
      const txt = `${noLugar} de ${TOTAL} camadas no lugar`;
      contas.forEach((el) => { el.textContent = txt; });
    }
  }
  function rotuloPausa() {
    if (!botaoPausa) return;
    botaoPausa.setAttribute('aria-pressed', String(!ambiente));
    botaoPausa.textContent = ambiente ? 'Pausar' : 'Animar';
    botaoPausa.setAttribute('aria-label', ambiente ? 'Pausar a animação contínua' : 'Retomar a animação contínua');
  }
  if (botaoPausa) botaoPausa.addEventListener('click', () => { ambiente = !ambiente; acordar(); rotuloPausa(); sujo = true; });
  window.addEventListener('keydown', acordar, { passive: true });
  window.addEventListener('wheel', acordar, { passive: true });
  rotuloPausa();
  mqReduzir.addEventListener('change', (e) => { reduzir = e.matches; ambiente = !reduzir; acordar(); rotuloPausa(); sujo = true; });

  /* ---------- atualização por quadro ---------- */
  const _S = new Vector3(), _C = new Vector3(), _E = new Vector3(), _P = new Vector3();
  const _q1 = new Quaternion(), _q2 = new Quaternion(), _qt = new Quaternion(), _e = new Euler();
  const EIXO_Y = new Vector3(0, 1, 0);
  const _cam = new Vector3(), _olhar = new Vector3(), _off = new Vector3(), _frente = new Vector3(), _direita = new Vector3();
  let prog = 0, progAnt = 0, alvoP = 0, inclinar = 0, tempo = 0, forcado = null, sujo = true;

  function atualizarCamadas(dt, livre) {
    let noLugar = 0, movendo = false;
    const amb = forcaAmb;
    const aberto = 1 - 0.45 * suave(c01((prog - 0.05) / 0.85));
    for (const L of camadas) {
      const alvo = c01((prog - L.s) / (L.e - L.s));
      L.t = livre ? amortecer(L.t, alvo, 9, dt) : alvo;
      if (Math.abs(L.t - alvo) < 1e-4) L.t = alvo; else movendo = true;
      const t = maisSuave(L.t);
      if (L.t > 0.985) noLugar++;
      const solto = amb * (1 - t);
      const fy = L.y + (L.fy - L.y) * aberto;
      _S.set(
        L.fx + Math.sin(tempo * 0.5 + L.fase) * 0.03 * solto,
        fy + Math.sin(tempo * 1.1 + L.fase) * 0.035 * solto,
        L.fz + Math.cos(tempo * 0.6 + L.fase) * 0.03 * solto,
      );
      _E.set(0, L.y, 0);
      // arco: sai um pouco para fora da coluna e desce girando até o lugar
      const rr = Math.hypot(_S.x, _S.z) || 1;
      _C.set(_S.x + (_S.x / rr) * 0.3, _S.y * 0.55 + _E.y * 0.45 + 0.06, _S.z + (_S.z / rr) * 0.3);
      const u = 1 - t;
      _P.set(
        u * u * _S.x + 2 * u * t * _C.x + t * t * _E.x,
        u * u * _S.y + 2 * u * t * _C.y + t * t * _E.y,
        u * u * _S.z + 2 * u * t * _C.z + t * t * _E.z,
      );
      if (dt > 0) {
        L.vx = amortecer(L.vx, (_P.x - L.px) / dt, 10, dt);
        L.vz = amortecer(L.vz, (_P.z - L.pz) / dt, 10, dt);
      }
      L.px = _P.x; L.pz = _P.z;
      L.obj.position.copy(_P);

      _e.set(
        L.rx + inclinar * 0.5 * (1 - t) + Math.sin(tempo * 0.7 + L.fase) * 0.1 * solto,
        L.ry + tempo * 0.25 * L.giro * solto,
        L.rz + Math.cos(tempo * 0.8 + L.fase) * 0.08 * solto,
      );
      _q1.setFromEuler(_e);
      _q2.setFromAxisAngle(EIXO_Y, L.yaw + (1 - t) * L.twirl);
      L.obj.quaternion.slerpQuaternions(_q1, _q2, t);
      if (!reduzir) {
        _e.set(clamp(L.vz * 0.5, -0.45, 0.45), 0, clamp(-L.vx * 0.5, -0.45, 0.45));
        _qt.setFromEuler(_e);
        L.obj.quaternion.premultiply(_qt);
      }
      const k = !reduzir && t > 0.84 && t < 1 ? Math.sin((Math.PI * (t - 0.84)) / 0.16) : 0;
      L.obj.scale.set(1 + 0.05 * k, 1 - 0.1 * k, 1 + 0.05 * k);
      if (L.queijo) {
        const m = 0.12 + 0.88 * suave(c01((L.t - 0.72) / 0.28));
        if (Math.abs(m - L.mAnt) > 0.003) { L.queijo.derreter(m); L.mAnt = m; }
      }
    }
    matSombraLanche.opacity = 0.55 * suave(camadas[0].t);
    return { noLugar, movendo };
  }

  function atualizarCamera() {
    if (reduzir) {
      camera.position.copy(camParada);
      camera.lookAt(olharParado);
      return;
    }
    const u = maisSuave(c01(prog / 0.9));
    curva.getPoint(u, _cam);
    const o = suave(c01((prog - 0.9) / 0.1));
    if (o > 0) {
      _off.subVectors(_cam, centroLanche).applyAxisAngle(EIXO_Y, o * 0.65);
      _cam.addVectors(centroLanche, _off);
    }
    centroNuvem.y = 2.05 - 0.4 * suave(c01((prog - 0.05) / 0.85));
    _olhar.lerpVectors(centroNuvem, centroLanche, suave(c01((prog - 0.04) / 0.84)));
    _frente.subVectors(_olhar, _cam).normalize();
    _direita.crossVectors(_frente, EIXO_Y).normalize();
    _cam.addScaledVector(_direita, parX * 0.14).addScaledVector(EIXO_Y, -parY * 0.07);
    camera.position.copy(_cam);
    camera.lookAt(_olhar);
  }

  function atualizarTudo(dt, livre) {
    const amb = forcaAmb;
    if (livre) {
      const vel = dt > 0 ? (prog - progAnt) / dt : 0;
      progAnt = prog;
      inclinar = reduzir ? 0 : amortecer(inclinar, clamp(vel * 2.2, -0.6, 0.6), 3.5, dt);
      parX = amortecer(parX, reduzir ? 0 : parAlvoX, 3, dt);
      parY = amortecer(parY, reduzir ? 0 : parAlvoY, 3, dt);
      if (!arrastando) {
        yaw += giroVel * dt;
        giroVel = amortecer(giroVel, 0, 2.6, dt);
        if (Math.abs(giroVel) < 0.01) giroVel = 0;
      }
      if (prog > 0.93 && !arrastando) yaw += 0.18 * amb * dt;
      yawSuave = amortecer(yawSuave, yaw, 14, dt);
    }
    raizLanche.rotation.y = yawSuave;
    const r = atualizarCamadas(dt, livre);
    comandas.forEach((m, i) => {
      m.rotation.x = m.userData.base + inclinar * 0.6 + Math.sin(tempo * 1.3 + m.userData.fase) * 0.05 * amb;
      m.rotation.z = Math.sin(tempo * 0.9 + i) * 0.03 * amb;
    });
    atualizarCamera();
    return r;
  }

  /* ---------- qualidade adaptativa (mantém o FPS) ---------- */
  let acumulado = 0, quadros = 0, bons = 0, travaSubir = 0;
  function medir(dtReal) {
    if (dtReal > 0.25) return;
    acumulado += dtReal; quadros++;
    if (acumulado < 1) return;
    const fps = quadros / acumulado;
    acumulado = 0; quadros = 0;
    travaSubir = Math.max(0, travaSubir - 1);
    if (fps < 47 && dpr > 0.75) {
      dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); bons = 0; travaSubir = 8;
    } else if (fps > 57 && dpr < dprMax && travaSubir === 0) {
      if (++bons >= 3) { dpr = Math.min(dprMax, dpr + 0.25); renderer.setPixelRatio(dpr); bons = 0; }
    } else bons = 0;
    if (fpsEl) fpsEl.textContent = `${Math.round(fps)} fps · resolução ${dpr.toFixed(2)}x · ${renderer.info.render.calls} desenhos`;
  }

  /* ---------- laço principal ---------- */
  let ultimo = performance.now();
  function quadro(agora) {
    requestAnimationFrame(quadro);
    const dtReal = (agora - ultimo) / 1000;
    ultimo = agora;
    if (forcado !== null) return;
    const dt = Math.min(Math.max(dtReal, 0), 1 / 20);
    alvoP = c01(window.scrollY / maxRolagem);
    const longe = Math.abs(prog - alvoP) > 1e-5;
    if (longe) ultimaAcao = agora;
    const querAmb = ambiente && !reduzir && agora - ultimaAcao < OCIOSO_MS ? 1 : 0;
    forcaAmb = amortecer(forcaAmb, querAmb, querAmb ? 3 : 1.2, Math.min(Math.max(dtReal, 0), 0.25)); // tempo real
    if (forcaAmb < 0.002 && !querAmb) forcaAmb = 0;
    const amb = forcaAmb > 0;
    if (longe) prog = amortecer(prog, alvoP, reduzir ? 16 : 5.5, dt); else prog = alvoP;
    const giroAtivo = arrastando || giroVel !== 0 || Math.abs(yaw - yawSuave) > 1e-4;
    const parAtivo = Math.abs(parX - parAlvoX) > 1e-3 || Math.abs(parY - parAlvoY) > 1e-3 || Math.abs(inclinar) > 1e-3;
    if (!amb && !longe && !giroAtivo && !parAtivo && !sujo) return;
    if (amb) tempo += dt;
    const r = atualizarTudo(dt, true);
    if (r.movendo) sujo = true; else sujo = false;
    renderer.render(scene, camera);
    if (amb || longe || giroAtivo) medir(dtReal);
    atualizarUI(prog, r.noLugar);
  }

  /* ---------- partida ---------- */
  if (MOSTRAR_FPS && fpsEl) fpsEl.hidden = false;
  ajustar(true);
  window.addEventListener('resize', () => ajustar(false), { passive: true });
  prog = progAnt = alvoP = c01(window.scrollY / maxRolagem);
  atualizarTudo(0, false);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  atualizarUI(prog, camadas.filter((L) => L.t > 0.985).length);
  html.classList.add('cena-pronta');
  requestAnimationFrame(quadro);

  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load(`800 100px ${FONTE}`), document.fonts.load(`500 40px ${FONTE}`)])
      .then(() => { texturas.forEach((t) => t.userData.redesenhar && t.userData.redesenhar()); sujo = true; })
      .catch(() => {});
  }

  if (TESTE) {
    window.__brasa = {
      quadro(p, t = 0) {
        forcado = p; prog = progAnt = alvoP = p; tempo = t;
        for (const L of camadas) L.t = c01((p - L.s) / (L.e - L.s));
        const r = atualizarTudo(0, false);
        renderer.render(scene, camera);
        atualizarUI(p, r.noLugar);
        return r.noLugar;
      },
      soltar() { forcado = null; },
      passo(alvo, dt, t) {
        forcado = alvo; alvoP = alvo; tempo = t; forcaAmb = ambiente && !reduzir ? 1 : 0;
        prog = amortecer(prog, alvo, 5.5, dt);
        const r = atualizarTudo(dt, true);
        renderer.render(scene, camera);
        atualizarUI(prog, r.noLugar);
        return r.noLugar;
      },
      giro() { return yaw; },
      info() {
        const i = renderer.info;
        return { desenhos: i.render.calls, triangulos: i.render.triangles, texturas: i.memory.textures, geometrias: i.memory.geometries, dpr, quadros: i.render.frame };
      },
      cpu(n = 120) {
        const t0 = performance.now();
        for (let k = 0; k < n; k++) { prog = (k / n); tempo = k / 60; atualizarTudo(1 / 60, true); }
        return (performance.now() - t0) / n;
      },
    };
  }
  return true;
}

let ok = false;
try { ok = iniciar(); } catch (erro) { console.error(erro); ok = false; }
if (!ok) { html.classList.remove('is-live'); html.classList.add('sem-3d'); }
