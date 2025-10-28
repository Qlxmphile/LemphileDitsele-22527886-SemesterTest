// main.js (Cesium integration for SemTest.glb + DBF attribute reading)
// IMPORTANT: If you want real Cesium World Terrain, set a Cesium Ion token in the UI field.
// This script supports running without a token (no terrain) using imagery layers only.

// Simple helpers
const $ = (id) => document.getElementById(id);

let viewer;
let loadedModel = null;
let modelEntity = null;
let attributeIndex = {}; // name(lowercase) -> attributes object
let visualizerOn = true;
let heightRange = {min: Infinity, max: -Infinity};

const CESIUM_ION_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2YjQ1ODJkMi03NTgwLTRkNmItYjQ0ZC1mYWQ3Zjc1MzFhMDYiLCJpZCI6MzU0OTM0LCJpYXQiOjE3NjE2NzQwNjl9.gCOKP8_NK6EgxAMnn1DJEKCgX224g_k-6QcM4fwIAvA";

// initialize Cesium viewer with default imagery (OpenStreetMap)
function initViewer() {
  // Turn off default access token usage in Cesium unless user provides one
  Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;
  // create viewer
viewer = new Cesium.Viewer('cesiumContainer', {
  terrainProvider: new Cesium.CesiumTerrainProvider({
    url: Cesium.IonResource.fromAssetId(1)
  }),
  timeline: false,
  animation: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: true,
  sceneModePicker: true,
  navigationHelpButton: false,
});


  // default to OSM imagery provider
  viewer.imageryLayers.removeAll();
  const osm = new Cesium.OpenStreetMapImageryProvider();
  viewer.imageryLayers.addImageryProvider(osm);

  // place initial camera at UP Hatfield approx
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(28.23014, -25.75368, 400)
  });

  // click handler
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked)) {
      // show pick info
      onPick(picked, click.position);
    } else {
      $('#attrs').innerHTML = '<em>No feature clicked</em>';
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// load or switch imagery provider
function setImagery(type) {
  viewer.imageryLayers.removeAll();
  let provider;
  switch(type) {
    case 'BingAerial':
      provider = new Cesium.BingMapsImageryProvider({ url: 'https://dev.virtualearth.net', key: 'A-DEMOKEY' });
      break;
    case 'CartoDark':
      provider = new Cesium.UrlTemplateImageryProvider({ url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png' });
      break;
    default:
      provider = new Cesium.OpenStreetMapImageryProvider();
  }
  viewer.imageryLayers.addImageryProvider(provider);
}

// enable Cesium World Terrain if token provided
async function enableTerrainWithToken(token) {
  if(!token) {
    alert('No Cesium Ion token provided. Terrain will not be enabled.');
    return;
  }
  try {
    Cesium.Ion.defaultAccessToken = token;
    viewer.terrainProvider = Cesium.createWorldTerrain();
    // enable shadows
    viewer.scene.globe.enableLighting = true;
    $('#status').textContent = 'Terrain enabled (Cesium World Terrain).';
  } catch (e) {
    console.error(e);
    alert('Failed to enable terrain with provided token. See console.');
  }
}

// load model from an input file or from local path 'SemTest.glb'
async function loadGLBFromFile(fileOrUrl) {
  // fileOrUrl can be a File object (from input) or string path
  let url;
  if (typeof fileOrUrl === 'string') {
    url = fileOrUrl; // relative path
  } else {
    url = URL.createObjectURL(fileOrUrl);
  }

  if (modelEntity) {
    viewer.entities.remove(modelEntity);
    modelEntity = null;
  }

  modelEntity = viewer.entities.add({
    name: 'SemTest model',
    position: Cesium.Cartesian3.fromDegrees(28.23014, -25.75368, 0), // placeholder; will be updated on Place
    model: {
      uri: url,
      scale: 1.0,
      minimumPixelSize: 64,
      incrementallyLoadTextures: true
    }
  });

  $('#status').textContent = 'Model loaded (not placed). Use Lat/Lon/Height + Place Model.';
  loadedModel = modelEntity;

  // auto-focus camera near Pretoria (approx campus)
    viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(28.23014, -25.75368, 1200),
    duration: 2.5
});


}

// place model using user inputs lat, lon, height, scale
function placeModelAt(lat, lon, height, scale) {
  if(!modelEntity) { alert('No model loaded. Click Load SemTest.glb first.'); return; }
  const pos = Cesium.Cartesian3.fromDegrees(lon, lat, height);
  modelEntity.position = pos;
  modelEntity.model.scale = scale;
  // try to clamp to terrain if terrain exists
  if (viewer.terrainProvider && viewer.terrainProvider.ready) {
    // nothing special; position already above ground if height chosen appropriately
  }
  // fly camera smoothly to the model’s bounding area once it’s ready
viewer.scene.globe.depthTestAgainstTerrain = true;

viewer.whenReadyPromise.then(() => {
  const destination = Cesium.Cartesian3.fromDegrees(lon, lat, height + 300);
  viewer.camera.flyTo({
    destination,
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0
    },
    duration: 2.5
  });
});

}

