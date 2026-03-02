import { OUTLINE_COLOR } from './constants.js';

function hexToRGB(hex) {
  return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
}

function fillStar(g, x, y, size, color) {
  g.fillStyle(color, 1);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.fillPoints([
      { x, y },
      { x: x + Math.cos(a - 0.2) * size * 0.35, y: y + Math.sin(a - 0.2) * size * 0.35 },
      { x: x + Math.cos(a) * size, y: y + Math.sin(a) * size },
      { x: x + Math.cos(a + 0.2) * size * 0.35, y: y + Math.sin(a + 0.2) * size * 0.35 },
    ], true);
  }
}

export function generateBackgrounds(scene) {
  const bgs = [
    { sky: [0x87CEEB, 0xFFE4B5], clouds: true, rainbow: true, stars: false, ground: 0x90EE90 },
    { sky: [0x0D0328, 0x1A064E], clouds: false, rainbow: false, stars: true, ground: 0x1A063E },
    { sky: [0xFF7F45, 0xFFCC9C], clouds: true, rainbow: false, stars: false, ground: 0xFF6B6D },
    { sky: [0xFFB4D4, 0xFFE4EA], clouds: true, rainbow: true, stars: false, ground: 0xFFC3D4 },
    { sky: [0x006994, 0x40B5E0], clouds: false, rainbow: false, stars: false, ground: 0x005577, bubbles: true },
    { sky: [0x2D6B4F, 0x52B788], clouds: false, rainbow: false, stars: true, ground: 0x1B4332 },
  ];
  bgs.forEach((bg, idx) => {
    const rt = scene.add.renderTexture(0, 0, 390, 844); rt.setVisible(false);
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const top = hexToRGB(bg.sky[0]), bot = hexToRGB(bg.sky[1]);
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const r = Math.round(top.r + (bot.r - top.r) * t);
      const gr = Math.round(top.g + (bot.g - top.g) * t);
      const b = Math.round(top.b + (bot.b - top.b) * t);
      g.fillStyle((r << 16) | (gr << 8) | b, 1);
      g.fillRect(0, t * 844, 390, 844 / 40 + 1);
    }
    g.fillStyle(bg.ground, 1); g.fillRect(0, 724, 390, 120);
    g.fillStyle(bg.ground & 0xDDDDDD, 0.5); g.fillRect(0, 714, 390, 20);
    if (bg.rainbow) {
      [0xFF0000, 0xFF8000, 0xFFFF00, 0x00CC00, 0x0055FF, 0x8800FF].forEach((c, ci) => {
        g.lineStyle(16, c, 0.7); g.beginPath(); g.arc(195, 764, 260 - ci * 18, Math.PI, 0, false); g.strokePath();
      });
    }
    if (bg.clouds) {
      [[70, 100], [250, 80], [340, 160], [120, 220]].forEach(([cx, cy]) => {
        g.fillStyle(0xFFFFFF, 0.85);
        g.fillCircle(cx, cy, 30); g.fillCircle(cx + 30, cy - 10, 38);
        g.fillCircle(cx + 65, cy, 28); g.fillCircle(cx + 35, cy + 12, 25);
      });
    }
    if (bg.stars) {
      for (let i = 0; i < 60; i++) {
        g.fillStyle(0xFFFFFF, Math.random() * 0.8 + 0.2);
        g.fillCircle(Math.random() * 390, Math.random() * 644, Math.random() * 3 + 1);
      }
    }
    if (bg.bubbles) {
      for (let i = 0; i < 20; i++) {
        g.lineStyle(2, 0xAADDFF, 0.7);
        g.strokeCircle(Math.random() * 390, Math.random() * 844, Math.random() * 12 + 4);
      }
    }
    rt.draw(g, 0, 0); rt.saveTexture(`bg_${idx}`); g.destroy(); rt.destroy();
  });
}

