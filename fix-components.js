/**
 * 组件修复脚本
 * 用于解决CT Physics Web App中的组件路径问题和依赖安装问题
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 项目根目录
const rootDir = __dirname;

// 修复组件引用路径
function fixComponentPaths() {
  console.log('开始修复组件引用路径...');
  
  // 1. 确保组件目录存在
  const componentsDir = path.join(rootDir, 'components');
  const simulatorsDir = path.join(componentsDir, 'simulators');
  const uiDir = path.join(rootDir, 'ui');
  
  if (!fs.existsSync(simulatorsDir)) {
    fs.mkdirSync(simulatorsDir, { recursive: true });
    console.log(`创建目录: ${simulatorsDir}`);
  }
  
  // 2. 移动根目录下的模拟器组件到components/simulators目录
  const simulatorComponents = [
    'BackprojectionSimulator.jsx',
    'HelicalCTSimulator.jsx',
    'CardiacGatingSimulator.jsx',
    'RadiationDoseSimulator.jsx',
    'DualEnergyReconstructionSimulator.jsx',
    'XrayAttenuationSimulator.jsx'
  ];
  
  simulatorComponents.forEach(component => {
    const sourcePath = path.join(rootDir, component);
    const destPath = path.join(simulatorsDir, component);
    
    if (fs.existsSync(sourcePath)) {
      // 读取文件内容
      let content = fs.readFileSync(sourcePath, 'utf8');
      
      // 修复import路径
      content = content.replace(/from '\.\/ui\/([^']+)'/g, "from '../../ui/$1'");
      content = content.replace(/from '\.\/([^']+)'/g, "from '../../$1'");
      
      // 写入新位置
      fs.writeFileSync(destPath, content);
      console.log(`移动并修复组件: ${component}`);
    }
  });
  
  // 3. 移动UI组件到ui目录
  const uiComponents = [
    'Button.jsx',
    'Select.jsx',
    'Slider.jsx',
    'SimulatorContainer.jsx',
    'TabGroup.jsx',
    'KeyPoints.jsx',
    'PageHeader.jsx',
    'SectionCard.jsx'
  ];
  
  uiComponents.forEach(component => {
    const sourcePath = path.join(rootDir, component);
    const destPath = path.join(uiDir, component);
    
    if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
      // 读取文件内容
      let content = fs.readFileSync(sourcePath, 'utf8');
      
      // 修复import路径
      content = content.replace(/from '\.\/ui\/([^']+)'/g, "from './$1'");
      
      // 写入新位置
      fs.writeFileSync(destPath, content);
      console.log(`移动并修复组件: ${component}`);
    }
  });
  
  // 4. 修复页面组件的引用路径
  const pageFiles = [
    path.join(rootDir, 'app', 'reconstruction', 'page.jsx'),
    path.join(rootDir, 'app', 'cardiac', 'page.jsx'),
    path.join(rootDir, 'app', 'dose', 'page.jsx'),
    path.join(rootDir, 'app', 'dual-energy', 'page.jsx'),
    path.join(rootDir, 'app', 'questions', 'page.jsx')
  ];
  
  pageFiles.forEach(pagePath => {
    if (fs.existsSync(pagePath)) {
      let content = fs.readFileSync(pagePath, 'utf8');
      
      // 修复import路径
      content = content.replace(/from '\.\.\/(\.\.\/)?(\w+)';/g, "from '../../../$2';");
      content = content.replace(/from '\.\.\/(\.\.\/)?(\w+Simulator)';/g, "from '../../../components/simulators/$2';");
      content = content.replace(/from '\.\.\/(\.\.\/)?(reconstruction|cardiac|dose|dual-energy|questions)\.json';/g, "from '../../../$2.json';");
      
      fs.writeFileSync(pagePath, content);
      console.log(`修复页面引用: ${pagePath}`);
    }
  });
  
  console.log('组件引用路径修复完成!');
}

// 确保所有依赖都已安装
function ensureDependencies() {
  console.log('检查并安装依赖...');
  
  try {
    // 安装必要的依赖
    execSync('npm install --save framer-motion recharts', { stdio: 'inherit' });
    console.log('依赖安装完成!');
  } catch (error) {
    console.error('依赖安装失败:', error.message);
  }
}

// 修复CSS样式问题
function fixCssIssues() {
  console.log('修复CSS样式问题...');
  
  const globalCssPath = path.join(rootDir, 'app', 'globals.css');
  
  if (fs.existsSync(globalCssPath)) {
    let content = fs.readFileSync(globalCssPath, 'utf8');
    
    // 确保没有阻止交互的CSS样式
    if (!content.includes('/* 确保交互元素可点击 */')) {
      content += `

/* 确保交互元素可点击 */
.simulator-container {
  position: relative;
  z-index: 1;
}

.simulator-container canvas,
.simulator-container svg,
.simulator-container button,
.simulator-container input,
.simulator-container select {
  position: relative;
  z-index: 2;
  pointer-events: auto;
}

/* 修复阴影问题 */
.gradient-border::before {
  z-index: 0;
}
`;
      
      fs.writeFileSync(globalCssPath, content);
      console.log('CSS样式问题修复完成!');
    }
  }
}

// 主函数
function main() {
  console.log('开始修复CT Physics Web App组件问题...');
  
  // 1. 修复组件引用路径
  fixComponentPaths();
  
  // 2. 确保所有依赖都已安装
  ensureDependencies();
  
  // 3. 修复CSS样式问题
  fixCssIssues();
  
  console.log('修复完成! 请重启开发服务器以应用更改。');
}

// 执行主函数
main();