// on pick handler
function onPick(picked, canvasPos) {
  // If the picked object is an entity (our model), `picked.id` will be the entity
  if (picked.id && picked.id === modelEntity) {
    // We clicked the model entity — show model-level info
    const attrs = getAttributesForModel(); // attempt to match name-based attributes
    showAttributes(attrs || { info: 'Model clicked — no attribute match.' });
    // highlight by setting silhouette via Cesium (not all browsers), fallback: change model color
    highlightModel();
    return;
  }

  // If picked has primitive, we can try to show primitive info
  if (picked.primitive) {
    // attempt to get instance id or model node name
    const prim = picked.primitive;
    let out = { primitive: String(prim.constructor.name) };
    // if primitive is a Model, try to access glTF metadata (non-standard)
    if (prim instanceof Cesium.Model) {
      out.note = 'Picked Cesium.Model primitive';
    }
    showAttributes(out);
    return;
  }

  // fallback
  $('#attrs').innerHTML = '<em>Picked object not recognized</em>';
}

function showAttributes(attrs) {
  if (!attrs) {
    $('#attrs').innerHTML = '<em>No attributes</em>';
    return;
  }
  let html = '<table style="width:100%;font-size:13px">';
  for (const k of Object.keys(attrs)) {
    html += `<tr><td style="font-weight:600">${k}</td><td style="text-align:right">${attrs[k]}</td></tr>`;
  }
  html += '</table>';
  $('#attrs').innerHTML = html;
}

// attempt to match model name to attributes via the name key in attributeIndex
function getAttributesForModel() {
  // try entity name, then search a few likely keys
  const modelName = (modelEntity && modelEntity.name) ? modelEntity.name.toLowerCase() : null;
  if (modelName && attributeIndex[modelName]) return attributeIndex[modelName];
  // fallback: any attribute with similar substring
  for (const key of Object.keys(attributeIndex)) {
    if (modelName && modelName.includes(key)) return attributeIndex[key];
  }
  return null;
}

function highlightModel() {
  // simple emissive highlight: set color of model to a tint using colorBlendMode
  if (!modelEntity) return;
  try {
    modelEntity.model.color = Cesium.Color.fromCssColorString('#ffd700').withAlpha(0.8);
    modelEntity.model.colorBlendMode = Cesium.ModelColorBlendMode.REPLACE;
    // revert after 1.2s
    setTimeout(()=> {
      if (modelEntity) {
        modelEntity.model.color = Cesium.Color.WHITE;
        modelEntity.model.colorBlendMode = Cesium.ModelColorBlendMode.MODULATE;
      }
    }, 1200);
  } catch(e) {
    console.warn('Highlight not supported for this model:', e);
  }
}

// parse DBF files via shpjs (shp.min.js)
async function parseDbfFile(file) {
  try {
    const ab = await file.arrayBuffer();
    const records = window.shp.parseDbf(ab); // returns array of objects
    for (const rec of records) {
      // use 'name' field as key if it exists (per your earlier mapping)
      const nameField = (rec.name || rec.NAME || rec.Name || rec.NAME_ || '').toString().trim();
      if (nameField) attributeIndex[nameField.toLowerCase()] = rec;
      // also update heightRange if numeric height attributes present
      for (const k of Object.keys(rec)) {
        const maybeNum = parseFloat(rec[k]);
        if (!isNaN(maybeNum)) {
          heightRange.min = Math.min(heightRange.min, maybeNum);
          heightRange.max = Math.max(heightRange.max, maybeNum);
        }
      }
    }
    $('#status').textContent = `Loaded DBF: ${file.name} (${records.length} records)`;
  } catch (e) {
    console.error('Failed to parse DBF', e);
    alert('Error parsing DBF file. See console.');
  }
}