export function generatePennyBase(scene) {
  const rt = scene.add.renderTexture(0, 0, 200, 300); rt.setVisible(false);
  const g = scene.make.graphics({ add: false });
  const cx = 100;
  g.fillStyle(0xFFE4B0, 1); g.fillRect(cx - 12, 105, 24, 30);
  g.fillStyle(0xFFE4B0, 1); g.fillEllipse(cx, 68, 88, 96);
  g.lineStyle(3, OUTLINE_COLOR, 1); g.strokeEllipse(cx, 68, 88, 96);
  g.fillStyle(0x8B4513, 1); g.fillEllipse(cx, 52, 94, 70);
  g.fillEllipse(cx - 42, 85, 22, 60); g.fillEllipse(cx + 42, 85, 22, 60);
  g.fillStyle(0xB86B33, 0.5); g.fillEllipse(cx - 10, 40, 20, 35);
  g.fillStyle(0x4A1EC7, 1); g.fillCircle(cx - 18, 65, 9); g.fillCircle(cx + 18, 65, 9);
  g.fillStyle(0xFFFFFF, 1); g.fillCircle(cx - 15, 63, 3); g.fillCircle(cx + 21, 63, 3);
  g.fillStyle(0x000000, 1); g.fillCircle(cx - 17, 65, 5); g.fillCircle(cx + 19, 65, 5);
  g.fillStyle(0xFFFFFF, 1); g.fillCircle(cx - 14, 62, 2.5); g.fillCircle(cx + 22, 62, 2.5);
  g.lineStyle(2, OUTLINE_COLOR, 1);
  [-22, -18, -14].forEach(xo => { g.beginPath(); g.moveTo(cx + xo, 57); g.lineTo(cx + xo - 1, 52); g.strokePath(); });
  [14, 18, 22].forEach(xo => { g.beginPath(); g.moveTo(cx + xo, 57); g.lineTo(cx + xo + 1, 52); g.strokePath(); });
  g.fillStyle(0xFFCA99, 1); g.fillEllipse(cx, 76, 10, 7);
  g.fillStyle(0xFFB6AA, 0.5); g.fillCircle(cx - 28, 80, 12); g.fillCircle(cx + 28, 80, 12);
  g.lineStyle(2.5, 0x994F73, 1); g.beginPath(); g.arc(cx, 88, 14, 0.2, Math.PI - 0.2); g.strokePath();
  g.fillStyle(0xFFFFFF, 1); g.fillRect(cx - 7, 88, 14, 6);
  g.fillStyle(0xFFE4B0, 1);
  g.fillEllipse(cx - 65, 180, 22, 80); g.fillEllipse(cx + 65, 180, 22, 80);
  g.lineStyle(2, OUTLINE_COLOR, 1);
  g.strokeEllipse(cx - 65, 180, 22, 80); g.strokeEllipse(cx + 65, 180, 22, 80);
  g.fillStyle(0xFFE4B0, 1); g.fillCircle(cx - 65, 222, 11); g.fillCircle(cx + 65, 222, 11);
  g.fillStyle(0xFFE4B0, 1); g.fillRect(cx - 28, 240, 22, 55); g.fillRect(cx + 6, 240, 22, 55);
  g.fillStyle(0xFF4B64, 1);
  g.fillEllipse(cx - 17, 297, 32, 16); g.fillEllipse(cx + 17, 297, 32, 16);
  g.lineStyle(2, OUTLINE_COLOR, 1);
  g.strokeEllipse(cx - 17, 297, 32, 16); g.strokeEllipse(cx + 17, 297, 32, 16);
  rt.draw(g, 0, 0); rt.saveTexture('penny_base'); g.destroy(); rt.destroy();
}

