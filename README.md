# CTPhysics

简体中文说明 | English version below

——

## 概述
CTPhysics 是一个用于学习与演示计算机断层扫描（CT）成像物理的交互式平台。项目聚焦成像链路的关键环节（采样、重建、噪声和剂量等），通过轻量的前端可视化与实验模块，帮助学习者和从业者理解核心物理概念及工程权衡。

## 在线站点
- 生产/演示站点：https://www.ct-physics.xyz
  - 若链接更新，请在此处同步维护。

## 功能特性
- 交互式模块：采样与滤波、重建滤波核对图像的影响、剂量与噪声权衡、三维锥形束重建 (CBCT FDK 算法偏轴伪影模拟)、以及光子计数CT (PCCT 直接转换半导体探测器、零电子噪声、脉冲堆积谱畸变、多通道物质分解与 K-edge 临界指标跃变)
- 可视化解释：图表/曲线/示意图，直观展示物理量与图像质量指标的关系
- 多语言支持：中/英文内容（可拓展 i18n）
- 教学实验：本地保存实验参数（可选），便于复现实验
- 可访问性：尽量遵循可访问性规范（ARIA、键盘可操作）

## 技术栈
- 前端框架：React / Next.js（TypeScript 严格模式）
- 样式与组件：Tailwind CSS + Radix UI（或等价组件库）
- 可视化：Canvas/WebGL（必要时），可使用 D3/Plotly 等
- 测试：Vitest（单元/集成）、Playwright（端到端）
- 代码质量：ESLint + Prettier（CI 中强制）

## 快速开始
1) 环境准备
   - Node.js >= 18
   - 推荐使用 pnpm（或 npm / yarn）
2) 安装依赖
   - pnpm install
3) 配置环境变量
   - 请参考 docs/ENV.md（包含本地开发与部署所需的环境变量说明）
4) 本地开发
   - pnpm dev（或 npm run dev）
   - 访问 http://localhost:3000
5) 生产构建
   - pnpm build && pnpm start

## 测试（Vitest / Playwright）
- 单元与集成测试（Vitest）
  - 运行：pnpm test
  - 覆盖率报告：pnpm test --coverage
  - 建议覆盖率目标：语句/分支/函数/行 ≥ 80%（详见 docs/PCD_ROADMAP.md）
- 端到端（E2E，Playwright）
  - 本地运行（无头/可视）：pnpm e2e 或 pnpm e2e:headed
  - 录制视频与截图（CI 产物）：在 Playwright 配置中开启
  - 数据与网络：尽量使用可复现数据与网络模拟，避免外部依赖造成不稳定

## CI 概述
- GitHub Actions（示例）
  - 触发：PR / push 到 master
  - 阶段：lint → type-check → unit tests（Vitest）→ e2e（Playwright，可选）→ 构建
  - 覆盖率阈值：在 CI 中强制（失败则拒绝合并）
  - 预览部署：Vercel PR preview（自动）
  - 可选：Sentry release（仅 master）
  - 安全：GitHub Secret Scanning & Push Protection

## 部署（Vercel）
- 步骤
  - 连接 Git 仓库（picspin/CTPhysics）
  - 配置环境变量（参考 docs/ENV.md）
  - 设置生产与预览环境（Production / Preview）
  - 保护主分支（只允许通过 PR 合并）
- 产物
  - Preview URL（每个 PR 自动生成）
  - Production URL（合并到 master 后自动更新）

## 可观测性（可选：Sentry）
- 启用方式
  - 创建 Sentry 项目与 DSN
  - 在环境变量中配置 SENTRY_DSN（参考 docs/ENV.md）
  - CI 中对 master 分支执行 release 标记（版本号可取 commit SHA 或语义化版本）
- 范围
  - 前端错误采集、性能指标（Web Vitals）
  - 注意隐私和合规要求，避免上传敏感数据

## PCD 路线图摘要
- 详见 docs/PCD_ROADMAP.md
  - 里程碑 M1～M4
  - QA 指标：MTF（调制传递函数）、NPS（噪声功率谱）、NEQ（等效量子数）
  - 测试目标：单元/端到端覆盖率

## 贡献
- 欢迎贡献！请先阅读 CONTRIBUTING.md
  - 分支与提交流程（PR）
  - 代码风格与提交信息规范
  - 测试与环境管理要求

