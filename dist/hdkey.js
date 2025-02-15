"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HDKey = exports.HARDENED_OFFSET = exports.MASTER_SECRET = void 0;
const ed25519_1 = require("@noble/curves/ed25519");
const hmac_1 = require("@noble/hashes/hmac");
const ripemd160_1 = require("@noble/hashes/ripemd160");
const sha256_1 = require("@noble/hashes/sha256");
const sha512_1 = require("@noble/hashes/sha512");
const utils_1 = require("@noble/hashes/utils");
const _assert_1 = require("@noble/hashes/_assert");
exports.MASTER_SECRET = (0, utils_1.utf8ToBytes)('ed25519 seed');
exports.HARDENED_OFFSET = 0x80000000;
const ZERO = new Uint8Array([0]);
function ensureBytes(b, ...lengths) {
    if (typeof b === 'string')
        b = (0, utils_1.hexToBytes)(b);
    (0, _assert_1.bytes)(b, ...lengths);
    return b;
}
const hash160 = (data) => (0, ripemd160_1.ripemd160)((0, sha256_1.sha256)(data));
const fromU32 = (data) => (0, utils_1.createView)(data).getUint32(0, false);
const toU32 = (n) => {
    if (!Number.isSafeInteger(n) || n < 0 || n > 2 ** 32 - 1) {
        throw new Error(`Invalid number=${n}. Should be from 0 to 2 ** 32 - 1`);
    }
    const buf = new Uint8Array(4);
    (0, utils_1.createView)(buf).setUint32(0, n, false);
    return buf;
};
class HDKey {
    get publicKeyRaw() {
        return ed25519_1.ed25519.getPublicKey(this.privateKey);
    }
    get publicKey() {
        return (0, utils_1.concatBytes)(ZERO, this.publicKeyRaw);
    }
    get pubHash() {
        return hash160(this.publicKey);
    }
    get fingerprint() {
        return fromU32(this.pubHash);
    }
    get fingerprintHex() {
        return (0, utils_1.bytesToHex)(toU32(this.fingerprint));
    }
    get parentFingerprintHex() {
        return (0, utils_1.bytesToHex)(toU32(this.parentFingerprint));
    }
    static fromMasterSeed(seed) {
        seed = ensureBytes(seed);
        if (8 * seed.length < 128 || 8 * seed.length > 512) {
            throw new Error(`HDKey: wrong seed length=${seed.length}. Should be between 128 and 512 bits; 256 bits is advised)`);
        }
        const I = (0, hmac_1.hmac)(sha512_1.sha512, exports.MASTER_SECRET, seed);
        return new HDKey({
            privateKey: I.slice(0, 32),
            chainCode: I.slice(32),
        });
    }
    constructor(opt) {
        this.depth = 0;
        this.index = 0;
        this.parentFingerprint = 0;
        if (!opt || typeof opt !== 'object')
            throw new Error('HDKey.constructor must not be called directly');
        (0, _assert_1.bytes)(opt.privateKey, 32);
        (0, _assert_1.bytes)(opt.chainCode, 32);
        this.depth = opt.depth || 0;
        this.index = opt.index || 0;
        this.parentFingerprint = opt.parentFingerprint || 0;
        if (!this.depth) {
            if (this.parentFingerprint || this.index)
                throw new Error('HDKey: zero depth with non-zero index/parent fingerprint');
        }
        this.chainCode = opt.chainCode;
        this.privateKey = opt.privateKey;
    }
    derive(path, forceHardened = false) {
        if (!/^[mM]'?/.test(path))
            throw new Error('Path must start with "m" or "M"');
        if (/^[mM]'?$/.test(path))
            return this;
        const parts = path.replace(/^[mM]'?\//, '').split('/');
        let child = this;
        for (const c of parts) {
            const m = /^(\d+)('?)$/.exec(c);
            if (!m || m.length !== 3)
                throw new Error(`Invalid child index: ${c}`);
            let idx = +m[1];
            if (!Number.isSafeInteger(idx) || idx >= exports.HARDENED_OFFSET)
                throw new Error('Invalid index');
            if (forceHardened || m[2] === "'")
                idx += exports.HARDENED_OFFSET;
            child = child.deriveChild(idx);
        }
        return child;
    }
    deriveChild(index) {
        if (index < exports.HARDENED_OFFSET)
            throw new Error(`Non-hardened child derivation not possible for Ed25519 (index=${index})`);
        const data = (0, utils_1.concatBytes)(ZERO, this.privateKey, toU32(index));
        const I = (0, hmac_1.hmac)(sha512_1.sha512, this.chainCode, data);
        return new HDKey({
            chainCode: I.slice(32),
            depth: this.depth + 1,
            parentFingerprint: this.fingerprint,
            index,
            privateKey: I.slice(0, 32),
        });
    }
    sign(message) {
        return ed25519_1.ed25519.sign(message, this.privateKey);
    }
    verify(message, signature) {
        signature = ensureBytes(signature, 64);
        return ed25519_1.ed25519.verify(signature, message, this.publicKeyRaw);
    }
}
exports.HDKey = HDKey;
