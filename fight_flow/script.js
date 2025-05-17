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
          color: route.color,
          width: route.width 
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

  const years = Object.keys(visitorsData).filter(y => y !== '2020').sort();


  const slider = document.getElementById("year-slider");
  const playBtn = document.getElementById("play-btn");
  
  // 在 script.js 的 loadData 函数中，确保更新逻辑正确
  slider.addEventListener("input", () => {
    const year = slider.value;
    cancelAnimationFrame(animationId);
    setupRoutes(year);
    updateBarChart(year); 
    document.getElementById("year-label").textContent = year; // 确保此行存在
  });
  slider.value = years[0];
  setupRoutes(years[0]);
  document.getElementById("year-label").textContent = years[0];

}




function setupRoutes(year) {
  const data = visitorsData[year];
  const duplicated = [];

  // 👉 添加：映射函数，自动将访客人数映射到 1-6 像素宽
  function scaleWidth(visitors, minVisitors = 100, maxVisitors = 3500, minW = 1, maxW = 15) {
    const clamped = Math.max(minVisitors, Math.min(visitors, maxVisitors));
    return ((clamped - minVisitors) / (maxVisitors - minVisitors)) * (maxW - minW) + minW;
  }

  data.forEach((entry, i) => {
    const from = [entry.lng, entry.lat];
    const to = LONDON_COORDS;
    const visitors = entry.visitors;
    const copies = visitors > 0 ? 
      Math.min(Math.max(1, Math.floor(visitors / 100)), 10) : 0;

    const width = scaleWidth(visitors);  // 👈 计算自动宽度

    for (let j = 0; j < copies; j++) {
      duplicated.push({
        from,
        to,
        visitors,
        emitInterval: 10000 / Math.max(1, copies),
        lastEmit: 0,
        color: '#f36b1c',
        width: width  // 👈 加入粒子宽度
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
        },
        properties: {
          width: r.width  // 👈 加入轨道宽度
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
        'line-color': '#8E6CFF',
        'line-width': ['get', 'width'],  // 👈 根据属性动态宽度
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
        'line-width': ['get', 'width'],  // 👈 粒子轨迹也动态宽度
        'line-blur': 1
      }
    });
  }

  startAnimation();
}

  

map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-10, 50],        
    zoom: 3.6,                                    
  });

map.on('load', loadData);

map.addControl(new mapboxgl.NavigationControl({
    visualizePitch: true,
    showCompass: true,
    showZoom: true
}), 'bottom-right');


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
      let nextYear = currentYear + 1 > 2023 ? 2002 : currentYear + 1;
      if (nextYear === 2020) nextYear = 2021;


      slider.value = nextYear;
      slider.dispatchEvent(new Event("input"));
    }, 3000);
  } else {
    clearInterval(autoPlayTimer);
  }
});

document.getElementById('play-btn').click();


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
      textStyle: { color: '#555555' ,
        // fontWeight: 'normal'
       },
      left: 60,   
      top: 10  
    },
    grid: { top: 50, bottom: 20, left: 80, right: 70 },
    xAxis: {
      max: 'dataMax',
      axisLabel: {
        formatter: n => Math.round(n) + '',
        color: '#555555'
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(55, 55, 55, 0.2)'
        }
      }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      axisLabel: {
        show: true,
        fontSize: 14,
        color: '#555555'
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
          color: '#555555'
        },
        itemStyle: {
          color: 'rgba(255, 226, 146, 0.5)', 
          borderColor: '#f36b1c',           
          borderWidth: 0.5,                   
          shadowColor: 'rgba(0, 0, 0, 0.85)',
          shadowBlur: 0
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

  if (showTotal) {
    barChart.setOption({
      series: [{
        markLine: {
          data: [{ xAxis: String(year) }]
        }
      }]
    });
  } else {
    barChart.setOption({
      dataset: {
        source: formattedData.filter(d => d[1] === parseInt(year))
      }
    });
  }
}


let totalByYear = {};
totalByYear = {
    2002: 11603,
    2003: 11696,
    2004: 13389,
    2005: 13893,
    2006: 15593,
    2007: 15340,
    2008: 14753,
    2009: 15092,
    2010: 15353,
    2011: 16103,
    2012: 16279,
    2013: 17474,
    2014: 18189,
    2015: 19385,
    2016: 20533,
    2017: 21708,
    2018: 21072,
    2019: 21714,
    2020: 0,
    2021: 2719,
    2022: 16126,
    2023: 20277,
};


function renderLineChart() {
    if (barChart) {
      barChart.dispose();
    }
  
    const chartDom = document.getElementById("stats-chart");
    barChart = echarts.init(chartDom);
  
    const years = Object.keys(totalByYear).filter(y => y !== '2020');
    const values = years.map(year => totalByYear[year]);
  
    let currentMarkLine = {
      symbol: 'none',
      label: {
        show: false
      },
      lineStyle: {
        color: 'rgba(19, 19, 19, 0.5)',
        type: 'dashed',
        width: 2
      },
      data: [{ xAxis: '2002' }]
    };

    const option = {
      title: {
        text: 'Total Visitors Over Time (000s)',
        left: 60, 
        top: 10,  
        textStyle: {
          color: '#000000',
          fontSize: 18
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(50,50,50,1)',
        textStyle: {
          color: 'rgb(0, 0, 0)'
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
      grid: { top: 50, bottom: 20, left: 70, right: 70 },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: {
          color: '#999999',
          fontSize: 12
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(0, 0, 0, 0.3)'
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#999999',
          fontSize: 12
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(0, 0, 0, 0.3)'
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
          color: '#f36b1c',
          width: 3
        },
        itemStyle: {
          color: '#f36b1c'
        },
        areaStyle: {
          color: 'rgba(255, 226, 146, 0.5)'
        },
        markLine: currentMarkLine
      }],
      backgroundColor: 'transparent'
    };
  
    barChart.setOption(option);
  }
  