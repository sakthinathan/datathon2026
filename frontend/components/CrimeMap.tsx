'use client';
import { useEffect, useRef } from 'react';

interface Props {
  heatmapData: any[];
  districtData: any[];
  stations: any[];
  mapMode?: 'historical' | 'predictive';
}

const DISTRICT_COORDS: Record<string, [number, number]> = {
  "Bengaluru Urban": [12.9716, 77.5946],
  "Mysuru": [12.2958, 76.6394],
  "Hubballi-Dharwad": [15.3647, 75.1240],
  "Mangaluru": [12.9141, 74.8560],
  "Belagavi": [15.8497, 74.4977],
  "Kalaburagi": [17.3297, 76.8343],
  "Ballari": [15.1394, 76.9214],
  "Vijayapura": [16.8302, 75.7100],
  "Shivamogga": [13.9299, 75.5681],
  "Tumakuru": [13.3409, 77.1010],
  "Raichur": [16.2120, 77.3439],
  "Bidar": [17.9104, 77.5199],
  "Yadgir": [16.7710, 77.1384],
  "Dharwad": [15.4589, 75.0078],
  "Gadag": [15.4166, 75.6167],
  "Haveri": [14.7939, 75.4006],
  "Uttara Kannada": [14.7953, 74.6895],
  "Dakshina Kannada": [12.8438, 75.2479],
  "Udupi": [13.3409, 74.7421],
  "Chikkamagaluru": [13.3161, 75.7720],
  "Hassan": [13.0033, 76.1004],
  "Kodagu": [12.4244, 75.7382],
  "Mandya": [12.5218, 76.8951],
  "Chamarajanagar": [11.9261, 76.9442],
  "Ramanagara": [12.7157, 77.2819],
  "Chikkaballapur": [13.4355, 77.7315],
  "Kolar": [13.1367, 78.1292],
  "Bengaluru Rural": [13.1986, 77.7066],
  "Chitradurga": [14.2251, 76.4014],
  "Davanagere": [14.4644, 75.9218],
  "Koppal": [15.3508, 76.1549],
};

export default function CrimeMap({ heatmapData, districtData, stations, mapMode = 'historical' }: Props) {
  const mapRef = useRef<any>(null);
  const containerId = 'crime-map-container';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css');
      const container = document.getElementById(containerId);
      if (!container) return;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

      const map = L.map(containerId, { center: [15.0, 76.0], zoom: 7, zoomControl: true });
      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap ©CARTO', subdomains: 'abcd', maxZoom: 18
      }).addTo(map);

      const maxTotal = Math.max(...districtData.map((d: any) => d.total), 1);

      districtData.forEach((d: any) => {
        const coords = DISTRICT_COORDS[d.district];
        if (!coords) return;
        const ratio = d.total / maxTotal;
        const radius = 15000 + ratio * 45000;
        const color = ratio > 0.7 ? '#ef4444' : ratio > 0.4 ? '#f59e0b' : ratio > 0.2 ? '#6366f1' : '#22c55e';
        const opacity = 0.3 + ratio * 0.5;

        const circle = L.circle(coords, {
          radius,
          color,
          fillColor: color,
          fillOpacity: opacity,
          weight: 1.5,
          opacity: 0.8,
        }).addTo(map);

        const popupContent = mapMode === 'predictive' ? `
          <div style="font-family:Inter,sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:14px;margin-bottom:6px">🔮 ${d.district} (Forecast)</div>
            <div style="color:#6b7280;font-size:12px">Predicted Volume: <strong style="color:${color}">${d.total?.toLocaleString()}</strong></div>
            <div style="color:#6b7280;font-size:12px">Confidence: <strong>${Math.round((d.confidence || 0.8) * 100)}%</strong></div>
            <div style="color:#6b7280;font-size:12px">Trend: <strong style="color:${d.trend === 'Rising' ? '#ef4444' : '#22c55e'}">${d.trend || 'Stable'}</strong></div>
            <div style="color:#6b7280;font-size:12px">ML Model: <strong>${d.model || 'Ridge'}</strong></div>
          </div>
        ` : `
          <div style="font-family:Inter,sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:14px;margin-bottom:6px">${d.district}</div>
            <div style="color:#6b7280;font-size:12px">Total Crimes: <strong style="color:${color}">${d.total?.toLocaleString()}</strong></div>
            <div style="color:#6b7280;font-size:12px">Severity: ${ratio > 0.7 ? '🔴 High' : ratio > 0.4 ? '🟡 Medium' : '🟢 Low'}</div>
          </div>
        `;

        circle.bindPopup(popupContent, { className: 'dark-popup' });

        const icon = L.divIcon({
          html: `<div style="font-size:11px;font-weight:700;color:white;background:${color};padding:2px 6px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5)">${d.district.split(' ')[0]}</div>`,
          className: '', iconAnchor: [0, 0]
        });
        L.marker(coords, { icon }).addTo(map);
      });

      // Station markers
      stations.forEach((s: any) => {
        if (!s.lat || !s.lon) return;
        const icon = L.divIcon({
          html: `<div style="width:8px;height:8px;border-radius:50%;background:#38bdf8;border:1.5px solid rgba(255,255,255,0.5);box-shadow:0 0 6px rgba(56,189,248,0.8)"></div>`,
          className: '', iconAnchor: [4, 4]
        });
        const marker = L.marker([s.lat, s.lon], { icon }).addTo(map);
        marker.bindPopup(`<div style="font-family:Inter,sans-serif"><strong>${s.name}</strong><br/><span style="color:#6b7280;font-size:12px">${s.district}</span><br/><span style="font-size:11px">Solve rate: ${s.solve_rate}%</span></div>`);
      });

      // Legend
      const legend = (L.control as any)({ position: 'bottomleft' });
      legend.onAdd = () => {
        const div = L.DomUtil.create('div');
        const title = mapMode === 'predictive' ? 'Forecasted Severity' : 'Crime Intensity';
        div.innerHTML = `
          <div style="background:rgba(5,9,20,0.9);padding:12px 16px;border-radius:12px;border:1px solid rgba(99,102,241,0.3);font-family:Inter,sans-serif;font-size:12px;color:#f1f5f9">
            <div style="font-weight:700;margin-bottom:8px;color:#818cf8">${title}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><div style="width:12px;height:12px;border-radius:50%;background:#ef4444"></div>High / Critical</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><div style="width:12px;height:12px;border-radius:50%;background:#f59e0b"></div>Medium / Warning</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><div style="width:12px;height:12px;border-radius:50%;background:#6366f1"></div>Low-Medium</div>
            <div style="display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;border-radius:50%;background:#22c55e"></div>Low / Normal</div>
          </div>`;
        return div;
      };
      legend.addTo(map);
    });
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [heatmapData, districtData, stations]);

  return (
    <div id={containerId} style={{ width:'100%', height:'100%', borderRadius:'inherit' }} />
  );
}
