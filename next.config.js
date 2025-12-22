/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    styledComponents: true,
  },
  // --- 以下为 GitHub Pages 部署新增的精确配置 ---
  // 1. 启用静态导出（Next.js 构建后会生成 out 文件夹）
  output: 'export',
  
  // 2. 资源路径前缀：必须与仓库名一致
  // 假设你的仓库地址是 github.com/username/my-three-project
  // 那么这里就填 '/my-three-project'
  basePath: '/CTPhysics',
  
  // 3. 静态资源前缀：确保 JS/CSS/图片 路径正确
  assetPrefix: '/CTPhysics/',
  
  // 4. 关闭图片优化：静态导出不支持 Next.js 默认的图片优化服务
  images: {
    unoptimized: true,
  },
  
  // 5. 如果你使用了引用的外部库有 ES Module 问题（Three.js 经常需要）
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
};

module.exports = nextConfig;
