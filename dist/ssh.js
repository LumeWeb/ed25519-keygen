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
exports.authSign = exports.getKeys = exports.getFingerprint = exports.formatPublicKey = exports.PrivateExport = exports.AuthData = exports.PublicKey = exports.SSHKeyType = exports.SSHBuf = exports.SSHString = void 0;
const ed25519_1 = require("@noble/curves/ed25519");
const sha256_1 = require("@noble/hashes/sha256");
const micro_packed_1 = require("micro-packed");
const P = __importStar(require("micro-packed"));
const base_1 = require("@scure/base");
const utils_1 = require("@noble/hashes/utils");
exports.SSHString = P.string(P.U32BE);
exports.SSHBuf = P.bytes(P.U32BE);
exports.SSHKeyType = P.magic(exports.SSHString, 'ssh-ed25519');
exports.PublicKey = P.struct({ keyType: exports.SSHKeyType, pubKey: P.bytes(P.U32BE) });
const PrivateKey = P.padRight(8, P.struct({
    check1: P.bytes(4),
    check2: P.bytes(4),
    keyType: exports.SSHKeyType,
    pubKey: exports.SSHBuf,
    privKey: exports.SSHBuf,
    comment: exports.SSHString,
}), (i) => i + 1);
exports.AuthData = P.struct({
    nonce: exports.SSHBuf,
    userAuthRequest: P.U8,
    user: exports.SSHString,
    conn: exports.SSHString,
    auth: exports.SSHString,
    haveSig: P.U8,
    keyType: exports.SSHKeyType,
    pubKey: P.prefix(P.U32BE, exports.PublicKey),
});
exports.PrivateExport = P.base64armor('openssh private key', 70, P.struct({
    magic: P.magicBytes('openssh-key-v1\0'),
    ciphername: P.magic(exports.SSHString, 'none'),
    kdfname: P.magic(exports.SSHString, 'none'),
    kdfopts: P.magic(exports.SSHString, ''),
    keys: P.array(P.U32BE, P.struct({
        pubKey: P.prefix(P.U32BE, exports.PublicKey),
        privKey: P.prefix(P.U32BE, PrivateKey),
    })),
}));
function formatPublicKey(bytes, comment) {
    const blob = exports.PublicKey.encode({ pubKey: bytes });
    return `ssh-ed25519 ${base_1.base64.encode(blob)}${comment ? ` ${comment}` : ''}`;
}
exports.formatPublicKey = formatPublicKey;
function getFingerprint(bytes) {
    const blob = exports.PublicKey.encode({ pubKey: bytes });
    return `SHA256:${base_1.base64.encode((0, sha256_1.sha256)(blob)).replace(/=$/, '')}`;
}
exports.getFingerprint = getFingerprint;
async function getKeys(privateKey, comment, checkBytes = (0, utils_1.randomBytes)(4)) {
    const pubKey = await ed25519_1.ed25519.getPublicKey(privateKey);
    return {
        publicKeyBytes: pubKey,
        publicKey: formatPublicKey(pubKey, comment),
        fingerprint: getFingerprint(pubKey),
        privateKey: exports.PrivateExport.encode({
            keys: [
                {
                    pubKey: { pubKey },
                    privKey: {
                        check1: checkBytes,
                        check2: checkBytes,
                        pubKey,
                        privKey: (0, micro_packed_1.concatBytes)(privateKey, pubKey),
                        comment: comment || '',
                    },
                },
            ],
        }),
    };
}
exports.getKeys = getKeys;
function authSign(privateKey, data) {
    return ed25519_1.ed25519.sign(exports.AuthData.encode(data), privateKey);
}
exports.authSign = authSign;
exports.default = getKeys;
