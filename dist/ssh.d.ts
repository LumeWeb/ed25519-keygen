import * as P from 'micro-packed';
export declare const SSHString: P.CoderType<string>;
export declare const SSHBuf: P.CoderType<Uint8Array>;
export declare const SSHKeyType: P.CoderType<undefined>;
export declare const PublicKey: P.CoderType<{
    pubKey: Uint8Array;
} & {}>;
export declare const AuthData: P.CoderType<{
    nonce: Uint8Array;
    auth: string;
    user: string;
    pubKey: {
        pubKey: Uint8Array;
    } & {};
    userAuthRequest: number;
    conn: string;
    haveSig: number;
} & {}>;
export type AuthDataType = P.UnwrapCoder<typeof AuthData>;
export declare const PrivateExport: P.Coder<{
    keys: ({
        pubKey: {
            pubKey: Uint8Array;
        } & {};
        privKey: {
            pubKey: Uint8Array;
            check1: Uint8Array;
            check2: Uint8Array;
            privKey: Uint8Array;
            comment: string;
        } & {};
    } & {})[];
} & {}, string>;
export declare function formatPublicKey(bytes: Uint8Array, comment?: string): string;
export declare function getFingerprint(bytes: Uint8Array): string;
export declare function getKeys(privateKey: Uint8Array, comment?: string, checkBytes?: Uint8Array): Promise<{
    publicKeyBytes: Uint8Array;
    publicKey: string;
    fingerprint: string;
    privateKey: string;
}>;
export declare function authSign(privateKey: Uint8Array, data: AuthDataType): Uint8Array;
export default getKeys;
//# sourceMappingURL=ssh.d.ts.map