"use client";

import { Fragment, useEffect } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import type { LatLng, RideRequest, RiderLocation } from "@/types/database";

const pickupIcon = L.divIcon({
  className: "",
  html: '<div class="taxiro-marker taxiro-marker-pickup"><span></span></div>',
  iconAnchor: [18, 18],
  iconSize: [36, 36],
});

const dropIcon = L.divIcon({
  className: "",
  html: '<div class="taxiro-marker taxiro-marker-drop"><span></span></div>',
  iconAnchor: [18, 18],
  iconSize: [36, 36],
});

const readyDemandIcon = L.divIcon({
  className: "",
  html: '<div class="taxiro-demand-marker taxiro-demand-marker-ready"><span>!</span></div>',
  iconAnchor: [18, 18],
  iconSize: [36, 36],
});

const scheduledDemandIcon = L.divIcon({
  className: "",
  html: '<div class="taxiro-demand-marker taxiro-demand-marker-scheduled"><span></span></div>',
  iconAnchor: [15, 15],
  iconSize: [30, 30],
});

function riderIcon(rider: RiderLocation) {
  const heading = rider.heading ?? 0;
  return L.divIcon({
    className: "",
    html: `<div class="taxiro-rider-marker"><span style="transform: rotate(${heading}deg)">&rarr;</span></div>`,
    iconAnchor: [18, 18],
    iconSize: [36, 36],
  });
}

function ClickHandler({ onPick }: { onPick?: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onPick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function FitMap({
  demandRides,
  drop,
  pickup,
  riders,
  route,
}: {
  demandRides: RideRequest[];
  drop?: LatLng | null;
  pickup?: LatLng | null;
  riders: RiderLocation[];
  route: LatLng[];
}) {
  const map = useMap();

  useEffect(() => {
    const points = [...route];
    if (pickup) points.push(pickup);
    if (drop) points.push(drop);
    demandRides.forEach((ride) => points.push({ lat: ride.pickup_lat, lng: ride.pickup_lng }));
    riders.forEach((rider) => points.push({ lat: rider.lat, lng: rider.lng }));

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]));
      map.fitBounds(bounds, { animate: true, maxZoom: 16, padding: [56, 56] });
      return;
    }

    const center = pickup ?? drop ?? (demandRides[0] ? { lat: demandRides[0].pickup_lat, lng: demandRides[0].pickup_lng } : null) ?? (riders[0] ? { lat: riders[0].lat, lng: riders[0].lng } : null);
    if (center) {
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), 13), { animate: true });
    }
  }, [demandRides, drop, map, pickup, riders, route]);

  return null;
}

function formatLastSeen(value: string | null) {
  if (!value) return "No live update yet";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 10) return "Live now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export function MapPicker({
  className,
  demandRides = [],
  drop,
  onPick,
  pickup,
  riders = [],
  route = [],
}: {
  className?: string;
  demandRides?: RideRequest[];
  drop?: LatLng | null;
  onPick?: (point: LatLng) => void;
  pickup?: LatLng | null;
  riders?: RiderLocation[];
  route?: LatLng[];
}) {
  const center = pickup ?? drop ?? { lat: 17.385, lng: 78.4867 };

  return (
    <div
      className={`relative min-w-0 max-w-full overflow-hidden ${
        className ?? "h-[360px] rounded-lg border border-border"
      }`}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        className="h-full min-w-0 w-full max-w-full overflow-hidden"
        scrollWheelZoom
        zoom={12}
      >
        <FitMap demandRides={demandRides} drop={drop} pickup={pickup} riders={riders} route={route} />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onPick} />
        {route.length ? (
          <Polyline
            pathOptions={{ color: "#101713", opacity: 0.88, weight: 6 }}
            positions={route.map((point) => [point.lat, point.lng])}
          />
        ) : null}
        {demandRides.map((ride) => {
          const ready = ride.status === "ready";
          return (
            <Fragment key={ride.id}>
              <Circle
                center={[ride.pickup_lat, ride.pickup_lng]}
                pathOptions={{
                  color: ready ? "#dbf86f" : "#101713",
                  fillColor: ready ? "#dbf86f" : "#101713",
                  fillOpacity: ready ? 0.18 : 0.08,
                  opacity: ready ? 0.65 : 0.3,
                  weight: ready ? 3 : 1,
                }}
                radius={ready ? 850 : 380}
              />
              <Marker icon={ready ? readyDemandIcon : scheduledDemandIcon} position={[ride.pickup_lat, ride.pickup_lng]}>
                <Popup>
                  <strong>{ready ? "Ready ride now" : "Scheduled demand"}</strong>
                  <br />
                  {ride.pickup_address}
                  <br />
                  {ride.distance_km ?? "--"} km | {ride.estimated_duration_min ?? "--"} min
                  <br />
                  {new Date(ride.scheduled_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
        {pickup ? (
          <Marker icon={pickupIcon} position={[pickup.lat, pickup.lng]}>
            <Popup>Pickup</Popup>
          </Marker>
        ) : null}
        {drop ? (
          <Marker icon={dropIcon} position={[drop.lat, drop.lng]}>
            <Popup>Drop</Popup>
          </Marker>
        ) : null}
        {riders.map((rider) => (
          <Fragment key={rider.rider_id}>
            {rider.accuracy_m ? (
              <Circle
                center={[rider.lat, rider.lng]}
                pathOptions={{ color: "#101713", fillColor: "#101713", fillOpacity: 0.06, opacity: 0.18, weight: 1 }}
                radius={Math.min(Math.max(rider.accuracy_m, 20), 250)}
              />
            ) : null}
            <Marker icon={riderIcon(rider)} position={[rider.lat, rider.lng]}>
              <Popup>
                {rider.is_available ? "Available rider" : "Assigned rider"}
                <br />
                {formatLastSeen(rider.last_seen_at ?? rider.updated_at)}
                {rider.accuracy_m ? <><br />Accuracy: {Math.round(rider.accuracy_m)}m</> : null}
              </Popup>
            </Marker>
          </Fragment>
        ))}
      </MapContainer>
    </div>
  );
}



