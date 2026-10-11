import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Serve the SVG icon as favicon
    const iconPath = join(process.cwd(), 'public', 'icons', 'icon.svg');
    const iconBuffer = await readFile(iconPath);
    
    return new NextResponse(iconBuffer, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    // Fallback to PNG if SVG not found
    try {
      const pngPath = join(process.cwd(), 'public', 'icons', 'icon-192x192.png');
      const pngBuffer = await readFile(pngPath);
      
      return new NextResponse(pngBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      return new NextResponse(null, { status: 404 });
    }
  }
}
