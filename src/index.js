import ndarray from 'ndarray';
import imshow from 'ndarray-imshow';

import IOBuffer64 from './iobuffer64';
import { parseHDF5 } from './hdf5';

export function parseNetCDF(arrayBuffer) {
  const hdf5 = parseHDF5(arrayBuffer);
  return hdf5;
}
