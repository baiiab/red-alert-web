export const TILE_SIZE = 32;
export const MAP_WIDTH = 72;
export const MAP_HEIGHT = 72;
// 每秒帧数。冷却/建造/生产计时一律按帧存放（timer++），
// 所以凡是「秒」的定义都必须 × FPS 换算，否则会差 60 倍。
export const FPS = 60;
export const GRASS = 0, WATER = 1, ORE = 2, ROCK = 3, CONCRETE = 4, SAND = 5, TREE = 6;
export const TEAM_PLAYER = 0, TEAM_ENEMY = 1;

// 阵营颜色
export const COLOR_ALLIED = '#4a9fd4', COLOR_ALLIED_DARK = '#1a5276';
export const COLOR_SOVIET = '#c0392b', COLOR_SOVIET_DARK = '#7b241c';
export const COLOR_PLAYER = '#4a9fd4', COLOR_PLAYER_DARK = '#1a5276';
export const COLOR_ENEMY = '#c0392c', COLOR_ENEMY_DARK = '#922b21';

// 阵营定义
export const FACTION_ALLIED = 'allied';
export const FACTION_SOVIET = 'soviet';

export const SPATIAL_CELL = 8;

// 单位类型
export const TYPE_INFANTRY = 'infantry';
export const TYPE_VEHICLE = 'vehicle';
export const TYPE_AIRCRAFT = 'aircraft';
export const TYPE_HELICOPTER = 'helicopter';
export const TYPE_AIRSHIP = 'airship';
export const TYPE_NAVAL = 'naval';
export const TYPE_HARVESTER = 'harvester';
