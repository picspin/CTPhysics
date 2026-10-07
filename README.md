# CTPhysics

简体中文说明 | [English version below](#english)

——

## 概述
CTPhysics 是一个用于学习与演示计算机断层扫描（CT）成像物理的交互式教学平台。项目聚焦成像链路的关键环节（采样、重建、噪声和剂量等），通过前端可视化与实验模块，帮助学习者和从业者理解核心物理概念及工程权衡。所有内容保持厂商中立。

## 在线站点
- https://ct-physics.xyz

## 功能特性
- 交互式模块：滤波反投影与卷积核、螺旋 CT、迭代重建、锥束 CT（FDK 重建与偏轴伪影）、心脏 CT（心电门控、采集模式与重建窗）、剂量（CTDIvol / DLP / 有效剂量，ICRP 103 组织权重因子）、双能 CT、光子计数 CT（直接转换探测器、脉冲堆积、物质分解与 K 边）、习题练习
- 可视化解释：图表、曲线、Canvas 与 WebGL（Three.js）三维场景
- 完整中英双语：`i18n/zh.ts` + `i18n/en.ts`，题库与内容数据位于 `data/zh` 与 `data/en`
- 可访问性：尽量遵循 ARIA 与键盘可操作规范

## 技术栈
- 框架：Next.js 14（App Router）+ React 18，TypeScript 严格模式
- 样式：Tailwind CSS（含 @tailwindcss/typography）、framer-motion 动画
- 可视化：Recharts（图表）、Canvas 2D、Three.js / @react-three/fiber / drei / postprocessing（三维）
- 测试：Vitest（单元）、Playwright（端到端）
- 代码质量：ESLint（`next lint`）、`tsc --noEmit`、`npm run check:i18n`（双语一致性检查）

## 快速开始
需要 Node.js ≥ 18.17（CI 使用 20.x / 22.x）。
```bash
npm ci
npm run dev          # http://localhost:3000
npm run build && npm start
```
环境变量说明见 docs/ENV.md。

## 测试
- `npm test` — Vitest 单元测试
- `npm run check:i18n` — 中英词条/数据一致性与源码中文字符检查
- `npm run test:e2e` — Playwright 端到端测试
- `npm run crawl:i18n` — 对生产构建逐路由、逐控件的双语爬取检查（需先 `npm run build && npm start`）

## CI 与部署
- GitHub Actions（`.github/workflows/node.js.yml`）：在推送/PR 到 master 时运行 `npm ci` → `check:i18n` → `tsc --noEmit` → `build` → `test`
- 部署：Vercel Git 集成。PR 自动生成 Preview；生产站点跟随 Vercel 项目中设置的生产分支（应为 `master`）。

## 贡献
欢迎贡献！请先阅读 CONTRIBUTING.md。

## 许可证
- 本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)（非商业、源码可见许可），版权所有 © 2026 picspin / Ahloe Brown。许可证全文以 LICENSE 文件为准。
- 允许非商业用途，包括个人学习、学术教学、科研、引用，以及高校、医院教学、学术/专业学会等非商业机构的部署与使用。
- 任何商业用途均需事先获得作者另行书面许可。