// search by name: fly camera to attribute if attribute contains coordinate, else just show attributes
function searchByName(q) {
  if (!q) return;
  const key = q.toLowerCase();
  // exact match
  if (attributeIndex[key]) {
    showAttributes(attributeIndex[key]);
    // if attribute contains lat/lon fields attempt to fly to them
    const rec = attributeIndex[key];
    const lat = parseFloat(rec.lat || rec.Lat || rec.LAT || rec.latitude || rec.Y || rec.Y_COORD);
    const lon = parseFloat(rec.lon || rec.Lon || rec.LON || rec.longitude || rec.X || rec.X_COORD);
    if (!isNaN(lat) && !isNaN(lon)) {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 120) });
    }
    return;
  }
  // includes match
  for (const k of Object.keys(attributeIndex)) {
    if (k.includes(key)) {
      showAttributes(attributeIndex[k]);
      return;
    }
  }
  alert('No attribute record found for: ' + q);
}

// toggle simple height visualizer: this implementation will color the model entity (whole) or change terrain shading.
// For per-part coloring you'd need per-node mapping which requires model-specific node names; we color whole model as proxy.
function toggleVisualizer() {
  visualizerOn = !visualizerOn;
  if (!modelEntity) return;
  if (visualizerOn) {
    // color model by a single color that communicates height state (we use yellow tint)
    modelEntity.model.color = Cesium.Color.fromCssColorString('#ffcc66').withAlpha(0.99);
    modelEntity.model.colorBlendMode = Cesium.ModelColorBlendMode.MODULATE;
    $('#legend-range').textContent = (heightRange.min === Infinity ? '—' : `${heightRange.min} → ${heightRange.max}`);
  } else {
    // revert to white
    modelEntity.model.color = Cesium.Color.WHITE;
    modelEntity.model.colorBlendMode = Cesium.ModelColorBlendMode.MODULATE;
    $('#legend-range').textContent = '—';
  }
}

// wire UI controls
function wireUi() {
  $('imagery-select').addEventListener('change', (e) => setImagery(e.target.value));
  $('enable-terrain').addEventListener('click', async () => {
    const token = $('ion-token').value.trim();
    if (!token) return alert('Paste your Cesium Ion token in the input to enable terrain.');
    await enableTerrainWithToken(token);
  });

  $('load-model-btn').addEventListener('click', async () => {
    // attempt to load local SemTest.glb
    try {
      await loadGLBFromFile('SemTest.glb');
    } catch (e) {
      console.error(e);
      alert('Failed to load SemTest.glb from working folder. You can also upload a .glb using the file input.');
    }
  });

  $('model-file').addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (f) {
      loadGLBFromFile(f);
    }
  });

  $('place-model').addEventListener('click', () => {
    const lat = parseFloat($('model-lat').value);
    const lon = parseFloat($('model-lon').value);
    const height = parseFloat($('model-height').value || 0);
    const scale = parseFloat($('model-scale').value || 1);
    if (isNaN(lat) || isNaN(lon)) return alert('Enter valid latitude and longitude.');
    placeModelAt(lat, lon, height, scale);
  });

  $('dbf-input').addEventListener('change', (ev) => {
    const files = ev.target.files;
    for (let i=0;i<files.length;i++){
      parseDbfFile(files[i]);
    }
  });

  $('search-btn').addEventListener('click', () => {
    const q = $('search-name').value.trim();
    searchByName(q);
  });

  $('toggle-visualizer').addEventListener('click', () => {
    toggleVisualizer();
  });

  $('reset-view').addEventListener('click', () => {
    viewer.camera.flyHome();
  });
}

// entry
(function main(){
  initViewer();
  wireUi();
  // if SemTest.glb exists in folder, try to pre-load silently
  fetch('SemTest.glb', { method:'HEAD' }).then(r => {
    if (r.ok) {
      // show button as ready
      $('status').textContent = 'SemTest.glb available in folder. Click Load SemTest.glb.';
    }
  }).catch(()=>{ /* ignore */ });
})();