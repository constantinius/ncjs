import IOBuffer64 from '../iobuffer64';
import HDF5IOBuffer from './iobuffer-hdf5';
import { parseObjectHeader } from './object';


export function parseHDF5(arrayBuffer) {
  let buffer = new IOBuffer64(arrayBuffer);

  const magic = buffer.readByte();
  const signature = buffer.readChars(3);
  if (magic !== 137 && signature !== 'HDF') {
    throw new Error('Object is no HDF5 file.');
  }
  buffer.skip(4);
  const sbVersion = buffer.readByte();
  let shmfVersion;
  let offsetSize;
  let lengthsSize;
  if (sbVersion === 0 || sbVersion === 1) {
    const [fsVersion, rgVersion] = buffer.readBytes(3);
    [shmfVersion, offsetSize, lengthsSize] = buffer.readBytes(4);
    buffer.skip(12);
  } else if (sbVersion === 2 || sbVersion === 3) {
    [offsetSize, lengthsSize] = buffer.readBytes(3);
  }

  buffer = new HDF5IOBuffer(buffer, offsetSize, lengthsSize);

  const baseAddress = buffer.readOffset();
  const superBlockExtensionsAddress = buffer.readOffset();
  const endOfFileAddress = buffer.readOffset();
  const rootGroupObjectHeaderAddress = buffer.readOffset();

  return parseObjectHeader(buffer, rootGroupObjectHeaderAddress);
}
