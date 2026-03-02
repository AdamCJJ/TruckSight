import Phaser from 'phaser';

const COLORS = [
  0xFF9B9D, 0xFFE3BD, 0x6BC8B7, 0x4D9EFF,
  0xFFE79C, 0xC777FF, 0xFF7B7D, 0xFFFFFF,
];

export class Confetti {
  constructor(scene) {
    this.scene = scene;
    this._particles = [];
  }

  burst(x, y, count = 28) {
    const scene = this.scene;

    for (let i = 0; i < count; i++) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const size = Phaser.Math.Between(6, 14);
      const isCircle = Math.random() > 0.5;

      const g = scene.add.graphics();
      g.fillStyle(color, 1);
      if (isCircle) {
        g.fillCircle(0, 0, size / 2);
      } else {
        g.fillRect(-size / 2, -size / 2, size, size);
      }
      g.x = x;
      g.y = y;
      g.setDepth(100);

      const angle = Phaser.Math.Between(0, 360);
      const speed = Phaser.Math.Between(80, 220);
      const vx = Math.cos(Phaser.Math.DegToRad(angle)) * speed;
      const vy = Math.sin(Phaser.Math.DegToRad(angle)) * speed - Phaser.Math.Between(50, 150);
      const gravity = Phaser.Math.Between(200, 400);
      const duration = Phaser.Math.Between(700, 1200);

      this._particles.push(g);

      scene.tweens.add({
        targets: g,
        x: x + vx * (duration / 1000),
        y: y + vy * (duration / 1000) + gravity * (duration / 1000) ** 2 / 2,
        alpha: 0,
        angle: Phaser.Math.Between(-360, 360),
        scaleX: Phaser.Math.FloatBetween(0.2, 0.8),
        scaleY: Phaser.Math.FloatBetween(0.2, 0.8),
        duration,
        ease: 'Quad.easeIn',
        onComplete: () => {
          g.destroy();
          const idx = this._particles.indexOf(g);
          if (idx !== -1) this._particles.splice(idx, 1);
        },
      });
    }
  }

  clearAll() {
    this._particles.forEach((p) => p.destroy());
    this._particles = [];
  }
}
