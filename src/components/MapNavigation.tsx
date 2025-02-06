// src/components/MapNavigation.tsx
import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { Map, Marker, GeoJSONSource, LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/** A simple type for user-chosen points on the map. */
type Point = { lng: number; lat: number };

/** Hybrid style from MapTiler—replace key with your own if needed. */
const MAP_STYLE = 'https://api.maptiler.com/maps/streets-v2/style.json?key=GRskGJSJLjKz0f3Ah9hX';

/** Replace this with your own OpenRouteService API key. */
const ORS_API_KEY = '5b3ce3597851110001cf6248edbbde8ff61441a1a9500157e2b7ae93';

const MapNavigation: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  // State for displaying the chosen points and route in the UI
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const [routeGeoJSON, setRouteGeoJSON] = useState<unknown>(null);
  const [navigationActive, setNavigationActive] = useState<boolean>(false);

  // We also keep references to the points for the map click handler.
  const startPointRef = useRef<Point | null>(null);
  const endPointRef = useRef<Point | null>(null);

  // This will hold the route coordinates once we fetch them from OpenRouteService.
  const routeCoordsRef = useRef<[number, number][]>([]);
  
  // Marker for simulating “you are here” during navigation.
  const navigationMarkerRef = useRef<Marker | null>(null);

  // Variables to animate the marker along the route.
  const animationIndexRef = useRef<number>(0);
  const animationRef = useRef<number>();

  /** For demonstration, we’ll store placeholders for “time left” and “distance left.” */
  const [timeLeft, setTimeLeft] = useState('—');
  const [distanceLeft, setDistanceLeft] = useState('—');

  /** Initialize the map once (empty dependency array). */
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    // Create the map
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [11.255, 43.77],
      zoom: 13,
    });

    // Add a built-in geolocate control (optional)
    mapRef.current.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
        showUserLocation: true,
      }),
      'top-right'
    );

    // Handle clicks to set start/end points
    mapRef.current.on('click', (e) => {
      if (!startPointRef.current) {
        const pt = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        startPointRef.current = pt;
        setStartPoint(pt);

        new maplibregl.Marker({ color: 'green' })
          .setLngLat(pt)
          .addTo(mapRef.current!);

      } else if (!endPointRef.current) {
        const pt = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        endPointRef.current = pt;
        setEndPoint(pt);

        new maplibregl.Marker({ color: 'red' })
          .setLngLat(pt)
          .addTo(mapRef.current!);
      }
    });
  }, []);

  /** Cleanup any pending animation on unmount. */
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        window.clearTimeout(animationRef.current);
      }
    };
  }, []);

  /** Fetch route from OpenRouteService. */
  const fetchRoute = async () => {
    if (!startPointRef.current || !endPointRef.current) return;
    console.log('Fetching route...');

    try {
      const response = await fetch('https://api.openrouteservice.org/v2/directions/foot-hiking/geojson', {
        method: 'POST',
        headers: {
          'Authorization': ORS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coordinates: [
            [startPointRef.current.lng, startPointRef.current.lat],
            [endPointRef.current.lng, endPointRef.current.lat]
          ]
        })
      });
      const data = await response.json();
      console.log('Route data:', data);

      setRouteGeoJSON(data);

      // Extract coordinates as [lng, lat] tuples.
      const coords = data.features[0].geometry.coordinates.map((coord: number[]) => [coord[0], coord[1]]) as [number, number][];
      routeCoordsRef.current = coords;

      // Optionally parse distance/time from the response
      const distanceMeters = data.features[0].properties.summary.distance;
      const durationSeconds = data.features[0].properties.summary.duration;
      // Convert for display
      setDistanceLeft(`${(distanceMeters / 1000).toFixed(2)} km`);
      const mins = Math.round(durationSeconds / 60);
      setTimeLeft(`${mins} min`);

      // Add the route line on the map
      addRouteLayer(data);

    } catch (err) {
      console.error('Error fetching route:', err);
    }
  };

  /** Add or update the route layer on the map. */
  const addRouteLayer = (data: string) => {
    if (!mapRef.current) return;
    const sourceId = 'route';

    if (mapRef.current.getSource(sourceId)) {
      (mapRef.current.getSource(sourceId) as GeoJSONSource).setData(data);
    } else {
      mapRef.current.addSource(sourceId, { type: 'geojson', data });
      mapRef.current.addLayer({
        id: 'route',
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3887be', 'line-width': 5 }
      });
    }
  };

  /** Start a simulated navigation along the route. */
  const startNavigation = () => {
    if (!mapRef.current || routeCoordsRef.current.length === 0) return;

    console.log('Starting navigation...');
    setNavigationActive(true);

    // Tilt the map to a more 3D view
    mapRef.current.easeTo({
      center: routeCoordsRef.current[0],
      pitch: 45,      // tilt the map
      bearing: 0,     // set bearing if you like
      duration: 1000  // smooth animation
    });

    // Place a marker for “you are here” at the first coordinate
    animationIndexRef.current = 0;
    if (!navigationMarkerRef.current) {
      navigationMarkerRef.current = new maplibregl.Marker({ color: 'blue', draggable: true })
        .setLngLat(routeCoordsRef.current[0] as LngLatLike)
        .addTo(mapRef.current);
    } else {
      navigationMarkerRef.current.setLngLat(routeCoordsRef.current[0] as LngLatLike);
    }

    // Start animating
    animateMarker();
  };

  /** Recursively move the marker along the route coordinates. */
  const animateMarker = () => {
    if (!mapRef.current || !navigationMarkerRef.current) return;
    const coords = routeCoordsRef.current;

    if (animationIndexRef.current < coords.length) {
      const currentPoint = coords[animationIndexRef.current];

      // Move the marker
      navigationMarkerRef.current.setLngLat(currentPoint as LngLatLike);

      // Center the map on this point
      mapRef.current.easeTo({
        center: currentPoint as LngLatLike,
        duration: 500
      });

      animationIndexRef.current++;
      // Move again in 500ms (you can adjust this speed)
      animationRef.current = window.setTimeout(animateMarker, 500);

    } else {
      // Reached the end of the route
      setNavigationActive(false);
      if (animationRef.current) {
        window.clearTimeout(animationRef.current);
      }
    }
  };

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      {/* The Map container */}
      <div ref={mapContainer} style={{ height: '100%', width: '100%' }} />

      {/* A simple top-left UI panel */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'white',
          padding: '10px',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
        }}
      >
        <p><strong>Select Start and End Points</strong></p>

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
          disabled={!(startPoint && endPoint && !navigationActive)}
        >
          Get Route
        </button>
        
        <button
          onClick={startNavigation}
          disabled={!routeGeoJSON || navigationActive}
          style={{ marginLeft: '10px' }}
        >
          Start Navigation
        </button>
      </div>

      {/* A bottom “navigation UI” overlay, visible only when navigating */}
      {navigationActive && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div>
              <h3 style={{ margin: 0 }}>Time Left</h3>
              <p style={{ margin: 0 }}>{timeLeft}</p>
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Distance</h3>
              <p style={{ margin: 0 }}>{distanceLeft}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapNavigation;
