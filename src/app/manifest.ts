import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cruvels Internal Portal',
    short_name: 'Cruvels Portal',
    description: 'Enterprise Internal Operations, Employee Directory & Workplace Management Platform for Cruvels',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F172A',
    theme_color: '#2563EB',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
