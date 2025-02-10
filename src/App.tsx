// src/App.tsx
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import MapNavigation from './components/MapNavigation';
import MapBoxNavigation from './components/MapBoxNavigation';
import MapNavigationLeaflet from './components/MapNavigationLeaflet';

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
    <div className="App" style={{ display: 'absolute', flexDirection: 'column', height: '100vh', width: '210vh' }}>
      {/* Navigation Bar */}
      <header style={{ padding: '10px', background: '#eee' }}>
        <Link style={{ marginRight: '10px' }} to="/">Home</Link>
        <Link style={{ marginRight: '10px' }} to="/maplibre">MapLibre Navigation</Link>
        <Link to="/mapbox">MapBox Navigation</Link>
        <Link to="/map-leaflet">Map Leaflet Navigation</Link>
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
          <Route path="/maplibre" element={<MapNavigation />} />
          <Route path="/mapbox" element={<MapBoxNavigation />} />
          <Route path="/map-leaflet" element={<MapNavigationLeaflet />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
