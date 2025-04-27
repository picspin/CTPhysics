# CT Physics Web App 应用架构设计

## 1. 应用概述

我们将创建一个基于xrayphysics.com网站CT物理相关内容的Web应用，使用React v18作为前端框架，Tailwind CSS结合Material UI的设计风格，采用轻量化的数据方案，优先优化移动设备体验。

## 2. 技术栈选择

### 前端
- **框架**: React v18
- **构建工具**: Next.js 14（提供更好的性能和SEO优化）
- **样式**: Tailwind CSS + Material UI风格组件
- **状态管理**: React Context API（轻量级应用无需Redux）
- **路由**: Next.js内置路由
- **图表库**: Recharts（用于交互式图表）
- **动画**: Framer Motion（用于流畅的UI动画）

### 后端/数据
- **数据存储**: 静态JSON文件（轻量化方案）
- **API**: Next.js API Routes（如需动态数据）

### 部署
- **目标平台**: Vercel或Netlify

## 3. 颜色主题

根据用户要求，使用以下颜色方案：

```css
--primary-100: #FF8C00; /* 主橙色 */
--primary-200: #dc7000; /* 深橙色 */
--primary-300: #8e3000; /* 暗橙色 */
--accent-100: #4A90E2; /* 蓝色强调 */
--accent-200: #003a80; /* 深蓝色 */
--text-100: #333333; /* 主文本色 */
--text-200: #5c5c5c; /* 次要文本色 */
--bg-100: #FFFFFF; /* 主背景色 */
--bg-200: #f5f5f5; /* 次要背景色 */
--bg-300: #cccccc; /* 边框和分隔线 */
```

## 4. 应用结构

### 页面结构
1. **首页** (`/`): 应用概述和导航
2. **CT重建和螺旋CT** (`/reconstruction`): 包含反投影和螺旋CT模拟
3. **CT剂量测量** (`/dose`): 剂量测量方法和概念
4. **心脏CT** (`/cardiac`): 心脏CT相关内容
5. **束硬化和双能CT** (`/dual-energy`): 束硬化效应和双能CT技术
6. **CT物理复习题** (`/questions`): 交互式问答

### 组件结构

```
src/
├── components/
│   ├── layout/
│   │   ├── Layout.jsx         # 主布局组件
│   │   ├── Sidebar.jsx        # 侧边导航栏
│   │   ├── Header.jsx         # 顶部导航栏（移动设备）
│   │   └── Footer.jsx         # 页脚
│   ├── ui/
│   │   ├── Button.jsx         # 自定义按钮
│   │   ├── Select.jsx         # 自定义下拉菜单
│   │   ├── Slider.jsx         # 自定义滑块
│   │   ├── Card.jsx           # 内容卡片
│   │   └── Tabs.jsx           # 标签页组件
│   ├── simulators/
│   │   ├── BackprojectionSimulator.jsx    # 反投影模拟器
│   │   ├── HelicalCTSimulator.jsx         # 螺旋CT模拟器
│   │   ├── DualEnergySimulator.jsx        # 双能CT模拟器
│   │   └── CardiacCTSimulator.jsx         # 心脏CT模拟器
│   ├── charts/
│   │   ├── XRaySpectraChart.jsx           # X射线能谱图表
│   │   ├── AttenuationChart.jsx           # 衰减曲线图表
│   │   └── DoseChart.jsx                  # 剂量相关图表
│   └── interactive/
│       ├── QuizComponent.jsx              # 交互式问答组件
│       ├── ImageViewer.jsx                # 图像查看器
│       └── Calculator.jsx                 # 计算器组件
├── pages/
│   ├── index.js               # 首页
│   ├── reconstruction.js      # CT重建和螺旋CT页面
│   ├── dose.js                # CT剂量测量页面
│   ├── cardiac.js             # 心脏CT页面
│   ├── dual-energy.js         # 束硬化和双能CT页面
│   ├── questions.js           # CT物理复习题页面
│   └── _app.js                # Next.js应用入口
├── styles/
│   ├── globals.css            # 全局样式
│   └── tailwind.css           # Tailwind配置
├── lib/
│   ├── simulationUtils.js     # 模拟计算工具函数
│   ├── chartUtils.js          # 图表工具函数
│   └── mathUtils.js           # 数学计算工具函数
└── data/
    ├── reconstruction.json    # CT重建和螺旋CT数据
    ├── dose.json              # CT剂量测量数据
    ├── cardiac.json           # 心脏CT数据
    ├── dualEnergy.json        # 束硬化和双能CT数据
    └── questions.json         # CT物理复习题数据
```

## 5. 数据模型

