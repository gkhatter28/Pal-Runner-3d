import * as THREE from 'three';

export interface GameTextureSet {
  trackBed: THREE.CanvasTexture;
  wallA: THREE.CanvasTexture;
  wallB: THREE.CanvasTexture;
  trainTeal: THREE.CanvasTexture;
  trainCrimson: THREE.CanvasTexture;
  trainAmber: THREE.CanvasTexture;
  hazard: THREE.CanvasTexture;
  coin: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  skyBackdrop: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export function createGameTextures(maxAnisotropy: number): GameTextureSet {
  // 1. Track bed (3 lanes with wooden sleepers and ballast)
  const trackCanvas = document.createElement('canvas');
  trackCanvas.width = 512;
  trackCanvas.height = 512;
  const tCtx = trackCanvas.getContext('2d')!;
  tCtx.fillStyle = '#262b38';
  tCtx.fillRect(0, 0, 512, 512);

  // Subtle ballast speckles
  for (let i = 0; i < 1600; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    tCtx.fillStyle = i % 2 === 0 ? '#313748' : '#1b202b';
    tCtx.fillRect(x, y, 3, 3);
  }

  // 3 track lanes across width (170px per lane roughly)
  const laneCenters = [86, 256, 426];
  for (let y = 0; y < 512; y += 32) {
    for (const cx of laneCenters) {
      tCtx.fillStyle = '#5c4033';
      tCtx.fillRect(cx - 56, y + 6, 112, 12);
      tCtx.fillStyle = '#473026';
      tCtx.fillRect(cx - 56, y + 14, 112, 4);
    }
  }
  // Lane divider dashed lines
  tCtx.fillStyle = '#475569';
  for (let y = 0; y < 512; y += 64) {
    tCtx.fillRect(169, y, 4, 34);
    tCtx.fillRect(339, y, 4, 34);
  }
  const trackBed = finalizeColorTexture(trackCanvas, maxAnisotropy, 1, 2);

  // 2. Viaduct side walls with vibrant street-art geometric panels
  const makeWall = (accentA: string, accentB: string): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 256);

    // Concrete horizontal ribs
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 512, 22);
    ctx.fillRect(0, 226, 512, 30);

    // Mural geometric blocks
    ctx.fillStyle = accentA;
    ctx.beginPath();
    ctx.moveTo(40, 210);
    ctx.lineTo(130, 50);
    ctx.lineTo(240, 50);
    ctx.lineTo(150, 210);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = accentB;
    ctx.beginPath();
    ctx.moveTo(260, 210);
    ctx.lineTo(340, 60);
    ctx.lineTo(460, 210);
    ctx.closePath();
    ctx.fill();

    // Accent stripe
    ctx.fillStyle = '#f8fafc';
    ctx.globalAlpha = 0.22;
    ctx.fillRect(0, 120, 512, 10);
    ctx.globalAlpha = 1;

    return finalizeColorTexture(c, maxAnisotropy, 1, 1);
  };

  const wallA = makeWall('#0ea5e9', '#f59e0b');
  const wallB = makeWall('#ef4444', '#10b981');

  // 3. Subway train side livery
  const makeTrainTex = (bodyHex: string, stripeHex: string): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bodyHex;
    ctx.fillRect(0, 0, 512, 256);

    // Racing stripe
    ctx.fillStyle = stripeHex;
    ctx.fillRect(0, 152, 512, 24);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 144, 512, 6);

    // Windows & doors
    for (let x = 24; x < 480; x += 96) {
      // Door seam
      ctx.fillStyle = '#0f172a';
      ctx.globalAlpha = 0.28;
      ctx.fillRect(x - 10, 44, 4, 180);
      ctx.globalAlpha = 1;

      // Window frame
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, 56, 68, 64);
      ctx.fillStyle = '#38bdf8';
      ctx.globalAlpha = 0.65;
      ctx.fillRect(x + 6, 62, 56, 52);
      ctx.globalAlpha = 1;
    }
    return finalizeColorTexture(c, maxAnisotropy);
  };

  const trainTeal = makeTrainTex('#0284c7', '#f59e0b');
  const trainCrimson = makeTrainTex('#dc2626', '#fde047');
  const trainAmber = makeTrainTex('#0d9488', '#f97316');

  // 4. Hazard construction stripes
  const hazardCanvas = document.createElement('canvas');
  hazardCanvas.width = 256;
  hazardCanvas.height = 128;
  const hCtx = hazardCanvas.getContext('2d')!;
  hCtx.fillStyle = '#f59e0b';
  hCtx.fillRect(0, 0, 256, 128);
  hCtx.fillStyle = '#18181b';
  for (let x = -128; x < 384; x += 48) {
    hCtx.beginPath();
    hCtx.moveTo(x, 128);
    hCtx.lineTo(x + 24, 128);
    hCtx.lineTo(x + 96, 0);
    hCtx.lineTo(x + 72, 0);
    hCtx.closePath();
    hCtx.fill();
  }
  const hazard = finalizeColorTexture(hazardCanvas, maxAnisotropy);

  // 5. Gold coin face
  const coinCanvas = document.createElement('canvas');
  coinCanvas.width = 128;
  coinCanvas.height = 128;
  const cCtx = coinCanvas.getContext('2d')!;
  cCtx.fillStyle = '#f59e0b';
  cCtx.fillRect(0, 0, 128, 128);
  cCtx.strokeStyle = '#fde047';
  cCtx.lineWidth = 10;
  cCtx.beginPath();
  cCtx.arc(64, 64, 48, 0, Math.PI * 2);
  cCtx.stroke();
  cCtx.fillStyle = '#fef08a';
  cCtx.fillRect(54, 34, 20, 60);
  const coin = finalizeColorTexture(coinCanvas, maxAnisotropy);

  // 6. Soft radial contact shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.needsUpdate = true;

  // 7. Golden hour urban gradient sky texture
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 32;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d')!;
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, '#0f172a');
  skyGrad.addColorStop(0.42, '#1d4ed8');
  skyGrad.addColorStop(0.75, '#f97316');
  skyGrad.addColorStop(1, '#fde68a');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 32, 256);
  const skyBackdrop = finalizeColorTexture(skyCanvas, 1);

  return {
    trackBed,
    wallA,
    wallB,
    trainTeal,
    trainCrimson,
    trainAmber,
    hazard,
    coin,
    contactShadow,
    skyBackdrop,
    dispose: () => {
      trackBed.dispose();
      wallA.dispose();
      wallB.dispose();
      trainTeal.dispose();
      trainCrimson.dispose();
      trainAmber.dispose();
      hazard.dispose();
      coin.dispose();
      contactShadow.dispose();
      skyBackdrop.dispose();
    },
  };
}
