/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cf.shopee.tw' },
      { protocol: 'https', hostname: 'down-tw.img.susercontent.com' },
    ],
  },
}

export default nextConfig
