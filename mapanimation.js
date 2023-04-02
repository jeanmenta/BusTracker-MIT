mapboxgl.accessToken = 'pk.eyJ1IjoiamVhbm1lbnRhIiwiYSI6ImNsZmliM20zajNyZmEzc3BjN2puemFkbmIifQ.lJkjr-IH0GnyunxgAQtD8Q';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-71.0589, 42.3601], // Center the map on Boston, MA
    zoom: 12
});

const routeSelect = document.getElementById('routeSelect');
let selectedRoute = null;

function loadRoutes() {
    fetch('https://api-v3.mbta.com/routes?filter[type]=0,1')
        .then(response => response.json())
        .then(data => {
            data.data.forEach(route => {
                const option = document.createElement('option');
                option.value = route.id;
                option.textContent = route.attributes.long_name;
                routeSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Error fetching routes:', error));
}

function drawRouteLine(routeId) {
    fetch(`https://api-v3.mbta.com/shapes?filter[route]=${routeId}`)
        .then(response => response.json())
        .then(data => {
            const coordinates = data.data.map(shape => [shape.attributes.longitude, shape.attributes.latitude]);

            // Remove the previous route line layer if it exists
            if (map.getLayer('route-line')) {
                map.removeLayer('route-line');
            }

            // Remove the previous route line source if it exists
            if (map.getSource('route-line-source')) {
                map.removeSource('route-line-source');
            }

            // Add the new route line source
            map.addSource('route-line-source', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    }
                }
            });

            // Add the new route line layer
            map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route-line-source',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#888',
                    'line-width': 8
                }
            });

            // Update bus locations
            updateBusLocations();
        })
        .catch(error => console.error('Error fetching route data:', error));
}



function updateBusLocations() {
    if (!selectedRoute) return;

    // Remove previous bus markers
    if (window.busMarkers) {
        window.busMarkers.forEach(marker => marker.remove());
    }
    window.busMarkers = [];

    fetch(`https://api-v3.mbta.com/vehicles?filter[route]=${selectedRoute}&include=trip`)
        .then(response => response.json())
        .then(data => {
            const buses = data.data;

            if (map.getSource('buses')) {
                if (map.getLayer('buses')) {
                    map.removeLayer('buses');
                }
                map.removeSource('buses');
            }

            const geojsonData = {
                type: 'FeatureCollection',
                features: buses.map(bus => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [bus.attributes.longitude, bus.attributes.latitude]
                    },
                    properties: {
                        id: bus.id,
                        route: bus.relationships.route.data.id
                    }
                }))
            };

            map.addSource('buses', {
                type: 'geojson',
                data: geojsonData
            });

            if (!map.getLayer('buses')) {
                map.addLayer({
                    id: 'buses',
                    type: 'symbol',
                    source: 'buses',
                    layout: {
                        'icon-image': 'marker-15', // Use the 'marker-15' built-in icon
                        'icon-allow-overlap': true
                    },
                    paint: {
                        'icon-color': '#FF0000' // Set the marker color to red
                    }
                });
            }

            buses.forEach(bus => {
                const coordinates = [bus.attributes.longitude, bus.attributes.latitude];
                const marker = new mapboxgl.Marker()
                    .setLngLat(coordinates)
                    .setPopup(createPopup(bus))
                    .addTo(map);

                // Add the marker to the busMarkers array
                window.busMarkers.push(marker);
            });
        })
        .catch(error => console.error('Error fetching bus data:', error));

    setTimeout(updateBusLocations, 15000);
}





function createPopup(bus) {
    const popupContent = `
      <div>
        <h4>Bus Information</h4>
        <p><strong>ID:</strong> ${bus.id}</p>
        <p><strong>Route:</strong> ${bus.relationships.route.data.id}</p>
        <p><strong>Status:</strong> ${bus.attributes.current_status}</p>
        <p><strong>Bearing:</strong> ${bus.attributes.bearing}&deg;</p>
      </div>
    `;

    return new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent);
}


routeSelect.addEventListener('change', event => {
    selectedRoute = event.target.value;
    drawRouteLine(selectedRoute);
    updateBusLocations();
});

map.on('load', () => {
    loadRoutes();
});

