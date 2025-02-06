// src/components/MapNavigation.tsx
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl, { Map, Marker, GeoJSONSource } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// *** IMPORTANT ***
// 1) Set your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZW1hcGJveDkxIiwiYSI6ImNtNXUzMGR3ajByMW0yaXNpemh1ZHlnanQifQ.wJFMKE-ESj9e2hiMYv6dpA';

// 2) Set your OpenRouteService API key
const ORS_API_KEY = '5b3ce3597851110001cf6248edbbde8ff61441a1a9500157e2b7ae93';

// A simple type for user-chosen points on the map.
type Point = { lng: number; lat: number };

// A type for route steps from ORS
type Step = {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
};

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v11';

const MapNavigation: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  // Markers for start, end, and user location
  const startMarkerRef = useRef<Marker | null>(null);
  const endMarkerRef = useRef<Marker | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);

  // Start/end states
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const endPointRef = useRef<Point | null>(null);

  // ORS route + steps
  const [routeGeoJSON, setRouteGeoJSON] = useState<unknown>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Real-time location from GeolocateControl
  const [userLocation, setUserLocation] = useState<Point | null>(null);

  // Basic “remaining” stats
  const [distanceLeft, setDistanceLeft] = useState<string>('—');
  const [timeLeft, setTimeLeft] = useState<string>('—');

  // Toggle for “navigation mode”
  const [navigationActive, setNavigationActive] = useState<boolean>(false);

  /**
   * Helper: text-to-speech for step instructions
   */
  const speak = (text: string) => {
    if (!window.speechSynthesis) return; // not supported
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1; // normal speed
    window.speechSynthesis.speak(utter);
  };

  /**
   * Initialize map once
   */
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [11.255, 43.77], // for example: Florence
      zoom: 13,
    });
    mapRef.current = map;

    // Add a GeolocateControl for continuous user tracking
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
    });

    map.addControl(geolocateControl, 'top-right');

    // Trigger geolocation once the control is added (optional).
    // This will prompt the user for location permission.
    map.once('load', () => {
      geolocateControl.trigger();
    });

    // Listen for geolocate events
    geolocateControl.on('geolocate', (position) => {
      const { latitude, longitude } = position.coords;
      const newLoc = { lat: latitude, lng: longitude };
      setUserLocation(newLoc);

      // If userMarker doesn't exist, add it
      if (!userMarkerRef.current) {
        userMarkerRef.current = new mapboxgl.Marker({ color: 'blue' })
          .setLngLat([longitude, latitude])
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat([longitude, latitude]);
      }

      // If navigation is active, keep the map centered on the user
      if (navigationActive) {
        map.easeTo({
          center: [longitude, latitude],
          duration: 1000,
        });
      }
    });

    // On map click, set start/end
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      const pt = { lng, lat };

      if (!startPointRef.current) {
        startPointRef.current = pt;
        setStartPoint(pt);
        startMarkerRef.current = new mapboxgl.Marker({ color: 'green' })
          .setLngLat([pt.lng, pt.lat])
          .addTo(map);
      } else if (!endPointRef.current) {
        endPointRef.current = pt;
        setEndPoint(pt);
        endMarkerRef.current = new mapboxgl.Marker({ color: 'red' })
          .setLngLat([pt.lng, pt.lat])
          .addTo(map);
      }
    });
  }, [navigationActive]);

  /**
   * Fetch a walking/hiking route from OpenRouteService
   */
  const fetchRoute = async () => {
    if (!startPointRef.current || !endPointRef.current) return;

    try {
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
              [startPointRef.current.lng, startPointRef.current.lat],
              [endPointRef.current.lng, endPointRef.current.lat],
            ],
          }),
        }
      );
      const data = await response.json();
      setRouteGeoJSON(data);

      // Parse steps
      const routeSteps: Step[] =
        data.features[0].properties.segments?.[0]?.steps?.map((s: Step) => ({
          instruction: s.instruction,
          distance: s.distance,
          duration: s.duration,
        })) || [];

      setSteps(routeSteps);
      setCurrentStepIndex(0);

      // Summary info
      const dist = data.features[0].properties.summary.distance; // meters
      const dur = data.features[0].properties.summary.duration; // seconds
      setDistanceLeft(`${(dist / 1000).toFixed(2)} km`);
      setTimeLeft(`${Math.round(dur / 60)} min`);

      // Add or update the route line on the map
      addRouteLayer(data);
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  /**
   * Add or update the route line on the map
   */
  const addRouteLayer = (data: string) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const sourceId = 'route';

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as GeoJSONSource).setData(data);
    } else {
      map.addSource(sourceId, { type: 'geojson', data });
      map.addLayer({
        id: 'route',
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#3887be',
          'line-width': 5,
        },
      });
    }
  };

  /**
   * Start “navigation mode”:
   *  - tilt the map
   *  - keep recentering on user
   *  - speak initial instruction if desired
   */
  const startNavigation = () => {
    if (!routeGeoJSON || steps.length === 0) return;
    if (!mapRef.current) return;

    setNavigationActive(true);

    // Pitch the map for a 3D-like effect
    mapRef.current.easeTo({
      pitch: 45,
      bearing: 0,
      duration: 1000,
    });

    // Immediately speak the first step if it exists
    if (steps[0]?.instruction) {
      speak(steps[0].instruction);
    }
  };

  /**
   * Each time userLocation changes, if navigation is active, check progress
   * and speak next instruction if we pass certain thresholds.
   */
  useEffect(() => {
    if (!navigationActive || !userLocation) return;
    if (steps.length === 0) return;

    // For a real app, you'd calculate how far you are along each step,
    // and when you pass the next step's start, increment the step index
    // and speak the instruction. For now, we do a simple placeholder approach.
    checkProgressToNextStep();
  }, [userLocation, navigationActive]);

  /**
   * Demo: automatically advance steps after some short threshold
   * (In a real app, you'd measure distance to step endpoints or use map matching)
   */
  const checkProgressToNextStep = () => {
    if (currentStepIndex >= steps.length - 1) return; // no more steps

    // In a real scenario, you'd do:
    // 1. Measure distance from userLocation to the next step's end
    // 2. If distance < some threshold, setCurrentStepIndex(...)

    // For a demonstration, we just automatically advance after ~5 seconds of movement
    // or some arbitrary condition. We'll do a trivial setTimeout once we start navigation.
    // This is just to show the TTS.

    // Example: automatically go to next step after 10 seconds:
    setTimeout(() => {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length) {
        setCurrentStepIndex(nextIndex);
        // Speak the next step
        speak(steps[nextIndex].instruction);

        // Also update distance/time left
        updateDistanceTimeLeft(nextIndex);
      }
    }, 10000);
  };

  /**
   * Recalculate distance/time left from a certain step index onward
   */
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

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      {/* Map Container */}
      <div ref={mapContainer} style={{ height: '100%', width: '100%' }} />

      {/* UI Overlay (Top-Left) */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'white',
          padding: '10px',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          width: '220px',
        }}
      >
        <p>
          <strong>Select Start & End by clicking the map</strong>
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
        <button
          onClick={fetchRoute}
          disabled={!startPoint || !endPoint || navigationActive}
        >
          Get Route
        </button>
        <button
          onClick={startNavigation}
          disabled={!routeGeoJSON || navigationActive}
          style={{ marginLeft: '10px' }}
        >
          Start Nav
        </button>
      </div>

      {/* Navigation Overlay (Bottom) */}
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

export default MapNavigation;
