import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

const C = {
    bg: "#0a0e1a",
    card: "#141d2e",
    border: "#1e2d45",
    accent: "#3b82f6",
    teal: "#06b6d4",
    green: "#10b981",
    text: "#f1f5f9",
    muted: "#64748b",
    subtle: "#94a3b8",
};

// ── Parking slot markers data ────────────────────────────────
const PARKING_SLOTS = [
    {
        id: "P1",
        lat: 27.7172,
        lng: 85.3240,
        color: C.green,
        status: "Available",
        slots: 5,
    },
    {
        id: "P2",
        lat: 27.7155,
        lng: 85.3260,
        color: C.accent,
        status: "Reserved",
        slots: 2,
    },
    {
        id: "P3",
        lat: 27.7180,
        lng: 85.3220,
        color: C.green,
        status: "Available",
        slots: 8,
    },
];

// ── Google Maps dark style (matches your dark theme) ─────────
const DARK_MAP_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#0a0e1a" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0a0e1a" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#1e2d45" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#141d2e" }],
    },
    {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#64748b" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#1e3a5f" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#0a1628" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#3b82f6" }],
    },
    {
        featureType: "poi",
        elementType: "geometry",
        stylers: [{ color: "#111827" }],
    },
    {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#0d1b2e" }],
    },
    {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#141d2e" }],
    },
    {
        featureType: "administrative",
        elementType: "geometry",
        stylers: [{ color: "#1e2d45" }],
    },
    {
        featureType: "administrative.country",
        elementType: "labels.text.fill",
        stylers: [{ color: "#94a3b8" }],
    },
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#64748b" }],
    },
];

// ── OPTION A: Real Google Map ─────────────────────────────────
// Replace "YOUR_GOOGLE_MAPS_API_KEY" with your actual key
// Get one free at: https://console.cloud.google.com
const GOOGLE_MAPS_API_KEY = "AIzaSyAEtMuTf9YLh651QHd7xLqBm6gGHIkgp-o";

export function MiniMapGoogle({ height = 260, iotSlots }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);

    const updateMarkers = () => {
        if (!mapInstanceRef.current || !window.google) return;

        // Clear existing markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const currentSlots = PARKING_SLOTS.map((slot) => {
            if (slot.id === "P1" && iotSlots) {
                const availableCount = Object.values(iotSlots).filter((v) => v === 0).length;
                return {
                    ...slot,
                    slots: availableCount,
                    status: availableCount > 0 ? "Available" : "Full",
                    color: availableCount > 0 ? C.green : C.red,
                };
            }
            return slot;
        });

        currentSlots.forEach((slot) => {
            const svgMarker = {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: slot.color,
                fillOpacity: 0.9,
                strokeColor: slot.color,
                strokeWeight: 2,
            };

            const marker = new window.google.maps.Marker({
                position: { lat: slot.lat, lng: slot.lng },
                map: mapInstanceRef.current,
                icon: svgMarker,
                title: slot.id,
            });

            const infoWindow = new window.google.maps.InfoWindow({
                content: `
            <div style="
              background: #141d2e;
              color: #f1f5f9;
              padding: 10px 14px;
              border-radius: 10px;
              border: 1px solid #1e2d45;
              font-family: Inter, sans-serif;
              min-width: 140px;
            ">
              <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">
                Slot ${slot.id}
              </div>
              <div style="color: ${slot.color}; font-size: 12px; font-weight: 600;">
                ● ${slot.status}
              </div>
              <div style="color: #64748b; font-size: 11px; margin-top: 4px;">
                ${slot.slots} spaces available
              </div>
            </div>
          `,
            });

            marker.addListener("click", () => {
                infoWindow.open(mapInstanceRef.current, marker);
            });

            markersRef.current.push(marker);
        });
    };

    useEffect(() => {
        // Load Google Maps script dynamically
        if (!window.google) {
            const existingScript = document.getElementById("google-maps-script");
            if (!existingScript) {
                const script = document.createElement("script");
                script.id = "google-maps-script";
                script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
                script.async = true;
                script.defer = true;
                script.onload = initMap;
                document.head.appendChild(script);
            } else {
                existingScript.addEventListener("load", initMap);
            }
        } else {
            initMap();
        }

        function initMap() {
            if (!mapRef.current || mapInstanceRef.current) return;

            const map = new window.google.maps.Map(mapRef.current, {
                center: { lat: 27.7172, lng: 85.3240 },
                zoom: 16,
                styles: DARK_MAP_STYLE,
                disableDefaultUI: true,
                zoomControl: true,
                zoomControlOptions: {
                    position: window.google.maps.ControlPosition.RIGHT_CENTER,
                },
                gestureHandling: "cooperative",
            });

            mapInstanceRef.current = map;
            updateMarkers();
        }

        return () => {
            mapInstanceRef.current = null;
        };
    }, []);

    useEffect(() => {
        updateMarkers();
    }, [iotSlots]);

    return (
        <div style={{
            borderRadius: 16, overflow: "hidden",
            border: `1px solid ${C.border}`, position: "relative",
            height,
        }}>
            <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

            <div style={{
                position: "absolute", bottom: 10, left: 10,
                background: C.card + "ee", borderRadius: 8,
                padding: "6px 10px", border: `1px solid ${C.border}`,
                backdropFilter: "blur(8px)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
                    <span style={{ color: C.subtle, fontSize: 10 }}>Available</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent }} />
                    <span style={{ color: C.subtle, fontSize: 10 }}>Reserved</span>
                </div>
            </div>
        </div>
    );
}

