"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeys = exports.parseAddress = exports.formatPublicKey = void 0;
const ed25519_1 = require("@noble/curves/ed25519");
const sha3_1 = require("@noble/hashes/sha3");
const base_1 = require("@scure/base");
const micro_packed_1 = require("micro-packed");
const ADDRESS_VERSION = new Uint8Array([0x03]);
function formatPublicKey(pubBytes) {
    const checksum = (0, sha3_1.sha3_256)((0, micro_packed_1.concatBytes)(base_1.utf8.decode('.onion checksum'), pubBytes, ADDRESS_VERSION));
    const addr = (0, micro_packed_1.concatBytes)(pubBytes, checksum.slice(0, 2), ADDRESS_VERSION);
    return `${base_1.base32.encode(addr).toLowerCase()}.onion`;
}
exports.formatPublicKey = formatPublicKey;
function parseAddress(address) {
    if (!address.endsWith('.onion'))
        throw new Error('Address must end with .onion');
    const addr = base_1.base32.decode(address.replace(/\.onion$/, '').toUpperCase());
    const skip = addr.slice(0, addr.length - 3);
    const key = formatPublicKey(skip);
    if (key !== address)
        throw new Error('Invalid checksum');
    return skip;
}
exports.parseAddress = parseAddress;
async function getKeys(seed) {
    const { head, prefix, pointBytes } = await ed25519_1.ed25519.utils.getExtendedPublicKey(seed);
    const added = (0, micro_packed_1.concatBytes)(head, prefix);
    return {
        publicKeyBytes: pointBytes,
        publicKey: formatPublicKey(pointBytes),
        privateKey: `ED25519-V3:${base_1.base64.encode(added)}`,
    };
}
exports.getKeys = getKeys;
exports.default = getKeys;
