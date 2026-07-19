// 武器配置：红=扩散火神炮（范围） 蓝=穿透激光（高伤）
// 每级定义一次齐射的子弹阵列：angle=相对正前方的偏角(度), x=出生横向偏移, dmg, speed, size, pierce=穿透数
export const WEAPONS = {
  red: {
    name: '火神炮',
    color: 0xff5a4d,
    glow: '#ff6a7a',
    levels: [
      { interval: 0.16, shots: [
        { angle: 0, x: 0, dmg: 10, speed: 46, size: 1.0 },
      ]},
      { interval: 0.15, shots: [
        { angle: -6, x: -0.5, dmg: 9, speed: 46, size: 1.0 },
        { angle: 6,  x: 0.5,  dmg: 9, speed: 46, size: 1.0 },
      ]},
      { interval: 0.14, shots: [
        { angle: 0,  x: 0,    dmg: 10, speed: 48, size: 1.1 },
        { angle: -9, x: -0.6, dmg: 9,  speed: 46, size: 1.0 },
        { angle: 9,  x: 0.6,  dmg: 9,  speed: 46, size: 1.0 },
      ]},
      { interval: 0.13, shots: [
        { angle: 0,   x: -0.25, dmg: 10, speed: 48, size: 1.1 },
        { angle: 0,   x: 0.25,  dmg: 10, speed: 48, size: 1.1 },
        { angle: -12, x: -0.7,  dmg: 9,  speed: 46, size: 1.0 },
        { angle: 12,  x: 0.7,   dmg: 9,  speed: 46, size: 1.0 },
      ]},
      { interval: 0.12, shots: [
        { angle: 0,   x: -0.25, dmg: 11, speed: 50, size: 1.2 },
        { angle: 0,   x: 0.25,  dmg: 11, speed: 50, size: 1.2 },
        { angle: -10, x: -0.7,  dmg: 10, speed: 48, size: 1.1 },
        { angle: 10,  x: 0.7,   dmg: 10, speed: 48, size: 1.1 },
        { angle: -20, x: -0.9,  dmg: 8,  speed: 45, size: 0.9 },
        { angle: 20,  x: 0.9,   dmg: 8,  speed: 45, size: 0.9 },
      ]},
    ],
  },
  blue: {
    name: '激光',
    color: 0x4da6ff,
    glow: '#5ab8ff',
    levels: [
      { interval: 0.19, shots: [
        { angle: 0, x: 0, dmg: 26, speed: 60, size: 1.2, pierce: 1 },
      ]},
      { interval: 0.18, shots: [
        { angle: 0, x: -0.35, dmg: 22, speed: 60, size: 1.2, pierce: 1 },
        { angle: 0, x: 0.35,  dmg: 22, speed: 60, size: 1.2, pierce: 1 },
      ]},
      { interval: 0.17, shots: [
        { angle: 0, x: -0.4, dmg: 24, speed: 62, size: 1.3, pierce: 2 },
        { angle: 0, x: 0.4,  dmg: 24, speed: 62, size: 1.3, pierce: 2 },
      ]},
      { interval: 0.16, shots: [
        { angle: 0, x: 0,    dmg: 30, speed: 64, size: 1.4, pierce: 2 },
        { angle: 0, x: -0.55, dmg: 22, speed: 62, size: 1.2, pierce: 2 },
        { angle: 0, x: 0.55,  dmg: 22, speed: 62, size: 1.2, pierce: 2 },
      ]},
      { interval: 0.15, shots: [
        { angle: 0, x: 0,     dmg: 36, speed: 66, size: 1.6, pierce: 3 },
        { angle: 0, x: -0.6,  dmg: 26, speed: 64, size: 1.3, pierce: 2 },
        { angle: 0, x: 0.6,   dmg: 26, speed: 64, size: 1.3, pierce: 2 },
      ]},
    ],
  },
};

export const MAX_WEAPON_LEVEL = 5;