export function generateOutfits(scene) {
  const outfits = [
    { body: 0xFFB4D4, skirt: 0xFF4B64, pattern: 'dots', accent: 0xFFE400 },
    { body: 0x87CEEB, skirt: 0x415E81, pattern: 'stars', accent: 0xFFE400 },
    { body: 0x9B59B6, skirt: 0x6C3483, pattern: 'zigzag', accent: 0xFFE400 },
    { body: 0x52B788, skirt: 0x2D6B4F, pattern: 'flowers', accent: 0xFFE400 },
    { body: 0xFF7F45, skirt: 0xFFEEBD, pattern: 'rainbow', accent: 0xFF4B64 },
    { body: 0xE8DAEF, skirt: 0xBE93DE, pattern: 'snowflakes', accent: 0x4FC3F7 },
  ];
  outfits.forEach((o, idx) => {
    const rt = scene.add.renderTexture(0, 0, 160, 180); rt.setVisible(false);
    const g = scene.make.graphics({ add: false });
    const cx = 80;
    g.fillStyle(o.body, 1); g.fillRoundedRect(cx - 38, 0, 76, 75, 8);
    g.lineStyle(3, OUTLINE_COLOR, 1); g.strokeRoundedRect(cx - 38, 0, 76, 75, 8);
    g.fillStyle(o.skirt, 1);
    g.fillTriangle(cx - 60, 75, cx + 60, 75, cx - 70, 175);
    g.fillTriangle(cx - 60, 75, cx + 60, 75, cx + 70, 175);
    g.fillTriangle(cx - 60, 75, cx + 60, 75, cx, 180);
    g.fillEllipse(cx, 130, 145, 100);
    g.lineStyle(3, OUTLINE_COLOR, 1); g.strokeEllipse(cx, 130, 145, 100);
    if (o.pattern === 'dots') {
      g.fillStyle(o.accent, 0.7);
      [[cx-20,25],[cx+10,35],[cx-5,50],[cx-30,110],[cx+30,120],[cx,145],[cx-50,135],[cx+50,130]].forEach(([px,py]) => g.fillCircle(px, py, 5));
    } else if (o.pattern === 'stars') {
      [[cx-15,20],[cx+15,40],[cx,30],[cx-40,115],[cx+40,125],[cx,150]].forEach(([px,py]) => fillStar(g, px, py, 7, o.accent));
    } else if (o.pattern === 'zigzag') {
      g.lineStyle(2, o.accent, 0.8);
      for (let r = 0; r < 3; r++) { const by = 85 + r * 28; g.beginPath(); for (let j = 0; j < 8; j++) { const px = cx - 60 + j * 18, py = by + (j % 2 === 0 ? 0 : 10); j === 0 ? g.moveTo(px, py) : g.lineTo(px, py); } g.strokePath(); }
    } else if (o.pattern === 'flowers') {
      g.fillStyle(o.accent, 0.8);
      [[cx,20],[cx-25,110],[cx+25,130],[cx,155],[cx-45,145]].forEach(([px,py]) => { for (let p = 0; p < 5; p++) { const a = (p/5)*Math.PI*2; g.fillCircle(px+Math.cos(a)*7, py+Math.sin(a)*7, 4); } g.fillCircle(px, py, 5); });
    } else if (o.pattern === 'rainbow') {
      [0xFF0000,0xFF8000,0xFFFF00,0x00CC00,0x0055FF].forEach((c,ci) => { g.fillStyle(c, 0.6); g.fillRect(cx-38, 8+ci*12, 76, 10); });
    } else if (o.pattern === 'snowflakes') {
      g.lineStyle(1.5, o.accent, 0.9);
      [[cx-20,25],[cx+10,40],[cx-35,115],[cx+35,130],[cx,155]].forEach(([px,py]) => { for (let s = 0; s < 6; s++) { const a = (s/6)*Math.PI*2; g.beginPath(); g.moveTo(px, py); g.lineTo(px+Math.cos(a)*9, py+Math.sin(a)*9); g.strokePath(); } });
    }
    g.fillStyle(o.accent, 1);
    g.fillTriangle(cx-18,73,cx,82,cx-18,91); g.fillTriangle(cx+18,73,cx,82,cx+18,91);
    g.fillCircle(cx, 82, 7); g.lineStyle(2, OUTLINE_COLOR, 1); g.strokeCircle(cx, 82, 7);
    rt.draw(g, 0, 0); rt.saveTexture(`outfit_${idx}`); g.destroy(); rt.destroy();
  });
}

