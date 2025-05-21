mapboxgl.accessToken = 'pk.eyJ1IjoieWwzIiwiYSI6ImNtN2txZGc2czAzYjMybXNka3ZsbTl5cmQifQ.kV4cU6Id_aGZM7R1HiudwA';

const LONDON_COORDS = [-0.1276, 51.5072];
let visitorsData = {};
let particles = [];
let routes = [];
let animationId;
let map;

function interpolateArcCoords(from, to, t) {
    const lng = from[0] + (to[0] - from[0]) * t;
    const lat = from[1] + (to[1] - from[1]) * t;
    return [lng, lat]; 
  }
  

function generateArcLine(from, to, steps = 60) {
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    coords.push(interpolateArcCoords(from, to, i / steps));
  }
  return coords;
}


function startAnimation() {
  function animate() {
    const now = performance.now();
    const SPEED = 20.00; 

    function computeDuration(from, to) {
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const dist = Math.sqrt(dx * dx + dy * dy); 
        return dist / SPEED * 1000; 
    }


    for (const route of routes) {
      if (now - route.lastEmit > route.emitInterval) {
        route.lastEmit = now;
        const PARTICLE_SPEED = 0.02;  
        const dx = route.to[0] - route.from[0];
        const dy = route.to[1] - route.from[1];
        const distance = Math.sqrt(dx * dx + dy * dy);
        const duration = distance / PARTICLE_SPEED;
        
        particles.push({
          from: route.from,
          to: route.to,
          startTime: now,
          duration,
          color: route.color
        });
        
      }
    }

    const updated = {
      type: 'FeatureCollection',
      features: []
    };

    const newParticles = [];
    for (const p of particles) {
      const t = (now - p.startTime) / p.duration;
      if (t <= 1) {
        const PARTICLE_LENGTH_MS = 100;  
        const progressNow = now - p.startTime;
        const progressPast = Math.max(0, progressNow - PARTICLE_LENGTH_MS);
        const tNow = progressNow / p.duration;
        const tPast = progressPast / p.duration;
        
        const [lng, lat] = interpolateArcCoords(p.from, p.to, tNow);
        const prev = interpolateArcCoords(p.from, p.to, tPast);
              
        updated.features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [prev, [lng, lat]]
          },
          properties: {
            color: p.color,
            opacity: 1 - t
          }
        });        
        newParticles.push(p);
      }
    }

    particles = newParticles;

    if (map.getSource('particles')) {
      map.getSource('particles').setData(updated);
    }

    animationId = requestAnimationFrame(animate);
  }

  animationId = requestAnimationFrame(animate);
}

async function loadData() {
  const res = await fetch('https://raw.githubusercontent.com/YULI61/Group_visual/main/data/visitors.json');
  const raw = await res.json();
  visitorsData = {};

  raw.forEach(entry => {
    const year = entry.Year;
    if (!visitorsData[year]) visitorsData[year] = [];
    visitorsData[year].push({
      country: entry.Country,
      visitors: entry.Visitors != null ? entry.Visitors : 0,
      lat: entry.Latitude,
      lng: entry.Longitude
    });  
  });

  const years = Object.keys(visitorsData).sort();
  setupRoutes("2019");
}


function setupRoutes(year) {
  const data = visitorsData[year];
  const duplicated = [];

  data.forEach((entry, i) => {
    const from = [entry.lng, entry.lat];
    const to = LONDON_COORDS;
    const visitors = entry.visitors;
    const copies = visitors > 0 ? 
      Math.min(Math.max(1, Math.floor(visitors / 100)), 10) : 0; 

    for (let j = 0; j < copies; j++) {
      duplicated.push({
        from,
        to,
        visitors,
        emitInterval: 10000 / Math.max(1, copies),
        lastEmit: 0,
        color: 'rgb(87, 168, 245)'
      });
    }
  });

  routes = duplicated;


  const arcFeatures = [];
  const uniqueRoutes = new Map();
  duplicated.forEach(r => {
    const key = r.from.toString();
    if (!uniqueRoutes.has(key)) {
      uniqueRoutes.set(key, true);
      arcFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: generateArcLine(r.from, r.to)
        }
      });
    }
  });

  const arcLineData = {
    type: 'FeatureCollection',
    features: arcFeatures
  };

  if (!map.getSource('lines')) {
    map.addSource('lines', { type: 'geojson', data: arcLineData });
    map.addLayer({
      id: 'lines',
      type: 'line',
      source: 'lines',
      paint: {
        'line-color': 'rgb(50, 73, 150)',     
        'line-width': 2,
        'line-opacity': 0.8,
        'line-blur': 1            
      }      
    });
  } else {
    map.getSource('lines').setData(arcLineData);
  }

  if (!map.getSource('particles')) {
    map.addSource('particles', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    map.addLayer({
        id: 'particles',
        type: 'line',
        source: 'particles',
        paint: {
            'line-color': ['get', 'color'], 
            'line-opacity': ['get', 'opacity'],
            'line-width': 2,
            'line-blur': 1                
          }
          
      });
  }

  startAnimation();

}

map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [0, 48],        
    zoom: 3.6,                                    
  });

map.scrollZoom.disable();       
map.boxZoom.disable();          
map.doubleClickZoom.disable();  
map.touchZoomRotate.disable();  
map.keyboard.disable();         


map.once('load', () => {
  map.jumpTo({ center: [0, 48], zoom: 0.1 });

  map.easeTo({
    zoom: 3.6,
    duration: 3000,
    center: [0, 48]
  });

  loadData(); 

  setTimeout(() => {
    rotateGlobe();  
  }, 3200); 
});


function rotateGlobe() {
  let bearing = 0;

  function rotate() {
    bearing = (bearing + 0.02) % 360; 
    map.setBearing(bearing);
    requestAnimationFrame(rotate);
  }

  rotate();
}
