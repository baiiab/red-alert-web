// 通知出口。
//
// main.js 的 notify 需要操作 ui，而拆分出去的模块（Combat/UnitAI/Buildings）
// 也要弹提示。与其把 notify 当参数一层层往下传，不如在这里放一个可注入的出口：
// main.js 在模块初始化时用 setNotifier 注册实现。
let sink = null;

export function setNotifier(fn) { sink = fn; }

export function notify(text, kind) {
  if (sink) sink(text, kind);
}
