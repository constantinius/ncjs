import { marked } from '../iobuffer64';
import { assertChecksum } from './utils';

class FractalHeap {
  constructor(header) {
    Object.assign(this, header);
  }

  get maximumDirecktBlockRows() {
    return (Math.log2(this.maximumDirectBlockSize) - Math.log2(this.startingBlockSize)) + 2;
  }

  * iterBlocks(buffer) {
    if (this.currentNumberOfRowsInIndirectBlock === 0) {
      // eslint-disable-next-line no-use-before-define
      yield parseFractalHeapDirectBlock(
        buffer, this.addressOfRootBlock, this, this.startingBlockSize
      );
    } else {
      // eslint-disable-next-line no-use-before-define
      const indirectBlock = parseFractalHeapIndirectBlock(
        buffer, this.addressOfRootBlock, this, this.startingBlockSize,
        this.currentNumberOfRowsInRootIndirectBlock
      );
      yield* indirectBlock.iterBlocks(buffer, this);
    }
  }
}

class FractalHeapDirectBlock {
  constructor(address, size, dataOffset) {
    this._address = address;
    this._size = size;
    this._dataOffset = dataOffset;
  }

  get dataAddress() {
    return this._address + this._dataOffset;
  }

  get dataSize() {
    return this._size - this._dataOffset;
  }
}

class FractalHeapIndirectBlock {
  constructor(address, directBlockDescriptors, indirectBlockAddresses) {
    this._address = address;
    this._directBlockDescriptors = directBlockDescriptors;
    this._indirectBlockAddresses = indirectBlockAddresses;
  }

  * iterBlocks(buffer, heap) {
    const addresses = [];
    for (const descriptor of this._directBlockDescriptors) {
      // TODO: filtered blocks
      // TODO: get correct size

      console.log(descriptor.address);
      if (descriptor.address === -1) {
        break;
      }
      addresses.push(descriptor.address);
      // eslint-disable-next-line no-use-before-define
      yield parseFractalHeapDirectBlock(buffer, descriptor.address, heap, 512);
    }

    for (const address of this._indirectBlockAddresses) {
      // eslint-disable-next-line no-use-before-define
      const indirectBlock = parseFractalHeapIndirectBlock(
        buffer, address, heap, 512
      );
      yield* indirectBlock.iterBlocks(buffer);
    }
  }
}

function parseFractalHeapDirectBlock(buffer, address, heap, size) {
  buffer.pushMark();
  try {
    buffer.seek(address);
    if (buffer.readChars(4) !== 'FHDB') {
      throw new Error(`Location ${address.toString(16)} is not a fractal heap direct block.`);
    }
    const version = buffer.readByte();
    const heapHeaderAddress = buffer.readOffset();
    const blockOffset = buffer.readBytes(Math.ceil(heap.maximumHeapSize / 8));
    const checksum = (heap.flags & 0b10) ? buffer.readUint32() : null;
    const dataOffset = 5 + buffer.offsetSize + Math.ceil(heap.maximumHeapSize / 8) + ((heap.flags & 0b10) ? 4 : 0);
    return new FractalHeapDirectBlock(address, size, dataOffset);
  } finally {
    buffer.popMark();
  }
}

