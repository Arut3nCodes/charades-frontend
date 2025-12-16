import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css'
import DrawingCanvas from './DrawingCanvas';
import HomePage from './HomePage';

function App() {
  return (
    <Router>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/draw/:id" element={<DrawingCanvas />} />
        </Routes>
      </main>
    </Router>
  )
}

export default App
