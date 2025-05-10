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

  const slider = document.getElementById("year-slider");
  const playBtn = document.getElementById("play-btn");
  
  slider.addEventListener("input", () => {
    const year = slider.value;
    cancelAnimationFrame(animationId);
    setupRoutes(year);
    updateBarChart(year); 
    document.getElementById("year-overlay").innerText = year;
  });
  
  slider.value = years[0];
  setupRoutes(years[0]);
  document.getElementById("year-overlay").innerText = years[0];

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

map.on('load', loadData);

map.addControl(new mapboxgl.NavigationControl({
    visualizePitch: true,
    showCompass: true,
    showZoom: true
}), 'top-right');
  


const playBtn = document.getElementById("play-btn");
const slider = document.getElementById("year-slider");
const display = document.getElementById("year-display");

let autoPlayTimer = null;
let playing = false;

playBtn.addEventListener("click", () => {
  playing = !playing;
  playBtn.textContent = playing ? '⏸' : '▶';

  if (playing) {
    autoPlayTimer = setInterval(() => {
      let currentYear = parseInt(slider.value);
      const nextYear = currentYear + 1 > 2020 ? 2002 : currentYear + 1;
      slider.value = nextYear;
      slider.dispatchEvent(new Event("input"));
    }, 3000);
  } else {
    clearInterval(autoPlayTimer);
  }
});


let showTotal = false;

document.getElementById('toggle-btn').addEventListener('click', () => {
  showTotal = !showTotal;

  if (showTotal) {
    document.getElementById('toggle-btn').textContent = 'Show Per Year';
    renderLineChart(); 
  } else {
    document.getElementById('toggle-btn').textContent = 'Show Total';
    startBarRace(); 
  }
});


let barChart = null;

let formattedData = [], allYears = [];

fetch('https://raw.githubusercontent.com/YULI61/Group_visual/main/data/bar_chart_data.json')
  .then(res => res.json())
  .then(data => {
    formattedData = data;
    allYears = [...new Set(data.map(d => d[1]))].sort((a, b) => a - b);
    startBarRace(); 
  });



  
function startBarRace() {
 
    if (barChart) {
        barChart.dispose();
      }
          
  
  let startIndex = 0;
  let startYear = allYears[startIndex];
  const updateFrequency = 2000;

  const chartDom = document.getElementById('stats-chart');
  barChart = echarts.init(chartDom);

  const option = {
    title: {
      text: 'Top 10 Visitor Countries per Year (000s)',
      textStyle: { color: '#fff' },
      left: 60,   
      top: 50  
    },
    grid: { top: 90, bottom: 30, left: 100, right: 80 },
    xAxis: {
      max: 'dataMax',
      axisLabel: {
        formatter: n => Math.round(n) + '',
        color: '#fff'
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(255,255,255,0.05)'
        }
      }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      axisLabel: {
        show: true,
        fontSize: 14,
        color: '#fff'
      },
      animationDuration: 300,
      animationDurationUpdate: 300
    },
    dataset: {
      source: formattedData.filter(d => d[1] === startYear)
    },
    series: [
      {
        realtimeSort: true,
        seriesLayoutBy: 'column',
        type: 'bar',
        encode: { x: 0, y: 3 },
        label: {
          show: true,
          position: 'right',
          valueAnimation: true,
          fontFamily: 'monospace',
          color: '#fff'
        },
        itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#A9CCE3' },
              { offset: 1, color: '#2980B9' }
            ]),
            shadowColor: 'rgba(0, 0, 0, 0.15)',
            shadowBlur: 6
          }
          
          
      }
    ],
    animationDuration: 0,
    animationDurationUpdate: updateFrequency,
    animationEasing: 'linear',
    animationEasingUpdate: 'linear',
  };

  barChart.setOption(option);

}

function updateBarChart(year) {
    if (!barChart) return;
    barChart.setOption({
      dataset: {
        source: formattedData.filter(d => d[1] === parseInt(year))
      },
    });
}
  



let totalByYear = {};
totalByYear = {
    2002: 11603.4,
    2003: 11695.8,
    2004: 13389.3,
    2005: 13892.6,
    2006: 15592.6,
    2007: 15339.8,
    2008: 14753.0,
    2009: 14211.3,
    2010: 14705.5,
    2011: 15289.5,
    2012: 15460.9,
    2013: 16810.8,
    2014: 17404.2,
    2015: 18581.1,
    2016: 19059.5,
    2017: 19827.8,
    2018: 19090.2,
    2019: 21713.5,
    2020: 3696.3
};

function renderLineChart() {
    if (barChart) {
      barChart.dispose();
    }
  
    const chartDom = document.getElementById("stats-chart");
    barChart = echarts.init(chartDom);
  
    const years = Object.keys(totalByYear);
    const values = years.map(year => totalByYear[year]);
  
    const option = {
      title: {
        text: 'Total Visitors Over Time (000s)',
        left: 60, 
        top: 50,  
        textStyle: {
          color: '#fff',
          fontSize: 18
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(50,50,50,0.7)',
        textStyle: {
          color: '#fff'
        },
        axisPointer: {
          type: 'line'
        },
        formatter: function (params) {
          const year = params[0].axisValue;
          const value = params[0].data;
          return `Year: ${year}<br/>Total: ${value}`;
        }
      },      
      grid: {
        top: 90,     
        bottom: 30,
        left: 80,
        right: 40
      },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: {
          color: '#fff',
          fontSize: 12
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255,255,255,0.05)'
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#fff',
          fontSize: 12
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255,255,255,0.05)'
          }
        }
      },
      series: [{
        data: values,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          color: '#6fa8dc',
          width: 3
        },
        itemStyle: {
          color: '#6fa8dc'
        },
        areaStyle: {
          color: 'rgba(111, 168, 220, 0.2)'
        }
      }],
      backgroundColor: 'transparent'
    };
  
    barChart.setOption(option);
  }
  