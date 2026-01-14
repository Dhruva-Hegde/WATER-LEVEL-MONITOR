import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
    try {
        const { pin } = await req.json();
        const serverPin = process.env.DASHBOARD_PIN;

        if (!serverPin || pin === serverPin) {
            const cookieStore = await cookies();
            cookieStore.set("dashboard_auth", serverPin || "allowed", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 60 * 60 * 24 * 7, // 1 week
            });
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    } catch (e) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
