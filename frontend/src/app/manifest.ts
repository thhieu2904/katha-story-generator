import type { MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name : 'Katha',
        short_name : 'Katha',
        description : 'Khám phá thế giới của dân tộc Khmer vùng đất Nam Bộ!',
        start_url : '/',
        display : 'standalone',
        background_color : '#fff8ec',
        theme_color : '#d99a16',
        orientation : 'portrait-primary',
        icons : [
            {
                src:'icons/icon-192.png',
                sizes:'192x192',
                type:'image/png'
            },
            {
                src:'icons/icon-512.png',
                sizes:'512x512',
                type:'image/png',
            },
            {
                src:'icons/icon-512-maskable.png',
                sizes:'512x512',
                type:'image/png',
                purpose:'maskable',
            },
        ],
    };
}