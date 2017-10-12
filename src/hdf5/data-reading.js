import { inflate } from 'pako/lib/inflate';

function getArrayType(dataType) {
  const cls = dataType['class'];
  const size = dataType.size;

  if (cls === 0 || cls === 1) {
    switch(size){
      case 4:
        return Float32Array;
      default:
        return Float64Array;
    }
  }
  return Array;
}

function createArray(dataType, dataSpace) {
  const size = dataSpace.dimensions.reduce((a, b) => a.size * b.size, {size: 1});
  return new (getArrayType(dataType))(size);
}

function createParser(dataType) {
  const cls = dataType['class'];
  const size = dataType.size;

  // Fixed-Point
  if (cls === 0) {
    switch(size) {
    case 4:
      return (buffer) => buffer.readFloat32();
    case 8:
      return (buffer) => buffer.readFloat64();
    }
  }

  // Floating-point
  if (cls === 1) {
    switch(size) {
    case 4:
      return (buffer) => buffer.readFloat32();
    case 8:
      return (buffer) => buffer.readFloat64();
    }
  }

  // String
  if (cls === 3) {
    switch(dataType.bitField[0] & 0b1111) {
      case 0: // null terminate
      case 1: // null pad
      case 2: // space pad
        break; // TODO no special action required?
    }
    if (((dataType.bitField[0] & 0b11110000) >> 4) === 0) {
      return (buffer) => buffer.readChars(size);
    } else {
      return (buffer) => buffer.readUtf8(size);
    }
  }

  throw new Error(`Data type class ${dataType.className} is not supported.`);
  // TODO: way more
}


function readDataFromBlock(buffer, address, parser, array) {
  buffer.pushMark();
  try {
    buffer.seek(address);
    if (!array) {
      return parser(buffer);
    } else {
      for (let i = 0; i < array.length; ++i) {
        array[i] = parser(buffer);
      }
      return array;
    }
  } finally {
    buffer.popMark();
  }
}

export function readData(buffer, dataLayout, dataType, dataSpace, filters) {
  const parser = createParser(dataType);
  const { dimensions } = dataSpace;

  if (dataLayout.address) {
    const array = (dimensions.length) ? createArray(dataType, dataSpace) : null;
    return readDataFromBlock(buffer, dataLayout.address, parser, array);
  } else if (dataLayout.storageType === 'chunked') {
    const bTree = parseV1BTreeNode(buffer, dataLayout.bTreeAddress, dimensions.length);

  }


}
