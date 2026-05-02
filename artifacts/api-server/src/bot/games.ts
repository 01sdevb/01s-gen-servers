export interface GameConfig {
  name: string;
  universeId: number;
  placeId: number;
  emoji: string;
  color: number;
}

export const GAMES: Record<string, GameConfig> = {
  sab: {
    name: "Steal a Brainrot",
    universeId: 7709344486,
    placeId: 109983668079237,
    emoji: "🧠",
    color: 0xff6b6b,
  },
  blox: {
    name: "Blox Fruits",
    universeId: 994732206,
    placeId: 2753915549,
    emoji: "🍎",
    color: 0xffd700,
  },
  tsunami: {
    name: "Escape Tsunami For Brainrots",
    universeId: 9363735110,
    placeId: 131623223084840,
    emoji: "🌊",
    color: 0x00bfff,
  },
  patea: {
    name: "Kick a Lucky Block",
    universeId: 10004244222,
    placeId: 89469502395769,
    emoji: "🍀",
    color: 0x00cc44,
  },
};

export const ALLOWED_CHANNEL_ID = "1499958245526081727";
export const WATERMARK = "By: 0.1s Dev | https://discord.gg/vpD8cBjHFP";
