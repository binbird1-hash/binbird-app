// app/api/optimize/route.ts
import { NextRequest, NextResponse } from "next/server";
import polyline from "@mapbox/polyline";

export async function POST(req: NextRequest) {
  try {
    const { start, end, waypoints } = await req.json();

    const key = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Missing Google Maps API key" }, { status: 500 });
    }

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `${start.lat},${start.lng}`);
    url.searchParams.set("destination", `${end.lat},${end.lng}`);
    url.searchParams.set("key", key);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("waypoints", `optimize:true|${waypoints.map((w: any) => `${w.lat},${w.lng}`).join("|")}`);

    const resp = await fetch(url.toString());
    const data = await resp.json();

    if (data.status !== "OK") {
      return NextResponse.json({ error: data.status, details: data }, { status: 400 });
    }

    const route = data.routes[0];
    const order: number[] = route.waypoint_order;
    const decodedPath = polyline.decode(route.overview_polyline.points)
      .map((coords) => ({ lat: coords[0], lng: coords[1] }));



    return NextResponse.json({
      polyline: route.overview_polyline.points,
      order,
      legs: route.legs.map((l: any) => ({
        start_address: l.start_address,
        end_address: l.end_address,
        distance_m: l.distance.value,
        duration_s: l.duration.value,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
