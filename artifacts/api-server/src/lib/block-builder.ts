import * as crypto from "crypto";
import type { BlockTemplate } from "./rpc";

function sha256(buffer: Buffer): Buffer {
  return crypto.createHash("sha256").update(buffer).digest();
}

function sha256d(buffer: Buffer): Buffer {
  return sha256(sha256(buffer));
}

function reverseBuffer(buff: Buffer): Buffer {
  const reversed = Buffer.alloc(buff.length);
  for (let i = buff.length - 1; i >= 0; i--)
    reversed[buff.length - i - 1] = buff[i];
  return reversed;
}

function reverseHex(hex: string): string {
  return reverseBuffer(Buffer.from(hex, "hex")).toString("hex");
}

function uint256BufferFromHash(hex: string): Buffer {
  const fromHex = Buffer.from(hex, "hex");
  if (fromHex.length !== 32) {
    const empty = Buffer.alloc(32);
    fromHex.copy(empty);
    return reverseBuffer(empty);
  }
  return reverseBuffer(fromHex);
}

function varIntBuffer(n: number): Buffer {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) {
    const buff = Buffer.alloc(3);
    buff[0] = 0xfd;
    buff.writeUInt16LE(n, 1);
    return buff;
  }
  if (n <= 0xffffffff) {
    const buff = Buffer.alloc(5);
    buff[0] = 0xfe;
    buff.writeUInt32LE(n, 1);
    return buff;
  }
  const buff = Buffer.alloc(9);
  buff[0] = 0xff;
  buff.writeUInt32LE(n, 1);
  buff.writeUInt32LE(Math.floor(n / 0x100000000), 5);
  return buff;
}

function serializeNumber(n: number): Buffer {
  if (n >= 1 && n <= 16) return Buffer.from([0x50 + n]);
  let l = 1;
  const buff = Buffer.alloc(9);
  while (n > 0x7f) {
    buff.writeUInt8(n & 0xff, l++);
    n >>= 8;
  }
  buff.writeUInt8(l, 0);
  buff.writeUInt8(n, l++);
  return buff.slice(0, l);
}

function serializeString(s: string): Buffer {
  const buf = Buffer.from(s);
  if (buf.length < 253)
    return Buffer.concat([Buffer.from([buf.length]), buf]);
  if (buf.length < 0x10000)
    return Buffer.concat([Buffer.from([253]), packUInt16LE(buf.length), buf]);
  return Buffer.concat([Buffer.from([254]), packUInt32LE(buf.length), buf]);
}

function packUInt16LE(num: number): Buffer {
  const buff = Buffer.alloc(2);
  buff.writeUInt16LE(num, 0);
  return buff;
}

function packUInt32LE(num: number): Buffer {
  const buff = Buffer.alloc(4);
  buff.writeUInt32LE(num, 0);
  return buff;
}

function packInt64LE(num: number): Buffer {
  const buff = Buffer.alloc(8);
  buff.writeUInt32LE(num % 2 ** 32, 0);
  buff.writeUInt32LE(Math.floor(num / 2 ** 32), 4);
  return buff;
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_MAP: Record<string, bigint> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  ALPHABET_MAP[ALPHABET.charAt(i)] = BigInt(i);
}
const BASE58 = 58n;

function base58Decode(str: string): Buffer {
  let num = 0n;
  for (let i = 0; i < str.length; i++) {
    num = num * BASE58 + ALPHABET_MAP[str[i]];
  }
  let leadingZeros = 0;
  for (let i = 0; i < str.length && str[i] === "1"; i++) {
    leadingZeros++;
  }
  const hex = num.toString(16);
  const hexPadded = hex.length % 2 === 0 ? hex : "0" + hex;
  return Buffer.concat([
    Buffer.alloc(leadingZeros),
    Buffer.from(hexPadded, "hex"),
  ]);
}

function addressToScript(addr: string): Buffer {
  const decoded = base58Decode(addr);
  const pubkeyHash = decoded.slice(1, -4);
  return Buffer.concat([
    Buffer.from([0x76, 0xa9, 0x14]),
    pubkeyHash,
    Buffer.from([0x88, 0xac]),
  ]);
}

function buildCoinbaseTx(
  height: number,
  minerAmount: number,
  minerScript: Buffer,
  devAmount: number,
  devScript: Buffer,
  extraNonce1: string,
  extraNonce2: string,
): Buffer {
  const parts = buildCoinbaseParts(height, minerAmount, minerScript, devAmount, devScript);
  const e1 = Buffer.from(extraNonce1, "hex");
  const e2 = Buffer.from(extraNonce2, "hex");
  return Buffer.concat([parts.coinb1, e1, e2, parts.coinb2]);
}

