/*
  Brasa 41 por dentro: a rua, a fachada e o salão da hamburgueria em 3D.
  A rolagem atravessa a rua, abre a porta e entra; lá dentro o Brasa Duplo
  aparece desmontado sobre o balcão e cada movimento põe uma camada no lugar.

  Este é o código-fonte. O arquivo publicado é ../cena.min.js, gerado com:
    npm install && npm run build
*/
import {
  ACESFilmicToneMapping, BoxGeometry, BufferAttribute, CanvasTexture, CatmullRomCurve3, Color,
  CylinderGeometry, DoubleSide, Euler, ExtrudeGeometry, Fog, Group, HemisphereLight,
  InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, Quaternion, RepeatWrapping, Scene, Shape,
  SphereGeometry, SpotLight, SRGBColorSpace, TorusGeometry, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

  const texFachadaLetreiro = textura(1024, 176, (g, w, h) => {
    g.fillStyle = '#7d0c14'; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#e0a526'; fonte(g, 800, 138, true); g.fillText('BRASA 41', w / 2, h * 0.43);
    g.fillStyle = '#e6e3dd'; fonte(g, 500, 30, false); g.fillText('Smash burger na chapa', w / 2, h * 0.84);
  });
  const texSobrado = textura(896, 500, (g, w, h) => {
    const r = sorteio(11), bw = 28, bh = 10;
    g.fillStyle = '#1f1110'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += bh) {
      for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < w; x += bw) {
        g.fillStyle = `hsl(10, 32%, ${12 + r() * 6}%)`; g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      }
    }
    for (let andar = 0; andar < 2; andar++) for (let k = 0; k < 3; k++) {
      const cx = w * (1 + 2 * k) / 6, ww = 104, hh = 150, x = cx - ww / 2, y = 52 + andar * 248;
      const acesa = r() < 0.6;
      g.fillStyle = '#cfc9bf'; g.fillRect(x - 9, y - 9, ww + 18, hh + 18);
      g.fillStyle = acesa ? (r() < 0.5 ? '#ffcf8a' : '#f2ad62') : '#120c0c'; g.fillRect(x, y, ww, hh);
      if (acesa) { g.fillStyle = 'rgba(125,12,20,0.6)'; g.fillRect(x, y, ww * 0.34, hh); }
      g.fillStyle = '#cfc9bf'; g.fillRect(cx - 3, y, 6, hh); g.fillRect(x - 14, y + hh + 6, ww + 28, 8);
    }
  });
  function texPredio(semente, largura, altura, terreo) {
    const w = 768, h = Math.round((768 * altura) / largura);
    return textura(w, h, (g) => {
      const r = sorteio(semente), chao = h * (3.2 / altura);
      g.fillStyle = '#211614'; g.fillRect(0, 0, w, h);
      const andares = Math.max(1, Math.floor((altura - 3.2) / 2.3)), cols = 4;
      const alto = h - chao, gh = alto / andares, gw = (w - 80) / cols;
      for (let a = 0; a < andares; a++) for (let c = 0; c < cols; c++) {
        const x = 40 + c * gw + gw * 0.2, y = a * gh + gh * 0.2, ww = gw * 0.6, hh = gh * 0.58;
        const acesa = r() < 0.38;
        g.fillStyle = acesa ? (r() < 0.5 ? '#f6c07a' : '#e3a25c') : '#0d0a0a'; g.fillRect(x, y, ww, hh);
        g.fillStyle = '#3a2a26'; g.fillRect(x - 6, y + hh, ww + 12, 9);
      }
      const y0 = h - chao;
      g.fillStyle = '#2a1c19'; g.fillRect(0, y0, w, chao);
      if (terreo === 'loja') {
        g.fillStyle = '#56524d'; g.fillRect(60, y0 + chao * 0.18, w - 120, chao * 0.82);
        g.fillStyle = 'rgba(0,0,0,0.28)';
        for (let y = y0 + chao * 0.18; y < h; y += 10) g.fillRect(60, y, w - 120, 3);
      } else {
        g.fillStyle = '#120c0b'; g.fillRect(w * 0.42, y0 + chao * 0.22, w * 0.16, chao * 0.78);
        g.fillStyle = '#ffd59a'; g.fillRect(w * 0.49, y0 + chao * 0.12, w * 0.02, chao * 0.05);
        g.fillStyle = '#0d0a0a'; g.fillRect(w * 0.1, y0 + chao * 0.3, w * 0.22, chao * 0.38); g.fillRect(w * 0.68, y0 + chao * 0.3, w * 0.22, chao * 0.38);
      }
    });
  }
  const texCalcada = textura(256, 256, (g, w, h) => {
    const r = sorteio(5);
    g.fillStyle = '#4a4440'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = `hsl(25, 6%, ${38 + r() * 6}%)`; g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
    }
  });
  const texAsfalto = textura(256, 256, (g, w, h) => {
    const r = sorteio(9);
    g.fillStyle = '#1d1a1a'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.25)'; g.fillRect(r() * w, r() * h, 2, 2); }
  });
  const texCavalete = textura(512, 768, (g, w, h) => {
    g.fillStyle = '#1e1617'; g.fillRect(0, 0, w, h);
    g.textBaseline = 'top'; g.textAlign = 'left';
    g.fillStyle = '#e0a526'; fonte(g, 800, 110, true); g.fillText('HOJE', 44, 56);
    g.fillStyle = '#e6e3dd'; fonte(g, 800, 120, true); g.fillText('BRASA', 44, 230); g.fillText('DUPLO', 44, 350);
    g.fillStyle = '#e0a526'; fonte(g, 800, 96, true); g.fillText('R$ 34', 44, 500);
    g.fillStyle = '#e6e3dd'; fonte(g, 500, 34, false); g.fillText('Duas carnes, queijo em dobro.', 44, 650);
  });
  const texBau = textura(256, 256, (g, w, h) => {
    g.fillStyle = '#e0a526'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7d0c14'; fonte(g, 800, 170, true); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('41', w / 2, h / 2 + 8);
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

  // luzes: um foco só sobre o balcão (não ilumina a rua) e luz ambiente fraca de noite
  scene.add(new HemisphereLight(0xffe0c2, 0x2a0a0c, 0.26));
  const chave = new SpotLight(0xfff1de, 18, 9, 0.62, 0.7, 1.5);
  chave.position.set(-1.3, 3.05, -1.3);
  chave.target.position.set(0, 1.25, ZBAL);
  scene.add(chave, chave.target);

  /* ---------- lado de fora: fachada, calçada, rua e vizinhos ---------- */
  const ESP = 0.25, ZFF = ZF + ESP / 2; // ZFF: face de fora da fachada
  const matFachada = new MeshLambertMaterial({ color: 0x5e0a10 });
  const matMoldura = new MeshLambertMaterial({ color: 0xd9d5cd });
  const bloco = (x0, x1, y0, y1) => fixo(new Mesh(new BoxGeometry(x1 - x0, y1 - y0, ESP), matFachada), (x0 + x1) / 2, (y0 + y1) / 2, ZF);
  // paredes ao redor da porta (x -0.7 a 0.7) e das duas janelas (x 1.1 a 2.9, altura 0.9 a 2.3)
  bloco(-XW, -2.9, 0, 2.3); bloco(-1.1, -0.7, 0, 2.3); bloco(0.7, 1.1, 0, 2.3); bloco(2.9, XW, 0, 2.3);
  bloco(-2.9, -1.1, 0, 0.9); bloco(1.1, 2.9, 0, 0.9);
  bloco(-XW, XW, 2.3, HT);
  const moldura = (x0, x1, y0, y1) => fixo(new Mesh(new BoxGeometry(x1 - x0, y1 - y0, ESP + 0.06), matMoldura), (x0 + x1) / 2, (y0 + y1) / 2, ZF);
  for (const [a, b] of [[-2.9, -1.1], [1.1, 2.9]]) {
    moldura(a - 0.06, b + 0.06, 2.3, 2.36);
    moldura(a - 0.06, a, 0.9, 2.3); moldura(b, b + 0.06, 0.9, 2.3);
    moldura((a + b) / 2 - 0.03, (a + b) / 2 + 0.03, 0.9, 2.3);
    fixo(new Mesh(new BoxGeometry(b - a + 0.24, 0.06, 0.42), matMostarda), (a + b) / 2, 0.88, ZF + 0.06);
  }
  moldura(-0.76, -0.7, 0, 2.36); moldura(0.7, 0.76, 0, 2.36); moldura(-0.76, 0.76, 2.3, 2.36);
  fixo(new Mesh(new BoxGeometry(1.5, 0.04, 0.5), matAcoFosco), 0, 0.02, ZF);
  // toldos inclinados e letreiro aceso
  const INCL = 0.36, PROF_T = 0.95;
  const matToldoEscuro = new MeshLambertMaterial({ color: 0x4b070c });
  function toldo(x, larg2, mat, matAba) {
    const zc = ZFF + (PROF_T / 2) * Math.cos(INCL), yc = 2.62 - (PROF_T / 2) * Math.sin(INCL);
    fixo(new Mesh(new BoxGeometry(larg2, 0.04, PROF_T), mat), x, yc, zc, INCL);
    fixo(new Mesh(new BoxGeometry(larg2, 0.16, 0.025), matAba), x, 2.62 - PROF_T * Math.sin(INCL) - 0.08, ZFF + PROF_T * Math.cos(INCL));
  }
  toldo(0, 2.0, matMostarda, matVinho);
  toldo(-2.0, 2.0, matToldoEscuro, matMostarda);
  toldo(2.0, 2.0, matToldoEscuro, matMostarda);
  fixo(new Mesh(new BoxGeometry(2.6, 0.46, 0.14), matVinho), 0, 2.93, ZFF + 0.07);
  fixo(new Mesh(new PlaneGeometry(2.56, 0.44), new MeshBasicMaterial({ map: texFachadaLetreiro, toneMapped: false })), 0, 2.93, ZFF + 0.142);
  fixo(new Mesh(new BoxGeometry(larg, 0.08, 0.3), matMostarda), 0, HT, ZFF);
  fixo(new Mesh(new PlaneGeometry(larg, 3.8), new MeshBasicMaterial({ map: texSobrado })), 0, HT + 1.9, ZFF + 0.001);
  fixo(new Mesh(new BoxGeometry(larg + 0.2, 0.18, 0.36), matMoldura), 0, HT + 3.85, ZFF);

  // portas duplas: abrem para dentro quando a câmera chega perto
  const matPorta = new MeshStandardMaterial({ color: COR.vinho, roughness: 0.5 });
  const matVidroPorta = new MeshBasicMaterial({ color: 0x6b3c1f });
  const geoFolha = new BoxGeometry(0.69, 2.26, 0.05), geoVidro = new PlaneGeometry(0.43, 1.2), geoPuxador = new CylinderGeometry(0.012, 0.012, 0.5, 8);
  function folha(lado) {
    const piv = new Group();
    piv.position.set(lado * 0.7, 0, ZF - 0.03);
    const d = -lado * 0.345;
    const f = new Mesh(geoFolha, matPorta); f.position.set(d, 1.13, 0); piv.add(f);
    const v1 = new Mesh(geoVidro, matVidroPorta); v1.position.set(d, 1.35, 0.026); piv.add(v1);
    const v2 = new Mesh(geoVidro, matVidroPorta); v2.position.set(d, 1.35, -0.026); v2.rotation.y = Math.PI; piv.add(v2);
    const pux = new Mesh(geoPuxador, matAco); pux.position.set(-lado * 0.6, 1.05, 0.05); piv.add(pux);
    scene.add(piv);
    return piv;
  }
  const portas = [folha(-1), folha(1)];

  // calçada, meio-fio, rua e faixa de pedestres
  texCalcada.wrapS = texCalcada.wrapT = RepeatWrapping; texCalcada.repeat.set(28 / 1.2, 2.4 / 1.2);
  texAsfalto.wrapS = texAsfalto.wrapT = RepeatWrapping; texAsfalto.repeat.set(10, 4.5);
  const Z_MEIOFIO = ZFF + 2.4;
  fixo(new Mesh(new PlaneGeometry(28, 2.4), new MeshLambertMaterial({ map: texCalcada })), 0, 0.012, ZFF + 1.2, -Math.PI / 2);
  fixo(new Mesh(new BoxGeometry(28, 0.16, 0.2), new MeshLambertMaterial({ color: 0x8a837b })), 0, -0.05, Z_MEIOFIO + 0.1);
  fixo(new Mesh(new PlaneGeometry(40, 18), new MeshLambertMaterial({ map: texAsfalto })), 0, -0.1, Z_MEIOFIO + 9, -Math.PI / 2);
  const geoListra = new BoxGeometry(3.2, 0.012, 0.42), matListra = new MeshLambertMaterial({ color: 0xcfc9bf });
  for (let k = 0; k < 7; k++) fixo(new Mesh(geoListra, matListra), 0, -0.092, Z_MEIOFIO + 0.75 + k * 0.85);

  // prédios vizinhos (de noite, com janelas acesas)
  const matLadoPredio = new MeshLambertMaterial({ color: 0x1a1110 });
  function predio(cx, largura, altura, semente, terreo) {
    const frente = new MeshBasicMaterial({ map: texPredio(semente, largura, altura, terreo) });
    const m = new Mesh(new BoxGeometry(largura, altura, 9), [matLadoPredio, matLadoPredio, matLadoPredio, matLadoPredio, frente, matLadoPredio]);
    fixo(m, cx, altura / 2, ZFF - 0.12 - 4.5);
  }
  predio(-XW - 4.2, 8.4, 7.8, 21, 'porta');
  predio(XW + 4.2, 8.4, 9.4, 33, 'loja');

  // poste com luz quente, moto de entrega e cavalete com o lanche do dia
  const matPoste = new MeshStandardMaterial({ color: 0x2a2626, roughness: 0.6, metalness: 0.5 });
  const Z_POSTE = Z_MEIOFIO - 0.35;
  fixo(new Mesh(new CylinderGeometry(0.05, 0.08, 4.2, 10), matPoste), -3.0, 2.1, Z_POSTE);
  fixo(new Mesh(new BoxGeometry(0.72, 0.06, 0.08), matPoste), -2.68, 4.15, Z_POSTE);
  fixo(new Mesh(new BoxGeometry(0.36, 0.12, 0.22), matPoste), -2.4, 4.08, Z_POSTE);
  fixo(new Mesh(new BoxGeometry(0.3, 0.02, 0.16), new MeshBasicMaterial({ color: 0xffd49a })), -2.4, 4.015, Z_POSTE);
  const luzPoste = new PointLight(0xffb25a, 14, 11, 2);
  luzPoste.position.set(-2.4, 3.9, Z_POSTE);
  scene.add(luzPoste);
  fixo(new Mesh(new CylinderGeometry(0.05, 0.08, 4.2, 10), matPoste), 8.6, 2.1, Z_POSTE);
  fixo(new Mesh(new BoxGeometry(0.3, 0.02, 0.16), new MeshBasicMaterial({ color: 0xffd49a })), 8.3, 4.015, Z_POSTE);
  // luz do salão que sai pela porta e cai na calçada
  const luzPorta = new SpotLight(0xffb066, 16, 8, 0.8, 0.85, 2);
  luzPorta.position.set(0, 2.25, ZF - 0.6);
  luzPorta.target.position.set(0, 0, Z_MEIOFIO);
  scene.add(luzPorta, luzPorta.target);

  const moto = new Group();
  const matPneu = new MeshLambertMaterial({ color: 0x141112 });
  const geoRoda = new TorusGeometry(0.19, 0.07, 10, 24);
  for (const x of [-0.42, 0.42]) { const r = new Mesh(geoRoda, matPneu); r.position.set(x, 0.26, 0); moto.add(r); }
  const corpoMoto = new Mesh(new BoxGeometry(0.9, 0.22, 0.32), matVinho); corpoMoto.position.set(0, 0.42, 0); moto.add(corpoMoto);
  const assentoMoto = new Mesh(new BoxGeometry(0.5, 0.09, 0.3), new MeshLambertMaterial({ color: 0x1d1516 })); assentoMoto.position.set(-0.12, 0.58, 0); moto.add(assentoMoto);
  const colunaMoto = new Mesh(new CylinderGeometry(0.035, 0.035, 0.62, 8), matAco); colunaMoto.position.set(0.42, 0.72, 0); colunaMoto.rotation.z = -0.35; moto.add(colunaMoto);
  const guidao = new Mesh(new CylinderGeometry(0.02, 0.02, 0.56, 8), matAco); guidao.position.set(0.52, 1.0, 0); guidao.rotation.x = Math.PI / 2; moto.add(guidao);
  const farol = new Mesh(new SphereGeometry(0.05, 10, 8), new MeshBasicMaterial({ color: 0xfff0c8 })); farol.position.set(0.58, 0.9, 0); moto.add(farol);
  const matBau = new MeshLambertMaterial({ map: texBau });
  const bau = new Mesh(new BoxGeometry(0.46, 0.42, 0.44), [matMostarda, matMostarda, matMostarda, matMostarda, matBau, matBau]); bau.position.set(-0.4, 0.86, 0); moto.add(bau);
  moto.position.set(2.15, 0.012, ZFF + 1.55); moto.rotation.y = -0.28;
  moto.traverse((o) => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  scene.add(moto);

  const cavalete = new Group();
  const placa = new Mesh(new PlaneGeometry(0.6, 0.9), new MeshLambertMaterial({ map: texCavalete, emissive: 0xffffff, emissiveMap: texCavalete, emissiveIntensity: 0.22 }));
  placa.position.set(0, 0.44, 0.12); placa.rotation.x = -0.26; cavalete.add(placa);
  const costas = new Mesh(new PlaneGeometry(0.6, 0.9), new MeshLambertMaterial({ color: 0x3a2a20 }));
  costas.position.set(0, 0.44, -0.12); costas.rotation.set(0.26, Math.PI, 0); cavalete.add(costas);
  cavalete.position.set(-1.35, 0.012, ZFF + 1.15); cavalete.rotation.y = 0.32;
  cavalete.traverse((o) => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  scene.add(cavalete);

  /* ---------- o lanche sobre o balcão ---------- */
  const raizLanche = new Group();
  raizLanche.position.set(0, 1.08, ZBAL);
  scene.add(raizLanche);
  fixo(new Mesh(new CylinderGeometry(0.4, 0.4, 0.03, 48), new MeshStandardMaterial({ color: COR.tabua, roughness: 0.62 })), 0, 1.065, ZBAL);
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
    const s = 0.38 + i * 0.064;
    return {
      obj: grupo, queijo: q, mAnt: 0.12, y: r.y, yaw: r.yaw || i * 0.7,
      fx: Math.cos(a) * raio, fy: 0.5 + i * 0.18, fz: Math.sin(a) * raio * 0.8,
      rx: Math.sin(i * 2.3) * 0.38, ry: i * 0.9, rz: Math.cos(i * 1.7) * 0.3,
      giro: i % 2 ? 1 : -1, twirl: (i % 2 ? 1 : -1) * (2.2 + (i % 3) * 0.5), fase: i * 1.37,
      s, e: s + 0.11, t: 0, a: 0, px: 0, pz: 0, vx: 0, vz: 0,
    };
  });
  const TOTAL = camadas.length;

  /* ---------- caminho da câmera ---------- */
  const centroLanche = new Vector3(0, 1.27, ZBAL);
  const centroNuvem = new Vector3(0, 2.05, ZBAL);
  const dirFinal = new Vector3(0.2, 0.3, 1).normalize();
  const camParada = new Vector3(1.0, 1.8, -0.55), olharParado = new Vector3(0, 1.75, ZBAL);
  const P_DENTRO = 0.36, P_FIM = 0.93;
  let curva, uDentro = 0.7;
  function montarCaminho(aspecto) {
    const dist = aspecto < 0.8 ? 1.5 : aspecto < 1.2 ? 1.45 : 1.6;
    const fim = centroLanche.clone().addScaledVector(dirFinal, dist);
    const longe = aspecto < 0.8 ? 14.5 : 13.0;
    const pts = [
      new Vector3(0.9, 2.0, longe), new Vector3(0.45, 1.88, 9.2), new Vector3(0.15, 1.74, 5.7),
      new Vector3(0, 1.67, 3.4), new Vector3(0, 1.66, 1.6), new Vector3(0.75, 1.63, 0.2),
      new Vector3(-0.55, 1.58, -0.9), new Vector3(0.45, 1.54, -1.6), fim,
    ];
    curva = new CatmullRomCurve3(pts, false, 'centripetal');
    curva.arcLengthDivisions = 600;
    const comp = curva.getLengths(600);
    uDentro = comp[Math.round((4 / (pts.length - 1)) * 600)] / comp[600];
  }
  // rolagem -> posição no caminho: rápido na rua, mais devagar lá dentro, sem trancos (Hermite monotônica)
  function caminhar(p) {
    if (p <= 0) return 0;
    if (p >= P_FIM) return 1;
    const d0 = uDentro / P_DENTRO, d1 = (1 - uDentro) / (P_FIM - P_DENTRO);
    const m1 = 2 / (1 / d0 + 1 / d1);
    const [xa, xb, ya, yb, ma, mb] = p < P_DENTRO ? [0, P_DENTRO, 0, uDentro, d0 * 0.5, m1] : [P_DENTRO, P_FIM, uDentro, 1, m1, 0];
    const h = xb - xa, t = (p - xa) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ya + (t3 - 2 * t2 + t) * h * ma + (-2 * t3 + 3 * t2) * yb + (t3 - t2) * h * mb;
  }
  // para onde olhar: fachada lá de longe, a porta chegando perto, o lanche lá dentro
  const olharFachada = new Vector3(0, 2.05, ZF), olharPorta = new Vector3(0, 1.62, 0);
  const _o1 = new Vector3(), _o2 = new Vector3();
  function alvoOlhar(camZ, m, out) {
    const w1 = suave(c01((7.5 - camZ) / 4.0));
    const w2 = suave(c01((3.4 - camZ) / 2.4));
    _o1.lerpVectors(olharFachada, olharPorta, w1);
    _o2.lerpVectors(centroNuvem, centroLanche, m);
    return out.lerpVectors(_o1, _o2, w2);
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
    if (forcado !== null) { atualizarTudo(0, false); renderer.render(scene, camera); }
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
  const LIMITES = [0, 0.1, 0.3, 0.42, 0.55, 0.68, 0.81, 0.94];
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

  function atualizarCamadas(dt, livre, entrada) {
    let noLugar = 0, movendo = false, visivel = false;
    const amb = forcaAmb;
    const aberto = 1 - 0.45 * suave(c01((prog - 0.36) / 0.57));
    camadas.forEach((L, i) => {
      const alvo = c01((prog - L.s) / (L.e - L.s));
      L.t = livre ? amortecer(L.t, alvo, 9, dt) : alvo;
      if (Math.abs(L.t - alvo) < 1e-4) L.t = alvo; else movendo = true;
      const alvoA = c01(entrada * 1.4 - i * 0.05);
      L.a = livre ? amortecer(L.a, alvoA, 6, dt) : alvoA;
      if (Math.abs(L.a - alvoA) < 1e-4) L.a = alvoA; else movendo = true;
      if (L.a > 0.0005) visivel = true;
      const ap = 1 - Math.pow(1 - L.a, 3);
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
      _S.lerpVectors(_E, _S, ap); // ao entrar, a camada brota da tábua e sobe até a coluna
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
      _q2.setFromAxisAngle(EIXO_Y, L.yaw + (1 - t) * L.twirl + (1 - ap) * 2.2);
      L.obj.quaternion.slerpQuaternions(_q1, _q2, t);
      if (!reduzir) {
        _e.set(clamp(L.vz * 0.5, -0.45, 0.45), 0, clamp(-L.vx * 0.5, -0.45, 0.45));
        _qt.setFromEuler(_e);
        L.obj.quaternion.premultiply(_qt);
      }
      const k = !reduzir && t > 0.84 && t < 1 ? Math.sin((Math.PI * (t - 0.84)) / 0.16) : 0;
      const tam = Math.max(ap, 0.0001);
      L.obj.scale.set((1 + 0.05 * k) * tam, (1 - 0.1 * k) * tam, (1 + 0.05 * k) * tam);
      if (L.queijo) {
        const m = 0.12 + 0.88 * suave(c01((L.t - 0.72) / 0.28));
        if (Math.abs(m - L.mAnt) > 0.003) { L.queijo.derreter(m); L.mAnt = m; }
      }
    });
    raizLanche.visible = visivel;
    matSombraLanche.opacity = 0.55 * suave(camadas[0].t);
    return { noLugar, movendo };
  }

  function atualizarCamera() {
    if (reduzir) {
      camera.position.copy(camParada);
      camera.lookAt(olharParado);
      return;
    }
    curva.getPointAt(caminhar(prog), _cam);
    const o = suave(c01((prog - P_FIM) / (1 - P_FIM)));
    if (o > 0) {
      _off.subVectors(_cam, centroLanche).applyAxisAngle(EIXO_Y, o * 0.65);
      _cam.addVectors(centroLanche, _off);
    }
    const m = suave(c01((prog - 0.38) / 0.55));
    centroNuvem.y = 2.05 - 0.4 * m;
    alvoOlhar(_cam.z, m, _olhar);
    _frente.subVectors(_olhar, _cam).normalize();
    _direita.crossVectors(_frente, EIXO_Y).normalize();
    const forte = 1 + 1.6 * c01((_cam.z - 2) / 6); // lá fora o mouse e a inclinação mexem mais: mais profundidade
    _cam.addScaledVector(_direita, parX * 0.14 * forte).addScaledVector(EIXO_Y, -parY * 0.07 * forte);
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
      if (prog > 0.95 && !arrastando) yaw += 0.18 * amb * dt;
      yawSuave = amortecer(yawSuave, yaw, 14, dt);
    }
    raizLanche.rotation.y = yawSuave;
    atualizarCamera();
    const z = camera.position.z;
    const fora = suave(c01((z - 1.5) / 4));
    scene.fog.near = 6.5 + 5.5 * fora;
    scene.fog.far = 14 + 22 * fora;
    renderer.toneMappingExposure = 1.05 - 0.1 * fora;
    const abre = reduzir ? 1 : suave(c01((9 - z) / 4.6));
    portas[0].rotation.y = abre * 1.5;
    portas[1].rotation.y = -abre * 1.5;
    const entrada = reduzir ? suave(c01((prog - 0.26) / 0.12)) : suave(c01((3.0 - z) / 1.4));
    const r = atualizarCamadas(dt, livre, entrada);
    comandas.forEach((m, i) => {
      m.rotation.x = m.userData.base + inclinar * 0.6 + Math.sin(tempo * 1.3 + m.userData.fase) * 0.05 * amb;
      m.rotation.z = Math.sin(tempo * 0.9 + i) * 0.03 * amb;
    });
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

  /* ---------- menos chamadas de desenho: junta as peças paradas que usam o mesmo material ---------- */
  function juntarParados() {
    scene.updateMatrixWorld(true);
    const grupos = new Map();
    scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent) return;
      for (let q = o; q && q !== scene; q = q.parent) if (q.matrixAutoUpdate) return; // só o que nunca se mexe
      const g = o.geometry;
      const chave = `${o.material.uuid}|${Object.keys(g.attributes).sort().join(',')}|${g.index ? 'i' : 'n'}`;
      if (!grupos.has(chave)) grupos.set(chave, { mat: o.material, itens: [] });
      grupos.get(chave).itens.push(o);
    });
    for (const { mat, itens } of grupos.values()) {
      if (itens.length < 2) continue;
      const geos = itens.map((o) => o.geometry.clone().applyMatrix4(o.matrixWorld));
      const junta = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!junta) continue;
      const m = new Mesh(junta, mat);
      m.matrixAutoUpdate = false;
      scene.add(m);
      itens.forEach((o) => o.parent.remove(o));
    }
  }
  juntarParados();

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
        // L.a é calculado em atualizarTudo a partir da posição da câmera (livre = false)
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
      cena: scene, camera, renderer,
      info() {
        const i = renderer.info;
        return { desenhos: i.render.calls, triangulos: i.render.triangles, texturas: i.memory.textures, geometrias: i.memory.geometries, dpr, quadros: i.render.frame, cam: camera.position.toArray().map((v) => +v.toFixed(2)), nevoa: [+scene.fog.near.toFixed(1), +scene.fog.far.toFixed(1)], uDentro: +uDentro.toFixed(3) };
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
