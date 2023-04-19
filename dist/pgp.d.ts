import * as P from 'micro-packed';
export type Bytes = Uint8Array;
export declare const mpi: P.BytesCoderStream<bigint> & P.BytesCoder<bigint>;
export declare const opaquempi: P.BytesCoderStream<Uint8Array> & P.BytesCoder<Uint8Array>;
export declare const oid: P.BytesCoderStream<string> & P.BytesCoder<string>;
export declare const PacketLen: P.BytesCoderStream<number> & P.BytesCoder<number>;
export declare const PubKeyPacket: P.CoderType<{
    created: number;
    algo: {
        TAG: "ECDH";
        data: {
            curve: string;
            pub: bigint;
            params: {
                hash: string;
                encryption: string;
            } & {};
        } & {};
    } | {
        TAG: "EdDSA";
        data: {
            curve: string;
            pub: bigint;
        } & {};
    };
} & {}>;
declare const SecretKeyPacket: P.CoderType<{
    type: {
        TAG: "encrypted";
        data: {
            secret: Uint8Array;
            enc: string;
            S2K: {
                TAG: "simple";
                data: {
                    hash: string;
                } & {};
            } | {
                TAG: "salted";
                data: {
                    hash: string;
                    salt: Uint8Array;
                } & {};
            } | {
                TAG: "iterated";
                data: {
                    hash: string;
                    salt: Uint8Array;
                    count: number;
                } & {};
            };
            iv: Uint8Array;
        } & {};
    } | {
        TAG: "plain";
        data: {
            secret: Uint8Array;
        } & {};
    } | {
        TAG: "encrypted2";
        data: {
            secret: Uint8Array;
            enc: string;
            S2K: {
                TAG: "simple";
                data: {
                    hash: string;
                } & {};
            } | {
                TAG: "salted";
                data: {
                    hash: string;
                    salt: Uint8Array;
                } & {};
            } | {
                TAG: "iterated";
                data: {
                    hash: string;
                    salt: Uint8Array;
                    count: number;
                } & {};
            };
            iv: Uint8Array;
        } & {};
    };
    pub: {
        created: number;
        algo: {
            TAG: "ECDH";
            data: {
                curve: string;
                pub: bigint;
                params: {
                    hash: string;
                    encryption: string;
                } & {};
            } & {};
        } | {
            TAG: "EdDSA";
            data: {
                curve: string;
                pub: bigint;
            } & {};
        };
    } & {};
} & {}>;
type SecretKeyType = P.UnwrapCoder<typeof SecretKeyPacket>;
export declare const Stream: P.CoderType<any[]>;
export declare function decodeSecretKey(password: string, key: SecretKeyType): Promise<bigint>;
export declare const pubArmor: P.Coder<any[], string>;
export declare const privArmor: P.Coder<any[], string>;
export declare function formatPublic(edPriv: Bytes, cvPriv: Bytes, user: string, created?: number): Promise<string>;
export declare function formatPrivate(edPriv: Bytes, cvPriv: Bytes, user: string, password: string, created?: number, edSalt?: Uint8Array, edIV?: Uint8Array, cvSalt?: Uint8Array, cvIV?: Uint8Array): Promise<string>;
export declare function getKeys(privKey: Bytes, user: string, password: string, created?: number): Promise<{
    keyId: string;
    privateKey: string;
    publicKey: string;
}>;
export default getKeys;
//# sourceMappingURL=pgp.d.ts.map