## 支持与赞助
- CTPhysics 是一个教育项目。欢迎将其用于学术教学、引用和非商业部署（例如高校、医院教学、学术/专业学会）。
- 如需部署或合作，请联系作者 Ahloe Brown（GitHub [@picspin](https://github.com/picspin)），通过 [GitHub Issues](https://github.com/picspin/CTPhysics/issues) 留言。
- 欢迎学术层面的赞助与支持。
- 商业用途需另行获得许可。

## 引用
如在教学、论文或报告中使用本项目，建议引用为：

> Ahloe Brown. *CTPhysics: An Interactive Learning Platform for CT Imaging Physics* [Web application]. 2026. https://ct-physics.xyz. Source: https://github.com/picspin/CTPhysics

```bibtex
@misc{brown2026ctphysics,
  author       = {Brown, Ahloe},
  title        = {{CTPhysics}: An Interactive Learning Platform for CT Imaging Physics},
  year         = {2026},
  howpublished = {\url{https://ct-physics.xyz}},
  note         = {Source code: \url{https://github.com/picspin/CTPhysics}}
}
```

## 相关文档
- 环境变量：docs/ENV.md
- 架构与设计：docs/ARCHITECTURE.md
- PCD 路线图：docs/PCD_ROADMAP.md

——

<a id="english"></a>
## English

### Overview
CTPhysics is an interactive teaching platform for CT (Computed Tomography) imaging physics. It focuses on key parts of the imaging chain (sampling, reconstruction, noise and dose) and uses front-end visualizations and hands-on labs to clarify core physical concepts and engineering trade-offs. All content is vendor-neutral.

### Live site
- https://ct-physics.xyz

### Features
- Interactive modules: filtered back-projection and kernels, helical CT, iterative reconstruction, cone-beam CT (FDK reconstruction and off-axis artifacts), cardiac CT (ECG gating, acquisition modes, reconstruction windows), dose (CTDIvol / DLP / effective dose with ICRP 103 tissue weighting factors), dual-energy CT, photon-counting CT (direct-conversion detectors, pile-up, material decomposition, K-edge), practice questions
- Visual explanations: charts, curves, Canvas and WebGL (Three.js) 3D scenes
- Full Chinese/English parity: `i18n/zh.ts` + `i18n/en.ts`; question bank and content data in `data/zh` and `data/en`
- Accessibility: aims for ARIA compliance and keyboard operability

### Tech stack
- Framework: Next.js 14 (App Router) + React 18, strict TypeScript
- Styling: Tailwind CSS (with @tailwindcss/typography), framer-motion
- Visualization: Recharts (charts), Canvas 2D, Three.js / @react-three/fiber / drei / postprocessing (3D)
- Testing: Vitest (unit), Playwright (e2e)
- Code quality: ESLint (`next lint`), `tsc --noEmit`, `npm run check:i18n` (bilingual parity guard)

### Quick start
Requires Node.js ≥ 18.17 (CI uses 20.x / 22.x).
```bash
npm ci
npm run dev          # http://localhost:3000
npm run build && npm start
```
See docs/ENV.md for environment variables.

### Testing
- `npm test` — Vitest unit tests
- `npm run check:i18n` — zh/en key/data parity and stray-CJK source check
- `npm run test:e2e` — Playwright end-to-end tests
- `npm run crawl:i18n` — per-route, per-control bilingual crawl of a production build (run `npm run build && npm start` first)

### CI & deployment
- GitHub Actions (`.github/workflows/node.js.yml`) on push/PR to master: `npm ci` → `check:i18n` → `tsc --noEmit` → `build` → `test`
- Deployment: Vercel Git integration. PRs get Preview deployments; production follows the production branch configured in the Vercel project (should be `master`).

### Contributing
Contributions are welcome! Please read CONTRIBUTING.md.

### License
- Released under the [PolyForm Noncommercial License 1.0.0](LICENSE) (non-commercial, source-available). Copyright (c) 2026 picspin / Ahloe Brown. The LICENSE file is the authoritative text.
- Non-commercial use is permitted, including personal study, academic teaching, research, citation, and deployment/use by non-commercial institutions such as universities, hospital teaching programmes, and academic or professional societies.
- Any commercial use requires separate written permission from the author.

### Support & Sponsorship
- CTPhysics is an educational project. Academic teaching, citation and non-commercial deployment (e.g. universities, hospital teaching, academic/professional societies) are welcome.
- For deployment or collaboration, please contact the author, Ahloe Brown (GitHub [@picspin](https://github.com/picspin)), via [GitHub Issues](https://github.com/picspin/CTPhysics/issues).
- Academic sponsorship and support are welcome.
- Commercial use requires separate permission.

### How to cite
If you use this project in teaching, papers or reports, please cite:

> Ahloe Brown. *CTPhysics: An Interactive Learning Platform for CT Imaging Physics* [Web application]. 2026. https://ct-physics.xyz. Source: https://github.com/picspin/CTPhysics

```bibtex
@misc{brown2026ctphysics,
  author       = {Brown, Ahloe},
  title        = {{CTPhysics}: An Interactive Learning Platform for CT Imaging Physics},
  year         = {2026},
  howpublished = {\url{https://ct-physics.xyz}},
  note         = {Source code: \url{https://github.com/picspin/CTPhysics}}
}
```

### Documentation
- Environment variables: docs/ENV.md
- Architecture & design: docs/ARCHITECTURE.md
- PCD roadmap: docs/PCD_ROADMAP.md
