import leftPad from 'left-pad';

import IOBuffer64 from './iobuffer64';
import { parseHDF5 } from './hdf5';

function parseNetCDF(arrayBuffer) {
  const hdf5 = parseHDF5(arrayBuffer);
  hdf5.getLinks();
  console.log(hdf5.getChildNames())

  const child = hdf5.getChildObject("surface_reflectance870_lowerquartile");
  console.log(child.getAttributes());
  window.hdf5 = hdf5;
  window.child = child;
  child.readData();
}



fetch('20120102-ESACCI-L3C_AEROSOL-AER_PRODUCTS-AATSR-ENVISAT-ORAC-DAILY-fv04.01.nc')
  .then(response => response.arrayBuffer())
  .then(buffer => parseNetCDF(buffer));