function parseFractalHeapIndirectBlock(buffer, address, heap, size, numberOfRows) {
  buffer.pushMark();
  try {
    buffer.seek(address);
    if (buffer.readChars(4) !== 'FHIB') {
      throw new Error(`Location ${address.toString(16)} is not a fractal heap indirect block.`);
    }
    const version = buffer.readByte();
    const heapHeaderAddress = buffer.readOffset();
    // const blockOffset = buffer.readUintVar(Math.ceil(heap.maximumHeapSize / 8));
    buffer.skip(Math.ceil(heap.maximumHeapSize / 8));

    // The number of rows of blocks, nrows, in an indirect block of size iblock_size is given by the following expression:
    //
    // nrows = (log2(iblock_size) - log2(<Starting Block Size> * <Width>)) + 1
    //
    // The maximum number of rows of direct blocks, max_dblock_rows, in any indirect block of a fractal heap is given by the following expression:
    //
    // max_dblock_rows = (log2(<Max. Direct Block Size>) - log2(<Starting Block Size>)) + 2
    //
    // Using the computed values for nrows and max_dblock_rows, along with the Width of the doubling table, the number of direct and indirect block entries (K and N in the indirect block description, below) in an indirect block can be computed:
    //
    // K = MIN(nrows, max_dblock_rows) * Width
    //
    // If nrows is less than or equal to max_dblock_rows, N is 0. Otherwise, N is simply computed:
    //
    // N = K - (max_dblock_rows * Width)

    // const numberOfRows = (Math.log2(size) - Math.log2(heap.startingBlockSize * heap.tableWidth)) + 1;

    const K = Math.min(numberOfRows, heap.maximumDirecktBlockRows) * heap.tableWidth;
    const N = (numberOfRows <= heap.maximumDirecktBlockRows) ? 0 : K - (heap.maximumDirecktBlockRows * heap.tableWidth);

    const directBlockDescriptors = [];
    for (let k = 0; k < K; ++k) {
      directBlockDescriptors.push({
        address: buffer.readOffset(),
        filteredSize: heap.ioFiltersEncodedLength ? buffer.readLength() : null,
        filterMask: heap.ioFiltersEncodedLength ? buffer.readUint32() : null,
      });
    }

    const indirectBlockAddresses = [];
    for (let n = 0; n < N; ++n) {
      indirectBlockAddresses.push(buffer.readOffset());
    }

    return new FractalHeapIndirectBlock(address, directBlockDescriptors, indirectBlockAddresses);
  } finally {
    buffer.popMark();
  }
}


export function parseFractalHeap(buffer, address) {
  buffer.pushMark();
  buffer.seek(address);

  try {
    if (buffer.readChars(4) !== 'FRHP') {
      throw new Error(`Location ${address.toString(16)} is not a fractal heap.`);
    }
    const version = buffer.readByte();
    const heapIDLength = buffer.readUint16();
    const ioFiltersEncodedLength = buffer.readUint16();

    const header = {
      version,
      heapIDLength,
      ioFiltersEncodedLength,
      flags: buffer.readByte(),
      maximumSizeOfManagedObjects: buffer.readUint32(),
      nextHugeObjectID: buffer.readLength(),
      v2BTreeAddressOfHugeObjects: buffer.readOffset(),
      amountOfFreeSpaceInManagedBlocks: buffer.readLength(),
      addressOfManagedBlockFreeSpaceManager: buffer.readOffset(),
      amountOfManagedSpaceInHeap: buffer.readLength(),
      amountOfAllocatedManagedSpaceInHeap: buffer.readLength(),
      offsetOfDirectBlockAllocationIteratorInManagedSpace: buffer.readLength(),
      numberOfManagedObjectsInHeap: buffer.readLength(),
      sizeOfHugeObjectsInHeap: buffer.readLength(),
      numberOfHugeObjectsInHeap: buffer.readLength(),
      sizeOfTinyObjectsInHeap: buffer.readLength(),
      numberOfTinyObjectsInHeap: buffer.readLength(),
      tableWidth: buffer.readUint16(),
      startingBlockSize: buffer.readLength(),
      maximumDirectBlockSize: buffer.readLength(),
      maximumHeapSize: buffer.readUint16(),
      startingNumberOfRowsInRootIndirectBlock: buffer.readUint16(),
      addressOfRootBlock: buffer.readOffset(),
      currentNumberOfRowsInRootIndirectBlock: buffer.readUint16(),
      sizeOfFilteredRootDirectBlock: ioFiltersEncodedLength ? buffer.readLength() : null,
      ioFilterMask: ioFiltersEncodedLength ? buffer.readUint32() : null,
      ioFilterInformation: ioFiltersEncodedLength ? buffer.readBytes(ioFiltersEncodedLength) : null,
    };
    return new FractalHeap(header);
  } finally {
    buffer.popMark();
  }
}
