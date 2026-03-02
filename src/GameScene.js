import Phaser from 'phaser';
import { ITEM_COUNT, CATEGORIES, OUTLINE_COLOR } from './constants.js';
import { SoundManager } from './SoundManager.js';
import { SaveManager } from './SaveManager.js';
import { Confetti } from './Confetti.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.sound_mgr = new SoundManager();
    this.store = new SaveManager();
    this.confetti = new Confetti(this);

    this.state = {
      outfit: this.store.get('outfit'),
      wings: this.store.get('wings'),
      crown: this.store.get('crown'),
      background: this.store.get('background'),
    };

    this._createBackground();
    this._createPenny();
    this._createButtonBar();
    this._createGearButton();

    this._booActive = false;
    this._babyActive = false;
    this._booSprites = [];
    this._babySprites = [];
    this._heartSprites = [];
  }

  // ── Background ──
  _createBackground() {
    this.bgImage = this.add.image(this.W / 2, this.H / 2, `bg_${this.state.background}`)
      .setDisplaySize(this.W, this.H).setDepth(0);
  }

  _updateBackground(idx) {
    this.bgImage.setTexture(`bg_${idx}`);
    this.bgImage.setDisplaySize(this.W, this.H);
  }

  // ── Penny character ──
  _createPenny() {
    const cx = this.W / 2;
    const cy = this.H / 2 - 60;

    this.wingsImage = this.add.image(cx, cy + 20, `wings_${this.state.wings}`)
      .setDisplaySize(260, 185).setDepth(2);
    this.pennyImage = this.add.image(cx, cy, 'penny_base')
      .setDisplaySize(180, 270).setDepth(3);
    this.outfitImage = this.add.image(cx, cy + 60, `outfit_${this.state.outfit}`)
      .setDisplaySize(145, 165).setDepth(4);
    this.crownImage = this.add.image(cx, cy - 100, `crown_${this.state.crown}`)
      .setDisplaySize(115, 70).setDepth(5);

    this._addFloatingSparkles();
  }

  _addFloatingSparkles() {
    const cx = this.W / 2;
    const cy = this.H / 2 - 60;
    const colors = [0xFFE400, 0xFF4B64, 0x87CEEB, 0x90EE90, 0xCC99FF];

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 110 + Math.random() * 30;
      const sx = cx + Math.cos(angle) * radius;
      const sy = cy + Math.sin(angle) * radius;

      const spark = this.add.graphics();
      spark.fillStyle(colors[i % colors.length], 0.8);
      spark.fillStar(0, 0, 4, 3, 8, 0);
      spark.x = sx;
      spark.y = sy;
      spark.setDepth(6);

      this.tweens.add({
        targets: spark,
        y: sy - 15,
        alpha: { from: 0.3, to: 0.9 },
        scaleX: { from: 0.8, to: 1.2 },
        scaleY: { from: 0.8, to: 1.2 },
        duration: 1200 + Math.random() * 800,
        yoyo: true,
        repeat: -1,
        delay: i * 150,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ── Button bar ──
  _createButtonBar() {
    const W = this.W;
    const H = this.H;
    const barH = 110;
    const btnW = Math.floor(W / 6) - 4;
    const btnH = 88;
    const barY = H - barH;

    // Bar background
    const bar = this.add.graphics();
    bar.fillStyle(0x1A064E, 0.92);
    bar.fillRoundedRect(0, barY, W, barH, { tl: 22, tr: 22, bl: 0, br: 0 });
    bar.lineStyle(3, 0xCC99FF, 0.5);
    bar.strokeRoundedRect(0, barY, W, barH, { tl: 22, tr: 22, bl: 0, br: 0 });
    bar.setDepth(10);

    this.buttons = [];

    CATEGORIES.forEach((cat, idx) => {
      const bx = Math.floor((idx + 0.5) * (W / 6));
      const by = barY + (barH - btnH) / 2 + btnH / 2;

      const container = this.add.container(bx, by).setDepth(11);

      // Button bg
      const bg = this.add.graphics();
      bg.fillStyle(0x3D1A8E, 1);
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
      bg.lineStyle(2.5, 0xCC99FF, 0.7);
      bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
      container.add(bg);

      // Emoji
      const emoji = this.add.text(0, -18, cat.emoji, {
        fontSize: '28px',
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
      }).setOrigin(0.5);
      container.add(emoji);

      // Label
      const label = this.add.text(0, 22, cat.label, {
        fontSize: '13px',
        fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
        color: '#ffffff',
        stroke: '#1a0a2e',
        strokeThickness: 3,
      }).setOrigin(0.5);
      container.add(label);

      // Hit area
      const hitArea = this.add.rectangle(0, 0, btnW, btnH, 0, 0)
        .setInteractive({ useHandCursor: true });
      container.add(hitArea);

      hitArea.on('pointerdown', () => this._onButtonTap(cat.key, idx, container, bx, by));

      hitArea.on('pointerover', () => {
        this.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 100, ease: 'Back.easeOut' });
        bg.clear();
        bg.fillStyle(0x5A2FA0, 1);
        bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
        bg.lineStyle(2.5, 0xFFCCFF, 0.9);
        bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
      });

      hitArea.on('pointerout', () => {
        this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
        bg.clear();
        bg.fillStyle(0x3D1A8E, 1);
        bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
        bg.lineStyle(2.5, 0xCC99FF, 0.7);
        bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
      });

      this.buttons.push({ container, bg, emoji, label, btnW, btnH });
    });
  }

  _onButtonTap(key, idx, container) {
    // Tap animation
    this.tweens.add({
      targets: container,
      scaleX: 0.88, scaleY: 0.88,
      duration: 80, yoyo: true,
      ease: 'Quad.easeInOut',
    });

    if (key === 'boo') {
      this._triggerBoo();
      this.sound_mgr.playCatMeow();
    } else if (key === 'baby') {
      this._triggerBaby();
      this.sound_mgr.playBabyGiggle();
    } else {
      this.state[key] = (this.state[key] + 1) % ITEM_COUNT;
      this.store.set(key, this.state[key]);
      this._updateItem(key, this.state[key]);
      this.sound_mgr.playPop();
    }

    // Confetti + sparkle
    this.confetti.burst(this.W / 2, this.H / 2 - 80 - 60, 24);
    this.sound_mgr.playSparkle();
  }

  _updateItem(key, val) {
    let target = null;
    if (key === 'outfit') { target = this.outfitImage; this.outfitImage.setTexture(`outfit_${val}`); }
    else if (key === 'wings') { target = this.wingsImage; this.wingsImage.setTexture(`wings_${val}`); }
    else if (key === 'crown') { target = this.crownImage; this.crownImage.setTexture(`crown_${val}`); }
    else if (key === 'background') { this._updateBackground(val); return; }
    if (target) this._bounceItem(target);
  }

  _bounceItem(target) {
    this.tweens.add({
      targets: target,
      scaleX: 1.18, scaleY: 1.18,
      duration: 120, ease: 'Back.easeOut', yoyo: true,
      onComplete: () => { this.tweens.add({ targets: target, scaleX: 1, scaleY: 1, duration: 80 }); },
    });
  }

  // ── Boo the Cat animation ──
  _triggerBoo() {
    if (this._booActive) return;
    this._booActive = true;

    const H = this.H;
    const W = this.W;
    const leftEdge = -70;
    const rightEdge = W + 70;
    const groundY = H - 175;

    this._booSprites.forEach(s => s.destroy());
    this._booSprites = [];

    // Butterfly
    const butterfly = this.add.image(W + 50, groundY - 60, 'butterfly')
      .setDisplaySize(50, 42).setDepth(15);
    this._booSprites.push(butterfly);

    this.tweens.add({ targets: butterfly, scaleY: { from: 1, to: 0.3 }, duration: 200, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: butterfly, x: leftEdge - 30, y: groundY - 80, duration: 3000, ease: 'Sine.easeInOut', onComplete: () => butterfly.destroy() });

    // Cat chasing
    const cat = this.add.image(leftEdge, groundY, 'boo_cat')
      .setDisplaySize(85, 77).setDepth(14).setFlipX(false);
    this._booSprites.push(cat);

    this.tweens.add({ targets: cat, y: groundY - 10, duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: cat, x: rightEdge, duration: 2800, ease: 'Linear', onComplete: () => { cat.destroy(); this._booActive = false; } });
  }

  // ── Baby Luke animation ──
  _triggerBaby() {
    if (this._babyActive) return;
    this._babyActive = true;

    const cx = this.W / 2;
    this._babySprites.forEach(s => s.destroy());
    this._heartSprites.forEach(s => s.destroy());
    this._babySprites = [];
    this._heartSprites = [];

    const baby = this.add.image(cx, this.H + 80, 'baby_luke')
      .setDisplaySize(95, 115).setDepth(16);
    this._babySprites.push(baby);

    this.tweens.add({
      targets: baby,
      y: this.H - 220,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: baby, angle: { from: -8, to: 8 }, duration: 300, yoyo: true, repeat: 3 });

        // Floating hearts
        for (let i = 0; i < 8; i++) {
          this.time.delayedCall(i * 180, () => {
            const hx = cx + Phaser.Math.Between(-70, 70);
            const hy = this.H - 240;
            const heart = this.add.image(hx, hy, 'heart')
              .setDisplaySize(32, 28).setDepth(17).setAlpha(0.9);
            this._heartSprites.push(heart);

            this.tweens.add({
              targets: heart,
              y: hy - Phaser.Math.Between(80, 180),
              x: hx + Phaser.Math.Between(-40, 40),
              alpha: 0, scale: 1.4,
              duration: Phaser.Math.Between(1200, 2000),
              ease: 'Sine.easeOut',
              onComplete: () => {
                heart.destroy();
                const hi = this._heartSprites.indexOf(heart);
                if (hi !== -1) this._heartSprites.splice(hi, 1);
              },
            });
          });
        }

        // Baby exits
        this.time.delayedCall(2500, () => {
          this.tweens.add({
            targets: baby,
            y: this.H + 100,
            duration: 400,
            ease: 'Back.easeIn',
            onComplete: () => { baby.destroy(); this._babyActive = false; },
          });
        });
      },
    });
  }

  // ── Settings gear ──
  _createGearButton() {
    const gx = this.W - 30;
    const gear = this.add.image(gx, 30, 'gear_icon')
      .setDisplaySize(38, 38).setDepth(20)
      .setInteractive({ useHandCursor: true });

    gear.on('pointerover', () => gear.setScale(1.15));
    gear.on('pointerout', () => gear.setScale(1));
    gear.on('pointerdown', () => this._showResetDialog());

    this.tweens.add({ targets: gear, angle: 360, duration: 6000, repeat: -1, ease: 'Linear' });
  }

  _showResetDialog() {
    const W = this.W, H = this.H, z = 50;

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(z);
    const panel = this.add.graphics().setDepth(z + 1);
    const pw = 300, ph = 200;
    panel.fillStyle(0x2D1A4E, 1);
    panel.fillRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 20);
    panel.lineStyle(3, 0xCC99FF, 1);
    panel.strokeRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 20);

    const title = this.add.text(W / 2, H / 2 - 55, '\uD83D\uDD04 Reset Outfit?', {
      fontSize: '22px', fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
      color: '#ffffff', stroke: '#3a1a5c', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(z + 2);

    const subtitle = this.add.text(W / 2, H / 2 - 18, 'Start fresh from the beginning!', {
      fontSize: '15px', fontFamily: 'Arial, sans-serif', color: '#ddaaff',
    }).setOrigin(0.5).setDepth(z + 2);

    // Yes button
    const yesBg = this.add.graphics().setDepth(z + 2);
    yesBg.fillStyle(0xFF7B7D, 1);
    yesBg.fillRoundedRect(W / 2 - 120, H / 2 + 30, 100, 48, 12);
    yesBg.lineStyle(2, 0xFFFFFF, 0.7);
    yesBg.strokeRoundedRect(W / 2 - 120, H / 2 + 30, 100, 48, 12);

    const yesText = this.add.text(W / 2 - 70, H / 2 + 54, '\u2728 Yes!', {
      fontSize: '18px', fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif', color: '#ffffff',
    }).setOrigin(0.5).setDepth(z + 3);

    const yesHit = this.add.rectangle(W / 2 - 70, H / 2 + 54, 100, 48, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(z + 4);

    // No button
    const noBg = this.add.graphics().setDepth(z + 2);
    noBg.fillStyle(0x3D1A8E, 1);
    noBg.fillRoundedRect(W / 2 + 20, H / 2 + 30, 100, 48, 12);
    noBg.lineStyle(2, 0xCC99FF, 0.7);
    noBg.strokeRoundedRect(W / 2 + 20, H / 2 + 30, 100, 48, 12);

    const noText = this.add.text(W / 2 + 70, H / 2 + 54, '\u274C No', {
      fontSize: '18px', fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif', color: '#ffffff',
    }).setOrigin(0.5).setDepth(z + 3);

    const noHit = this.add.rectangle(W / 2 + 70, H / 2 + 54, 100, 48, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(z + 4);

    const closeAll = () => {
      [overlay, panel, title, subtitle, yesBg, yesText, yesHit, noBg, noText, noHit].forEach(o => o.destroy());
    };

    yesHit.on('pointerdown', () => { closeAll(); this._resetAll(); });
    noHit.on('pointerdown', () => closeAll());
    overlay.setInteractive();
    overlay.on('pointerdown', () => closeAll());
  }

  _resetAll() {
    this.store.reset();
    this.state = { outfit: 0, wings: 0, crown: 0, background: 0 };
    this.outfitImage.setTexture('outfit_0');
    this.wingsImage.setTexture('wings_0');
    this.crownImage.setTexture('crown_0');
    this._updateBackground(0);
    this.sound_mgr.playReset();
    this.confetti.burst(this.W / 2, this.H / 2, 40);
  }
}
