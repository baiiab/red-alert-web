// 玩法调参常量
//
// 原先散落在 main.js 各处，被拆到不同模块的函数都要用。集中在这里，
// 让「改数值」有唯一入口，也让拆分后的模块不必各自搬一份声明。
export const PRISM_LINK_RANGE = 8;      // 光棱塔链式聚焦的最大链接距离（格）
export const GUARD_CHASE_RANGE = 5;     // 守卫模式允许的追击距离（离守卫点）
export const REPAIR_BAY_RANGE = 5;      // 维修站有效范围（格）
export const REPAIR_BAY_HEAL = 6;       // 维修站每次修复量（每 6 帧一次）
export const SPY_INFILTRATE_DIST = 1.5; // 间谍渗透判定距离（格）
export const SPY_BLACKOUT_FRAMES = 900; // 渗透电厂造成的断电时长（帧）
export const PRODUCER_BUILDINGS = ['barracks', 'warFactory', 'refinery'];
