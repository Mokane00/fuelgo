import { useEffect, useState, useCallback } from 'react';
import { MapPin, Search, Star, Clock, Fuel, Navigation, Heart, X, ArrowRight, LocateFixed } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { stationsApi, favouritesApi } from '../api/api';
import { useToast } from '../context/ToastContext';
import { Badge } from '../components/ui/Badge';
import type { Station } from '../types';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';
const DEFAULT_CENTER = { lat: -29.3167, lng: 27.4833 }; // Maseru, Lesotho
const NEARBY_RADIUS = 10000; // 10 km

/** Haversine distance in km */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// ─── User location dot ────────────────────────────────────────────────────────
function UserLocationMarker({ pos }: { pos: GeolocationCoordinates }) {
  return (
    <AdvancedMarker position={{ lat: pos.latitude, lng: pos.longitude }} title="Your location" zIndex={999}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        background: '#4285F4', border: '3px solid white',
        boxShadow: '0 0 0 4px rgba(66,133,244,0.3)',
      }} />
    </AdvancedMarker>
  );
}

// ─── Google Places nearby gas stations ───────────────────────────────────────
interface PlaceMarker { placeId: string; name: string; lat: number; lng: number; vicinity: string }

function NearbyPlacesLayer({ userPos, fuelgoIds, onSelect }: {
  userPos: GeolocationCoordinates;
  fuelgoIds: Set<string>; // known station names to avoid duplicates
  onSelect: (p: PlaceMarker | null) => void;
}) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const [places, setPlaces] = useState<PlaceMarker[]>([]);

  useEffect(() => {
    if (!placesLib || !map) return;
    const svc = new placesLib.PlacesService(map);
    svc.nearbySearch({
      location: { lat: userPos.latitude, lng: userPos.longitude },
      radius: NEARBY_RADIUS,
      type: 'gas_station',
    }, (results, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) return;
      const filtered = results
        .filter(r => r.geometry?.location && !fuelgoIds.has((r.name ?? '').toLowerCase()))
        .map(r => ({
          placeId: r.place_id ?? '',
          name:    r.name ?? 'Filling Station',
          lat:     r.geometry!.location!.lat(),
          lng:     r.geometry!.location!.lng(),
          vicinity: r.vicinity ?? '',
        }));
      setPlaces(filtered);
    });
  }, [placesLib, map, userPos, fuelgoIds]);

  return (
    <>
      {places.map(p => (
        <AdvancedMarker
          key={p.placeId}
          position={{ lat: p.lat, lng: p.lng }}
          title={p.name}
          onClick={() => onSelect(p)}
        >
          {/* Grey pump icon to distinguish from FuelGO blue markers */}
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#6B7280', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            fontSize: 14,
          }}>⛽</div>
        </AdvancedMarker>
      ))}
    </>
  );
}

// ─── Directions renderer ──────────────────────────────────────────────────────
function DirectionsLayer({ destination, userPos, onResult }: {
  destination: Station | null;
  userPos: GeolocationCoordinates | null;
  onResult: (result: google.maps.DirectionsResult | null, status: string) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const [svc, setSvc] = useState<google.maps.DirectionsService | null>(null);
  const [renderer, setRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!routesLib || !map) return;
    const s = new routesLib.DirectionsService();
    const r = new routesLib.DirectionsRenderer({ suppressMarkers: false });
    r.setMap(map);
    setSvc(s);
    setRenderer(r);
    return () => { r.setMap(null); };
  }, [routesLib, map]);

  useEffect(() => {
    if (!svc || !renderer) return;
    if (!destination) { renderer.setMap(null); onResult(null, ''); return; }
    renderer.setMap(map);
    const origin = userPos
      ? new google.maps.LatLng(userPos.latitude, userPos.longitude)
      : new google.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
    svc.route({
      origin,
      destination: { lat: destination.latitude, lng: destination.longitude },
      travelMode: google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK' && result) { renderer.setDirections(result); onResult(result, status); }
      else { onResult(null, status); }
    });
  }, [svc, renderer, destination, userPos, map, onResult]);

  return null;
}

