import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './DrawingCanvas.css';

// --- 1. Konfiguracja ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PIXEL_SIZE = 10; 
const SYNC_INTERVAL = 2000;
const API_URL = 'http://localhost:8080/api';

const COLS = Math.floor(CANVAS_WIDTH / PIXEL_SIZE);
const ROWS = Math.floor(CANVAS_HEIGHT / PIXEL_SIZE);

type Tool = 'pen' | 'eraser';

interface PixelGroup {
  color: string;
  pixels: number[][]; 
}

// Mapa: "x,y" -> "kolor"
type PixelGrid = Map<string, string>;

// --- Algorytm Bresenhama ---
const getPointsOnLine = (x0: number, y0: number, x1: number, y1: number): number[][] => {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while(true) {
        points.push([x0, y0]);
        if ((x0 === x1) && (y0 === y1)) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
    return points;
};

const componentToHex = (c: number): string => {
  const hex = c.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

const DrawingCanvas: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Stan całego obrazka (do wyświetlania)
  const [pixelGrid, setPixelGrid] = useState<PixelGrid>(new Map());
  
  // NOWOŚĆ: Stan tylko nowych zmian (do wysyłki)
  const [unsyncedGrid, setUnsyncedGrid] = useState<PixelGrid>(new Map());

  const [isLoading, setIsLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastGridPoint, setLastGridPoint] = useState<number[] | null>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [currentColor, setCurrentColor] = useState('#000000');

  // --- Ładowanie danych z backendu ---
  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    };

    setIsLoading(true);
    fetch(`${API_URL}/images/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Nie udało się wczytać obrazka');
        return res.json();
      })
      .then(data => {
        const img = new window.Image();
        img.onload = () => {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

          if (!tempCtx) {
            console.error("Nie można uzyskać kontekstu 2d dla tymczasowego płótna");
            setIsLoading(false);
            return;
          }

          tempCtx.drawImage(img, 0, 0);
          const imageData = tempCtx.getImageData(0, 0, img.width, img.height).data;
          const initialGrid = new Map<string, string>();

          // Obrazek z bazy ma wymiary 80x60. Każdy jego piksel odpowiada
          // jednej komórce na naszej siatce (która też ma 80x60 komórek).
          for (let gy = 0; gy < img.height; gy++) { // Pętla po wierszach obrazka (0-59)
            for (let gx = 0; gx < img.width; gx++) { // Pętla po kolumnach obrazka (0-79)
              
              // Zabezpieczenie na wypadek, gdyby obrazek z bazy był większy niż siatka
              if (gx >= COLS || gy >= ROWS) continue;

              const pixelIndex = (gy * img.width + gx) * 4;

              const r = imageData[pixelIndex];
              const g = imageData[pixelIndex + 1];
              const b = imageData[pixelIndex + 2];
              const a = imageData[pixelIndex + 3];

              // Jeśli piksel nie jest w pełni biały, dodajemy go do siatki
              if (a > 0 && (r < 255 || g < 255 || b < 255)) { 
                const key = `${gx},${gy}`;
                initialGrid.set(key, rgbToHex(r, g, b));
              }
            }
          }
          setPixelGrid(initialGrid);
          setIsLoading(false);
        };
        img.onerror = () => {
          console.error("Błąd podczas ładowania obrazka z danych Base64.");
          setIsLoading(false);
        };
        img.src = `data:image/png;base64,${data.content}`;
      })
      .catch(error => {
        console.error("Błąd podczas wczytywania obrazka:", error);
        setIsLoading(false);
      });

  }, [id]);

  // --- Renderowanie Płótna ---
  // Ten hook jest teraz jedynym źródłem prawdy o tym, jak wygląda płótno.
  // Uruchamia się za każdym razem, gdy zmienia się siatka pikseli.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // KROK 1: Zawsze upewnij się, że płótno ma właściwe wymiary.
    // To rozwiązuje problem z domyślnym rozmiarem 300x150.
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // KROK 2: Wyczyść i narysuj tło oraz siatkę
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.beginPath();
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x += PIXEL_SIZE) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += PIXEL_SIZE) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
    }
    ctx.stroke();

    // KROK 3: Narysuj wszystkie piksele z aktualnego stanu
    pixelGrid.forEach((color, key) => {
      const [gx, gy] = key.split(',').map(Number);
      ctx.fillStyle = color;
      ctx.fillRect(gx * PIXEL_SIZE, gy * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    });
  }, [pixelGrid]);

  // --- Logika Rysowania (Aktualizuje oba stany) ---
  const paintPixels = useCallback((targetX: number, targetY: number, prevX: number | null, prevY: number | null) => {
    
    // Obliczamy punkty do zmiany
    let pointsToDraw: number[][] = [];
    if (prevX !== null && prevY !== null) {
        pointsToDraw = getPointsOnLine(prevX, prevY, targetX, targetY);
    } else {
        pointsToDraw = [[targetX, targetY]];
    }

    // 1. Aktualizacja Głównego Obrazu (Wizualna)
    setPixelGrid(prevGrid => {
        const newGrid = new Map(prevGrid);
        
        pointsToDraw.forEach(([gx, gy]) => {
            if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
            const key = `${gx},${gy}`;
            
            const color = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
            newGrid.set(key, color);
        });
        return newGrid;
    });

    // 2. Aktualizacja Bufora Zmian (Do wysyłki)
    setUnsyncedGrid(prevUnsynced => {
        const newUnsynced = new Map(prevUnsynced);

        pointsToDraw.forEach(([gx, gy]) => {
            if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
            const key = `${gx},${gy}`;

            const color = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
            newUnsynced.set(key, color);
        });
        return newUnsynced;
    });

  }, [currentTool, currentColor]);

  const getGridCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { offsetX, offsetY } = e.nativeEvent;
      return [Math.floor(offsetX / PIXEL_SIZE), Math.floor(offsetY / PIXEL_SIZE)];
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const [gx, gy] = getGridCoordinates(e);
    paintPixels(gx, gy, null, null);
    setLastGridPoint([gx, gy]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastGridPoint) return;
    const [gx, gy] = getGridCoordinates(e);
    if (gx === lastGridPoint[0] && gy === lastGridPoint[1]) return;
    paintPixels(gx, gy, lastGridPoint[0], lastGridPoint[1]);
    setLastGridPoint([gx, gy]);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastGridPoint(null);
  };

  const clearCanvas = () => {
    setUnsyncedGrid(prevUnsynced => {
        const newUnsynced = new Map(prevUnsynced);
        pixelGrid.forEach((_, key) => {
            newUnsynced.set(key, '#FFFFFF');
        });
        return newUnsynced;
    });
    setPixelGrid(new Map());
  };

  // --- Funkcja formatująca dane do JSON ---
  const formatGridToJson = (gridToFormat: PixelGrid): PixelGroup[] => {
    const colorMap: Record<string, number[][]> = {};

    gridToFormat.forEach((color, key) => {
        const coords = key.split(',').map(Number);
        if (!colorMap[color]) {
            colorMap[color] = [];
        }
        colorMap[color].push(coords);
    });

    return Object.keys(colorMap).map(color => ({
        color: color,
        pixels: colorMap[color]
    }));
  };

  // --- Synchronizacja ---
  const syncDrawingData = useCallback(() => {
    if (unsyncedGrid.size === 0 || !id) return;

    const dataToSend = formatGridToJson(unsyncedGrid);

    console.log("--- WYSYŁKA DELTA (Tylko nowe pixele) ---");
    console.log(`Liczba zmienionych pikseli: ${unsyncedGrid.size}`);
    console.log(JSON.stringify(dataToSend, null, 2));

    fetch(`${API_URL}/images/${id}/pixels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataToSend),
    })
    .then(res => {
      if (!res.ok) {
        throw new Error('Błąd synchronizacji');
      }
      console.log("Synchronizacja udana!");
      // Czyścimy bufor tylko po udanej synchronizacji
      setUnsyncedGrid(new Map());
    })
    .catch(error => {
      console.error("Błąd podczas synchronizacji:", error);
    });

  }, [unsyncedGrid, id]);

  useEffect(() => {
    const intervalId = setInterval(syncDrawingData, SYNC_INTERVAL);
    return () => clearInterval(intervalId);
  }, [syncDrawingData]);

  if (isLoading) {
    return <div>Wczytywanie płótna...</div>;
  }

  return (
    <div className="drawing-container">
      <div className="toolbar">
        <button onClick={() => navigate('/')} style={{ marginRight: '10px' }}>🏠 Strona główna</button>
        <button onClick={() => setCurrentTool('pen')} className={currentTool === 'pen' ? 'active' : ''}>✏️ Ołówek</button>
        <button onClick={() => setCurrentTool('eraser')} className={currentTool === 'eraser' ? 'active' : ''}>🧽 Gumka</button>
        <div className="color-picker-wrapper">
            <span>Kolor:</span>
            <input type="color" value={currentColor} onChange={(e) => { setCurrentColor(e.target.value); setCurrentTool('pen'); }}/>
        </div>
        <button onClick={clearCanvas}>🗑️ Wyczyść</button>
        <button onClick={syncDrawingData} style={{ backgroundColor: '#a0e0a0' }}>Wyślij zmiany teraz</button>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onMouseMove={draw}
      />

      <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace', textAlign: 'left' }}>
          <strong>Status:</strong> Siatka {COLS}x{ROWS}<br/>
          <strong>Pamięć (Total):</strong> {pixelGrid.size} pixeli<br/>
          <strong>Do wysłania (Delta):</strong> {unsyncedGrid.size} pixeli
      </div>
    </div>
  );
};

export default DrawingCanvas;