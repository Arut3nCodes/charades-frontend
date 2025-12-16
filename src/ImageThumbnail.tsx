import React, { useRef, useEffect } from 'react';

interface PixelGroup {
  color: string;
  pixels: number[][];
}

interface ImageThumbnailProps {
  pixels: PixelGroup[];
  originalWidth: number;
  originalHeight: number;
  pixelSize: number;
}

const THUMBNAIL_WIDTH = 200;

const ImageThumbnail: React.FC<ImageThumbnailProps> = ({ pixels, originalWidth, originalHeight, pixelSize }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const scale = THUMBNAIL_WIDTH / originalWidth;
  const thumbnailHeight = originalHeight * scale;
  const thumbnailPixelSize = pixelSize * scale;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels) return;

    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = thumbnailHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    pixels.forEach(group => {
      ctx.fillStyle = group.color;
      group.pixels.forEach(([x, y]) => {
        ctx.fillRect(
          x * thumbnailPixelSize, 
          y * thumbnailPixelSize, 
          thumbnailPixelSize, 
          thumbnailPixelSize
        );
      });
    });

  }, [pixels, originalWidth, originalHeight, pixelSize, thumbnailHeight, thumbnailPixelSize]);

  return (
    <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', backgroundColor: 'white' }} />
  );
};

export default ImageThumbnail;