export function generateWings(scene) {
  const wings = [
    { color: 0xFFEB78, vein: 0xFF4B64, glow: 0xFFC3DD },
    { color: 0xB8DFFF, vein: 0x415E81, glow: 0x87CEEB },
    { color: 0xD4AAFF, vein: 0x9B59B6, glow: 0xCC99FF },
    { color: 0xB8E8D4, vein: 0x2EB971, glow: 0x90EE90 },
    { color: 0xFFE568, vein: 0xFF7F45, glow: 0xFFC357 },
    { color: 0xFFFF98, vein: 0xFFE400, glow: 0xFFFF7A },
  ];
  wings.forEach((w, idx) => {
    const rt = scene.add.renderTexture(0, 0, 280, 200); rt.setVisible(false);
    const g = scene.make.graphics({ add: false });
    const cx = 140, cy = 110;
    [[-1, cx - 10], [1, cx + 10]].forEach(([dir, bx]) => {
      g.fillStyle(w.color, 0.85); g.fillEllipse(bx + dir * 60, cy - 40, 115, 110);
      g.lineStyle(2.5, w.vein, 0.9); g.strokeEllipse(bx + dir * 60, cy - 40, 115, 110);
      g.fillStyle(w.color, 0.75); g.fillEllipse(bx + dir * 45, cy + 45, 80, 70);
      g.lineStyle(2, w.vein, 0.7); g.strokeEllipse(bx + dir * 45, cy + 45, 80, 70);
      g.lineStyle(1.5, w.vein, 0.5);
      const wcx = bx + dir * 60, wcy = cy - 40;
      for (let v = 0; v < 4; v++) { const a = (v/4)*Math.PI*0.8+(dir>0?0.1:Math.PI-0.9); g.beginPath(); g.moveTo(cx, cy); g.lineTo(wcx+Math.cos(a)*50, wcy+Math.sin(a)*45); g.strokePath(); }
      g.fillStyle(w.glow, 0.9);
      for (let d = 0; d < 5; d++) { const a = (d/5)*Math.PI*1.2+(dir>0?-0.2:Math.PI-1); g.fillCircle(wcx+Math.cos(a)*50, wcy+Math.sin(a)*47, 4); }
    });
    rt.draw(g, 0, 0); rt.saveTexture(`wings_${idx}`); g.destroy(); rt.destroy();
  });
}

