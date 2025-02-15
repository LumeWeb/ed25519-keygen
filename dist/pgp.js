"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeys = exports.formatPrivate = exports.formatPublic = exports.privArmor = exports.pubArmor = exports.decodeSecretKey = exports.Stream = exports.PubKeyPacket = exports.PacketLen = exports.oid = exports.opaquempi = exports.mpi = void 0;
const ed25519_1 = require("@noble/curves/ed25519");
const sha1_1 = require("@noble/hashes/sha1");
const ripemd160_1 = require("@noble/hashes/ripemd160");
const sha256_1 = require("@noble/hashes/sha256");
const sha512_1 = require("@noble/hashes/sha512");
const sha3_1 = require("@noble/hashes/sha3");
const utils_1 = require("@noble/hashes/utils");
const crypto_1 = require("@noble/hashes/crypto");
const P = __importStar(require("micro-packed"));
const micro_packed_1 = require("micro-packed");
const base_1 = require("@scure/base");
function numberToHexUnpadded(num) {
    let hex = num.toString(16);
    hex = hex.length & 1 ? `0${hex}` : hex;
    return hex;
}
function bytesToNumber(bytes) {
    return BigInt('0x' + base_1.hex.encode(bytes));
}
function equalBytes(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
const BLOCK_LEN = 16;
const IV = new Uint8Array(BLOCK_LEN);
async function runAesBlock(msg, key) {
    if (key.length !== 16 && key.length !== 32)
        throw new Error('Invalid key length');
    if (!crypto_1.crypto)
        throw new Error('crypto.subtle must be defined');
    const mode = { name: `AES-CBC`, length: key.length * 8 };
    const wKey = await crypto_1.crypto.subtle.importKey('raw', key, mode, true, ['encrypt']);
    const cipher = await crypto_1.crypto.subtle.encrypt({ name: `aes-cbc`, iv: IV, counter: IV, length: 64 }, wKey, msg);
    return new Uint8Array(cipher).subarray(0, 16);
}
async function runAesCfb(keyLen, data, key, iv, decrypt = false) {
    if (keyLen !== key.length * 8)
        throw new Error('AesCfbProcess: wrong key length');
    if (iv.length !== 16)
        throw new Error('AesCfbProcess: wrong IV');
    const blocks = [];
    let prevBlock = iv;
    for (let i = 0; i < data.length; i += 16) {
        const curBlock = data.subarray(i, i + 16);
        const enc = await runAesBlock(prevBlock, key);
        const outBlock = curBlock.slice();
        for (let j = 0; j < outBlock.length; j++)
            outBlock[j] ^= enc[j];
        blocks.push(outBlock);
        prevBlock = decrypt ? curBlock : outBlock;
    }
    return (0, micro_packed_1.concatBytes)(...blocks);
}
function createAesCfb(len) {
    return {
        encrypt: (plaintext, key, iv) => runAesCfb(len, plaintext, key, iv),
        decrypt: (ciphertext, key, iv) => runAesCfb(len, ciphertext, key, iv, true),
    };
}
exports.mpi = P.wrap({
    encodeStream: (w, value) => {
        let bitLen = 0;
        for (let v = value; v > 0n; v >>= 1n, bitLen++)
            ;
        P.U16BE.encodeStream(w, bitLen);
        w.bytes(base_1.hex.decode(numberToHexUnpadded(value)));
    },
    decodeStream: (r) => bytesToNumber(r.bytes((P.U16BE.decodeStream(r) + 7) >>> 3)),
});
exports.opaquempi = P.wrap({
    encodeStream: (w, value) => {
        P.U16BE.encodeStream(w, value.length * 8);
        w.bytes(value);
    },
    decodeStream: (r) => r.bytes((P.U16BE.decodeStream(r) + 7) >>> 3),
});
const OID_MSB = 2 ** 7;
const OID_NO_MSB = 2 ** 7 - 1;
exports.oid = P.wrap({
    encodeStream: (w, value) => {
        const items = value.split('.').map((i) => +i);
        let oid = [items[0] * 40];
        if (items.length >= 2)
            oid[0] += items[1];
        for (let i = 2; i < items.length; i++) {
            const item = [];
            for (let n = items[i], mask = 0x00; n; n >>= 7, mask = OID_MSB)
                item.unshift((n & OID_NO_MSB) | mask);
            oid = oid.concat(item);
        }
        w.bytes(new Uint8Array(oid));
    },
    decodeStream: (r) => {
        if (r.isEnd())
            throw new Error('PGP: empty oid');
        const first = r.byte();
        let res = `${Math.floor(first / 40)}.${first % 40}`;
        for (let num = 0; !r.isEnd();) {
            const byte = r.byte();
            num = (num << 7) | (byte & OID_NO_MSB);
            if (byte & OID_MSB)
                continue;
            res += `.${num >>> 0}`;
            num = 0;
        }
        return res;
    },
});
exports.PacketLen = P.wrap({
    encodeStream: (w, value) => {
        if (typeof value !== 'number')
            throw new Error(`PGP.PacketLen invalid length type, ${value}`);
        if (value < 192)
            w.byte(value);
        else if (value < 8383) {
            value -= 192;
            w.bytes(new Uint8Array([(value >> 8) + 192, value & 0xff]));
        }
        else if (value < 2 ** 32) {
            w.byte(0xff);
            P.U32BE.encodeStream(w, value);
        }
        else
            throw new Error(`PGP.PacketLen: length is too big: ${value}`);
    },
    decodeStream: (r) => {
        let res;
        const first = r.byte();
        if (first < 192)
            res = first;
        else if (first < 224)
            res = ((first - 192) << 8) + r.byte() + 192;
        else if (first == 255)
            res = P.U32BE.decodeStream(r);
        else
            throw new Error('PGP.PacketLen: Partial body lengths unsupported');
        return res;
    },
});
const PGP_PACKET_VERSION = P.magic(P.hex(1), '04');
const pubKeyEnum = P.map(P.U8, {
    ECDH: 18,
    ECDSA: 19,
    EdDSA: 22,
});
const ECEnum = P.map(P.prefix(P.U8, exports.oid), {
    nistP256: '1.2.840.10045.3.1.7',
    nistP384: '1.3.132.0.34',
    nistP521: '1.3.132.0.35',
    brainpoolP256r1: '1.3.36.3.3.2.8.1.1.7',
    brainpoolP384r1: '1.3.36.3.3.2.8.1.1.11',
    brainpoolP512r1: '1.3.36.3.3.2.8.1.1.13',
    secp256k1: '1.3.132.0.10',
    curve25519: '1.3.6.1.4.1.3029.1.5.1',
    ed25519: '1.3.6.1.4.1.11591.15.1',
});
const HashEnum = P.map(P.U8, {
    md5: 1,
    sha1: 2,
    ripemd160: 3,
    sha224: 11,
    sha256: 8,
    sha384: 9,
    sha512: 10,
    sha3_256: 12,
    sha3_512: 14,
});
const Hash = { ripemd160: ripemd160_1.ripemd160, sha256: sha256_1.sha256, sha512: sha512_1.sha512, sha3_256: sha3_1.sha3_256, sha1: sha1_1.sha1 };
const EncryptionEnum = P.map(P.U8, {
    plaintext: 0,
    idea: 1,
    tripledes: 2,
    cast5: 3,
    blowfish: 4,
    aes128: 7,
    aes192: 8,
    aes256: 9,
    twofish: 10,
});
const EncryptionKeySize = {
    plaintext: 0,
    aes128: 16,
    aes192: 24,
    aes256: 32,
};
const CompressionEnum = P.map(P.U8, {
    uncompressed: 0,
    zip: 1,
    zlib: 2,
    bzip2: 3,
});
const AEADEnum = P.map(P.U8, {
    None: 0,
    EAX: 1,
    OCB: 2,
});
const S2KEnum = P.map(P.U8, { simple: 0, salted: 1, iterated: 3 });
const S2K = P.tag(S2KEnum, {
    simple: P.struct({ hash: HashEnum }),
    salted: P.struct({ hash: HashEnum, salt: P.bytes(8) }),
    iterated: P.struct({ hash: HashEnum, salt: P.bytes(8), count: P.U8 }),
});
const ECDSAPub = P.struct({ curve: ECEnum, pub: exports.mpi });
const ECDHPub = P.struct({
    curve: ECEnum,
    pub: exports.mpi,
    params: P.prefix(P.U8, P.struct({
        magic: P.magic(P.hex(1), '01'),
        hash: HashEnum,
        encryption: EncryptionEnum,
    })),
});
exports.PubKeyPacket = P.struct({
    version: PGP_PACKET_VERSION,
    created: P.U32BE,
    algo: P.tag(pubKeyEnum, {
        EdDSA: ECDSAPub,
        ECDH: ECDHPub,
    }),
});
const PlainSecretKey = P.struct({
    secret: P.bytes(null),
});
const EncryptedSecretKey = P.struct({
    enc: EncryptionEnum,
    S2K,
    iv: P.bytes(16),
    secret: P.bytes(null),
});
const SecretKeyPacket = P.struct({
    pub: exports.PubKeyPacket,
    type: P.mappedTag(P.U8, {
        plain: [0x00, PlainSecretKey],
        encrypted: [254, EncryptedSecretKey],
        encrypted2: [255, EncryptedSecretKey],
    }),
});
const SigTypeEnum = P.map(P.U8, {
    binary: 0x00,
    text: 0x01,
    standalone: 0x02,
    certGeneric: 0x10,
    certPersona: 0x11,
    certCasual: 0x12,
    certPositive: 0x13,
    subkeyBinding: 0x18,
    keyBinding: 0x19,
    key: 0x1f,
    keyRevocation: 0x20,
    subkeyRevocation: 0x28,
    certRevocation: 0x30,
    timestamp: 0x40,
    thirdParty: 0x50,
});
const signatureSubpacket = P.map(P.U8, {
    signatureCreationTime: 2,
    signatureExpirationTime: 3,
    exportableCertification: 4,
    trustSignature: 5,
    regularExpression: 6,
    revocable: 7,
    keyExpirationTime: 9,
    placeholderBackwardsCompatibility: 10,
    preferredEncryptionAlgorithms: 11,
    revocationKey: 12,
    issuer: 16,
    notationData: 20,
    preferredHashAlgorithms: 21,
    preferredCompressionAlgorithms: 22,
    keyServerPreferences: 23,
    preferredKeyServer: 24,
    primaryUserID: 25,
    policyURI: 26,
    keyFlags: 27,
    signersUserID: 28,
    reasonForRevocation: 29,
    features: 30,
    signatureTarget: 31,
    embeddedSignature: 32,
    issuerFingerprint: 33,
    preferredAEADAlgorithms: 34,
    intendedRecipientFingerprint: 35,
    attestedCertifications: 37,
    keyBlock: 38,
});
const SignatureSubpacket = P.prefix(exports.PacketLen, P.tag(signatureSubpacket, {
    issuerFingerprint: P.struct({ version: PGP_PACKET_VERSION, fingerprint: P.hex(20) }),
    signatureCreationTime: P.U32BE,
    keyFlags: P.bitset([
        '_r',
        'shared',
        'auth',
        'split',
        'encrypt',
        'encryptComm',
        'sign',
        'certify',
    ]),
    preferredEncryptionAlgorithms: P.array(null, EncryptionEnum),
    preferredHashAlgorithms: P.array(null, HashEnum),
    preferredCompressionAlgorithms: P.array(null, CompressionEnum),
    preferredAEADAlgorithms: P.array(null, AEADEnum),
    features: P.bitset(['_r', '_r', '_r', '_r', '_r', 'v5Keys', 'aead', 'modDetect']),
    keyServerPreferences: P.bitset(['modDetect'], true),
    issuer: P.hex(8),
    primaryUserID: P.bool,
}));
const SignatureSubpackets = P.prefix(P.U16BE, P.array(null, SignatureSubpacket));
const SignatureHead = P.struct({
    version: PGP_PACKET_VERSION,
    type: SigTypeEnum,
    algo: pubKeyEnum,
    hash: HashEnum,
    hashed: SignatureSubpackets,
});
const SignaturePacket = P.struct({
    head: SignatureHead,
    unhashed: SignatureSubpackets,
    hashPrefix: P.bytes(2),
    sig: P.array(null, exports.mpi),
});
const UserPacket = P.string(null);
const EXPBIAS6 = (count) => (16 + (count & 15)) << ((count >> 4) + 6);
function deriveKey(hash, len, password, salt, count) {
    count = count === undefined ? 0 : EXPBIAS6(count);
    const data = salt ? (0, micro_packed_1.concatBytes)(salt, password) : password;
    let out = new Uint8Array([]);
    const hashC = Hash[hash];
    if (!hashC)
        throw new Error('PGP.deriveKey: unknown hash');
    const rounds = Math.ceil(len / hashC.outputLen);
    for (let r = 0; r < rounds; r++) {
        const h = hashC.create();
        if (r > 0)
            h.update(new Uint8Array(r));
        for (let c = Math.max(count, data.length); c > 0;) {
            const take = Math.min(c, data.length);
            h.update(data.subarray(0, take));
            c -= take;
        }
        out = (0, micro_packed_1.concatBytes)(h.digest());
    }
    return out.subarray(0, len);
}
const Encryption = {
    aes128: createAesCfb(128),
    aes192: createAesCfb(192),
    aes256: createAesCfb(256),
};
const hashTail = new Uint8Array([0x04, 0xff]);
const hashPubKey = P.struct({
    magic: P.magic(P.hex(1), '99'),
    pubKey: P.prefix(P.U16BE, exports.PubKeyPacket),
});
const hashUser = P.struct({
    magic: P.magic(P.hex(1), 'b4'),
    user: P.prefix(P.U32BE, UserPacket),
});
const hashSelfCert = P.struct({ pubKey: hashPubKey, user: hashUser });
const hashSubKeyCert = P.struct({ pubKey: hashPubKey, subKey: hashPubKey });
function hashSignature(head, data) {
    const hashC = Hash[head.hash];
    if (!hashC)
        throw new Error('PGP.hashSignature: unknown hash');
    const h = hashC.create();
    if (['certGeneric', 'certPersona', 'certCasual', 'certPositive'].includes(head.type))
        h.update(hashSelfCert.encode(data));
    else if (head.type === 'subkeyBinding')
        h.update(hashSubKeyCert.encode(data));
    else
        throw new Error('Unknown signature type');
    const sigData = SignatureHead.encode(head);
    h.update(sigData).update(hashTail).update(P.U32BE.encode(sigData.length));
    return h.digest();
}
const getFingerprint = (pubKey) => base_1.hex.encode((0, sha1_1.sha1)(hashPubKey.encode({ pubKey })));
const getKeyId = (fp) => fp.slice(-16);
function crc24(data) {
    let crc = 0xb704ce;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i] << 16;
        for (let j = 0; j < 8; j++) {
            crc <<= 1;
            if (crc & 0x1000000)
                crc ^= 0x1864cfb;
        }
    }
    return new Uint8Array([(crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff]);
}
const PacketTags = {
    userId: UserPacket,
    signature: SignaturePacket,
    publicKey: exports.PubKeyPacket,
    publicSubkey: exports.PubKeyPacket,
    secretKey: SecretKeyPacket,
    secretSubkey: SecretKeyPacket,
};
const PacketHead = P.struct({
    magic: P.magic(P.bits(1), 1),
    version: P.magic(P.bits(1), 0),
    tag: P.map(P.bits(4), {
        public_key_encrypted_session_key: 1,
        signature: 2,
        symmetric_key_encrypted_session_key: 3,
        onePassSignature: 4,
        secretKey: 5,
        publicKey: 6,
        secretSubkey: 7,
        compressedData: 8,
        encryptedData: 9,
        marker: 10,
        literalData: 11,
        trust: 12,
        userId: 13,
        publicSubkey: 14,
        userAttribute: 17,
        encryptedProtectedData: 18,
        modificationDetectionCode: 19,
    }),
    lenType: P.bits(2),
});
const Packet = P.wrap({
    encodeStream: (w, value) => {
        const data = PacketTags[value.TAG].encode(value.data);
        const lenType = data.length < 2 ** 8 ? 0 : data.length < 2 ** 16 ? 1 : 2;
        PacketHead.encodeStream(w, { tag: value.TAG, lenType });
        [P.U8, P.U16BE, P.U32BE][lenType].encodeStream(w, data.length);
        w.bytes(data);
    },
    decodeStream: (r) => {
        const { tag, lenType } = PacketHead.decodeStream(r);
        const packetLen = lenType !== 3 ? [P.U8, P.U16BE, P.U32BE][lenType].decodeStream(r) : r.data.length - r.pos;
        return { TAG: tag, data: PacketTags[tag].decode(r.bytes(packetLen)) };
    },
});
exports.Stream = P.array(null, Packet);
const EDSIGN = P.array(null, P.U256BE);
async function signData(head, unhashed, data, privateKey) {
    const hash = hashSignature(head, data);
    const hashPrefix = hash.subarray(0, 2);
    const sig = EDSIGN.decode(await ed25519_1.ed25519.sign(hash, privateKey));
    return { head, unhashed, hashPrefix, sig };
}
function decodeSecretChecksum(secret) {
    const [data, checksum] = [secret.slice(0, -2), P.U16BE.decode(secret.slice(-2))];
    let ourChecksum = 0;
    for (let i = 0; i < data.length; i++)
        ourChecksum += data[i];
    ourChecksum %= 65536;
    if (ourChecksum !== checksum)
        throw new Error('PGP.secretKey: wrong checksum for plain encoding');
    return exports.mpi.decode(data);
}
async function decodeSecretKey(password, key) {
    if (key.type.TAG === 'plain')
        return decodeSecretChecksum(key.type.data.secret);
    const keyData = key.type.data;
    const data = keyData.S2K.data;
    const keyLen = EncryptionKeySize[keyData.enc];
    if (keyLen === undefined)
        throw new Error(`PGP.secretKey: unknown encryption mode=${keyData.enc}`);
    const encKey = deriveKey(data.hash, keyLen, base_1.utf8.decode(password), data.salt, data.count);
    const decrypted = await Encryption[keyData.enc].decrypt(keyData.secret, encKey, keyData.iv);
    const decryptedKey = decrypted.subarray(0, -20);
    const checksum = Hash.sha1(decryptedKey);
    if (!equalBytes(decrypted.slice(-20), checksum))
        throw new Error('PGP.secretKey: invalid sha1 checksum');
    if (!['ECDH', 'ECDSA', 'EdDSA'].includes(key.pub.algo.TAG))
        throw new Error(`PGP.secretKey unsupported publicKey algorithm: ${key.pub.algo.TAG}`);
    if (key.type.TAG === 'encrypted2')
        return decodeSecretChecksum(decryptedKey);
    return exports.mpi.decode(decryptedKey);
}
exports.decodeSecretKey = decodeSecretKey;
async function createPrivKey(pub, key, password, salt, iv, hash = 'sha1', count = 240, enc = 'aes128') {
    const keyLen = EncryptionKeySize[enc];
    if (keyLen === undefined)
        throw new Error(`PGP.secretKey: unknown encryption mode=${enc}`);
    const encKey = deriveKey(hash, keyLen, base_1.utf8.decode(password), salt, count);
    const keyBytes = exports.opaquempi.encode(key);
    const secretClear = (0, micro_packed_1.concatBytes)(keyBytes, (0, sha1_1.sha1)(keyBytes));
    const secret = await Encryption[enc].encrypt(secretClear, encKey, iv);
    const S2K = { TAG: 'iterated', data: { hash, salt, count } };
    return { pub, type: { TAG: 'encrypted', data: { enc, S2K, iv, secret } } };
}
exports.pubArmor = P.base64armor('PGP PUBLIC KEY BLOCK', 64, exports.Stream, crc24);
exports.privArmor = P.base64armor('PGP PRIVATE KEY BLOCK', 64, exports.Stream, crc24);
async function getPublicPackets(edPriv, cvPriv, created = 0) {
    const edPub = bytesToNumber((0, micro_packed_1.concatBytes)(new Uint8Array([0x40]), await ed25519_1.ed25519.getPublicKey(edPriv)));
    const edPubPacket = {
        created,
        algo: { TAG: 'EdDSA', data: { curve: 'ed25519', pub: edPub } },
    };
    const cvPoint = ed25519_1.x25519.scalarMultBase(cvPriv);
    const cvPub = bytesToNumber((0, micro_packed_1.concatBytes)(new Uint8Array([0x40]), cvPoint));
    const cvPubPacket = {
        created,
        algo: {
            TAG: 'ECDH',
            data: { curve: 'curve25519', pub: cvPub, params: { hash: 'sha256', encryption: 'aes128' } },
        },
    };
    const fingerprint = getFingerprint(edPubPacket);
    const keyId = getKeyId(fingerprint);
    return { edPubPacket, fingerprint, keyId, cvPubPacket };
}
async function getCerts(edPriv, cvPriv, user, created = 0) {
    const preferredEncryptionAlgorithms = ['aes256', 'aes192', 'aes128', 'tripledes'];
    const preferredHashAlgorithms = ['sha512', 'sha384', 'sha256', 'sha224', 'sha1'];
    const preferredCompressionAlgorithms = ['zlib', 'bzip2', 'zip'];
    const preferredAEADAlgorithms = ['OCB', 'EAX'];
    const { edPubPacket, fingerprint, keyId, cvPubPacket } = await getPublicPackets(edPriv, cvPriv, created);
    const edCert = await signData({
        type: 'certPositive',
        algo: 'EdDSA',
        hash: 'sha512',
        hashed: [
            { TAG: 'issuerFingerprint', data: { fingerprint } },
            { TAG: 'signatureCreationTime', data: created },
            { TAG: 'keyFlags', data: { sign: true, certify: true } },
            { TAG: 'preferredEncryptionAlgorithms', data: preferredEncryptionAlgorithms },
            { TAG: 'preferredAEADAlgorithms', data: preferredAEADAlgorithms },
            { TAG: 'preferredHashAlgorithms', data: preferredHashAlgorithms },
            { TAG: 'preferredCompressionAlgorithms', data: preferredCompressionAlgorithms },
            { TAG: 'features', data: { aead: true, v5Keys: true, modDetect: true } },
            { TAG: 'keyServerPreferences', data: { modDetect: true } },
        ],
    }, [{ TAG: 'issuer', data: keyId }], { pubKey: { pubKey: edPubPacket }, user: { user } }, edPriv);
    const cvCert = await signData({
        type: 'subkeyBinding',
        algo: 'EdDSA',
        hash: 'sha512',
        hashed: [
            { TAG: 'issuerFingerprint', data: { fingerprint } },
            { TAG: 'signatureCreationTime', data: created },
            { TAG: 'keyFlags', data: { encrypt: true, encryptComm: true } },
        ],
    }, [{ TAG: 'issuer', data: keyId }], { pubKey: { pubKey: edPubPacket }, subKey: { pubKey: cvPubPacket } }, edPriv);
    return { edPubPacket, fingerprint, keyId, cvPubPacket, cvCert, edCert };
}
async function formatPublic(edPriv, cvPriv, user, created = 0) {
    const { edPubPacket, cvPubPacket, edCert, cvCert } = await getCerts(edPriv, cvPriv, user, created);
    return exports.pubArmor.encode([
        { TAG: 'publicKey', data: edPubPacket },
        { TAG: 'userId', data: user },
        { TAG: 'signature', data: edCert },
        { TAG: 'publicSubkey', data: cvPubPacket },
        { TAG: 'signature', data: cvCert },
    ]);
}
exports.formatPublic = formatPublic;
async function formatPrivate(edPriv, cvPriv, user, password, created = 0, edSalt = (0, utils_1.randomBytes)(8), edIV = (0, utils_1.randomBytes)(16), cvSalt = (0, utils_1.randomBytes)(8), cvIV = (0, utils_1.randomBytes)(16)) {
    const { edPubPacket, cvPubPacket, edCert, cvCert } = await getCerts(edPriv, cvPriv, user, created);
    const edSecret = await createPrivKey(edPubPacket, edPriv, password, edSalt, edIV);
    const cvPrivLE = P.U256BE.encode(P.U256LE.decode(cvPriv));
    const cvSecret = await createPrivKey(cvPubPacket, cvPrivLE, password, cvSalt, cvIV);
    return exports.privArmor.encode([
        { TAG: 'secretKey', data: edSecret },
        { TAG: 'userId', data: user },
        { TAG: 'signature', data: edCert },
        { TAG: 'secretSubkey', data: cvSecret },
        { TAG: 'signature', data: cvCert },
    ]);
}
exports.formatPrivate = formatPrivate;
async function getKeys(privKey, user, password, created = 0) {
    const { keyId } = await getPublicPackets(privKey, privKey, created);
    const { head: cvPrivate } = await ed25519_1.ed25519.utils.getExtendedPublicKey(privKey);
    const publicKey = await formatPublic(privKey, cvPrivate, user, created);
    const privateKey = await formatPrivate(privKey, cvPrivate, user, password, created);
    return { keyId, privateKey, publicKey };
}
exports.getKeys = getKeys;
exports.default = getKeys;
