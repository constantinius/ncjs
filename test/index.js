import ndarray from 'ndarray';
import imshow from 'ndarray-imshow';
import Map from 'ol/map';
import View from 'ol/view';
import ImageLayer from 'ol/layer/image';
import TileLayer from 'ol/layer/tile';
import ImageStaticSource from 'ol/source/imagestatic';
import WMTSSource from 'ol/source/wmts';
import WMTSTileGrid from 'ol/tilegrid/wmts';
import proj from 'ol/proj';
import extent from 'ol/extent';
import plotty from 'plotty';

import { parseNetCDF } from '../src';


window.loadNetCDF = (url) => {
  fetch(url)
    .then(response => response.arrayBuffer())
    .then(buffer => parseNetCDF(buffer))
    .then((hdf5) => {
      console.log(Array.from(hdf5.getLinks()));

      const projection = proj.get('EPSG:4326');
      const projectionExtent = projection.getExtent();
      const size = extent.getWidth(projectionExtent) / 256;
      const resolutions = new Array(14);
      const matrixIds = new Array(14);
      for (let z = 0; z < 14; ++z) {
        // generate resolutions and matrixIds arrays for this WMTS
        resolutions[z] = size / Math.pow(2, z + 1);
        matrixIds[z] = z;
      }

      const imageLayer = new ImageLayer({});

      const map = new Map({
        target: 'map',
        projection,
        layers: [
          new TileLayer({
            source: new WMTSSource({
              urls: [
                'https://a.tiles.maps.eox.at/wmts/',
                'https://b.tiles.maps.eox.at/wmts/',
                'https://c.tiles.maps.eox.at/wmts/',
                'https://d.tiles.maps.eox.at/wmts/',
                'https://e.tiles.maps.eox.at/wmts/'
              ],
              layer: 'terrain-light',
              tileGrid: new WMTSTileGrid({
                origin: extent.getTopLeft(projectionExtent),
                resolutions,
                matrixIds
              }),
              matrixSet: 'WGS84',
              projection,
              protocol: 'WMTS',
              style: 'default',
              format: 'image/png',
            })
          }),
          imageLayer,
        ],
        view: new View({
          projection,
          center: [0, 0],
          zoom: 1
        })
      })

      const select = document.getElementById('datasets');
      for (const link of hdf5.getLinks()) {
        const option = document.createElement('option');
        option.value = option.innerHTML = link.linkName;
        select.appendChild(option);
      }

      select.onchange = (event) => {
        const child = hdf5.getChildObject(event.target.value);
        console.log(child.getAttributes());

        const { dimensions } = child.dataSpace;
        const [height, width] = dimensions.map(dim => dim.size);
        const data = child.readData();
        const validRange = child.getAttribute('valid_range');
        const [min, max] = validRange || [0, 1];

        const dimObj1 = child.getDimensionObject(0);
        const dimObj2 = child.getDimensionObject(1);

        if (dimensions.length > 2) {
          // TODO:
        }

        let na = ndarray(data, [height, width]);
        // na = na.step(1, 1);

        const flippedData = data.slice();

        for (let y = 0; y < height; ++y) {
          for (let x = 0; x < width; ++x) {
            flippedData[(y * width) + x] = na.get(y, x);
          }
        }

        const imageCanvas = document.createElement('canvas');
        imageCanvas.width = width;
        imageCanvas.height = height;
        const plot = new plotty.plot({
          canvas: imageCanvas,
          data: flippedData,
          width,
          height,
          domain: [min, max],
          colorscale: 'viridis',
          clampLow: true,
          clampHigh: true,
          noDataValue: child.getFillValue(),
        });
        plot.render();

        //

        imageLayer.setSource(new ImageStaticSource({
          projection,
          url: imageCanvas.toDataURL('image/png'),
          imageExtent: [-180, -90, 180, 90],
        }));

        imshow(na, { min, max });
      };
    });

};
