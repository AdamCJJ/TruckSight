import Phaser from 'phaser';
import {
  generateBackgrounds, generatePennyBase, generateOutfits,
  generateWings, generateCrowns, generateBooCat, generateButterfly,
  generateBabyLuke, generateHeart, generateGearIcon,
} from './textures.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    const loadText = this.add.text(W / 2, H / 2, '\u2728 Loading Magic... \u2728', {
      fontSize: '28px',
      fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
      color: '#ffffff',
      stroke: '#3a1a5c',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Generate all procedural textures
    generateBackgrounds(this);
    generatePennyBase(this);
    generateOutfits(this);
    generateWings(this);
    generateCrowns(this);
    generateBooCat(this);
    generateButterfly(this);
    generateBabyLuke(this);
    generateHeart(this);
    generateGearIcon(this);

    loadText.setText('\u2728 Ready! \u2728');

    this.time.delayedCall(300, () => {
      this.scene.start('GameScene');
    });
  }
}
