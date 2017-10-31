import { inflate } from 'pako/lib/inflate';

import { parseV1BTreeNode } from './b-tree';
import HDF5IOBuffer from './iobuffer-hdf5';

function getArrayType(dataType) {
  const { class: cls, size } = dataType;

  if (cls === 0) {
    const signed = dataType.bitField[0] & 0b1000;
    const { offset, precision } = dataType.properties;
    if (offset > 0) {
      throw new Error(`Parsing of Fixed-Point values with offet ${offset} not implemented.`);
    }

    if (signed) {
      switch (precision) {
        case 8:
          return Int8Array;
        case 16:
          return Int16Array;
        case 32:
          return Int32Array;
        case 64:
          return Float64Array;
        default:
          break;
      }
    } else {
      switch (precision) {
        case 8:
          return Uint8Array;
        case 16:
          return Uint16Array;
        case 32:
          return Uint32Array;
        case 64:
          return Float64Array;
        default:
          break;
      }
    }
  } else if (cls === 1) {
    switch (size) {
      case 4:
        return Float32Array;
      default:
        return Float64Array;
    }
  }
  return Array;
}

function createArray(dataType, dataSpace) {
  const size = dataSpace.dimensions.map(dim => dim.size).reduce((a, b) => (a * b), 1);
  return new (getArrayType(dataType))(size);
}

function createParser(dataType) {
  const { class: cls, size } = dataType;

  // Fixed-Point
  if (cls === 0) {
    const signed = dataType.bitField[0] & 0b1000;
    const { offset, precision } = dataType.properties;
    if (offset > 0) {
      throw new Error(`Parsing of Fixed-Point values with offet ${offset} not implemented.`);
    }

    if (signed) {
      switch (precision) {
        case 8:
          return buffer => buffer.readInt8();
        case 16:
          return buffer => buffer.readInt16();
        case 32:
          return buffer => buffer.readInt32();
        case 64:
          return buffer => buffer.readInt64();
        default:
          break;
      }
    } else {
      switch (precision) {
        case 8:
          return buffer => buffer.readUint8();
        case 16:
          return buffer => buffer.readUint16();
        case 32:
          return buffer => buffer.readUint32();
        case 64:
          return buffer => buffer.readUint64();
        default:
          break;
      }
    }
  }

  // Floating-point
  if (cls === 1) {
    switch (size) {
      case 4:
        return buffer => buffer.readFloat32();
      case 8:
        return buffer => buffer.readFloat64();
      default:
        break;
    }
  }

  // String
  if (cls === 3) {
    switch (dataType.bitField[0] & 0b1111) {
      case 0: // null terminate
      case 1: // null pad
      case 2: // space pad
        break; // TODO no special action required?
      default:
        break;
    }
    if (((dataType.bitField[0] & 0b11110000) >> 4) === 0) {
      return buffer => buffer.readChars(size);
    }
    return buffer => buffer.readUtf8(size);
  }

  // Compound
  if (cls === 6) {
    const memberParsers = dataType.properties.members.map(
      memberDataType => createParser(memberDataType)
    );
    return buffer => memberParsers.map(memberParser => memberParser(buffer));
  }

  // Reference
  if (cls === 7) {
    return buffer => buffer.readUintVar(size);
  }

  // Variable-Length
  if (cls === 9) {
    const [bits0to7, bits8to16] = dataType.bitField;
    const type = bits0to7 & 0b00001111;
    const padding = (bits0to7 & 0b11110000) >> 4;
    const charSet = bits8to16 & 0b00001111;

    if (type === 0) {
      const subParser = createParser(dataType.properties.baseType);
      return subParser;
    }
    // return null; TODO
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
    }
    for (let i = 0; i < array.length; ++i) {
      // eslint-disable-next-line no-param-reassign
      array[i] = parser(buffer);
    }
    return array;
  } finally {
    buffer.popMark();
  }
}

export function readData(buffer, dataLayout, dataType, dataSpace, filters) {
  const parser = createParser(dataType);
  const { dimensions } = dataSpace;
  const array = (dimensions.length) ? createArray(dataType, dataSpace) : null;

  if (dataLayout.address) {
    return readDataFromBlock(buffer, dataLayout.address, parser, array);
  } else if (dataLayout.storageType === 'chunked') {
    const bTree = parseV1BTreeNode(buffer, dataLayout.bTreeAddress, dimensions.length);
    // bTree._keys[0].chunkOffsets;
    let data = buffer.seek(bTree.children[0]).readBytes(bTree.keys[0].chunkSize);
    if (filters && filters.find(filter => filter.id === 1)) {
      data = inflate(data);
    }
    return readDataFromBlock(new HDF5IOBuffer(data), 0, parser, array);
    // for (let i = 0; i < bTree.children.length; ++i) {
    //
    // }
  }
  throw new Error();
}

export function readSingleValue(buffer, dataType, address) {
  buffer.pushMark();
  try {
    buffer.seek(address);
    const parser = createParser(dataType);
    return parser(buffer);
  } finally {
    buffer.popMark();
  }
}