export function generateCrowns(scene) {
  const crowns = [
    { base: 0xFFE400, gems: [0xFF0000, 0x0000FF, 0xFF0000], style: 'crown' },
    { base: 0xE8E8E8, gems: [0x4FC3F7, 0xFFFFFF, 0x4FC3F7], style: 'tiara' },
    { base: 0xCC6B4C, gems: [0xFFFFFF, 0xFFE400, 0xFFFFFF], style: 'floral' },
    { base: 0xFF4B64, gems: [0xFFFFFF, 0xFF4B64, 0xFFFFFF], style: 'bow' },
    { base: 0x40B5E0, gems: [0xFFFFFF, 0x87CEEB, 0xFFFFFF], style: 'stars' },
    { base: 0x52B788, gems: [0xFFE400, 0xFFC3DD, 0xFFE400], style: 'leaves' },
  ];
  crowns.forEach((c, idx) => {
    const rt = scene.add.renderTexture(0, 0, 130, 80); rt.setVisible(false);
    const g = scene.make.graphics({ add: false });
    const cx = 65;
    if (c.style === 'crown' || c.style === 'tiara') {
      g.fillStyle(c.base, 1); g.fillRoundedRect(cx-55, 40, 110, 30, 8);
      g.lineStyle(2.5, OUTLINE_COLOR, 1); g.strokeRoundedRect(cx-55, 40, 110, 30, 8);
      const pts = c.style === 'crown' ? 5 : 7;
      for (let p = 0; p < pts; p++) {
        const px = cx - 45 + p * (90 / (pts - 1)), h = p % 2 === 0 ? 35 : 20;
        g.fillStyle(c.base, 1); g.fillTriangle(px-10,42,px+10,42,px,42-h);
        g.lineStyle(2, OUTLINE_COLOR, 1); g.strokeTriangle(px-10,42,px+10,42,px,42-h);
        if (p % 2 === 0) { g.fillStyle(c.gems[p%c.gems.length], 1); g.fillCircle(px, 42-h+8, 6); g.fillStyle(0xFFFFFF, 0.5); g.fillCircle(px-2, 42-h+6, 2); }
      }
      c.gems.forEach((gem, gi) => { const gx = cx-25+gi*25; g.fillStyle(gem, 1); g.fillRoundedRect(gx-6,46,12,18,3); g.fillStyle(0xFFFFFF, 0.4); g.fillRect(gx-3,48,4,6); });
    } else if (c.style === 'floral') {
      g.fillStyle(c.base, 0.3); g.fillRoundedRect(cx-55, 48, 110, 12, 6);
      [cx-40,cx-20,cx,cx+20,cx+40].forEach((fx, fi) => {
        const fc = c.gems[fi%c.gems.length];
        for (let p = 0; p < 5; p++) { const a = (p/5)*Math.PI*2; g.fillStyle(fc, 1); g.fillCircle(fx+Math.cos(a)*8, 44+Math.sin(a)*8, 6); }
        g.fillStyle(c.base, 1); g.fillCircle(fx, 44, 7); g.lineStyle(1.5, OUTLINE_COLOR, 1); g.strokeCircle(fx, 44, 7);
      });
    } else if (c.style === 'bow') {
      g.fillStyle(c.base, 1); g.fillRoundedRect(cx-55,46,110,16,8);
      g.lineStyle(2, OUTLINE_COLOR, 1); g.strokeRoundedRect(cx-55,46,110,16,8);
      g.fillStyle(c.base, 1); g.fillTriangle(cx-32,25,cx,42,cx-32,58); g.fillTriangle(cx+32,25,cx,42,cx+32,58);
      g.fillCircle(cx, 42, 12); g.lineStyle(2, OUTLINE_COLOR, 1); g.strokeCircle(cx, 42, 12);
      c.gems.forEach((gem, gi) => { g.fillStyle(gem, 1); g.fillCircle(cx-18+gi*18, 54, 5); });
    } else if (c.style === 'stars') {
      g.fillStyle(c.base, 1); g.fillRoundedRect(cx-55,46,110,16,8);
      g.lineStyle(2, OUTLINE_COLOR, 1); g.strokeRoundedRect(cx-55,46,110,16,8);
      [cx-40,cx-20,cx,cx+20,cx+40].forEach((sx, si) => { fillStar(g, sx, 30, 14, c.gems[si%c.gems.length]); });
    } else if (c.style === 'leaves') {
      g.lineStyle(3, c.base, 1); g.beginPath(); g.moveTo(cx-55, 54);
      for (let lx = -55; lx <= 55; lx += 5) g.lineTo(cx+lx, 54+Math.sin(lx*0.2)*5);
      g.strokePath();
      for (let lx = -45; lx <= 45; lx += 18) {
        g.fillStyle(c.base, 1); const ly = 54+Math.sin(lx*0.2)*5;
        g.fillEllipse(cx+lx, ly-14, 14, 24); g.lineStyle(1, OUTLINE_COLOR, 0.5); g.strokeEllipse(cx+lx, ly-14, 14, 24);
        if (Math.abs(lx) % 36 === 0) { for (let p = 0; p < 5; p++) { const a = (p/5)*Math.PI*2; g.fillStyle(c.gems[0], 1); g.fillCircle(cx+lx+Math.cos(a)*7, ly-28+Math.sin(a)*7, 4); } g.fillStyle(0xFFE400, 1); g.fillCircle(cx+lx, ly-28, 5); }
      }
    }
    rt.draw(g, 0, 0); rt.saveTexture(`crown_${idx}`); g.destroy(); rt.destroy();
  });
}

