import leftPad from 'left-pad';
import { readData } from './data-reading';

class Message {
  constructor(type, parameters) {
    this._type = type;
    Object.assign(this, parameters);
  }

  get type() {
    return this._type;
  }

  get name() {
    const parser = messageParsers.get(this.type);
    if (parser) {
      return parser.name;
    }
    return null;
  }

  get parameters() {
    return this._parameters
  }
}

const messageParsers = new Map([
  [0x0001, {
    name: 'Dataspace',
    parse(buffer) {
      const [version, dimensionality, flags, reserved] = buffer.readBytes(4);

      const dimensions = (new Array(dimensionality)).map(() => { return {}; });
      for (let i = 0; i < dimensionality; ++i) {
        dimensions[i] = {
          size: buffer.readLength(),
        };
      }

      if (flags & 0b01) {
        for (let i = 0; i < dimensionality; ++i) {
          dimensions[i].maxSize =  buffer.readLength();
        }
      }

      if (flags & 0b10) {
        for (let i = 0; i < dimensionality; ++i) {
          dimensions[i].permutationIndex = buffer.readLength();
        }
      }

      return { dimensions };
    }
  }],

  [0x0002, {
    name: 'Link Info',
    parse(buffer) {
      const [version, flags] = buffer.readBytes(2);

      return {
        maximumCreationIndex: (flags & 0b01) ? buffer.readUint64() : null,
        fractalHeapAddress: buffer.readOffset(),
        v2BTreeNameIndex: buffer.readOffset(),
        v2BTreeCreationOrderIndex: (flags & 0b10) ? buffer.readOffset() : null,
      }
      // parseFractalHeap(buffer, offsetSize, lengthsSize, fractalHeapAddress, messageParsers.get(0x0006).parse);
      // parseV2BTreeHeader(buffer, offsetSize, lengthsSize, v2BTreeNameIndex);
    }
  }],

  [0x0003, {
    name: 'Datatype',
    parse(buffer) {
      const classAndVersion = buffer.readByte();
      const version = (classAndVersion & 0b11110000) >> 4;
      const cls = classAndVersion & 0b00001111;
      const bitField = buffer.readBytes(3);
      const size = buffer.readUint32();

      const classNames = [
        'Fixed-Point',
        'Floating-point',
        'Time',
        'String',
        'Bit field',
        'Opaque',
        'Compound',
        'Reference',
        'Enumerated',
        'Variable-Length',
        'Array',
      ];

      // type specific properties
      let properties = null;
      if (cls === 0) {
        properties = {
          littleEndian: (bitField[0] & 0b01) === 0,
          offset: buffer.readUint16(),
          precision: buffer.readUint16(),
        };
      }

      return {
        className: classNames[cls],
        'class': cls,
        bitField,
        size,
        properties,
        // parser(buffer) {
        //   if (cls === 1 && size === 4) {
        //     return buffer.readFloat32();
        //   } else if (cls === 3) {
        //     return buffer.readChars(size);
        //   } // TODO: other datatypes
        // }
      }
    }
  }],

  [0x0004, {
    name: 'Fill Value (old)',
  }],

  [0x0005, {
    name: 'Fill Value',
    parse(buffer) {
      const [version, spaceAllocationTime, fillValueWriteTime, fillValueDefined] = buffer.readBytes(4);
    }
  }],

  [0x0006, {
    name: 'Link',
    parse(buffer) {
      const [version, flags] = buffer.readBytes(2);

      const linkType = (flags & 0b00001000) ? buffer.readByte() : 0;
      const creationOrder = (flags & 0b00000100) ? buffer.readUint64() : null;
      const charSet = (flags & 0b00010000) ? buffer.readChar() : 0;
      const lengthOfLinkName = buffer.readUintVar(1 << (flags & 0x0011));

      const linkName = (charSet === 0) ? buffer.readChars(lengthOfLinkName) : buffer.readUtf8(lengthOfLinkName);

      if (linkType === 0) { // hard links
        return {
          linkType: 'hard',
          linkName,
          address: buffer.readOffset(),
        };
        // parseObjectHeader(buffer, offsetSize, lengthsSize, objectHeaderAddress);
      } else if (linkType === 1) { // soft links
        const length = buffer.readUint16();
        return {
          linkType: 'soft',
          linkName,
          address: buffer.readChars(length),
        };
      } else if (linkType === 64) { // external link
        const length = buffer.readUint16();
        return {
          linkType: 'external',
          linkName,
          address: buffer.readChars(length),
        };
      }
    }
  }],

  [0x0007, {
    name: 'External Data Files',
  }],

  [0x0008, {
    name: 'Data Layout',
    parse(buffer) {
      const version = buffer.readByte();
      console.log("Data Layout version", version);
      if (version === 1 || version === 2) {
        // TODO:
      } else if (version === 3 || version === 4) {
        let storageType;
        switch (buffer.readByte()) {
          case 0: // compact storage
            return {
              storageType: 'compact',
              size: buffer.readUint16(),
              address: buffer.offset,
            };
          case 1: // contiguous storage
            return {
              storageType: 'contiguous',
              address: buffer.readOffset(),
              size: buffer.readLength(),
            };
          case 2: { // chunked storage
            storageType = 'chunked';
            const dimensionality = buffer.readByte();
            const bTreeAddress = buffer.readOffset();
            const sizes = [];
            for (let i = 0; i < dimensionality; ++i) {
              sizes[i] = buffer.readUint32();
            }
            const datasetElementSize = buffer.readUint32();

            return {
              storageType,
              dimensionality,
              bTreeAddress,
              sizes,
              datasetElementSize,
            };
          }
          case 3: // virtual storage
            storageType = 'virtual';
            break;
        }
      }
    }
  }],

  [0x0009, {
    name: 'Bogus',
  }],

  [0x000A, {
    name: 'Group Info',
    parse(buffer) {
      const [version, flags] = buffer.readBytes(2);
      if (flags & 0b01) {
        buffer.skip(4);
      }
      if (flags & 0b10) {
        buffer.skip(4);
      }
    }
  }],

  [0x000B, {
    name: 'Data Storage - Filter Pipeline',
    parse(buffer) {
      const [version, numberOfFilters] = buffer.readBytes(2);
      const filters = [];

      if (version === 1) {
        buffer.skip(6);
        // TODO: implement
      } else if (version === 2) {
        for (let i = 0; i < numberOfFilters; ++i) {
          const id = buffer.readUint16();
          const nameLength = (id < 256) ? null : buffer.readUint16();
          const flags = buffer.readUint16();
          const numberOfClientDataValues = buffer.readUint16();

          const name = nameLength ? buffer.readChars(nameLength) : '';
          const clientData = numberOfClientDataValues ? buffer.readBytes(4 * numberOfClientDataValues) : null;
          filters.push({
            id,
            flags,
            name,
            clientData: clientData.buffer,
          });
        }
        return { filters };
      }
    }
  }],

  [0x000C, {
    name: 'Attribute',
    parse(buffer) {
      const [version, flags] = buffer.readBytes(2);
      const nameSize = buffer.readUint16();
      const dataTypeSize = buffer.readUint16();
      const dataSpaceSize = buffer.readUint16();

      if (version === 1) {

      } else if (version === 3) {
        const name = (buffer.readByte() === 0) ? buffer.readChars(nameSize) : buffer.readUtf8(nameSize);
        // if ((flags & 0b01) === 0) {
        buffer.pushMark();
        const dataType = messageParsers.get(0x0003).parse(buffer);
        buffer.popMark();
        buffer.skip(dataTypeSize);

        buffer.pushMark();
        const dataSpace = messageParsers.get(0x0001).parse(buffer);
        buffer.popMark();
        buffer.skip(dataSpaceSize);

        // const value = dataType.parser(buffer);
        const value = readData(
          buffer, { address: buffer.offset }, dataType, dataSpace
        );
        return { attributeName: name, attributeValue: value };
      }
    }
  }],

  [0x000D, {
    name: 'Object Comment',
  }],

  [0x000E, {
    name: 'Object Modification Time (old)',
  }],

  [0x000F, {
    name: 'Shared Message Table',
  }],

  [0x0010, {
    name: 'Object Header Continuation',
    parse(buffer) {
      return {
        offset: buffer.readOffset(),
        length: buffer.readLength(),
      };
    }
  }],

  [0x0011, {
    name: 'Symbol Table',
  }],

  [0x0012, {
    name: 'Object Modification Time',
  }],

  [0x0013, {
    name: 'B-tree ‘K’ Values',
  }],

  [0x0014, {
    name: 'Driver Info',
  }],

  [0x0015, {
    name: 'Attribute Info',
    parse(buffer) {
      const [version, flags] = buffer.readBytes(2);
      return {
        maximumCreationIndex: (flags & 0b01) ? buffer.readUint16() : null,
        fractalHeapAddress: buffer.readOffset(),
        v2BTreeNameIndex: buffer.readOffset(),
        v2BTreeCreationOrderIndex: (flags & 0b10) ? buffer.readOffset() : null,
      };
    }
  }],

  [0x0016, {
    name: 'Object Reference Count',
  }]
]);

export function parseMessage(buffer, type, size, flags) {
  const { name, parse } = messageParsers.get(type) || {};
  let parameters = null;
  if (name && parse) {
    buffer.pushMark();
    const startOffset = buffer.offset;
    console.log("message", name, `0x${leftPad(type.toString(16), 4, '0')}`, size, flags.toString(2));
    parameters = parse(buffer);
    if (typeof size === 'undefined') {
      size = buffer.offset - startOffset;
    }
    buffer.popMark();
  } else {
    console.log('unsupported message', (name) ? name : '', `0x${leftPad(type.toString(16), 4, '0')}`)
  }
  buffer.skip(size);
  return new Message(type, parameters);
}

export function parseSharedMessage(buffer, type, size, flags) {
  buffer.pushMark();
  const [version, sharedType] = buffer.readBytes(2);
  if (version === 1) {
    buffer.skip(6);
  }
  buffer.popMark();
  buffer.skip(size);

}