### CT重建和螺旋CT数据模型
```json
{
  "backprojection": {
    "title": "反投影",
    "description": "反投影是CT重建的基本方法...",
    "images": {
      "abdomen": {
        "src": "/images/abdomen.png",
        "alt": "腹部CT图像"
      },
      "phantom": {
        "src": "/images/phantom.png",
        "alt": "模型CT图像"
      }
    },
    "fanBeamAngles": [30, 60, 90],
    "simulationData": {
      // 模拟计算所需的数据
    }
  },
  "helicalCT": {
    "title": "螺旋CT和螺距",
    "description": "螺旋CT技术使用连续旋转的X射线源...",
    "images": {
      "fracture": {
        "src": "/images/fracture.png",
        "alt": "骨折CT图像"
      },
      "liverLesions": {
        "src": "/images/liver_lesions.png",
        "alt": "肝脏病变CT图像"
      }
    },
    "pitchValues": [0.5, 1, 1.5, 2],
    "simulationData": {
      // 模拟计算所需的数据
    }
  }
}
```

### 双能CT数据模型
```json
{
  "xrayEnergy": {
    "title": "X射线能量和衰减",
    "description": "X射线在不同能量下通过不同材料的衰减...",
    "tissues": [
      {"name": "软组织", "value": "soft_tissue", "density": 1.06},
      {"name": "脂肪", "value": "fat", "density": 0.92},
      {"name": "骨骼", "value": "bone", "density": 1.92},
      {"name": "碘造影剂", "value": "iodine", "density": 1.0},
      {"name": "碘增强器官", "value": "iodine_enhanced", "density": 1.06},
      {"name": "水", "value": "water", "density": 1.0},
      {"name": "空气", "value": "air", "density": 0.001}
    ],
    "iodineConcentrations": [1, 2, 5, 8, 10],
    "simulationData": {
      // 模拟计算所需的数据
    }
  },
  "beamHardening": {
    "title": "束硬化",
    "description": "束硬化是X射线束通过物质时...",
    "simulationData": {
      // 模拟计算所需的数据
    }
  },
  "dualEnergyReconstruction": {
    "title": "双能重建",
    "description": "双能CT可以进行材料分解...",
    "reconstructionTypes": [
      {"name": "虚拟平扫", "value": "virtual_noncontrast"},
      {"name": "碘叠加", "value": "iodine_overlay"},
      {"name": "骨骼减除", "value": "bone_subtraction"},
      {"name": "肺灌注", "value": "lung_perfusion"}
    ],
    "simulationData": {
      // 模拟计算所需的数据
    }
  }
}
```

### CT物理复习题数据模型
```json
{
  "questions": [
    {
      "id": 1,
      "question": "在CT重建中，滤波反投影与原始反投影相比有什么优势？",
      "options": [
        "减少图像噪声",
        "提高空间分辨率",
        "减少星状伪影",
        "以上都是"
      ],
      "correctAnswer": 3,
      "explanation": "滤波反投影通过应用高通滤波器减少了模糊，提高了空间分辨率，并减少了星状伪影。"
    },
    // 更多问题...
  ]
}
```

## 6. 响应式设计策略

### 断点设计
使用Tailwind CSS的断点：
- `sm`: 640px（小型手机）
- `md`: 768px（大型手机/小型平板）
- `lg`: 1024px（平板/小型笔记本）
- `xl`: 1280px（笔记本/桌面）
- `2xl`: 1536px（大型桌面）

### 布局策略
1. **移动设备优先**：
   - 侧边导航栏在移动设备上转为底部导航或抽屉式菜单
   - 单列内容布局，交互元素垂直排列
   - 触摸友好的UI元素（更大的点击区域）

2. **平板/桌面设备**：
   - 固定侧边导航栏
   - 多列内容布局
   - 更复杂的交互模式

### 交互元素适配
- 图表和模拟器根据屏幕尺寸自动调整大小
- 在小屏幕上简化某些复杂交互
- 使用手势支持触摸交互

## 7. 性能优化策略

1. **代码分割**：使用Next.js的动态导入功能
2. **图像优化**：使用Next.js的Image组件和WebP格式
3. **延迟加载**：非关键资源延迟加载
4. **缓存策略**：静态资源有效缓存
5. **计算优化**：复杂计算在Web Worker中执行

## 8. 部署策略

1. **构建优化**：
   - 生产环境构建时启用代码压缩
   - 移除未使用的CSS
   - 优化依赖包大小

2. **部署平台**：
   - Vercel（优先考虑，与Next.js无缝集成）
   - Netlify（备选方案）

3. **CI/CD**：
   - 自动化测试和部署流程
   - 预览部署用于代码审查