export function generateBooCat(scene) {
  const rt = scene.add.renderTexture(0, 0, 100, 90); rt.setVisible(false);
  const g = scene.make.graphics({ add: false });
  const cx = 50, cy = 50;
  g.fillStyle(0xF5D7A5, 1); g.fillEllipse(cx, cy+15, 58, 50);
  g.lineStyle(2.5, OUTLINE_COLOR, 1); g.strokeEllipse(cx, cy+15, 58, 50);
  g.fillStyle(0xF5D7A5, 1); g.fillCircle(cx, cy-10, 34);
  g.lineStyle(2.5, OUTLINE_COLOR, 1); g.strokeCircle(cx, cy-10, 34);
  g.fillStyle(0xF5D7A5, 1);
  g.fillTriangle(cx-28,cy-36,cx-18,cy-14,cx-8,cy-36); g.fillTriangle(cx+28,cy-36,cx+18,cy-14,cx+8,cy-36);
  g.lineStyle(2, OUTLINE_COLOR, 1);
  g.strokeTriangle(cx-28,cy-36,cx-18,cy-14,cx-8,cy-36); g.strokeTriangle(cx+28,cy-36,cx+18,cy-14,cx+8,cy-36);
  g.fillStyle(0xFFB8BC, 1);
  g.fillTriangle(cx-25,cy-33,cx-18,cy-17,cx-11,cy-33); g.fillTriangle(cx+25,cy-33,cx+18,cy-17,cx+11,cy-33);
  g.fillStyle(0x228B22, 1); g.fillEllipse(cx-11,cy-12,14,16); g.fillEllipse(cx+11,cy-12,14,16);
  g.fillStyle(0x000000, 1); g.fillEllipse(cx-11,cy-12,7,12); g.fillEllipse(cx+11,cy-12,7,12);
  g.fillStyle(0xFFFFFF, 1); g.fillCircle(cx-8,cy-14,3); g.fillCircle(cx+14,cy-14,3);
  g.fillStyle(0xFF4B64, 1); g.fillTriangle(cx-4,cy-3,cx+4,cy-3,cx,cy+2);
  g.lineStyle(2, OUTLINE_COLOR, 1);
  g.beginPath(); g.moveTo(cx,cy+2); g.lineTo(cx-8,cy+8); g.strokePath();
  g.beginPath(); g.moveTo(cx,cy+2); g.lineTo(cx+8,cy+8); g.strokePath();
  g.lineStyle(1.5, 0x888888, 0.8);
  [[-1,1],[-1,-1],[1,1],[1,-1]].forEach(([dx,dy]) => { g.beginPath(); g.moveTo(cx+dx*5,cy+1); g.lineTo(cx+dx*30,cy+dy*5); g.strokePath(); });
  g.lineStyle(5, 0xF5D7A5, 1); g.beginPath(); g.moveTo(cx+26,cy+25); g.bezierCurveTo(cx+55,cy+10,cx+65,cy+35,cx+48,cy+42); g.strokePath();
  g.lineStyle(2, OUTLINE_COLOR, 0.6); g.beginPath(); g.moveTo(cx+26,cy+25); g.bezierCurveTo(cx+55,cy+10,cx+65,cy+35,cx+48,cy+42); g.strokePath();
  g.fillStyle(0xFF4B64, 1); g.fillRect(cx-18,cy+20,36,8);
  g.lineStyle(1.5, OUTLINE_COLOR, 1); g.strokeRect(cx-18,cy+20,36,8);
  g.fillStyle(0xFFE400, 1); g.fillCircle(cx,cy+28,5); g.lineStyle(1, OUTLINE_COLOR, 1); g.strokeCircle(cx,cy+28,5);
  rt.draw(g, 0, 0); rt.saveTexture('boo_cat'); g.destroy(); rt.destroy();
}

export function generateButterfly(scene) {
  const rt = scene.add.renderTexture(0, 0, 60, 50); rt.setVisible(false);
  const g = scene.make.graphics({ add: false });
  const cx = 30, cy = 25;
  g.fillStyle(0xFF9900, 0.9);
  g.fillEllipse(cx-14,cy-8,28,22); g.fillEllipse(cx+14,cy-8,28,22);
  g.fillEllipse(cx-10,cy+10,18,16); g.fillEllipse(cx+10,cy+10,18,16);
  g.lineStyle(1.5, OUTLINE_COLOR, 0.8);
  g.strokeEllipse(cx-14,cy-8,28,22); g.strokeEllipse(cx+14,cy-8,28,22);
  g.fillStyle(0x000000, 0.5); g.fillCircle(cx-14,cy-8,5); g.fillCircle(cx+14,cy-8,5);
  g.fillStyle(0x333333, 1); g.fillEllipse(cx,cy,6,22);
  g.lineStyle(1.5, 0x333333, 1);
  g.beginPath(); g.moveTo(cx-2,cy-8); g.lineTo(cx-10,cy-22); g.strokePath();
  g.beginPath(); g.moveTo(cx+2,cy-8); g.lineTo(cx+10,cy-22); g.strokePath();
  g.fillStyle(0xFF9900, 1); g.fillCircle(cx-10,cy-22,3); g.fillCircle(cx+10,cy-22,3);
  rt.draw(g, 0, 0); rt.saveTexture('butterfly'); g.destroy(); rt.destroy();
}

