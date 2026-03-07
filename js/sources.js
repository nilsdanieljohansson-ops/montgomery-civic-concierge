// ════════════════════════════════════════════
// SOURCES — ArcGIS endpoints from Montgomery Open Data Portal
// ════════════════════════════════════════════

export const SOURCES = [
  // SAFETY & EMERGENCY
  { key: 'tornado_shelters', label: 'Tornado Shelters', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Tornado_Shelter/FeatureServer/0' },
  { key: 'weather_sirens', label: 'Weather Sirens', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Weather_Sirens/FeatureServer/0' },
  { key: 'calls_911', label: '911 Calls', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/911_Calls_Data/FeatureServer/0' },
  { key: 'fire_police', label: 'Fire & Police Stations', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Story_Map___Live__1__WFL1/FeatureServer/0' },

  // CITY SERVICES
  { key: 'received_311', label: '311 Service Requests', type: 'MS',
    url: 'https://gis.montgomeryal.gov/server/rest/services/HostedDatasets/Received_311_Service_Request/MapServer/0' },
  { key: 'code_violations', label: 'Code Violations', type: 'FS',
    url: 'https://gis.montgomeryal.gov/server/rest/services/HostedDatasets/Code_Violations/FeatureServer/0' },

  // INFRASTRUCTURE
  { key: 'paving', label: 'Paving Projects', type: 'MS',
    url: 'https://gis.montgomeryal.gov/server/rest/services/HostedDatasets/Paving_Project/MapServer/0' },
  { key: 'construction', label: 'Construction Permits', type: 'FS',
    url: 'https://gis.montgomeryal.gov/server/rest/services/HostedDatasets/Construction_Permits/FeatureServer/0' },

  // BUSINESS & ECONOMY
  { key: 'business_license', label: 'Business Licenses', type: 'FS',
    url: 'https://gis.montgomeryal.gov/server/rest/services/HostedDatasets/Business_License/FeatureServer/0' },
  { key: 'food_scores', label: 'Food Scores', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Food_Scoring/FeatureServer/0' },

  // COMMUNITY & RECREATION
  { key: 'community_centers', label: 'Community Centers', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Community_Center/FeatureServer/0' },
  { key: 'poi', label: 'Points of Interest', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Point_of_Interest/FeatureServer/0' },
  { key: 'pharmacy', label: 'Pharmacy Locator', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Pharmacy_Locator/FeatureServer/0' },
  { key: 'parks', label: 'Parks & Trails', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Park_and_Trail/FeatureServer/0' },
  { key: 'education', label: 'Education Facilities', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Education_Facility/FeatureServer/0' },

  // TRAFFIC & TRANSPORT
  { key: 'traffic_req', label: 'Traffic Eng. Requests', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Traffic_Engineering_Requests/FeatureServer/0' },
  { key: 'traffic_kpi', label: 'Traffic Eng. KPIs', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Traffic_Engineering_Key_Performance_Indicators/FeatureServer/0' },

  // ANALYTICS
  { key: 'pop_trends', label: 'Daily Population', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Daily_Population_Trends/FeatureServer/0' },
  { key: 'visited', label: 'Most Visited Locations', type: 'FS',
    url: 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Most_Visited_Locations/FeatureServer/0' },
];


// ════════════════════════════════════════════
// SERVICES — City department knowledge base
// ════════════════════════════════════════════

export const SERVICES = {
  sanitation:      { dept: 'Public Works — Sanitation',       phone: '(334) 625-2180', cat: 'Sanitation & Waste',    icon: '🗑️' },
  publicWorks:     { dept: 'Public Works Department',         phone: '(334) 625-2180', cat: 'Roads & Infrastructure', icon: '🛣️' },
  permits:         { dept: 'Inspections Department',          phone: '(334) 625-2058', cat: 'Permits & Inspections',  icon: '📋' },
  businessLicense: { dept: 'Finance — Revenue Division',      phone: '(334) 625-2059', cat: 'Business Licensing',     icon: '🏢' },
  police:          { dept: 'Montgomery Police Department',    phone: '(334) 625-2831', cat: 'Public Safety',          icon: '🚔', emergency: '911' },
  fire:            { dept: 'Montgomery Fire/Rescue',          phone: '(334) 625-2800', cat: 'Fire & Rescue',          icon: '🚒', emergency: '911' },
  codeEnforcement: { dept: 'Neighborhood Services',           phone: '(334) 625-2068', cat: 'Code Enforcement',       icon: '🏘️' },
  parks:           { dept: 'Parks & Recreation',              phone: '(334) 625-2520', cat: 'Parks & Recreation',     icon: '🌳' },
  traffic:         { dept: 'Traffic Engineering',             phone: '(334) 625-2681', cat: 'Traffic & Signals',      icon: '🚦' },
  ema:             { dept: 'Emergency Management Agency',     phone: '(334) 625-2800', cat: 'Emergency Management',   icon: '⚠️', emergency: '911' },
  housing:         { dept: 'Planning & Development',          phone: '(334) 625-2630', cat: 'Planning & Zoning',      icon: '🏗️' },
  council:         { dept: 'City Council',                    phone: '(334) 625-2096', cat: 'City Government',        icon: '🏛️' },
};