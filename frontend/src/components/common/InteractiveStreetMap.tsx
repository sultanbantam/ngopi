import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View, Text } from 'react-native';

export interface MapLatLng {
  lat: number;
  lng: number;
}

export interface MapPinItem {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color?: string;
  selected?: boolean;
}

interface InteractiveStreetMapProps {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  height?: number;
  routePoints?: MapLatLng[];
  pins?: MapPinItem[];
  onPinPress?: (id: string) => void;
  routeColor?: string;
  showGoogleMapsLink?: boolean;
}

const TILE_SIZE = 256;

function latLngToWorldPx(lat: number, lng: number, zoom: number) {
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n * TILE_SIZE;
  const latRad = (clampedLat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    n *
    TILE_SIZE;
  return { x, y };
}

export default function InteractiveStreetMap({
  centerLat,
  centerLng,
  zoom: initialZoom = 16,
  height = 220,
  routePoints = [],
  pins = [],
  onPinPress,
  routeColor = '#2563EB',
  showGoogleMapsLink = true,
}: InteractiveStreetMapProps) {
  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          height,
          borderRadius: 12,
          backgroundColor: '#0B1220',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#94A3B8', fontSize: 12 }}>
          GPS: {centerLat.toFixed(5)}, {centerLng.toFixed(5)}
        </Text>
      </View>
    );
  }

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [boxWidth, setBoxWidth] = useState(360);
  const [zoom, setZoom] = useState(initialZoom);
  const [panOffsetPx, setPanOffsetPx] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.clientWidth > 0) setBoxWidth(el.clientWidth);
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Reset manual pan when center prop changes significantly from parent pin click
  useEffect(() => {
    setPanOffsetPx({ x: 0, y: 0 });
  }, [centerLat, centerLng]);

  const centerWorld = useMemo(
    () => latLngToWorldPx(centerLat, centerLng, zoom),
    [centerLat, centerLng, zoom]
  );

  const viewWorldX = centerWorld.x - panOffsetPx.x;
  const viewWorldY = centerWorld.y - panOffsetPx.y;
  const topLeftWorldX = viewWorldX - boxWidth / 2;
  const topLeftWorldY = viewWorldY - height / 2;

  const maxTileIdx = Math.pow(2, zoom) - 1;
  const minTx = Math.floor(topLeftWorldX / TILE_SIZE);
  const maxTx = Math.floor((topLeftWorldX + boxWidth) / TILE_SIZE);
  const minTy = Math.max(0, Math.floor(topLeftWorldY / TILE_SIZE));
  const maxTy = Math.min(maxTileIdx, Math.floor((topLeftWorldY + height) / TILE_SIZE));

  const tiles: Array<{ key: string; left: number; top: number; url: string; fallbackUrl: string }> = [];
  const sub = ['a', 'b', 'c'];
  for (let tx = minTx; tx <= maxTx; tx++) {
    const wrappedTx = ((tx % (maxTileIdx + 1)) + (maxTileIdx + 1)) % (maxTileIdx + 1);
    for (let ty = minTy; ty <= maxTy; ty++) {
      const s = sub[Math.abs(tx + ty) % sub.length];
      tiles.push({
        key: `${zoom}-${tx}-${ty}`,
        left: tx * TILE_SIZE - topLeftWorldX,
        top: ty * TILE_SIZE - topLeftWorldY,
        url: `https://${s}.tile.openstreetmap.org/${zoom}/${wrappedTx}/${ty}.png`,
        fallbackUrl: `https://tile.openstreetmap.org/${zoom}/${wrappedTx}/${ty}.png`,
      });
    }
  }

  const routeSvgPoints = useMemo(() => {
    if (routePoints.length === 0) return '';
    return routePoints
      .map((pt) => {
        const w = latLngToWorldPx(pt.lat, pt.lng, zoom);
        return `${(w.x - topLeftWorldX).toFixed(1)},${(w.y - topLeftWorldY).toFixed(1)}`;
      })
      .join(' ');
  }, [routePoints, zoom, topLeftWorldX, topLeftWorldY]);

  const currentMarkerPos = useMemo(() => {
    const last = routePoints[routePoints.length - 1] || { lat: centerLat, lng: centerLng };
    const w = latLngToWorldPx(last.lat, last.lng, zoom);
    return { x: w.x - topLeftWorldX, y: w.y - topLeftWorldY };
  }, [routePoints, centerLat, centerLng, zoom, topLeftWorldX, topLeftWorldY]);

  const startMarkerPos = useMemo(() => {
    if (routePoints.length < 2) return null;
    const first = routePoints[0];
    const w = latLngToWorldPx(first.lat, first.lng, zoom);
    return { x: w.x - topLeftWorldX, y: w.y - topLeftWorldY };
  }, [routePoints, zoom, topLeftWorldX, topLeftWorldY]);

  const ctrlBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid rgba(15,23,42,0.18)',
    backgroundColor: 'rgba(255,255,255,0.95)',
    color: '#0F172A',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  };

  return React.createElement(
    'div',
    {
      ref: containerRef,
      onPointerDown: (e: any) => {
        dragRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          origX: panOffsetPx.x,
          origY: panOffsetPx.y,
        };
      },
      onPointerMove: (e: any) => {
        if (!dragRef.current.active) return;
        setPanOffsetPx({
          x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
          y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
        });
      },
      onPointerUp: () => {
        dragRef.current.active = false;
      },
      onPointerLeave: () => {
        dragRef.current.active = false;
      },
      style: {
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#E2E8F0',
        userSelect: 'none',
        touchAction: 'none',
        cursor: 'grab',
      },
    },
    // Street Map Tiles
    tiles.map((tile) =>
      React.createElement('img', {
        key: tile.key,
        src: tile.url,
        alt: '',
        draggable: false,
        onError: (e: any) => {
          if (e.currentTarget.dataset.fallbackApplied) return;
          e.currentTarget.dataset.fallbackApplied = '1';
          e.currentTarget.src = tile.fallbackUrl;
        },
        style: {
          position: 'absolute',
          left: tile.left,
          top: tile.top,
          width: TILE_SIZE,
          height: TILE_SIZE,
          pointerEvents: 'none',
        },
      })
    ),
    // Route Polyline & Current Location Overlay
    React.createElement(
      'svg',
      {
        width: boxWidth,
        height,
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          pointerEvents: 'none',
        },
      },
      routeSvgPoints
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement('polyline', {
              points: routeSvgPoints,
              fill: 'none',
              stroke: '#FFFFFF',
              strokeWidth: 7,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              opacity: 0.92,
            }),
            React.createElement('polyline', {
              points: routeSvgPoints,
              fill: 'none',
              stroke: routeColor,
              strokeWidth: 4,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            })
          )
        : null,
      startMarkerPos
        ? React.createElement('circle', {
            cx: startMarkerPos.x,
            cy: startMarkerPos.y,
            r: 5,
            fill: '#10B981',
            stroke: '#FFFFFF',
            strokeWidth: 2,
          })
        : null,
      pins.length === 0
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement('circle', {
              cx: currentMarkerPos.x,
              cy: currentMarkerPos.y,
              r: 12,
              fill: 'rgba(37, 99, 235, 0.24)',
            }),
            React.createElement('circle', {
              cx: currentMarkerPos.x,
              cy: currentMarkerPos.y,
              r: 6,
              fill: '#2563EB',
              stroke: '#FFFFFF',
              strokeWidth: 2.5,
            })
          )
        : null
    ),
    // Optional Report Pins
    pins.map((pin) => {
      const w = latLngToWorldPx(pin.lat, pin.lng, zoom);
      const px = w.x - topLeftWorldX;
      const py = w.y - topLeftWorldY;
      return React.createElement(
        'button',
        {
          key: pin.id,
          type: 'button',
          onClick: (e: any) => {
            e.stopPropagation();
            onPinPress?.(pin.id);
          },
          title: pin.label,
          style: {
            position: 'absolute',
            left: px - 10,
            top: py - 20,
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: pin.selected ? '2.5px solid #FDE047' : '2px solid #FFFFFF',
            backgroundColor: pin.color || '#10B981',
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        '📍'
      );
    }),
    // Zoom & Recenter Controls
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          right: 8,
          top: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 10,
        },
      },
      React.createElement(
        'button',
        {
          type: 'button',
          style: ctrlBtnStyle,
          onClick: (e: any) => {
            e.stopPropagation();
            setZoom((z) => Math.min(18, z + 1));
          },
          title: 'Zoom In',
        },
        '+'
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          style: ctrlBtnStyle,
          onClick: (e: any) => {
            e.stopPropagation();
            setZoom((z) => Math.max(11, z - 1));
          },
          title: 'Zoom Out',
        },
        '−'
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          style: ctrlBtnStyle,
          onClick: (e: any) => {
            e.stopPropagation();
            setPanOffsetPx({ x: 0, y: 0 });
          },
          title: 'Center',
        },
        '◎'
      )
    ),
    // Bottom Google Maps External Guide Pill + Attribution
    showGoogleMapsLink
      ? React.createElement(
          'a',
          {
            href: `https://www.google.com/maps/search/?api=1&query=${centerLat},${centerLng}`,
            target: '_blank',
            rel: 'noopener noreferrer',
            onClick: (e: any) => e.stopPropagation(),
            style: {
              position: 'absolute',
              left: 8,
              bottom: 8,
              backgroundColor: 'rgba(255,255,255,0.95)',
              color: '#1D4ED8',
              padding: '4px 9px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              zIndex: 10,
            },
          },
          'Google Maps ↗'
        )
      : null,
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          right: 6,
          bottom: 4,
          backgroundColor: 'rgba(255,255,255,0.78)',
          color: '#334155',
          fontSize: 9,
          padding: '1px 5px',
          borderRadius: 4,
          pointerEvents: 'none',
        },
      },
      '© OpenStreetMap'
    )
  );
}
