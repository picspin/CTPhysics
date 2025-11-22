# CT Physics Web App 应用架构设计

## 1. 应用概述

我们将创建一个基于xrayphysics.com网站CT物理相关内容的Web应用，使用React v18作为前端框架，Tailwind CSS结合Material UI的设计风格，采用轻量化的数据方案，优先优化移动设备体验。

## 2. 技术栈选择

### 前端
- **框架**: React v18
- **构建工具**: Next.js 14（提供更好的性能和SEO优化）
- **语言**: TypeScript (类型安全)
- **样式**: Tailwind CSS + Material UI风格组件
- **状态管理**: React Context API（轻量级应用无需Redux）
- **路由**: Next.js内置路由
- **图表库**: Recharts（用于交互式图表）
- **动画**: Framer Motion（用于流畅的UI动画）
- **3D渲染**: Three.js / React Three Fiber (用于3D模拟)

### 后端/数据
- **数据存储**: 静态JSON文件（轻量化方案）
- **API**: Next.js API Routes（如需动态数据）

### 部署
- **目标平台**: Vercel或Netlify

## 3. 颜色主题

根据用户要求，使用以下颜色方案：

```css
:root {
  /* 主色调 - 更加鲜明的橙色系 */
  --primary-100: #FF7A00;
  --primary-200: #E56C00;
  --primary-300: #B35300;
  
  /* 强调色 - 科技感蓝色 */
  --accent-100: #3B82F6;
  --accent-200: #1D4ED8;
  --accent-300: #1E40AF;
  
  /* 文本颜色 */
  --text-100: #1F2937;
  --text-200: #4B5563;
  --text-300: #9CA3AF;
  
  /* 背景颜色 */
  --bg-100: #FFFFFF;
  --bg-200: #F9FAFB;
  --bg-300: #F3F4F6;
  --bg-400: #E5E7EB;
}
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
│   │   ├── Layout.tsx         # 主布局组件
│   │   ├── Sidebar.tsx        # 侧边导航栏
│   │   ├── Header.tsx         # 顶部导航栏（移动设备）
│   │   └── Footer.tsx         # 页脚
│   │   └── XrayAttenuationSimulator.tsx   # X射线衰减模拟器
│   └── interactive/
│       └── QuizComponent.tsx              # 交互式问答组件
├── app/
│   ├── page.tsx               # 首页
│   ├── reconstruction/page.tsx # CT重建和螺旋CT页面
│   ├── dose/page.tsx          # CT剂量测量页面
│   ├── cardiac/page.tsx       # 心脏CT页面
│   ├── dual-energy/page.tsx   # 束硬化和双能CT页面
│   ├── questions/page.tsx     # CT物理复习题页面
│   └── layout.tsx             # Root Layout
├── styles/
│   └── globals.css            # 全局样式
├── utils/
│   ├── physics-calculations.ts # 物理计算工具函数
│   └── data-manager.ts        # 数据管理工具函数
└── data/
    ├── questions.json         # CT物理复习题数据
    └── ...
```

## 5. 数据模型

### CT重建和螺旋CT数据模型
(保持原有JSON结构)

### 双能CT数据模型
(保持原有JSON结构)

### CT物理复习题数据模型
(保持原有JSON结构)

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
- **注意**: 移除了模拟器容器的渐变遮罩以提高交互性

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
