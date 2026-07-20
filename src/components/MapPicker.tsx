"use client";

import { createElement, Fragment, useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { Bike, CarFront, CarTaxiFront, MapPin, type LucideIcon } from "lucide-react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

import {
  calculateFareBreakdown,
  formatMoney,
  getFarePricingLabel,
} from "@/lib/fare";
import { getVehicleLabel } from "@/lib/vehicles";
import type { LatLng, RideRequest, RiderLocation, VehicleType } from "@/types/database";

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

function vehicleIconComponent(vehicleType?: VehicleType): LucideIcon {
  if (vehicleType === "auto") return CarTaxiFront;
  if (vehicleType === "car") return CarFront;
  return Bike;
}

function riderIcon(rider: RiderLocation, vehicleType?: VehicleType) {
  const heading = rider.heading ?? 0;
  const preview = rider.rider_id.startsWith("nearby-");
  const VehicleIcon = vehicleIconComponent(vehicleType);
  const vehicleMarkup = renderToStaticMarkup(
    createElement(VehicleIcon, {
      "aria-hidden": true,
      fill: "none",
      size: preview ? 15 : 19,
      strokeWidth: 2.7,
    }),
  );
  return L.divIcon({
    className: "",
    html: `<div class="taxiro-rider-marker ${preview ? "taxiro-rider-marker-nearby" : "taxiro-rider-marker-assigned"}" data-vehicle="${vehicleType ?? "bike"}"><span style="transform: rotate(${heading}deg)">${vehicleMarkup}</span></div>`,
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

function CenterSelection({
  active,
  initialCenter,
  onChange,
}: {
  active: boolean;
  initialCenter?: LatLng | null;
  onChange?: (point: LatLng) => void;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const map = useMapEvents({
    moveend() {
      if (!active) return;
      const center = map.getCenter();
      onChangeRef.current?.({ lat: center.lat, lng: center.lng });
    },
  });

  useEffect(() => {
    if (!active) return;
    if (initialCenter) {
      map.setView(
        [initialCenter.lat, initialCenter.lng],
        Math.max(map.getZoom(), 16),
        { animate: true },
      );
    } else {
      const center = map.getCenter();
      onChangeRef.current?.({ lat: center.lat, lng: center.lng });
    }
  }, [active, initialCenter, map]);

  return null;
}

function FitMap({
  demandRides,
  disabled,
  drop,
  focusPoint,
  pickup,
  riders,
  route,
}: {
  demandRides: RideRequest[];
  disabled?: boolean;
  drop?: LatLng | null;
  focusPoint?: LatLng | null;
  pickup?: LatLng | null;
  riders: RiderLocation[];
  route: LatLng[];
}) {
  const map = useMap();

  useEffect(() => {
    if (disabled) return;

    if (route.length < 2 && focusPoint) {
      map.setView(
        [focusPoint.lat, focusPoint.lng],
        Math.max(map.getZoom(), 16),
        { animate: true },
      );
      return;
    }

    const points = [...route];
    if (pickup) points.push(pickup);
    if (drop) points.push(drop);
    demandRides.forEach((ride) =>
      points.push({ lat: ride.pickup_lat, lng: ride.pickup_lng }),
    );
    riders.forEach((rider) => points.push({ lat: rider.lat, lng: rider.lng }));

    if (points.length >= 2) {
      const bounds = L.latLngBounds(
        points.map((point) => [point.lat, point.lng]),
      );
      map.fitBounds(bounds, { animate: true, maxZoom: 16, padding: [56, 56] });
      return;
    }

    const center =
      pickup ??
      drop ??
      (demandRides[0]
        ? { lat: demandRides[0].pickup_lat, lng: demandRides[0].pickup_lng }
        : null) ??
      (riders[0] ? { lat: riders[0].lat, lng: riders[0].lng } : null);
    if (center) {
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), 13), {
        animate: true,
      });
    }
  }, [demandRides, disabled, drop, focusPoint, map, pickup, riders, route]);

  return null;
}

function formatLastSeen(value: string | null) {
  if (!value) return "No live update yet";
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 10) return "Live now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export function MapPicker({
  className,
  demandRides = [],
  drop,
  focusPoint,
  onPick,
  onSelectionChange,
  pickup,
  riders = [],
  riderVehicleTypes = {},
  route = [],
  selectionCenter,
  selectionMode = null,
}: {
  className?: string;
  demandRides?: RideRequest[];
  drop?: LatLng | null;
  focusPoint?: LatLng | null;
  onPick?: (point: LatLng) => void;
  onSelectionChange?: (point: LatLng) => void;
  pickup?: LatLng | null;
  riders?: RiderLocation[];
  riderVehicleTypes?: Partial<Record<string, VehicleType>>;
  route?: LatLng[];
  selectionCenter?: LatLng | null;
  selectionMode?: "pickup" | "drop" | null;
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
        scrollWheelZoom={false}
        zoom={12}
      >
        <FitMap
          demandRides={demandRides}
          disabled={Boolean(selectionMode)}
          drop={drop}
          focusPoint={focusPoint}
          pickup={pickup}
          riders={riders}
          route={route}
        />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={selectionMode ? undefined : onPick} />
        <CenterSelection
          active={Boolean(selectionMode)}
          initialCenter={selectionCenter}
          onChange={onSelectionChange}
        />
        {route.length ? (
          <Polyline
            pathOptions={{ color: "#101713", opacity: 0.88, weight: 6 }}
            positions={route.map((point) => [point.lat, point.lng])}
          />
        ) : null}
        {demandRides.map((ride) => {
          const ready = ride.status === "ready";
          const earning =
            ride.rider_earning ??
            calculateFareBreakdown(ride.fare_estimate).riderEarning;
          const effectiveRate = (ride.fare_rate_per_km ?? 0) + (ride.vehicle_surcharge_per_km ?? 0);
          const rateLabel = effectiveRate
            ? `${getVehicleLabel(ride.vehicle_type)} ${getFarePricingLabel(ride.fare_pricing_period)} Rs ${effectiveRate}/km`
            : "Rate pending";
          const passengerLabel =
            ride.booking_for === "other"
              ? `Passenger: ${ride.passenger_name || "guest"}`
              : "Customer ride";
          return (
            <Fragment key={ride.id}>
              <Circle
                center={[ride.pickup_lat, ride.pickup_lng]}
                pathOptions={{
                  color: ready ? "#dbf86f" : "#101713",
                  fillColor: ready ? "#dbf86f" : "#101713",
                  fillOpacity: ready ? 0.22 : 0.09,
                  opacity: ready ? 0.78 : 0.32,
                  weight: ready ? 4 : 1,
                }}
                radius={ready ? 950 : 420}
              />
              <Marker
                alt={ready ? "Ready ride demand at pickup" : "Advance ride demand at pickup"}
                icon={ready ? readyDemandIcon : scheduledDemandIcon}
                position={[ride.pickup_lat, ride.pickup_lng]}
                title={ready ? "Ready ride demand" : "Advance ride demand"}
              >
                <Tooltip
                  className={ready ? "taxiro-demand-label taxiro-demand-label-ready" : "taxiro-demand-label taxiro-demand-label-scheduled"}
                  direction="top"
                  offset={[0, -18]}
                  opacity={1}
                  permanent
                >
                  {ready ? "Nearby ready" : "Nearby advance"}
                </Tooltip>
                <Popup>
                  <div className="grid gap-1 text-sm">
                    <strong>
                      {ready ? "Nearby ready ride - accept now" : "Nearby scheduled demand"}
                    </strong>
                    <span>
                      Fare: {formatMoney(ride.fare_estimate)} | Earn:{" "}
                      {formatMoney(earning)}
                    </span>
                    <span>
                      {rateLabel} | {passengerLabel}
                    </span>
                    <span>
                      {ride.distance_km ?? "--"} km |{" "}
                      {ride.estimated_duration_min ?? "--"} min |{" "}
                      {(ride.payment_method ?? "cash").toUpperCase()}
                    </span>
                    <span>Pickup: {ride.pickup_address}</span>
                    <span>Drop: {ride.drop_address}</span>
                    <span>
                      {new Date(ride.scheduled_time).toLocaleString()}
                    </span>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
        {pickup ? (
          <Marker alt="Ride pickup" icon={pickupIcon} position={[pickup.lat, pickup.lng]} title="Ride pickup">
            <Popup>Pickup</Popup>
          </Marker>
        ) : null}
        {drop ? (
          <Marker alt="Ride destination" icon={dropIcon} position={[drop.lat, drop.lng]} title="Ride destination">
            <Popup>Drop</Popup>
          </Marker>
        ) : null}
        {riders.map((rider) => (
          <Fragment key={rider.rider_id}>
            {rider.accuracy_m ? (
              <Circle
                center={[rider.lat, rider.lng]}
                pathOptions={{
                  color: "#101713",
                  fillColor: "#101713",
                  fillOpacity: 0.06,
                  opacity: 0.18,
                  weight: 1,
                }}
                radius={Math.min(Math.max(rider.accuracy_m, 20), 250)}
              />
            ) : null}
            <Marker alt="Rider location" icon={riderIcon(rider, riderVehicleTypes[rider.rider_id])} position={[rider.lat, rider.lng]} title="Rider location">
              <Popup>
                {rider.rider_id.startsWith("nearby-") ? "Nearby verified rider (approximate)" : rider.is_available ? "Available rider" : "Your assigned rider"}
                {riderVehicleTypes[rider.rider_id] ? ` - ${getVehicleLabel(riderVehicleTypes[rider.rider_id])}` : ""}
                <br />
                {formatLastSeen(rider.last_seen_at ?? rider.updated_at)}
                {!rider.rider_id.startsWith("nearby-") && rider.accuracy_m ? (
                  <>
                    <br />
                    Accuracy: {Math.round(rider.accuracy_m)}m
                  </>
                ) : null}
              </Popup>
            </Marker>
          </Fragment>
        ))}
      </MapContainer>
      {selectionMode ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center"
        >
          <div className="taxiro-center-pin">
            <MapPin className="size-12 fill-[#dbf86f] stroke-[#101713] stroke-[2.5]" />
            <span />
          </div>
        </div>
      ) : null}
    </div>
  );
}
