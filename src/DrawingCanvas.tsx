import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import './DrawingCanvas.css';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PIXEL_SIZE = 10;
const API_URL = 'http://localhost:8080/api';

const COLS = CANVAS_WIDTH / PIXEL_SIZE;
const ROWS = CANVAS_HEIGHT / PIXEL_SIZE;
const BATCH_DELAY = 50;

type Tool = 'pen' | 'eraser';

interface PixelGroup {
  color: string;
  pixels: number[][];
  authorId: string;
}

type PixelGrid = Map<string, string>;

const clientId = crypto.randomUUID();

/* Bresenham */
const getPointsOnLine = (
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number[][] => {
  const points: number[][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return points;
};

const DrawingCanvas: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stompRef = useRef<Client | null>(null);
  const flushTimeout = useRef<number | null>(null);

  const [pixelGrid, setPixelGrid] = useState<PixelGrid>(new Map());
  const [buffer, setBuffer] = useState<PixelGrid>(new Map());
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<number[] | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);

  /* ---- Load image ---- */
  useEffect(() => {
    if (!id) return;

    fetch(`${API_URL}/images/${id}`)
      .then(r => r.json())
      .then(data => {
        const img = new Image();
        img.onload = () => {
          const tmp = document.createElement('canvas');
          tmp.width = img.width;
          tmp.height = img.height;
          const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0);

          const d = ctx.getImageData(0, 0, img.width, img.height).data;
          const grid = new Map<string, string>();

          for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
              const i = (y * img.width + x) * 4;
              const [r, g, b, a] = d.slice(i, i + 4);
              if (a > 0 && (r | g | b) !== 255) {
                grid.set(`${x},${y}`,
                  `#${((1 << 24) + (r << 16) + (g << 8) + b)
                    .toString(16).slice(1)}`);
              }
            }
          }
          setPixelGrid(grid);
          setLoading(false);
        };
        img.src = `data:image/png;base64,${data.content}`;
      });
  }, [id]);

  /* ---- WebSocket ---- */
  useEffect(() => {
    if (!id) return;

    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws-stomp'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/images/${id}`, msg => {
          const groups: PixelGroup[] = JSON.parse(msg.body);
          setPixelGrid(prev => {
            const next = new Map(prev);
            groups.forEach(g => {
              if (g.authorId === clientId) return;
              g.pixels.forEach(([x, y]) =>
                next.set(`${x},${y}`, g.color)
              );
            });
            return next;
          });
        });
      },
      onDisconnect: () => setConnected(false),
    });

    client.activate();
    stompRef.current = client;
    return () => {
      void client.deactivate();
    }
  }, [id]);

  /* ---- Canvas render ---- */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = CANVAS_WIDTH;
    c.height = CANVAS_HEIGHT;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = '#ddd';
    for (let x = 0; x <= CANVAS_WIDTH; x += PIXEL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += PIXEL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    pixelGrid.forEach((c, key) => {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = c;
      ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    });
  }, [pixelGrid]);

  /* ---- Flush buffer ---- */
  const flush = useCallback(() => {
    if (!connected || !stompRef.current || buffer.size === 0) return;

    const grouped: Record<string, number[][]> = {};
    buffer.forEach((c, k) => {
      grouped[c] ??= [];
      grouped[c].push(k.split(',').map(Number));
    });

    const payload: PixelGroup[] = Object.entries(grouped).map(
      ([color, pixels]) => ({ color, pixels, authorId: clientId })
    );

    stompRef.current.publish({
      destination: `/app/images/${id}/pixels`,
      body: JSON.stringify(payload),
    });

    setLastSync(Date.now());

    setBuffer(new Map());
  }, [buffer, connected, id]);

  useEffect(() => {
    if (buffer.size === 0) return;
    if (flushTimeout.current) clearTimeout(flushTimeout.current);

    flushTimeout.current = window.setTimeout(flush, BATCH_DELAY);
    return () => {
      if (flushTimeout.current)
        clearTimeout(flushTimeout.current);
    };
  }, [buffer, flush]);

  /* ---- Paint ---- */
  const paint = useCallback((x: number, y: number, px?: number, py?: number) => {
    const pts = px !== undefined && py !== undefined
      ? getPointsOnLine(px, py, x, y)
      : [[x, y]];

    setPixelGrid(prev => {
      const n = new Map(prev);
      pts.forEach(([gx, gy]) => {
        if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return;
        n.set(`${gx},${gy}`, tool === 'eraser' ? '#FFFFFF' : color);
      });
      return n;
    });

    setBuffer(prev => {
      const n = new Map(prev);
      pts.forEach(([gx, gy]) => {
        if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return;
        n.set(`${gx},${gy}`, tool === 'eraser' ? '#FFFFFF' : color);
      });
      return n;
    });
  }, [tool, color]);

  const coords = (e: React.MouseEvent<HTMLCanvasElement>) => [
    Math.floor(e.nativeEvent.offsetX / PIXEL_SIZE),
    Math.floor(e.nativeEvent.offsetY / PIXEL_SIZE)
  ];

  if (loading) return <div>Wczytywanie…</div>;

  return (
    <div className="drawing-container">
      <div className="toolbar">
        <button onClick={() => navigate('/')}>🏠</button>
        <button onClick={() => setTool('pen')}>✏️</button>
        <button onClick={() => setTool('eraser')}>🧽</button>
        <input type="color" value={color}
          onChange={e => { setColor(e.target.value); setTool('pen'); }} />
        <div className="status">
          <span className={`badge ${connected ? "ok" : "bad"}`}>
            {connected ? "● Connected" : "● Disconnected"}
          </span>
          <span className="badge mono">
            buffer: {buffer.size}
          </span>
          <span className="badge mono">
            {buffer.size > 0 ? "unsynced" : "synced"}
          </span>
          <span className="badge mono">
            last: {lastSync ? new Date(lastSync).toLocaleTimeString() : "--"}
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={e => {
          const [x, y] = coords(e);
          setIsDrawing(true);
          paint(x, y);
          setLastPoint([x, y]);
        }}
        onMouseMove={e => {
          if (!isDrawing || !lastPoint) return;
          const [x, y] = coords(e);
          paint(x, y, lastPoint[0], lastPoint[1]);
          setLastPoint([x, y]);
        }}
        onMouseUp={() => { setIsDrawing(false); setLastPoint(null); }}
        onMouseLeave={() => { setIsDrawing(false); setLastPoint(null); }}
      />
    </div>
  );
};

export default DrawingCanvas;