## 许可证
- License：参见仓库根目录的 LICENSE 文件（例如 MIT）

## 相关文档
- 环境变量：docs/ENV.md
- 架构与设计：docs/ARCHITECTURE.md

——

English

## Overview
CTPhysics is an interactive learning and demonstration platform for CT (Computed Tomography) imaging physics. It focuses on key parts of the imaging pipeline (sampling, reconstruction, noise and dose trade-offs) and uses lightweight visualizations and hands-on labs to clarify core physical concepts and engineering decisions.

## Live site
- Production / demo: https://www.ct-physics.xyz

## Features
- Interactive modules: sampling and filtering, reconstruction kernels, dose vs. noise trade-offs, Cone-Beam CT (CBCT 3D FDK reconstruction off-axis artifact simulation), and Photon-Counting CT (PCCT direct conversion, zero electronic noise, pulse pile-up spectrum distortion, material decomposition, and K-edge jump effect)
- Visual explanations: charts/curves/diagrams for relationships between physical quantities and image quality metrics
- Multilingual: CN/EN content (i18n-ready)
- Teaching labs: locally persisted parameters (optional) for reproducible experiments
- Accessibility: strive for ARIA compliance and keyboard operability

## Tech stack
- Frontend: React / Next.js with strict TypeScript
- UI/Styling: Tailwind CSS + Radix UI (or similar)
- Visualization: Canvas/WebGL as needed; D3/Plotly optional
- Testing: Vitest (unit/integration), Playwright (end-to-end)
- Code quality: ESLint + Prettier (enforced in CI)

## Quick start
1) Prerequisites
   - Node.js >= 18
   - Prefer pnpm (or npm / yarn)
2) Install
   - pnpm install
3) Environment variables
   - See docs/ENV.md for local and deployment configuration
4) Development
   - pnpm dev (or npm run dev)
   - Open http://localhost:3000
5) Production build
   - pnpm build && pnpm start

## Testing (Vitest / Playwright)
- Unit & integration with Vitest
  - Run: pnpm test
  - Coverage: pnpm test --coverage
  - Suggested thresholds: statements/branches/functions/lines ≥ 80% (see docs/PCD_ROADMAP.md)
- End-to-end with Playwright
  - Local run (headless/headed): pnpm e2e or pnpm e2e:headed
  - Video & screenshots (CI artifacts): enable in Playwright config
  - Data & network: prefer reproducible fixtures and network mocks to avoid flakiness

## CI overview
- GitHub Actions (example)
  - Triggers: PR / push to master
  - Stages: lint → type-check → unit tests (Vitest) → e2e (Playwright, optional) → build
  - Coverage enforcement: thresholds required in CI (fail PR if not met)
  - Preview deploy: Vercel PR previews (automatic)
  - Optional: Sentry release on master
  - Security: GitHub Secret Scanning & Push Protection

## Deployment (Vercel)
- Steps
  - Connect repo (picspin/CTPhysics)
  - Configure environment variables (see docs/ENV.md)
  - Set production and preview environments
  - Protect the master branch (merge via PR only)
- Outputs
  - Preview URL (auto for each PR)
  - Production URL (auto after merge to master)

## Observability (optional Sentry)
- Enable
  - Create Sentry project and DSN
  - Configure SENTRY_DSN in env (see docs/ENV.md)
  - CI release tagging on master (use commit SHA or semantic version)
- Scope
  - Frontend error reporting, performance (Web Vitals)
  - Respect privacy/compliance; avoid sensitive data

## PCD roadmap summary
- See docs/PCD_ROADMAP.md
  - Milestones M1–M4
  - QA metrics: MTF (Modulation Transfer Function), NPS (Noise Power Spectrum), NEQ (Noise Equivalent Quanta)
  - Test coverage targets (unit/e2e)

## Contributing
- Contributions are welcome! Please read CONTRIBUTING.md
  - Branch & PR workflow
  - Code style & commit message conventions
  - Testing & environment management requirements

## License
- See LICENSE file at the repo root (e.g., MIT)

## Documentation links
- Environment variables: docs/ENV.md
- Architecture & design: docs/ARCHITECTURE.md
