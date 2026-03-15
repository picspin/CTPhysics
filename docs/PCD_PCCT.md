# PCCT 模块设计与路线图 (PCD)

本文档为 CTPhysics 项目中光子计数 CT（PCCT）仿真模块的完整设计路线图。

## 目录

1. [概述](#概述)
2. [模块架构总览](#模块架构总览)
3. [M1: 探测器物理 (Detector Physics)](#m1-探测器物理-detector-physics)
4. [M2: 源与谱 (Source & Spectrum)](#m2-源与谱-source--spectrum)
5. [M3: 计数校正 (Counting Correction)](#m3-计数校正-counting-correction)
6. [M4: 材料分解与 K-Edge](#m4-材料分解与-k-edge)
7. [M5: 质控标准与可视化](#m5-质控标准与可视化)
8. [实现顺序与里程碑](#实现顺序与里程碑)

---

## 概述

光子计数 CT（Photon-Counting CT, PCCT）代表 CT 技术的下一代革命。与传统能量积分探测器（EID）不同，PCCT 采用直接探测技术，通过半导体材料将 X 射线光子直接转换为电信号，实现：

- **能谱成像**：每个光子能量可被单独测量
- **电子噪声消除**：低能量阈值（20-25 keV）过滤读出噪声
- **超高空间分辨率**：无需像素间反射隔膜，可制造更小像素（0.11-0.15mm）
- **改进对比度**：对低能光子（携带高组织对比度信息）更敏感

### 物理基础对比

| 特性 | 传统 EID | PCCT (直接探测) |
|------|----------|-----------------|
| 信号转换 | X射线 → 可见光 → 电信号 | X射线 → 电荷云 → 电信号 |
| 能量测量 | 积分所有光子能量 | 单光子能量阈值比较 |
| 电子噪声 | 累积叠加 | 低阈值可消除 |
| 像素尺寸 | ~0.5mm (受限于光散射) | 0.11-0.15mm |
| 光谱信息 | 无 | 多能级bin |

---

## 模块架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        PCCT Simulation                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ M1: Detector │  │ M2: Source   │  │ M3: Counting │          │
│  │   Physics    │  │   & Spectrum │  │  Correction  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                      │
│                  ┌──────────────────┐                          │
│                  │  M4: Material    │                          │
│                  │ Decomposition   │                          │
│                  │   & K-Edge       │                          │
│                  └────────┬─────────┘                          │
│                           │                                      │
│                           ▼                                      │
│                  ┌──────────────────┐                          │
│                  │  M5: QA &        │                          │
│                  │ Visualization   │                          │
│                  └──────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## M1: 探测器物理 (Detector Physics)

### 1.1 目标

模拟 PCCT 半导体探测器的基本物理过程，包括电荷生成、收集和响应。

### 1.2 关键技术点

#### 1.2.1 探测器材料建模

| 材料 | 原子序数 Z | 优点 | 局限性 |
|------|-----------|------|--------|
| CdTe | 48/52 | 高吸收效率，适合医学能量范围 | 电荷迁移率较低 |
| CZT | 48/30/52 | 室温稳定性好 | 能量分辨率较差 |
| Si | 14 | 电荷迁移率高，速度快 | 原子序数低，吸收效率差 |

**简化物理模型**：
```
光子能量 E → 产生电子-空穴对数 N = E / W
W (产生一对电子-空穴所需的能量)：
  - Si: 3.62 eV
  - CdTe: 4.43 eV
```

#### 1.2.2 像素响应函数 (PRF)

模拟探测器像素对入射光子的响应，包括：
- 几何效率（像素面积/总面积）
- 吸收效率（能量依赖）
- 电荷收集效率（偏置电压依赖）

#### 1.2.3 点扩散函数 (PSF)

- **无需物理隔膜**：PCCT 无死区，PSF 仅由电荷云扩散决定
- **简化模型**：高斯近似，σ 与探测器和偏置电压相关

### 1.3 测试建议

- [ ] 验证不同能量光子的电荷产生数量
- [ ] 验证像素几何效率计算
- [ ] 对比 CdTe/CZT/Si 材料的吸收曲线

### 1.4 交付物

- `detector/materials.ts` - 探测器材料参数
- `detector/prf.ts` - 像素响应函数
- `detector/psf.ts` - 点扩散函数
- `detector/tests/`

---

## M2: 源与谱 (Source & Spectrum)

### 2.1 目标

模拟 X 射线源的能谱分布，包括连续谱和特征峰。

### 2.2 关键技术点

#### 2.2.1 X 射线能谱模型

使用 TMC（Target Material Characteristic）模型：

```
N(E) = K * (E - E_0)² * e^(-μ(E)*t)
```

其中：
- K: 常数
- E_0: 截止能量
- μ(E): 靶材质量衰减系数
- t: 靶材厚度

#### 2.2.2 特征辐射

模拟特征 X 射线峰（Kα, Kβ）：
- 钨靶 (W): Kα₁ = 59.3 keV, Kβ₁ = 67.2 keV
- 钼靶 (Mo): Kα₁ = 17.4 keV, Kβ₁ = 19.6 keV

#### 2.2.3 能谱分桶 (Energy Binning)

模拟 PCCT 系统的同时多能级采集：

```typescript
interface EnergyBin {
  low: number;    // 低阈值 (keV)
  high: number;   // 高阈值 (keV)
  counts: number; // 该能级光子计数
}

// 示例：5-bin 系统
const bins: EnergyBin[] = [
  { low: 20, high: 35, counts: 0 },
  { low: 35, high: 50, counts: 0 },
  { low: 50, high: 65, counts: 0 },
  { low: 65, high: 80, counts: 0 },
  { low: 80, high: 120, counts: 0 },
];
```

### 2.3 测试建议

- [ ] 验证不同管电压的能谱形状
- [ ] 验证特征峰位置
- [ ] 验证能谱硬化效应

### 2.4 交付物

- `source/spectrum.ts` - X 射线能谱生成
- `source/filtration.ts` - 滤过模型
- `source/binning.ts` - 能谱分桶
- `source/tests/`

---

## M3: 计数校正 (Counting Correction)

### 3.1 目标

模拟并校正 PCCT 特有的非理想物理效应。

### 3.2 关键技术点

#### 3.2.1 脉冲堆积 (Pulse Pile-up)

**问题**：多个光子几乎同时击中探测器，产生重叠脉冲

**简化模型**：
```
P(pile-up) ≈ 1 - exp(-τ * R)
```
其中 τ 为探测器响应时间，R 为计数率

**校正方法**：
- 死时间模型（paralyzable/non-paralyzable）
- 脉冲形状甄别

#### 3.2.2 电荷共享 (Charge Sharing)

**问题**：一个光子产生的电荷云分裂到相邻像素

**简化模型**：
- 电荷云扩散半径：σ ∝ √(d / V)
- d: 吸收位置到像素边界距离
- V: 偏置电压

**影响**：
- 一个高能光子被记录为多个低能事件
- 能量分辨率下降

#### 3.2.3 K-逃逸 (K-escape)

**问题**：探测器材料 K 层电子被激发，特征 X 射线逃逸

**简化模型**：
```
P(K-escape) ∝ (Z^4 / E^3)
```

特征 X 射线能量：
- CdTe Kα: 23.2 keV, Kβ: 26.4 keV
- CZT (CdZnTe): 类似 CdTe

#### 3.2.4 量子迭代重建 (QIR)

PCCT 专用迭代重建算法：

```typescript
interface QIRConfig {
  iterations: number;
  regularization: number;  // λ 参数
  subsets: number;         // OS-S (ordered subsets)
}

function qirRecon(
  projections: number[][],
  config: QIRConfig
): Image {
  // 实现简化的 QIR 算法
}
```

### 3.3 测试建议

- [ ] 验证高计数率下的计数损失
- [ ] 验证电荷共享对能谱的影响
- [ ] 验证 K-逃逸峰位置
- [ ] 对比 FBP 与 QIR 重建结果

### 3.4 交付物

- `correction/pileup.ts` - 脉冲堆积校正
- `correction/charge-sharing.ts` - 电荷共享校正
- `correction/k-escape.ts` - K-逃逸校正
- `correction/qir.ts` - 量子迭代重建
- `correction/tests/`

---

## M4: 材料分解与 K-Edge

### 4.1 目标

利用 PCCT 的能谱信息实现物质识别和定量分析。

### 4.2 关键技术点

#### 4.2.1 物理基础

**光电效应**：截面 ∝ Z⁴ / E³
**康普顿散射**：截面 ∝ Z / E

不同材料的光电效应能量依赖性不同，在 K-Edge 附近突变。

#### 4.2.2 K-Edge 影像

K-Edge 造影剂（碘 Z=53，钡 Z=56）在特定能量处有显著吸收突变：

| 元素 | K-Edge 能量 |
|------|-------------|
| I (碘) | 33.2 keV |
| Ba (钡) | 37.4 keV |
| Gd (钆) | 50.2 keV |

#### 4.2.3 材料分解算法

**基分解法**：

```typescript
interface MaterialDecomposition {
  // 输入：多能级投影数据
  // 输出：物质密度图
  
  decompose(
    bins: EnergyBin[],
    materials: Material[]
  ): MaterialDensity[];
}

const materials = [
  { name: 'Iodine', z: 53, density: 0 },    // 碘
  { name: 'Water', z: 10, density: 0 },       // 水
  { name: 'Bone', z: 13, density: 0 },       // 骨
];
```

**分解方法**：
- 图像域分解：先重建，后分解
- 投影域分解：先分解，后重建（更准确）

#### 4.2.4 虚拟单能级图像 (VMI)

```typescript
function virtualMonoenergetic(
  bins: EnergyBin[],
  energy: number // 目标能量 keV
): Image {
  // 线性插值生成指定能量的虚拟图像
}
```

#### 4.2.5 有效原子序数 (Z_eff) 与电子密度

```typescript
interface SpectralMetrics {
  zEff: Image;        // 有效原子序数图
  electronDensity: Image; // 电子密度图
}
```

### 4.3 测试建议

- [ ] 验证碘溶液的 K-Edge 特征峰
- [ ] 对比 VMI 与常规 CT 的伪影改善
- [ ] 验证 Z_eff 计算准确性

### 4.4 交付物

- `materials/decomposition.ts` - 材料分解算法
- `materials/kedge.ts` - K-Edge 影像生成
- `materials/vmi.ts` - 虚拟单能级图像
- `materials/metrics.ts` - Z_eff 和电子密度
- `materials/tests/`

---

## M5: 质控标准与可视化

### 5.1 目标

为 PCCT 系统建立完整的质量控制标准和可视化工具。

### 5.2 关键技术点

#### 5.2.1 调制传递函数 (MTF)

评估空间分辨率：

```typescript
function calculateMTF(
  edgeImage: Image,
  edgeDirection: 'x' | 'y'
): MTF {
  // 从刃边图像计算 MTF
  // 报告 50%, 10%, 2% MTF 对应的空间频率 (lp/cm)
}
```

**PCCT 优势**：
- 无隔膜死区 → 更高 MTF
- 小像素 (0.11-0.15mm) → 超高分辨率

#### 5.2.2 噪声功率谱 (NPS)

评估噪声特性：

```typescript
function calculateNPS(
  uniformImage: Image,
  roiSize: number
): NPS {
  // 计算 2D NPS
  // 评估噪声频率分布
}
```

#### 5.2.3 等效量子数 (NEQ)

综合评价检测性能：

```typescript
function calculateNEQ(
  mtf: MTF,
  nps: NPS,
  dose: number
): NEQ {
  // NEQ = (MTF²) / NPS
  // 反映给定剂量下的信息传递能力
}
```

#### 5.2.4 DQE (检测量子效率)

```typescript
function calculateDQE(
  neq: NEQ,
  dose: number
): DQE {
  // DQE = NEQ / (光子数)
  // 0-1 之间，越高越好
}
```

### 5.3 可视化模块

| 可视化类型 | 用途 |
|-----------|------|
| MTF 曲线 | 空间分辨率评估 |
| NPS 云图 | 噪声空间分布 |
| 能谱曲线 | 光谱质量检查 |
| 物质分解图 | 材料可视化 |
| VMI 对比 | 伪影分析 |

### 5.4 测试建议

- [ ] 验证 MTF 计算与标准模体一致性
- [ ] 验证 NPS 统计可靠性
- [ ] 对比 PCCT 与 EID 的 DQE

### 5.5 交付物

- `qa/mtf.ts` - MTF 计算与可视化
- `qa/nps.ts` - NPS 计算
- `qa/neq.ts` - NEQ/DQE 计算
- `qa/viewer.ts` - 质控可视化界面
- `qa/tests/`

---

## 实现顺序与里程碑

### Phase 1: 基础 (M1 + M2)
- [ ] 探测器材料参数库
- [ ] PRF/PSF 模型
- [ ] X 射线能谱生成
- [ ] 基本投影仿真

### Phase 2: 核心 (M3)
- [ ] 脉冲堆积模拟
- [ ] 电荷共享模拟
- [ ] K-逃逸模拟
- [ ] 基础重建算法

### Phase 3: 高级 (M4)
- [ ] 能谱分桶
- [ ] 材料分解
- [ ] K-Edge 影像
- [ ] VMI 生成

### Phase 4: 质控 (M5)
- [ ] MTF/NPS/NEQ 计算
- [ ] 质控可视化工具
- [ ] 临床场景演示（冠脉钙化、支架）

### 里程碑时间线

| 里程碑 | 内容 | 预计迭代 |
|--------|------|----------|
| M1 | 探测器物理 | 2 周 |
| M2 | 源与谱 | 1 周 |
| M3 | 计数校正 | 3 周 |
| M4 | 材料分解 | 2 周 |
| M5 | 质控可视化 | 2 周 |

---

## 参考资料

- `Direct_Detection.md` - 直接探测技术详解
- `Digital_Twin_Design_Guideline_for_PCCT.md` - PCCT 数字孪生设计指南
- `PCD_ROADMAP.md` - 原项目路线图
- `ARCHITECTURE.md` - 系统架构

---

*本文档为 CTPhysics 项目的一部分，采用 MIT 许可证。*