function buildCoinbaseParts(
  height: number,
  minerAmount: number,
  minerScript: Buffer,
  devAmount: number,
  devScript: Buffer,
): { coinb1: Buffer; coinb2: Buffer } {
  const txVersion = 1;
  const txLockTime = 0;
  const txInPrevOutHash = "";
  const txInPrevOutIndex = 0xffffffff;
  const txInSequence = 0;
  const extranonceLen = 8;

  const scriptSigPrelude = Buffer.concat([
    serializeNumber(height),
    Buffer.alloc(0),
    serializeNumber(Math.floor(Date.now() / 1000)),
  ]);

  const scriptSigPostlude = serializeString("/LegacyPool/");

  const beforeExtranonce = Buffer.concat([
    scriptSigPrelude,
    Buffer.from([extranonceLen]),
  ]);

  const fullScriptSigLen = beforeExtranonce.length + extranonceLen + scriptSigPostlude.length;

  const coinb1 = Buffer.concat([
    packUInt32LE(txVersion),
    varIntBuffer(1),
    uint256BufferFromHash(txInPrevOutHash),
    packUInt32LE(txInPrevOutIndex),
    varIntBuffer(fullScriptSigLen),
    beforeExtranonce,
  ]);

  const coinb2 = Buffer.concat([
    scriptSigPostlude,
    packUInt32LE(txInSequence),
    varIntBuffer(2),
    Buffer.concat([packInt64LE(minerAmount), varIntBuffer(minerScript.length), minerScript]),
    Buffer.concat([packInt64LE(devAmount), varIntBuffer(devScript.length), devScript]),
    packUInt32LE(txLockTime),
  ]);

  return { coinb1, coinb2 };
}

function buildMerkleTree(txHashes: Buffer[]): Buffer {
  if (txHashes.length === 0) throw new Error("empty merkle tree");
  let level = txHashes.map(h => h);
  while (level.length > 1) {
    if (level.length % 2 !== 0) {
      level.push(level[level.length - 1]);
    }
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(sha256d(Buffer.concat([level[i], level[i + 1]])));
    }
    level = next;
  }
  return level[0];
}

function buildMerkleBranch(txHashes: Buffer[]): string[] {
  if (txHashes.length <= 1) return [];
  const branch: string[] = [];
  let level = txHashes;
  while (level.length > 1) {
    branch.push(level[1].toString("hex"));
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : a;
      next.push(sha256d(Buffer.concat([a, b])));
    }
    level = next;
  }
  return branch;
}

// Decodes template transactions in the order the node returned them (already
// topologically sorted, see template `depends`). Returns null when any entry is
// unusable so the caller can fall back to a coinbase-only block instead of
// building a block that cannot be serialized.
function templateTxBuffers(template: BlockTemplate): Buffer[] | null {
  const out: Buffer[] = [];
  for (const tx of template.transactions ?? []) {
    const data = tx?.data;
    if (typeof data !== "string" || data.length === 0 || data.length % 2 !== 0) return null;
    if (!/^[0-9a-fA-F]+$/.test(data)) return null;
    const buf = Buffer.from(data, "hex");
    if (buf.length !== data.length / 2) return null;
    out.push(buf);
  }
  return out;
}

function buildBlock(
  template: BlockTemplate,
  coinbaseTx: Buffer,
  nonce: string,
  nTimeHex?: string,
  includeTransactions = true,
): { blockHex: string; headerHash: Buffer } {
  // Include mempool transactions so the block actually settles them. A stale
  // template may still be rejected with bad-txns-*; that risk is bounded by the
  // 20s job refresh instead of permanently mining empty blocks.
  const mempoolTxs = includeTransactions ? templateTxBuffers(template) : null;
  const txBuffers: Buffer[] = mempoolTxs ? [coinbaseTx, ...mempoolTxs] : [coinbaseTx];
  const txHashes: Buffer[] = txBuffers.map(sha256d);
  const merkleRoot = buildMerkleTree(txHashes);

  // Use miner's nTime if provided, otherwise fall back to template.curtime
  const nTime = nTimeHex ? parseInt(nTimeHex, 16) : template.curtime;
  const nBits = parseInt(template.bits, 16);
  const nNonce = parseInt(nonce.padStart(8, "0"), 16);

  const header = Buffer.alloc(80);
  header.writeUInt32LE(template.version, 0);
  const prevBlock = reverseBuffer(Buffer.from(template.previousblockhash, "hex"));
  prevBlock.copy(header, 4);
  merkleRoot.copy(header, 36);
  header.writeUInt32LE(nTime, 68);
  header.writeUInt32LE(nBits, 72);
  header.writeUInt32LE(nNonce, 76);

  const headerHash = sha256d(header);

  const fullBlock = Buffer.concat([
    header,
    varIntBuffer(txBuffers.length),
    ...txBuffers,
  ]);

  return { blockHex: fullBlock.toString("hex"), headerHash };
}

export { buildBlock, buildCoinbaseParts, buildMerkleTree, buildMerkleBranch, addressToScript, sha256d, templateTxBuffers };
