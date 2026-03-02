import Phaser from 'phaser';
import { BootScene } from './BootScene.js';
import { GameScene } from './GameScene.js';
import { GAME_WIDTH, GAME_HEIGHT } from './constants.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a0a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene, GameScene],
  render: {
    antialias: true,
    pixelArt: false,
  },
  input: {
    activePointers: 3,
  },
};

new Phaser.Game(config);

// Prevent context menu and scrolling on touch devices
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
