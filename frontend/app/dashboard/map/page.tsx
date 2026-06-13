'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/CrimeMap'), { ssr: false, loading: () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:16 }}>
    <div className="spinner" style={{ width:40, height:40 }} />
    <div style={{ color:'var(--text-muted)' }}>Loading Karnataka Map...</div>
  </div>
) });

const CRIME_TYPES = ['All','Murder','Robbery','Theft','Cybercrime','Assault','Fraud','Drug Offense','Kidnapping','POCSO','Domestic Violence'];
const YEARS = [0,2018,2019,2020,2021,2022,2023,2024];

export default function MapPage() {
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [districtData, setDistrictData] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(0);
  const [selectedCrime, setSelectedCrime] = useState('All');
  const [showStations, setShowStations] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [hd, dd, st] = await Promise.all([
      api.getHeatmapData(selectedYear || undefined, selectedCrime !== 'All' ? selectedCrime : undefined),
      api.getByDistrict(selectedYear || undefined, selectedCrime !== 'All' ? selectedCrime : undefined),
      api.getStations(),
    ]);
    setHeatmapData(hd); setDistrictData(dd); setStations(st);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [selectedYear, selectedCrime]);

  const maxCount = Math.max(...districtData.map((d: any) => d.total), 1);

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span className="page-icon">🗺️</span>Crime Heatmap — Karnataka</div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <select className="filter-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            <option value={0}>All Years</option>
            {YEARS.filter(y => y > 0).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="filter-select" value={selectedCrime} onChange={e => setSelectedCrime(e.target.value)}>
            {CRIME_TYPES.map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-secondary)', cursor:'pointer' }}>
            <input type="checkbox" checked={showStations} onChange={e => setShowStations(e.target.checked)} />
            Show Stations
          </label>
        </div>
      </div>

      <div className="page-content" style={{ padding:16 }}>
        <div style={{ display:'flex', gap:16 }}>
          {/* Map */}
          <div className="glass-card map-wrap" style={{ flex:1, height:'calc(100vh - 180px)', overflow:'hidden', position:'relative' }}>
            {loading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:16 }}>
                <div className="spinner" style={{ width:40,height:40 }} />
                <div style={{ color:'var(--text-muted)' }}>Loading map data...</div>
              </div>
            ) : (
              <MapComponent heatmapData={heatmapData} districtData={districtData} stations={showStations ? stations : []} />
            )}
          </div>

          {/* District Ranking */}
          <div className="glass-card" style={{ width:280, padding:'20px 0', overflowY:'auto', height:'calc(100vh - 180px)' }}>
            <div style={{ padding:'0 20px 12px', borderBottom:'1px solid var(--border)', marginBottom:8 }}>
              <div className="chart-title" style={{ marginBottom:4 }}>🏆 District Ranking</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                {selectedYear ? selectedYear : 'All years'} · {selectedCrime}
              </div>
            </div>
            {districtData.map((d: any, i: number) => {
              const pct = Math.round((d.total / maxCount) * 100);
              const color = pct > 70 ? 'var(--danger)' : pct > 40 ? 'var(--warning)' : pct > 20 ? 'var(--accent)' : 'var(--success)';
              return (
                <div key={d.district} style={{ padding:'8px 20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:10, color:'var(--text-muted)', width:18 }}>#{i+1}</span>
                      {d.district}
                    </span>
                    <span style={{ fontSize:12, color, fontWeight:700 }}>{d.total?.toLocaleString()}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width:`${pct}%`, background:color }} />
                  </div>
                  {d.critical > 0 && (
                    <div style={{ fontSize:10, color:'var(--danger)', marginTop:2 }}>🔴 {d.critical} critical</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
