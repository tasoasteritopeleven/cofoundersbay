import { ImageResponse } from 'next/og';

export const size = {
  width: 64,
  height: 64,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(180deg, #6D28D9 0%, #EA580C 40%, #F97316 62%, #1E1B4B 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 16,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            background: '#FBBF24',
            position: 'absolute',
            top: 10,
            left: 18,
          }}
        />
        <div
          style={{
            width: 42,
            height: 7,
            borderRadius: 4,
            background: '#FFF7ED',
            position: 'absolute',
            top: 34,
            left: 11,
            transform: 'rotate(-14deg)',
          }}
        />
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: '#1E1B4B',
            position: 'absolute',
            top: 20,
            left: 20,
          }}
        />
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            background: '#0F172A',
            position: 'absolute',
            top: 44,
            left: 32,
          }}
        />
      </div>
    ),
    {
      ...size,
    },
  );
}
