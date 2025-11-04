import React, { useRef, useEffect, useState, useCallback } from 'react';
import './DrawingCanvas.css';

type Tool = 'pen' | 'eraser';

const DrawingCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.lineCap = 'round';
    context.strokeStyle = '#000000';
    context.lineWidth = 5;
    
    contextRef.current = context;
  }, []);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) {
      return;
    }

    if (tool === 'pen') {
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = '#000000';
      context.lineWidth = 5;
    } else if (tool === 'eraser') {
      context.globalCompositeOperation = 'destination-out';
      context.lineWidth = 20; 
    }
  }, [tool]); 


  const startDrawing = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const context = contextRef.current;
    if (!context) {
      return;
    }
    
    const { offsetX, offsetY } = event.nativeEvent;
    
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  }, []);

  const stopDrawing = useCallback(() => {
    const context = contextRef.current;
    if (!context) {
      return;
    }
    
    context.closePath();
    setIsDrawing(false);
  }, []);

  const draw = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }
    
    const context = contextRef.current;
    if (!context) {
      return;
    }

    const { offsetX, offsetY } = event.nativeEvent;
    context.lineTo(offsetX, offsetY);
    context.stroke();
  }, [isDrawing]);


  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) {
      return;
    }
    
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="drawing-container">
      <div className="toolbar">
        <button
          onClick={() => setTool('pen')}
          className={tool === 'pen' ? 'active' : ''}
        >
          Pen
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={tool === 'eraser' ? 'active' : ''}
        >
          Eraser
        </button>
        <button onClick={clearCanvas}>
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing} 
        onMouseMove={draw}
      />
    </div>
  );
};

export default DrawingCanvas;