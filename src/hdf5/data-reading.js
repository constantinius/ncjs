

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

  if (cls === 1) {
    switch(size) {
    case 4:
      return (buffer) => buffer.readFloat32();
    case 8:
      return (buffer) => buffer.readFloat64();
    }
  }

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


export function readData(buffer, address, dataType, dataSpace) {
  const parser = createParser(dataType);
  const { dimensions } = dataSpace
  if (dimensions.length === 0) {
    return parser(buffer);
  } else {
    const array = createArray(dataType, dataSpace);
    for (let i = 0; i < array.length; ++i) {
      array[i] = parser(buffer);
    }
    return array;
  }
}
