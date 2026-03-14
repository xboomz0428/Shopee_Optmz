/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright-core', '@browserbasehq/sdk'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cf.shopee.tw' },
      { protocol: 'https', hostname: 'down-tw.img.susercontent.com' },
    ],
  },
}

export default nextConfig
