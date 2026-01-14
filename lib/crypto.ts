import crypto from "crypto";

export function signTelemetry(payload: any, secret: string): string {
    const { level, status, rssi } = payload;
    // Stable format: level|status|rssi|secret
    const data = `${level}|${status}|${rssi}|${secret}`;
    return crypto.createHash("sha1").update(data).digest("hex");
}

export function verifyTelemetry(payload: any, secret: string, signature: string): boolean {
    const expected = signTelemetry(payload, secret);
    try {
        return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    } catch (e) {
        return false;
    }
}
