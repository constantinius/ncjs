import { parseFractalHeap } from './fractal-heap';
import { parseMessage, parseSharedMessage } from './message';
import { readData } from './data-reading';

class DataObject {
  constructor(buffer, times, attributeLimits, messages) {
    this._buffer = buffer;
    this._times = times;
    this._attributeLimits = attributeLimits;
    this._messages = messages;
  }

  get accessTime() {
    return this._times.access;
  }

  get modificationTime() {
    return this._times.modification;
  }

  get changeTime() {
    return this._times.change;
  }

  get birthTime() {
    return this._times.birth;
  }

  get maximumCompactAttributes() {
    return this._attributeLimits.maximumCompactAttributes;
  }

  get minimumDenseAttributes() {
    return this._attributeLimits.minimumDenseAttributes;
  }

  get messages() {
    return this._messages;
  }

  getMessage(type) {
    for (let i = 0; i < this._messages.length; ++i) {
      const message = this._messages[i];
      if (type === message.type) {
        return message;
      }
    }
    return null;
  }

  * getLinks() {
    const linkInfoMessage = this.getMessage(0x0002);
    if (linkInfoMessage) {
      const heap = parseFractalHeap(this._buffer, linkInfoMessage.fractalHeapAddress);

      for (const block of heap.iterBlocks(this._buffer)) {
        const { dataAddress, dataSize } = block;
        this._buffer.pushMark();
        try {
          this._buffer.seek(dataAddress);
          while (this._buffer.offset < dataAddress + dataSize) {
            yield parseMessage(this._buffer, 0x0006, undefined, 0);
          }
        } finally {
          this._buffer.popMark();
        }
      }
    }
  }

  getChildObject(name) {
    for (const link of this.getLinks()) {
      if (link.linkName === name) {
        if (link.linkType === 'soft') {
          return this.getChildObject(link.address);
        } else if (link.linkType === 'hard') {
          // eslint-disable-next-line no-use-before-define
          return parseObjectHeader(this._buffer, link.address);
        }
      }
    }
    return null;
  }

  getChildNames() {
    return Array.from(this.getLinks()).map(link => link.linkName);
  }

  getAttributes() {
    const attributeMessages = this._messages.filter(message => message.type === 0x000C);
    const attributes = {};
    for (const attributeMessage of attributeMessages) {
      attributes[attributeMessage.attributeName] = attributeMessage.attributeValue;
    }
    return attributes;
  }

  readData() {
    const dataLayoutMessage = this._messages.find(message => message.type === 0x0008);
    const dataTypeMessage = this._messages.find(message => message.type === 0x0003);
    const dataSpaceMessage = this._messages.find(message => message.type === 0x0001);
    const filterMessages = this._messages.find(message => message.type === 0x000B);
    return readData(
      this._buffer, dataLayoutMessage, dataTypeMessage, dataSpaceMessage, filterMessages.filters
    );
  }
}

function parseObjectHeaderContinuationBlock(buffer, address, length) {
  buffer.pushMark();
  try {
    buffer.seek(address);
    if (buffer.readChars(4) !== 'OCHK') {
      throw new Error(`Location ${address.toString(16)} is not an object header continuation block.`);
    }

    const messages = [];
    const initialOffset = buffer.offset;
    while (buffer.offset + 4 < address + length) {
      const messageType = buffer.readByte();
      const messageSize = buffer.readUint16();
      const messageFlags = buffer.readByte();

      if (messageFlags & 0b0100) {
        buffer.skip(2);
      }

      if (messageFlags & 0b10) {
        messages.push(parseSharedMessage(buffer, messageType, messageSize, messageFlags));
      } else {
        messages.push(parseMessage(buffer, messageType, messageSize, messageFlags));
      }
    }
    return messages;
  } finally {
    buffer.popMark();
  }
}

export function parseObjectHeader(buffer, address) {
  buffer.pushMark();
  buffer.seek(address);

  try {
    if (buffer.readChars(4) !== 'OHDR') {
      throw new Error(`Location ${address.toString(16)} is not an object.`);
    }

    const chunkSizeMask = 0b00000011;
    const creationOrderTrackedMask = 0b00000100;
    const creationOrderIndexedMask = 0b00001000;
    const attributeMask = 0b00010000;
    const timesMask = 0b00100000;

    // const chunkSizeMask = 0b11000000;
    // const attributeMask = 0b00010000;
    // const timesMask = 0b00001000;

    const [version, flags] = buffer.readBytes(2);

    let times = {};
    if (flags & timesMask) {
      times = {
        access: new Date(buffer.readUint32() * 1000),
        modification: new Date(buffer.readUint32() * 1000),
        change: new Date(buffer.readUint32() * 1000),
        birth: new Date(buffer.readUint32() * 1000),
      };
    }

    let attributeLimits = {};
    if (flags & attributeMask) {
      attributeLimits = {
        maximumCompactAttributes: buffer.readUint16(),
        minimumDenseAttributes: buffer.readUint16(),
      };
    }

    const creationOrderTracked = !!(flags & creationOrderTrackedMask);
    const creationOrderIndexed = !!(flags & creationOrderIndexedMask);

    const chunkSize = buffer.readUintVar(1 << (flags & chunkSizeMask));

    let messages = [];
    const continuationMessages = [];
    const initialOffset = buffer.offset;
    while (buffer.offset < initialOffset + chunkSize) {
      const messageType = buffer.readByte();
      const messageSize = buffer.readUint16();
      const messageFlags = buffer.readByte();
      if (creationOrderTracked) {
        buffer.skip(2);
      }
      const message = parseMessage(buffer, messageType, messageSize, messageFlags);
      messages.push(message);
      if (messageType === 0x0010) {
        continuationMessages.push(message);
      }
    }

    for (const message of continuationMessages) {
      messages = messages.concat(
        parseObjectHeaderContinuationBlock(buffer, message.offset, message.length)
      );
    }

    return new DataObject(buffer, times, attributeLimits, messages);
  } finally {
    buffer.popMark();
  }
}
