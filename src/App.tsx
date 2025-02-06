// src/App.tsx
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import MapNavigation from './components/MapNavigation';
import MapBoxNavigation from './components/MapBoxNavigation';

const Home: React.FC = () => {
  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Welcome to the Navigation Demo</h1>
      <p>Select one of the options from the nav bar above.</p>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <div className="App" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Navigation Bar */}
      <header style={{ padding: '10px', background: '#eee' }}>
        <Link style={{ marginRight: '10px' }} to="/">Home</Link>
        <Link style={{ marginRight: '10px' }} to="/map">MapLibre Navigation</Link>
        <Link to="/box">MapBox Navigation</Link>
      </header>

      {/* Main content area */}
      <main
        style={{
          flex: 1, // take the remaining height
          display: 'relative',
          justifyContent: 'center', // center horizontally
          alignItems: 'center', // center vertically
          background: '#f9f9f9'
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapNavigation />} />
          <Route path="/box" element={<MapBoxNavigation />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