// ─── Map component ────────────────────────────────────────────────────────────
function StationsMap({ stations, selected, onSelect, routeTo, userPos, onRouteResult }: {
  stations: Station[];
  selected: Station | null;
  onSelect: (s: Station | null) => void;
  routeTo: Station | null;
  userPos: GeolocationCoordinates | null;
  onRouteResult: (r: google.maps.DirectionsResult | null, status: string) => void;
}) {
  const map = useMap();
  const [nearbySelected, setNearbySelected] = useState<PlaceMarker | null>(null);

  // Pan to selected FuelGO station
  useEffect(() => {
    if (!map || !selected || routeTo) return;
    map.panTo({ lat: selected.latitude, lng: selected.longitude });
    map.setZoom(15);
  }, [map, selected, routeTo]);

  // Pan to user on first fix
  useEffect(() => {
    if (!map || !userPos || routeTo) return;
    map.panTo({ lat: userPos.latitude, lng: userPos.longitude });
    map.setZoom(14);
  }, [map, userPos, routeTo]);  

  const knownNames = new Set(stations.map(s => s.name.toLowerCase()));

  return (
    <>
      {/* User location dot */}
      {userPos && <UserLocationMarker pos={userPos} />}

      {/* Nearby Places stations not yet in the database */}
      {userPos && !routeTo && (
        <NearbyPlacesLayer
          userPos={userPos}
          fuelgoIds={knownNames}
          onSelect={p => { setNearbySelected(p); onSelect(null); }}
        />
      )}

      {/* Database stations */}
      {!routeTo && stations.map(s => (
        <AdvancedMarker
          key={s.id}
          position={{ lat: s.latitude, lng: s.longitude }}
          onClick={() => { onSelect(s); setNearbySelected(null); }}
          title={s.name}
        >
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#1A3C6E', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            fontSize: 14,
          }}>⛽</div>
        </AdvancedMarker>
      ))}

      {/* Database station info window */}
      {!routeTo && selected && (
        <InfoWindow
          position={{ lat: selected.latitude, lng: selected.longitude }}
          onCloseClick={() => onSelect(null)}
          headerContent={<strong>{selected.name}</strong>}
        >
          <div className="text-sm space-y-1 max-w-48">
            <p className="text-gray-600">{selected.address}, {selected.city}</p>
            {selected.operating_hours && <p className="text-gray-500">🕐 {selected.operating_hours}</p>}
            {selected.avg_rating && <p className="text-gray-600">⭐ {selected.avg_rating.toFixed(1)}</p>}
          </div>
        </InfoWindow>
      )}

      {/* Google Maps station info window */}
      {!routeTo && nearbySelected && (
        <InfoWindow
          position={{ lat: nearbySelected.lat, lng: nearbySelected.lng }}
          onCloseClick={() => setNearbySelected(null)}
          headerContent={<strong>{nearbySelected.name}</strong>}
        >
          <div className="text-sm space-y-1 max-w-48">
            <p className="text-gray-600">{nearbySelected.vicinity}</p>
          </div>
        </InfoWindow>
      )}

      <DirectionsLayer destination={routeTo} userPos={userPos} onResult={onRouteResult} />
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Stations() {
  const toast = useToast();
  const [stations, setStations] = useState<Station[]>([]);
  const [filtered, setFiltered] = useState<Station[]>([]);
  const [selected, setSelected] = useState<Station | null>(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [favIds, setFavIds]     = useState<Set<number>>(new Set());
  const [userPos, setUserPos]   = useState<GeolocationCoordinates | null>(null);
  const [geoError, setGeoError] = useState('');

  const [routeTo, setRouteTo]           = useState<Station | null>(null);
  const [routeResult, setRouteResult]   = useState<google.maps.DirectionsResult | null>(null);
  const [routeError, setRouteError]     = useState('');
  const [routeLoading, setRouteLoading] = useState(false);

  // mapCenter is only used as the initial defaultCenter; panning is done via useMap() in StationsMap

  function withDistances(ss: Station[], coords: GeolocationCoordinates): Station[] {
    return ss
      .map(s => ({ ...s, distance_km: haversine(coords.latitude, coords.longitude, s.latitude, s.longitude) }))
      .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
  }

  useEffect(() => {
    Promise.all([
      stationsApi.list().catch(() => []),
      favouritesApi.list().catch(() => []),
    ]).then(([ss, favs]) => {
      setStations(ss as Station[]);
      setFiltered(ss as Station[]);
      setFavIds(new Set((favs as Station[]).map(f => f.id)));
    }).finally(() => setLoading(false));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserPos(pos.coords);
          setStations(prev => prev.length ? withDistances(prev, pos.coords) : prev);
          setFiltered(prev => prev.length ? withDistances(prev, pos.coords) : prev);
        },
        () => setGeoError('Location access denied — showing all stations'),
      );
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeoError('Geolocation not supported by your browser');
    }
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFiltered(q ? stations.filter(s =>
      s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
    ) : stations);
  }, [search, stations]);

  async function toggleFav(s: Station, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      if (favIds.has(s.id)) {
        await favouritesApi.remove(s.id);
        setFavIds(prev => { const n = new Set(prev); n.delete(s.id); return n; });
      } else {
        await favouritesApi.add(s.id);
        setFavIds(prev => new Set([...prev, s.id]));
      }
    } catch { toast('error', 'Could not update favourite'); }
  }

  function startRoute(s: Station, e: React.MouseEvent) {
    e.stopPropagation();
    setRouteResult(null); setRouteError(''); setRouteLoading(true);
    setRouteTo(s); setSelected(null);
  }

  function clearRoute() {
    setRouteTo(null); setRouteResult(null); setRouteError(''); setRouteLoading(false);
  }

  const handleRouteResult = useCallback((result: google.maps.DirectionsResult | null, status: string) => {
    setRouteLoading(false);
    if (result) { setRouteResult(result); setRouteError(''); }
    else if (status) { setRouteError(status === 'ZERO_RESULTS' ? 'No driving route found' : `Could not get directions (${status})`); }
  }, []);

  const leg = routeResult?.routes?.[0]?.legs?.[0];

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-9rem)] animate-fade-in">
      {/* Left panel */}
      <div className="lg:w-96 flex flex-col gap-3 overflow-hidden flex-shrink-0">
        {routeTo ? (
          /* Route panel */
          <div className="flex flex-col gap-3 overflow-hidden flex-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Route to</p>
                <p className="font-heading font-semibold text-gray-900 dark:text-white truncate">{routeTo.name}</p>
                {leg && <p className="text-sm text-primary dark:text-blue-300 mt-0.5">{leg.distance?.text} · {leg.duration?.text}</p>}
              </div>
              <button onClick={clearRoute} className="btn-ghost p-2 rounded-sm flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-1">
              {routeLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Calculating route…
                </div>
              )}
              {routeError && <div className="text-sm text-danger bg-danger/10 rounded-sm px-3 py-2">{routeError}</div>}
              {leg?.steps?.map((step, i) => (
                <div key={i} className="flex gap-3 px-2 py-2 rounded-sm hover:bg-surface-alt dark:hover:bg-bg/50 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ArrowRight className="w-3 h-3 text-primary dark:text-blue-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: step.instructions }} />
                    <p className="text-xs text-gray-400 mt-0.5">{step.distance?.text}</p>
                  </div>
                </div>
              ))}
              {!routeLoading && !routeError && !leg && <p className="text-sm text-gray-400 text-center py-6">Waiting for route…</p>}
            </div>
          </div>
        ) : (
          /* Station list */
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input id="station-search" name="search" className="input pl-9" placeholder="Search stations…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {userPos ? (
              <p className="text-xs text-success flex items-center gap-1">
                <LocateFixed className="w-3 h-3" /> Sorted by distance from your location
              </p>
            ) : geoError ? (
              <p className="text-xs text-warning flex items-center gap-1"><LocateFixed className="w-3 h-3" /> {geoError}</p>
            ) : (
              <p className="text-xs text-gray-400 flex items-center gap-1"><LocateFixed className="w-3 h-3 animate-pulse" /> Getting your location…</p>
            )}

            {/* Legend */}
            {userPos && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary inline-block" /> With fuel prices</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400 inline-block" /> Other nearby</span>
              </div>
            )}

            <p className="text-xs text-gray-400">{filtered.length} station{filtered.length !== 1 ? 's' : ''} found</p>

            <div className="overflow-y-auto space-y-2 flex-1">
              {loading ? [...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-24" />) : filtered.map(s => (
                <div key={s.id} onClick={() => setSelected(s)}
                  className={`card cursor-pointer hover:shadow-md transition-shadow border-2 ${selected?.id === s.id ? 'border-primary' : 'border-transparent'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-sm bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-primary dark:text-blue-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.address}, {s.city}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={s.is_active ? 'success' : 'danger'}>{s.is_active ? 'Open' : 'Closed'}</Badge>
                        {s.distance_km != null && (
                          <span className="flex items-center gap-1 text-xs text-primary dark:text-blue-300 font-medium">
                            <MapPin className="w-3 h-3" /> {fmtDist(s.distance_km)}
                          </span>
                        )}
                        {userPos && filtered[0]?.id === s.id && (
                          <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-medium">Nearest</span>
                        )}
                        {s.avg_rating && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Star className="w-3 h-3 text-warning" /> {s.avg_rating.toFixed(1)}
                          </span>
                        )}
                        {s.operating_hours && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" /> {s.operating_hours}
                          </span>
                        )}
                      </div>
                      {s.fuel_prices && s.fuel_prices.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {s.fuel_prices.map(fp => (
                            <span key={fp.fuel_type_id} className="flex items-center gap-1 text-xs bg-surface-alt dark:bg-bg px-2 py-0.5 rounded-full">
                              <Fuel className="w-3 h-3 text-accent" /> {fp.fuel_name}: M{fp.price_per_litre.toFixed(2)}/L
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={e => toggleFav(s, e)} className="p-1 text-gray-400 hover:text-accent transition-colors" title="Favourite">
                        <Heart className={`w-4 h-4 ${favIds.has(s.id) ? 'fill-accent text-accent' : ''}`} />
                      </button>
                      <button onClick={e => startRoute(s, e)} className="p-1 text-gray-400 hover:text-primary transition-colors" title="Get directions">
                        <Navigation className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 rounded-md overflow-hidden min-h-64">
        {MAPS_KEY ? (
          <APIProvider apiKey={MAPS_KEY}>
            <Map
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={13}
              mapId="fuelgo-map"
              style={{ width: '100%', height: '100%' }}
            >
              <StationsMap
                stations={filtered}
                selected={selected}
                onSelect={setSelected}
                routeTo={routeTo}
                userPos={userPos}
                onRouteResult={handleRouteResult}
              />
            </Map>
          </APIProvider>
        ) : (
          <div className="w-full h-full bg-surface-alt dark:bg-surface-dark flex items-center justify-center rounded-md">
            <div className="text-center text-gray-400">
              <MapPin className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Map unavailable (no API key)</p>
              <p className="text-xs mt-1">Set VITE_GOOGLE_MAPS_KEY in .env</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
