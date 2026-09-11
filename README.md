# 落井下石 · Falling Block

Bloxorz 风格的翻滚方块解谜游戏：把 **1×1×2** 长方体滚到目标格上，并且必须 **直立** 落下才算过关。地图是不规则的 1×1 地砖（有缺口/虚空），一格失足就会掉下去。

A Bloxorz-style rolling-block puzzle. Roll the 1×1×2 prism onto the goal **standing upright**. The floor is an irregular set of tiles — if any occupied cell has no support, you fall.

## 本地运行 / Run locally

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址即可。

生产构建：

```bash
npm run build
npm run preview
```

## 玩法 / How to play

- 方块有两种姿态：**直立**（占 1 格）与 **平躺**（占相邻 2 格）。
- 移动是 **翻滚 90°**（不是平移），姿态与占地会随之改变。
- **胜利**：方块以直立姿态正好停在金色目标格上。
- **失败**：任一占地格子没有实体地砖（洞/地图外）→ 掉落，本关重来。
- 平躺时两格都必须有支撑；直立时那一格必须有支撑。

## 操作 / Controls

| 方式 | 说明 |
|------|------|
| **滑动（主要）** | 上/下滑动 = 北/南翻滚；左/右滑动 = 西/东翻滚（有阈值，防误触） |
| 方向键 | ↑↓←→ |
| WASD | W/S/A/D |
| 重新开始 | 界面按钮 |

> 页面已 **完全禁用缩放与滚动**（`user-scalable=no`、`overflow: hidden`、拦截 pinch / ctrl+滚轮），滑动只控制方块翻滚。

## 关卡 / Levels

内置 **12** 关，由易到难（直线教学 → 窄桥 → 镂空洞 → 迷宫）。关卡数据在 `src/game/levels.ts`，便于扩展。

验证全部关卡可解（BFS）：

```bash
npm run verify-levels
```

任一关无解时脚本以非零退出码失败。

## 技术栈

- Vite + TypeScript
- Canvas 2D 渲染 + 翻滚/掉落动画
- 触摸滑动 + 键盘

## License

MIT
