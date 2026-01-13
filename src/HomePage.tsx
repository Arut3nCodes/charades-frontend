import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:8080/api';

// Wymiary płótna powinny być spójne w całej aplikacji
const GRID_WIDTH = 80;
const GRID_HEIGHT = 60;

interface Image {
  imageid: number;
  content: string; // Base64 content
  width: number;
  height: number;
}

const HomePage: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/images`)
      .then(res => res.json())
      .then(data => {
        console.log("Pobrane obrazki z /api/images:", data); // Pomocniczy log
        setImages(data);
      })
      .catch(error => console.error('Błąd podczas pobierania obrazków:', error));
  }, []);

  const handleNewDrawing = () => {
    fetch(`${API_URL}/images/white?width=${GRID_WIDTH}&height=${GRID_HEIGHT}`, {
      method: 'POST',
    })
      .then(res => res.json())
      .then(newImage => {
        navigate(`/draw/${newImage.imageid}`);
      })
      .catch(error => console.error('Błąd podczas tworzenia obrazka:', error));
  };

  return (
    <div className="container" style={{textAlign: 'center', fontFamily: 'sans-serif'}}>
      <h1>Charades - Wybierz obrazek</h1>
      <button onClick={handleNewDrawing} style={{padding: '10px 20px', fontSize: '16px', cursor: 'pointer'}}>
        Rysuj nowy obrazek
      </button>
      <h2 style={{marginTop: '30px'}}>Istniejące obrazki:</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
        {images.length > 0 ? images.map(image => (
          <Link to={`/draw/${image.imageid}`} key={image.imageid} style={{ textDecoration: 'none', color: 'inherit', border: '1px solid #ccc', padding: '10px', borderRadius: '8px', backgroundColor: '#f0f0f0' }}>
            <img 
              src={`data:image/png;base64,${image.content}`}
              alt={`Obrazek #${image.imageid}`}
              style={{ width: '200px', height: '150px', objectFit: 'contain', backgroundColor: 'white', imageRendering: 'pixelated' }}
            />
            <p style={{margin: '8px 0 0', textAlign: 'center'}}>Obrazek #{image.imageid}</p>
          </Link>
        )) : <p>Nie ma jeszcze żadnych obrazków. Stwórz nowy!</p>}
      </div>
    </div>
  );
};

export default HomePage;