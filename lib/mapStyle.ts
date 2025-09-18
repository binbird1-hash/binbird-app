// lib/mapStyle.ts
export const darkMapStyle: google.maps.MapTypeStyle[] = [
  // Base dark theme
  { elementType: "geometry", stylers: [{ color: "#1c1c1c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#000000" }] },

  // 🚫 Hide all landmarks / POIs
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },

  // 🚫 Hide transit
  { featureType: "transit", stylers: [{ visibility: "off" }] },

  // 🚫 Hide road labels, but keep road geometry faint
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },

  // ✅ Show suburb/locality names only
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ visibility: "on" }, { color: "#ffffff" }],
  },

  // 🚫 Hide everything else (state/country/neighborhood borders)
  { featureType: "administrative.province", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },

  // Dark water + land
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#121212" }] },
];
