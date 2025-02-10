import React, { useRef, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, GeoJSON } from 'react-leaflet';
import L, { LatLngExpression  } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeoJsonObject } from 'geojson';
// Fix per icone Leaflet (se non le vedi correttamente)
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

// OpenRouteService key (imposta la tua)
const ORS_API_KEY = import.meta.env.VITE_APP_ORS_API_KEY!;

type Point = { lat: number; lng: number };

type Step = {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
};

const MapNavigationLeaflet: React.FC = () => {
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);

  // Memorizziamo la rotta in formato GeoJSON
  const [routeData, setRouteData] = useState<GeoJsonObject | null>(null);
  // Lista di step estratti da ORS
  const [steps, setSteps] = useState<Step[]>([]);
  // Indice step corrente
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Info su distanza e tempo residuo
  const [distanceLeft, setDistanceLeft] = useState('—');
  const [timeLeft, setTimeLeft] = useState('—');

  // Attiva/disattiva la “navigazione”
  const [navigationActive, setNavigationActive] = useState(false);

  // Posizione utente
  const [userLocation, setUserLocation] = useState<Point | null>(null);

  // Reference a un timer fittizio (per simulare avanzamento step)
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /** 1) Componente che gestisce gli eventi di click sulla mappa */
  function LocationSetter() {
    useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
        const point = { lat, lng };

        if (!startPoint) {
          setStartPoint(point);
        } else if (!endPoint) {
          setEndPoint(point);
        }
      },
    });
    return null;
  }

  /** 2) Funzione per chiamare ORS e recuperare la rotta foot-hiking */
  const fetchRoute = async () => {
    if (!startPoint || !endPoint) return;

    try {
        console.log(ORS_API_KEY);
      const response = await fetch(
        'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson',
        {
          method: 'POST',
          headers: {
            Authorization: ORS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            coordinates: [
              [startPoint.lng, startPoint.lat],
              [endPoint.lng, endPoint.lat],
            ],
          }),
        }
      );
      const data = await response.json()

      setRouteData(data as GeoJsonObject);

      // Estrae step dal JSON
      const routeSteps: Step[] =
        data.features[0].properties.segments?.[0]?.steps?.map((s: Step) => ({
          instruction: s.instruction,
          distance: s.distance,
          duration: s.duration,
        })) || [];

      setSteps(routeSteps);
      setCurrentStepIndex(0);

      // Calcolo veloce di distanza e tempo rimanente
      const dist = data.features[0].properties.summary.distance; // in metri
      const dur = data.features[0].properties.summary.duration; // in secondi
      setDistanceLeft(`${(dist / 1000).toFixed(2)} km`);
      setTimeLeft(`${Math.round(dur / 60)} min`);
    } catch (error) {
      console.error('Error fetching route from ORS:', error);
    }
  };

  /** 3) Avvio “navigazione”: attivo lo stato e (facoltativo) parlo il primo step */
  const startNavigation = () => {
    if (!routeData || steps.length === 0) return;
    setNavigationActive(true);

    // Se vuoi fare text-to-speech del primo step
    if (steps[0]) {
      speak(steps[0].instruction);
    }

    // Simulazione: ogni X secondi avanziamo di uno step
    timerRef.current = setInterval(() => {
      setCurrentStepIndex((prev) => {
        const next = prev + 1;
        if (next < steps.length) {
          speak(steps[next].instruction);
          // Aggiorna distanza/tempo rimanente
          updateDistanceTimeLeft(next);
          return next;
        } else {
          // Fine
          if (timerRef.current) clearInterval(timerRef.current);
          return prev;
        }
      });
    }, 10000); // ogni 10 secondi, avanza di step
  };

  /** 4) Calcola distanza e tempo rimanenti a partire da un certo indice di step */
  const updateDistanceTimeLeft = (fromIndex: number) => {
    let dist = 0;
    let dur = 0;
    for (let i = fromIndex; i < steps.length; i++) {
      dist += steps[i].distance;
      dur += steps[i].duration;
    }
    setDistanceLeft(`${(dist / 1000).toFixed(2)} km`);
    setTimeLeft(`${Math.round(dur / 60)} min`);
  };

  /** 5) text-to-speech helper */
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
  };

  /**
   * 6) Hook per geolocalizzazione HTML5
   *    Per una navigazione vera, potresti usare navigator.geolocation.watchPosition
   *    e centrare la mappa su userLocation, ecc.
   */
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
      },
      (err) => {
        console.warn('Geolocation error', err);
      },
      { enableHighAccuracy: true }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Pulizia timer se unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // In Leaflet, per “center on user” potresti usare la ref della mappa
  // e fare map.setView([latitude, longitude], zoom) quando ti arriva la posizione.
  // In React-Leaflet, puoi usare la prop "center" su <MapContainer> e aggiornarla a ogni cambio userLocation
  // oppure un imperativo useMap().

  const center: LatLngExpression = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [43.77, 11.255]; // fallback

  return (
    <div style={{  position: 'relative', height: '100vh' }}>
      {/* Mappa */}
      <MapContainer
        center={center}
        zoom={27}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          // Usa pure il tuo tile server o OSM
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Gestore click mappa */}
        <LocationSetter />

        {/* Marker start */}
        {startPoint && (
          <Marker position={[startPoint.lat, startPoint.lng]}>
            <Popup>Start</Popup>
          </Marker>
        )}
        {/* Marker end */}
        {endPoint && (
          <Marker position={[endPoint.lat, endPoint.lng]} icon={defaultIcon}>
            <Popup>End</Popup>
          </Marker>
        )}
        {/* Marker utente */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>Tu sei qui</Popup>
          </Marker>
        )}

        {/* Rotta in GeoJSON */}
        {routeData && <GeoJSON data={routeData} />}
      </MapContainer>

      {/* Overlay UI */}
      {/* UI Overlay (Top-Left) */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'white',
          zIndex: 1000,
          padding: '10px',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          width: '220px',
        }}
      >
        <p>
          <strong>Clicca sulla mappa per selezionare Start e End</strong>
        </p>
        {startPoint && (
          <p style={{ color: 'green' }}>
            Start: {startPoint.lng.toFixed(4)}, {startPoint.lat.toFixed(4)}
          </p>
        )}
        {endPoint && (
          <p style={{ color: 'red' }}>
            End: {endPoint.lng.toFixed(4)}, {endPoint.lat.toFixed(4)}
          </p>
        )}

        <button onClick={fetchRoute} disabled={!startPoint || !endPoint}>
          Get Route
        </button>
        <button
          onClick={startNavigation}
          disabled={!routeData || navigationActive}
          style={{ marginLeft: '8px' }}
        >
          Start Nav
        </button>
      </div>

      {/* Barra navigazione in basso */}
      {navigationActive && (
        <div
        style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '12px',
        }}
      >
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div>
              <h4 style={{ margin: 0 }}>Step</h4>
              <p style={{ margin: 0 }}>
                {steps[currentStepIndex]?.instruction || 'Arrived!'}
              </p>
            </div>
            <div>
              <h4 style={{ margin: 0 }}>Time Left</h4>
              <p style={{ margin: 0 }}>{timeLeft}</p>
            </div>
            <div>
              <h4 style={{ margin: 0 }}>Distance Left</h4>
              <p style={{ margin: 0 }}>{distanceLeft}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapNavigationLeaflet;
