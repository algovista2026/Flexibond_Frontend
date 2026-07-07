import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Bar } from 'react-chartjs-2';
import { getSalespersonList, getGeoAnalytics, getZoneAnalysis, getFilters } from '../services/api';
import { FiUsers, FiMap, FiLayers, FiInfo, FiTrendingUp, FiGlobe } from 'react-icons/fi';
import GlobalSearch from '../components/GlobalSearch';
import NotificationPanel from '../components/NotificationPanel';
import ExportControls from '../components/ExportControls';
import ChartCard from '../components/ChartCard';
import { formatINRShort } from '../utils/numberFormat';

// Categorical palette for sales zones on the map / charts.
const ZONE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

// India Center Coordinates
const INDIA_CENTER = [20.5937, 78.9629];
const INDIA_ZOOM = 4;

// GeoJSON URL for India States - High reliability source
const INDIA_GEOJSON_URL = 'https://raw.githubusercontent.com/HindustanTimesLabs/shapefiles/master/india/states/india_states.json';

import { Skeleton } from '../components/Skeleton';

const Geographic = () => {
  const user = JSON.parse(localStorage.getItem('flexibond_user') || '{}');
  const [salespersons, setSalespersons] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNames, setSelectedNames] = useState([]);
  const [geoData, setGeoData] = useState({});
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('revenue');
  const [indiaGeoJSON, setIndiaGeoJSON] = useState(null);
  const [mapType, setMapType] = useState('normal'); // 'normal' or 'satellite'

  // Zone Analysis mode
  const [view, setView] = useState('salesperson'); // 'salesperson' | 'zone'
  const [zoneData, setZoneData] = useState(null);
  const [gradeFilter, setGradeFilter] = useState([]); // selected grades (OR)
  const [gradeOptions, setGradeOptions] = useState([]);
  const [zoneLoading, setZoneLoading] = useState(false);

  // Load available grades for the zone-mode filter
  useEffect(() => {
    getFilters()
      .then(res => setGradeOptions(res.data.data?.grades || []))
      .catch(err => console.error('Error loading grades:', err));
  }, []);

  // Fetch zone analysis whenever zone view is active or the grade filter changes
  useEffect(() => {
    if (view !== 'zone') return;
    const fetchZones = async () => {
      try {
        setZoneLoading(true);
        const res = await getZoneAnalysis(gradeFilter.length ? { grade: gradeFilter } : {});
        setZoneData(res.data.data);
      } catch (err) {
        console.error('Error fetching zone analysis:', err);
      } finally {
        setZoneLoading(false);
      }
    };
    fetchZones();
  }, [view, gradeFilter]);

  // Fetch GeoJSON once from local public folder
  useEffect(() => {
    fetch('/india.json')
      .then(res => res.json())
      .then(data => setIndiaGeoJSON(data))
      .catch(err => console.error('Error loading GeoJSON:', err));
  }, []);

  // Fetch Salesperson List
  useEffect(() => {
    const fetchList = async () => {
      try {
        setLoading(true);
        const res = await getSalespersonList({ sortBy: 'totalRevenue' });
        setSalespersons(res.data.data);
        // Default select top 2
        if (res.data.data.length > 0 && selectedNames.length === 0) {
          const defaults = res.data.data.slice(0, 2).map(s => s._id);
          setSelectedNames(defaults);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  // Fetch Geo Data for selected names
  useEffect(() => {
    const fetchGeoData = async () => {
      const newData = {};
      await Promise.all(selectedNames.map(async (name) => {
        try {
          const res = await getGeoAnalytics({ name });
          newData[name] = res.data.data;
        } catch (err) {
          console.error(`Error fetching geo data for ${name}:`, err);
        }
      }));
      setGeoData(newData);
    };

    if (selectedNames.length > 0) {
      fetchGeoData();
    }
  }, [selectedNames]);

  const filteredSP = useMemo(() => {
    return salespersons.filter(sp => sp._id.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [salespersons, searchTerm]);

  const toggleSelection = (name) => {
    setSelectedNames(prev => {
      if (prev.includes(name)) {
        return prev.filter(n => n !== name);
      }
      if (prev.length < 2) {
        return [...prev, name];
      }
      return [prev[1], name]; // Replace first if already 2
    });
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  // Normalization helper to handle common mismatches
  const normalizeStateName = (name) => {
    if (!name) return '';
    let n = name.trim().toLowerCase();
    n = n.replace(/&/g, 'and');
    n = n.replace(/[^a-z0-9]/g, ''); // Remove all special chars and spaces
    
    // Specific maps for remaining differences
    if (n.includes('andaman')) return 'andaman';
    if (n.includes('dadra') || n.includes('daman')) return 'dadra';
    if (n.includes('delhi')) return 'delhi';
    if (n.includes('puducherry') || n.includes('pondicherry')) return 'puducherry';
    if (n.includes('odisha') || n.includes('orissa')) return 'odisha';
    if (n.includes('telangana') || n.includes('telengana')) return 'telangana';
    if (n.includes('uttarakhand') || n.includes('uttaranchal')) return 'uttarakhand';
    if (n.includes('jammu')) return 'jammu';
    
    return n;
  };

  const getStyle = (stateName, data) => {
    if (!data || data.length === 0) return { fillColor: '#f8fafc', weight: 1, color: '#cbd5e1', fillOpacity: 0.4 };
    
    const normalizedName = normalizeStateName(stateName);
    const stateData = data.find(d => normalizeStateName(d._id) === normalizedName);
    
    if (stateData) {
      const val = metric === 'revenue' ? stateData.totalRevenue : stateData.totalQty;
      const max = Math.max(...data.map(d => metric === 'revenue' ? d.totalRevenue : d.totalQty), 1);
      // Colors: Sophisticated Blue scale
      const opacity = val > 0 ? 0.4 + (val / max) * 0.55 : 0.1;
      return {
        fillColor: '#3b82f6',
        weight: 1.5,
        opacity: 1,
        color: '#ffffff', 
        fillOpacity: opacity
      };
    }

    return {
      fillColor: '#f1f5f9',
      weight: 1,
      opacity: 1,
      color: '#e2e8f0',
      fillOpacity: 0.4
    };
  };

  // Map Legend Component
  const MapLegend = ({ data }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data.map(d => metric === 'revenue' ? d.totalRevenue : d.totalQty), 1);
    const steps = [0.2, 0.4, 0.6, 0.8, 1];
    
    return (
      <div className="map-legend shadow-sm">
        <div className="legend-title">{metric === 'revenue' ? 'Revenue' : 'Qty'} Scale</div>
        <div className="legend-items">
          {steps.map((s, i) => (
            <div key={i} className="legend-item">
              <div className="legend-color" style={{ background: '#3b82f6', opacity: 0.4 + s * 0.5 }}></div>
              <span>{metric === 'revenue' ? formatCurrency(max * s) : Math.round(max * s)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---- Zone Analysis derived data ----
  const zoneColorMap = useMemo(() => {
    const m = {};
    (zoneData?.zones || []).forEach((z, i) => { m[z._id] = ZONE_COLORS[i % ZONE_COLORS.length]; });
    return m;
  }, [zoneData]);

  const stateZoneMap = useMemo(() => {
    const m = {};
    (zoneData?.stateZone || []).forEach(s => { if (s.state) m[normalizeStateName(s.state)] = s.zone; });
    return m;
  }, [zoneData]);

  const getZoneStyle = (stateName) => {
    const zone = stateZoneMap[normalizeStateName(stateName)];
    if (zone && zoneColorMap[zone]) {
      return { fillColor: zoneColorMap[zone], weight: 1.5, opacity: 1, color: '#ffffff', fillOpacity: 0.75 };
    }
    return { fillColor: '#f1f5f9', weight: 1, opacity: 1, color: '#e2e8f0', fillOpacity: 0.4 };
  };

  // Revenue-by-zone bar
  const zoneBarData = {
    labels: (zoneData?.zones || []).map(z => z._id),
    datasets: [{
      label: 'Revenue',
      data: (zoneData?.zones || []).map(z => z.totalRevenue),
      backgroundColor: (zoneData?.zones || []).map(z => zoneColorMap[z._id]),
      borderRadius: 6
    }]
  };

  // Zone x grade stacked bar
  const zoneGradeGrades = [...new Set((zoneData?.zoneGrade || []).map(g => g.grade))];
  const zoneGradeZones = (zoneData?.zones || []).map(z => z._id);
  const zoneGradeData = {
    labels: zoneGradeZones,
    datasets: zoneGradeGrades.map((grade, i) => ({
      label: grade,
      data: zoneGradeZones.map(zone => {
        const cell = (zoneData?.zoneGrade || []).find(g => g.zone === zone && g.grade === grade);
        return cell ? cell.revenue : 0;
      }),
      backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length],
      borderRadius: 4
    }))
  };

  const currencyTooltip = { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${formatCurrency(ctx.raw)}` } };
  const currencyScale = { ticks: { callback: v => formatINRShort(v) } };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Geographic Intelligence</h1>
          <p>{view === 'zone' ? 'Compare sales zones across India — top sellers, revenue and grade mix.' : 'Compare salesperson reach and market penetration across India.'}</p>
        </div>
        <div className="page-controls">
          <div className="metric-toggle" style={{ marginRight: '12px' }}>
            <button
              className={view === 'salesperson' ? 'active' : ''}
              onClick={() => setView('salesperson')}
            >
              <FiUsers style={{ marginRight: 6 }} /> Salesperson
            </button>
            <button
              className={view === 'zone' ? 'active' : ''}
              onClick={() => setView('zone')}
            >
              <FiGlobe style={{ marginRight: 6 }} /> Zone Analysis
            </button>
          </div>

          {view === 'salesperson' && (
            <div className="metric-toggle" style={{ marginRight: '12px' }}>
              <button
                className={metric === 'revenue' ? 'active' : ''}
                onClick={() => setMetric('revenue')}
              >
                Revenue
              </button>
              <button
                className={metric === 'qty' ? 'active' : ''}
                onClick={() => setMetric('qty')}
              >
                Quantity
              </button>
            </div>
          )}

          <div className="metric-toggle">
            <button
              className={mapType === 'normal' ? 'active' : ''}
              onClick={() => setMapType('normal')}
              title="Normal View"
            >
              <FiMap style={{ marginRight: 6 }} /> Atlas
            </button>
            <button
              className={mapType === 'satellite' ? 'active' : ''}
              onClick={() => setMapType('satellite')}
              title="Satellite View"
            >
              <FiLayers style={{ marginRight: 6 }} /> Satellite
            </button>
          </div>

          <ExportControls pageTitle="Geographic_Analytics" />
          {user.role === 'admin' && <NotificationPanel />}
        </div>
      </div>

      {view === 'salesperson' && (<>
      {/* Horizontal Selection Bar */}
      <div className="selection-bar-card shadow-sm">
        <div className="selection-header">
          <div className="selection-title">
            <FiUsers />
            <span>Select Salespersons to Compare ({selectedNames.length}/2)</span>
          </div>
          <div className="selection-search">
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="selection-chips">
          {loading && salespersons.length === 0 ? (
            [1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} style={{ width: '80px', height: '32px', borderRadius: '20px' }} />)
          ) : (
            filteredSP.map(sp => (
              <button 
                key={sp._id}
                className={`selection-chip ${selectedNames.includes(sp._id) ? 'active' : ''}`}
                onClick={() => toggleSelection(sp._id)}
              >
                {sp._id}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Maps Area Below */}
      <div className="geo-main">
        {loading && selectedNames.length === 0 ? (
          <Skeleton className="skeleton-chart" style={{ height: '100%' }} />
        ) : selectedNames.length === 0 ? (
          <div className="no-selection-placeholder">
            <FiMap className="placeholder-icon" />
            <h2>No Salesperson Selected</h2>
            <p>Please select up to 2 salespersons from the list above to view their geographic performance.</p>
          </div>
        ) : (
          <div className={`map-grid ${selectedNames.length === 1 ? 'single' : 'dual'}`}>
            {selectedNames.map(name => (
              <div key={name} className="map-card shadow-sm">
                <div className="map-header">
                  <h3>{name}</h3>
                  <div className="map-summary">
                    <span>States: {geoData[name]?.length || 0}</span>
                    <span>Total: {metric === 'revenue' ? formatCurrency(geoData[name]?.reduce((sum, d) => sum + d.totalRevenue, 0)) : geoData[name]?.reduce((sum, d) => sum + d.totalQty, 0)}</span>
                  </div>
                </div>
                <div className="map-container-wrapper">
                  {!indiaGeoJSON ? (
                    <Skeleton style={{ height: '100%', width: '100%' }} />
                  ) : (
                    <MapContainer center={INDIA_CENTER} zoom={INDIA_ZOOM} style={{ height: '100%', width: '100%' }}>
                      {mapType === 'normal' ? (
                        <TileLayer
                          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        />
                      ) : (
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          attribution='&copy; Esri'
                        />
                      )}
                      
                      <GeoJSON 
                        key={`${name}-${metric}-${mapType}-${geoData[name]?.length}`}
                        data={indiaGeoJSON} 
                        style={(feature) => getStyle(feature.properties.NAME_1 || feature.properties.ST_NM || feature.properties.state_name, geoData[name])}
                        onEachFeature={(feature, layer) => {
                          const stateName = feature.properties.NAME_1 || feature.properties.ST_NM || feature.properties.state_name;
                          const normalizedName = normalizeStateName(stateName);
                          const stateInfo = geoData[name]?.find(d => normalizeStateName(d._id) === normalizedName);
                          
                          if (stateInfo) {
                            const tooltipContent = `
                              <div class="map-tooltip">
                                <strong>${stateName}</strong>
                                <div class="stat-row"><span>${metric === 'revenue' ? 'Revenue' : 'Quantity'}:</span> <span>${metric === 'revenue' ? formatCurrency(stateInfo.totalRevenue) : stateInfo.totalQty}</span></div>
                                <div class="stat-row"><span>Orders:</span> <span>${stateInfo.totalOrders}</span></div>
                                <hr/>
                                <small>Top Cities:</small>
                                <ul class="tooltip-cities">
                                  ${stateInfo.cities.slice(0, 5).map(c => `<li><span>${c.city}</span> <span>${metric === 'revenue' ? formatCurrency(c.revenue) : c.qty}</span></li>`).join('')}
                                </ul>
                              </div>
                            `;
                            layer.bindTooltip(tooltipContent, { sticky: true, className: 'leaflet-custom-tooltip' });
                            
                            layer.on({
                              mouseover: (e) => {
                                const l = e.target;
                                l.setStyle({ weight: 2.5, color: '#1e40af', fillOpacity: 0.95 });
                                l.bringToFront();
                              },
                              mouseout: (e) => {
                                layer.setStyle(getStyle(stateName, geoData[name]));
                              }
                            });
                          } else {
                            layer.bindTooltip(`<strong>${stateName}</strong><br/>No active sales`, { sticky: true, className: 'leaflet-custom-tooltip' });
                          }
                        }}
                      />
                    </MapContainer>
                  )}
                  <MapLegend data={geoData[name]} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>)}

      {view === 'zone' && (
        <div className="zone-view">
          {/* Grade filter */}
          <div className="selection-bar-card shadow-sm">
            <div className="selection-header" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '12px' }}>
              <div className="selection-title">
                <FiGlobe />
                <span>Zone Comparison{gradeFilter.length ? ` · ${gradeFilter.join(', ')}` : ' · All Grades'}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Grade:</span>
                <button
                  className={`selection-chip ${gradeFilter.length === 0 ? 'active' : ''}`}
                  onClick={() => setGradeFilter([])}
                >All</button>
                {gradeOptions.map(g => (
                  <button
                    key={g}
                    className={`selection-chip ${gradeFilter.includes(g) ? 'active' : ''}`}
                    onClick={() => setGradeFilter(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                  >{g}</button>
                ))}
              </div>
            </div>
          </div>

          {zoneLoading && !zoneData ? (
            <Skeleton className="skeleton-chart" style={{ height: '500px' }} />
          ) : !zoneData || zoneData.zones.length === 0 ? (
            <div className="no-selection-placeholder" style={{ height: '400px' }}>
              <FiGlobe className="placeholder-icon" />
              <h2>No Zone Data</h2>
              <p>No segregated-format records with a zone match the current grade filter.</p>
            </div>
          ) : (
            <>
              {/* AI insight for zone comparison */}
              {/* Map + summary */}
              <div className="map-card shadow-sm" style={{ marginBottom: '24px', height: '520px' }}>
                <div className="map-header">
                  <h3>Sales Zones across India</h3>
                  <div className="map-summary">
                    <span>{zoneData.zones.length} zones</span>
                    <span>Total: {formatCurrency(zoneData.zones.reduce((s, z) => s + z.totalRevenue, 0))}</span>
                  </div>
                </div>
                <div className="map-container-wrapper">
                  {!indiaGeoJSON ? (
                    <Skeleton style={{ height: '100%', width: '100%' }} />
                  ) : (
                    <MapContainer center={INDIA_CENTER} zoom={INDIA_ZOOM} style={{ height: '100%', width: '100%' }}>
                      {mapType === 'normal' ? (
                        <TileLayer
                          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        />
                      ) : (
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          attribution='&copy; Esri'
                        />
                      )}
                      <GeoJSON
                        key={`zone-${mapType}-${zoneData.stateZone.length}-${gradeFilter.join(',')}`}
                        data={indiaGeoJSON}
                        style={(feature) => getZoneStyle(feature.properties.NAME_1 || feature.properties.ST_NM || feature.properties.state_name)}
                        onEachFeature={(feature, layer) => {
                          const stateName = feature.properties.NAME_1 || feature.properties.ST_NM || feature.properties.state_name;
                          const zone = stateZoneMap[normalizeStateName(stateName)];
                          if (zone) {
                            const zStat = zoneData.zones.find(z => z._id === zone);
                            const seller = zoneData.topSellerByZone?.[zone];
                            const tooltipContent = `
                              <div class="map-tooltip">
                                <strong>${stateName}</strong>
                                <div class="stat-row"><span>Zone:</span> <span>${zone}</span></div>
                                <div class="stat-row"><span>Zone Revenue:</span> <span>${formatCurrency(zStat?.totalRevenue || 0)}</span></div>
                                <hr/>
                                <small>Top Seller in Zone:</small>
                                <div class="stat-row"><span>${seller?.salesperson || '—'}</span> <span>${formatCurrency(seller?.revenue || 0)}</span></div>
                              </div>`;
                            layer.bindTooltip(tooltipContent, { sticky: true, className: 'leaflet-custom-tooltip' });
                            layer.on({
                              mouseover: (e) => { e.target.setStyle({ weight: 2.5, color: '#1e293b', fillOpacity: 0.95 }); e.target.bringToFront(); },
                              mouseout: (e) => { e.target.setStyle(getZoneStyle(stateName)); }
                            });
                          } else {
                            layer.bindTooltip(`<strong>${stateName}</strong><br/>No zone activity`, { sticky: true, className: 'leaflet-custom-tooltip' });
                          }
                        }}
                      />
                    </MapContainer>
                  )}
                  {/* Zone colour legend */}
                  <div className="map-legend shadow-sm">
                    <div className="legend-title">Zones</div>
                    <div className="legend-items">
                      {zoneData.zones.map(z => (
                        <div key={z._id} className="legend-item">
                          <div className="legend-color" style={{ background: zoneColorMap[z._id] }}></div>
                          <span>{z._id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="charts-grid" style={{ marginBottom: '24px' }}>
                <ChartCard title="Revenue by Zone" aiContext={zoneData.zones} aiType="Zone-wise Revenue Comparison">
                  <Bar
                    data={zoneBarData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: currencyTooltip },
                      scales: { y: currencyScale }
                    }}
                  />
                </ChartCard>

                <ChartCard title="Zone × Grade Revenue Mix" aiContext={zoneData.zoneGrade} aiType="Zone by Grade Revenue Breakdown">
                  <Bar
                    data={zoneGradeData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: currencyTooltip },
                      scales: { x: { stacked: true }, y: { stacked: true, ...currencyScale } }
                    }}
                  />
                </ChartCard>
              </div>

              {/* Top seller / top state per zone */}
              <div className="data-table-wrapper" style={{ marginBottom: '24px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Zone Leaders</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ minWidth: '600px' }}>
                    <thead>
                      <tr>
                        <th>Zone</th>
                        <th>Revenue</th>
                        <th>Orders</th>
                        <th>Customers</th>
                        <th>Top Salesperson</th>
                        <th>Top State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zoneData.zones.map((z, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: zoneColorMap[z._id] }}>{z._id}</td>
                          <td style={{ fontWeight: 600 }}>{formatCurrency(z.totalRevenue)}</td>
                          <td>{z.totalOrders}</td>
                          <td>{z.customerCount}</td>
                          <td>{zoneData.topSellerByZone?.[z._id]?.salesperson || '—'}</td>
                          <td>{zoneData.topStateByZone?.[z._id]?.state || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        .selection-bar-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
        }
        .selection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .selection-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          color: var(--text-primary);
          font-size: 1.1rem;
        }
        .selection-search input {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          width: 300px;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        .selection-search input:focus {
          outline: none;
          border-color: var(--primary-600);
          box-shadow: 0 0 0 3px var(--primary-50);
        }
        .selection-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .selection-chip {
          padding: 8px 20px;
          border-radius: 25px;
          border: 1px solid var(--border-color);
          background: white;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .selection-chip:hover {
          background: var(--bg-light);
          border-color: var(--text-secondary);
        }
        .selection-chip.active {
          background: var(--primary-50);
          color: var(--primary-700);
          border-color: var(--primary-600);
          box-shadow: 0 0 0 1px var(--primary-600);
        }

        .geo-main {
          height: calc(100vh - 400px);
          min-height: 500px;
        }
        .map-grid {
          display: grid;
          gap: 24px;
          height: 100%;
        }
        .map-grid.dual { grid-template-columns: 1fr 1fr; }
        .map-grid.single { grid-template-columns: 1fr; }
        
        .map-card {
          background: white;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .map-header {
          padding: 14px 20px;
          background: var(--bg-light);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .map-header h3 { font-size: 1rem; font-weight: 800; margin: 0; color: var(--primary-900); }
        .map-summary { display: flex; gap: 16px; font-size: 0.85rem; color: var(--text-secondary); font-weight: 600; }
        
        .map-container-wrapper {
          flex: 1;
          position: relative;
        }

        .no-selection-placeholder {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 12px;
          border: 2px dashed var(--border-color);
          color: var(--text-secondary);
          padding: 40px;
        }
        .placeholder-icon { font-size: 5rem; margin-bottom: 20px; opacity: 0.2; }

        .leaflet-custom-tooltip {
          background: rgba(255, 255, 255, 0.98) !important;
          border: 1px solid var(--primary-200) !important;
          border-radius: 10px !important;
          box-shadow: var(--shadow-lg) !important;
          padding: 14px !important;
          color: var(--text-primary) !important;
          min-width: 180px;
        }
        .map-tooltip strong { color: var(--primary-700); font-size: 1.1rem; display: block; margin-bottom: 4px; }
        .map-tooltip hr { margin: 8px 0; border: none; border-top: 1px solid var(--border-color); }
        
        .metric-toggle button {
          display: inline-flex;
          align-items: center;
          padding: 8px 18px;
          border: 1px solid var(--border-color);
          background: white;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.85rem;
          color: var(--text-secondary);
          transition: all 0.2s;
        }
        .metric-toggle button:first-child { border-radius: 8px 0 0 8px; border-right: none; }
        .metric-toggle button:last-child { border-radius: 0 8px 8px 0; }
        .metric-toggle button.active { background: var(--primary-600); color: white; border-color: var(--primary-600); }

        .map-legend {
          position: absolute;
          bottom: 20px;
          right: 20px;
          background: white;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          z-index: 1000;
          min-width: 140px;
        }
        .legend-title {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          margin-bottom: 2px;
        }
        .stat-row span:last-child {
          font-weight: 700;
          color: var(--primary-700);
        }
        .tooltip-cities {
          list-style: none;
          padding: 0;
          margin: 4px 0 0 0;
        }
        .tooltip-cities li {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-secondary);
          padding: 2px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .tooltip-cities li:last-child { border-bottom: none; }
      `}</style>
    </div>
  );
};

export default Geographic;
