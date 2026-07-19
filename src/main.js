import { Game } from './core/Game.js';

const game = new Game(document.getElementById('game-canvas'));
game.start();

// 暴露给调试控制台
window.__game = game;
