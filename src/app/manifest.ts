import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cruvels Workplace OS',
    short_name: 'Cruvels',
    description: 'Enterprise Internal Operations, Employee Directory, Compliance & Workforce Management OS',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    categories: ['business', 'productivity'],
    background_color: '#0B0F19',
    theme_color: '#0B6E6A',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/favicon.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/cruvels-logo-transparent.png',
        sizes: '161x161',
        type: 'image/png',
      },
    ],
  };
}