// ── OPTION B: OpenStreetMap (Free, No API Key needed) ─────────
// Uses Leaflet.js — run: npm install leaflet react-leaflet
export function MiniMapLeaflet({ height = 260, iotSlots }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersGroupRef = useRef(null);

    const updateMarkers = () => {
        if (!mapInstanceRef.current || !markersGroupRef.current) return;
        const L = window.L;
        if (!L) return;

        markersGroupRef.current.clearLayers();

        const currentSlots = PARKING_SLOTS.map((slot) => {
            if (slot.id === "P1" && iotSlots) {
                const availableCount = Object.values(iotSlots).filter((v) => v === 0).length;
                return {
                    ...slot,
                    slots: availableCount,
                    status: availableCount > 0 ? "Available" : "Full",
                    color: availableCount > 0 ? C.green : C.red,
                };
            }
            return slot;
        });

        currentSlots.forEach((slot) => {
            const circle = L.circleMarker([slot.lat, slot.lng], {
                radius: 10,
                fillColor: slot.color,
                color: slot.color,
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8,
            }).addTo(markersGroupRef.current);

            circle.bindPopup(`
          <div style="
            background: #141d2e;
            color: #f1f5f9;
            padding: 8px 12px;
            border-radius: 8px;
            font-family: Inter, sans-serif;
          ">
            <b style="font-size:14px">Slot ${slot.id}</b><br/>
            <span style="color:${slot.color}; font-size:12px">● ${slot.status}</span><br/>
            <span style="color:#64748b; font-size:11px">${slot.slots} spaces available</span>
          </div>
        `, {
                className: "dark-popup",
            });
        });
    };

    useEffect(() => {
        // Dynamically load Leaflet CSS
        if (!document.getElementById("leaflet-css")) {
            const link = document.createElement("link");
            link.id = "leaflet-css";
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            document.head.appendChild(link);
        }

        // Dynamically load Leaflet JS
        if (!window.L) {
            const script = document.createElement("script");
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.async = true;
            script.onload = initLeaflet;
            document.head.appendChild(script);
        } else {
            initLeaflet();
        }

        function initLeaflet() {
            if (!mapRef.current || mapInstanceRef.current) return;

            const L = window.L;

            // Create map centered at Kathmandu
            const map = L.map(mapRef.current, {
                center: [27.7172, 85.3240],
                zoom: 16,
                zoomControl: true,
            });

            mapInstanceRef.current = map;

            // Dark tile layer (free, no API key)
            L.tileLayer(
                "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
                {
                    attribution: '© OpenStreetMap © CARTO',
                    maxZoom: 19,
                }
            ).addTo(map);

            // Set up markers layer group
            markersGroupRef.current = L.layerGroup().addTo(map);

            // Add parking labels once
            PARKING_SLOTS.forEach((slot) => {
                L.tooltip({
                    permanent: true,
                    direction: "top",
                    className: "parking-label",
                    offset: [0, -14],
                })
                    .setContent(slot.id)
                    .setLatLng([slot.lat, slot.lng])
                    .addTo(map);
            });

            // Initial marker render
            updateMarkers();
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
            markersGroupRef.current = null;
        };
    }, []);

    useEffect(() => {
        updateMarkers();
    }, [iotSlots]);

    return (
        <div style={{
            borderRadius: 16, overflow: "hidden",
            border: `1px solid ${C.border}`, position: "relative",
            height,
        }}>
            <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

            {/* Legend */}
            <div style={{
                position: "absolute", bottom: 30, left: 10, zIndex: 1000,
                background: C.card + "ee", borderRadius: 8,
                padding: "6px 10px", border: `1px solid ${C.border}`,
                backdropFilter: "blur(8px)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
                    <span style={{ color: C.subtle, fontSize: 10 }}>Available</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent }} />
                    <span style={{ color: C.subtle, fontSize: 10 }}>Reserved</span>
                </div>
            </div>
        </div>
    );
}

// ── Default export: use Leaflet (no API key needed) ───────────
export default MiniMapLeaflet;