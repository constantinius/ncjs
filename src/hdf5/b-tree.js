class V2BTree {
  constructor() {

  }
}

class V1Node {
  constructor(level, leftSiblingAddress, rightSiblingAddress, dimensionality) {
    this._level = level;
    this._leftSiblingAddress = leftSiblingAddress;
    this._rightSiblingAddress = rightSiblingAddress;
    this._dimensionality = dimensionality;
  }

  getLeftSibling(buffer) {
    if (this._leftSiblingAddress === -1) {
      return null;
    }
    return parseV1BTreeNode(buffer, this._leftSiblingAddress, this._dimensionality);
  }

  getRightSibling(buffer) {
    if (this._rightSiblingAddress === -1) {
      return null;
    }
    return parseV1BTreeNode(buffer, this._rightSiblingAddress, this._dimensionality);
  }
}

class V1GroupNode extends V1Node {
  constructor(level, leftSiblingAddress, rightSiblingAddress, dimensionality) {
    super(level, leftSiblingAddress, rightSiblingAddress);
  }
}

class V1RawDataChunkNode extends V1Node {
  constructor(level, leftSiblingAddress, rightSiblingAddress, dimensionality) {
    super(level, leftSiblingAddress, rightSiblingAddress);
  }
}

export function parseV1BTreeNode(buffer, address, dimensionality) {
  buffer.pushMark();
  try {
    buffer.seek(address);
    if (buffer.readChars(4) !== 'TREE') {
      throw new Error(`Location ${address.toString(16)} is not a v1 B-Tree.`);
    }
    const [type, level] = buffer.readBytes(2);
    const entriesUsed = buffer.readUint16();
    const leftSiblingAddress = buffer.readOffset();
    const rightSiblingAddress = buffer.readOffset();

    if (type === 0) {
      return new V1GroupNode({
        level,
        leftSiblingAddress,
        rightSiblingAddress,
      });
    } else {

      function readKey(buffer, dimensionality) {
        const chunkSize = buffer.readUint32();
        const filterMask = buffer.readUint32();
        const chunkOffsets = [];
        for (let i = 0; i < dimensionality; ++i) {
          chunkOffsets[i] = buffer.readUint64();
        }
        return { chunkSize, filterMask, chunkOffsets };
      }


      const keys = [];
      const children = [];
      for (let j = 0; j < entriesUsed; ++j) {
        keys.push(readKey(buffer, dimensionality));
        // const chunkSize = buffer.readUint32();
        // const filterMask = buffer.readUint32();
        // const chunkOffsets = [];
        // for (let i = 0; i < dimensionality + 1; ++i) {
        //   chunkOffsets[i] = buffer.readUint64();
        // }
        // children.push({chunkSize, filterMask, chunkOffsets});
        children.push(buffer.readOffset());
      }
      keys.push(readKey(buffer, dimensionality));
      return new V1RawDataChunkNode(
        level,
        leftSiblingAddress,
        rightSiblingAddress,
        dimensionality,
        children,
      );
    }
  } finally {
    buffer.popMark();
  }
}



function parseRecords(buffer, type, numberOfRecords) {
  // 1	This B-tree is used for indexing indirectly accessed, non-filtered ‘huge’ fractal heap objects.
  // 2	This B-tree is used for indexing indirectly accessed, filtered ‘huge’ fractal heap objects.
  // 3	This B-tree is used for indexing directly accessed, non-filtered ‘huge’ fractal heap objects.
  // 4	This B-tree is used for indexing directly accessed, filtered ‘huge’ fractal heap objects.
  // 5	This B-tree is used for indexing the ‘name’ field for links in indexed groups.
  // 6	This B-tree is used for indexing the ‘creation order’ field for links in indexed groups.
  // 7	This B-tree is used for indexing shared object header messages.
  // 8	This B-tree is used for indexing the ‘name’ field for indexed attributes.
  // 9	This B-tree is used for indexing the ‘creation order’ field for indexed attributes.
  // 10	This B-tree is used for indexing chunks of datasets with no filters and with more than one dimension of unlimited extent.
  // 11	This B-tree is used for indexing chunks of datasets with filters and more than one dimension of unlimited extent.
  const records = [];
  for (let i = 0; i < numberOfRecords; ++i) {
    let record;
    switch (type) {
      case 1:
        record = {
          address: buffer.readOffset(),
          length: buffer.readLength(),
          id: buffer.readLength(),
        };
        break;
      case 2:
        record = {
          address: buffer.readOffset(),
          length: buffer.readLength(),
          filterMask: buffer.readUint32(),
          memorySize: buffer.readLength(),
          id: buffer.readLength(),
        };
        break;
      case 3:
        record = {
          address: buffer.readOffset(),
          length: buffer.readLength(),
        };
        break;
      case 4:
        record = {
          address: buffer.readOffset(),
          length: buffer.readLength(),
          filterMask: buffer.readUint32(),
          memorySize: buffer.readLength(),
        };
        break;
      case 5:
        record = {
          hash: buffer.readUint32(),
          id: buffer.readChars(7),
        };
        break;
      default:
        throw new Error(`Type ${type} not supported`);
    }

    records.push(record);
  }
  return records;
}


function parseV2BTreeNode(buffer, address, recordSize, numberOfRecords) {
  buffer.seek(address);
  const signature = buffer.readChars(4);
  const [version, type] = buffer.readBytes(2);
  // const records = buffer.readBytes(recordSize * numberOfRecords);
  const records = parseRecords(buffer, getOffset, getLength, type, numberOfRecords);
  console.log(records);

  // child nodes only in non-leaf nodes
  if (signature === 'BTIN') {

  }

  // for (let i = 0; i < numberOfRecords; ++i) {
  //   const childNodePointer = getOffset(buffer);
  //   // parseV2BTreeNode(buffer, getOffset, getLength, childOffset, recordSize, )
  // }
}

export function parseV2BTreeHeader(buffer, address) {

  buffer.pushMark();
  try {
    buffer.seek(address);
    const signature = buffer.readChars(4);
    if (signature !== 'BTHD') {
      throw new Error(`Location ${address.toString(16)} is not a v2 B-Tree.`);
    }
    const [version, type] = buffer.readBytes(2);
    const nodeSize = buffer.readUint32();
    const recordSize = buffer.readUint16();
    const depth = buffer.readUint16();
    const [splitPercent, mergePercent] = buffer.readBytes(2);

    const rootNodeAddress = buffer.readOffset();
    const numberOfRecordsInRootNode = buffer.readUint16();
    const totalNumberOfRecords = buffer.readLength();

    const checksum = buffer.readUint32();

    console.log('type', type)

    // parseV2BTreeNode(buffer, offsetSize, lengthsSize, rootNodeAddress, recordSize, recordSize, totalNumberOfRecords);
  } finally {
    buffer.popMark();
  }
}