export function generateBabyLuke(scene) {
  const rt = scene.add.renderTexture(0, 0, 110, 130); rt.setVisible(false);
  const g = scene.make.graphics({ add: false });
  const cx = 55;
  g.fillStyle(0x87CEEB, 1); g.fillRoundedRect(cx-32,70,64,55,12);
  g.lineStyle(2.5, OUTLINE_COLOR, 1); g.strokeRoundedRect(cx-32,70,64,55,12);
  g.fillStyle(0xFFFFFF, 1); [cx-8,cx,cx+8].forEach(bx => g.fillCircle(bx, 118, 3));
  g.fillStyle(0xFFE4B0, 1); g.fillRect(cx-10,62,20,15);
  g.fillStyle(0xFFE4B0, 1); g.fillCircle(cx, 42, 38);
  g.lineStyle(3, OUTLINE_COLOR, 1); g.strokeCircle(cx, 42, 38);
  g.fillStyle(0xB86B33, 1); g.fillEllipse(cx,12,35,22); g.fillEllipse(cx-10,8,18,20); g.fillEllipse(cx+10,8,18,20);
  g.fillStyle(0x4A1EC7, 1); g.fillCircle(cx-13,40,10); g.fillCircle(cx+13,40,10);
  g.fillStyle(0xFFFFFF, 1); g.fillCircle(cx-10,37,4); g.fillCircle(cx+16,37,4);
  g.fillStyle(0xFFB6AA, 0.6); g.fillCircle(cx-26,52,10); g.fillCircle(cx+26,52,10);
  g.fillStyle(0xFFCA99, 1); g.fillCircle(cx, 50, 4);
  g.lineStyle(2.5, 0x994F73, 1); g.beginPath(); g.arc(cx, 54, 12, 0.1, Math.PI-0.1); g.strokePath();
  g.fillStyle(0xFFE4B0, 1);
  g.fillEllipse(cx-44,88,20,38); g.fillEllipse(cx+44,88,20,38);
  g.fillCircle(cx-44,108,12); g.fillCircle(cx+44,108,12);
  g.lineStyle(2, OUTLINE_COLOR, 0.7); g.strokeCircle(cx-44,108,12); g.strokeCircle(cx+44,108,12);
  g.fillStyle(0xFF4B64, 1); g.fillCircle(cx+4,63,7);
  g.lineStyle(1.5, OUTLINE_COLOR, 1); g.strokeCircle(cx+4,63,7);
  g.fillStyle(0xFFFFFF, 1); g.fillRect(cx-2,60,12,6);
  rt.draw(g, 0, 0); rt.saveTexture('baby_luke'); g.destroy(); rt.destroy();
}

export function generateHeart(scene) {
  const rt = scene.add.renderTexture(0, 0, 40, 36); rt.setVisible(false);
  const g = scene.make.graphics({ add: false });
  const cx = 20, cy = 20;
  [0xFF4B64, 0xFF5B93, 0xFFC3DD].forEach((color, i) => {
    const s = 1-i*0.1, w = 30*s, h = 28*s;
    g.fillStyle(color, 1-i*0.2);
    g.fillCircle(cx-w*0.25, cy-h*0.15, w*0.28);
    g.fillCircle(cx+w*0.25, cy-h*0.15, w*0.28);
    g.fillTriangle(cx-w*0.5, cy, cx+w*0.5, cy, cx, cy+h*0.55);
  });
  rt.draw(g, 0, 0); rt.saveTexture('heart'); g.destroy(); rt.destroy();
}

export function generateGearIcon(scene) {
  const rt = scene.add.renderTexture(0, 0, 44, 44); rt.setVisible(false);
  const g = scene.make.graphics({ add: false });
  const cx = 22, cy = 22;
  g.fillStyle(0xFFFFFF, 0.9);
  for (let i = 0; i < 8; i++) { const a = (i/8)*Math.PI*2; g.fillRect(cx+Math.cos(a)*10-3, cy+Math.sin(a)*10-3, 6, 6); }
  g.lineStyle(4, 0xFFFFFF, 0.9); g.strokeCircle(cx, cy, 16);
  g.fillStyle(0x1A064E, 1); g.fillCircle(cx, cy, 7);
  rt.draw(g, 0, 0); rt.saveTexture('gear_icon'); g.destroy(); rt.destroy();
}
