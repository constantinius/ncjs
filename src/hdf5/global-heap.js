function parseGlobalHeapObject(buffer, dataParser) {
  const index = buffer.readUint16();
  buffer.skip(6);
  const size = buffer.readLength();
  const address = buffer.offset;
  const data = dataParser ? dataParser(buffer) : null;
  buffer.seek(address);
  buffer.skip(size);

  return {
    index, address, size, data,
  };
}

export function parseGlobalHeapCollection(buffer, address, dataParser) {
  buffer.pushMark();
  try {
    buffer.seek(address);

    if (buffer.readChars(4) !== 'GCOL') {
      throw new Error(`Location ${address.toString(16)} is not a global heap.`);
    }
    buffer.skip(4);

    const size = buffer.readLength();

    const objects = new Map();
    const initialOffset = buffer.offset;
    while (buffer.offset < initialOffset + size) {
      const object = parseGlobalHeapObject(buffer, dataParser);
      if (object.index !== 0) {
        objects.set(object.index, object);
      }
    }
    return objects;
  } finally {
    buffer.popMark();
  }
}
