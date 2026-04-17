/**
 * Static map of common Bangalore pincodes to area names.
 * Used for auto-detecting area from pincode and identifying outstation deliveries.
 */
const BANGALORE_PINCODES: Record<string, string> = {
  "560001": "MG Road / Brigade Road",
  "560002": "Shivajinagar",
  "560003": "Ulsoor",
  "560004": "Malleswaram",
  "560005": "Frazer Town",
  "560006": "Sadashivanagar",
  "560008": "Chamrajpet",
  "560009": "Richmond Town",
  "560010": "Langford Town",
  "560011": "Jayanagar",
  "560012": "Domlur",
  "560016": "Rajajinagar",
  "560017": "Basavanagudi",
  "560018": "Wilson Garden",
  "560019": "Banashankari",
  "560020": "Seshadripuram",
  "560021": "Peenya",
  "560022": "Yeshwanthpur",
  "560024": "RT Nagar",
  "560025": "Jayanagar 4th Block",
  "560027": "Sanjaynagar",
  "560029": "Bannerghatta Road",
  "560030": "Adugodi",
  "560032": "Hebbal",
  "560033": "Sahakara Nagar",
  "560034": "Koramangala",
  "560035": "JP Nagar",
  "560036": "Ramamurthy Nagar",
  "560037": "BTM Layout",
  "560038": "Indiranagar",
  "560040": "Vijayanagar",
  "560041": "HAL",
  "560043": "Mahadevapura",
  "560045": "Nagarbhavi",
  "560047": "Marathahalli",
  "560048": "Sarjapur Road",
  "560050": "HSR Layout",
  "560052": "Kengeri",
  "560054": "KR Puram",
  "560055": "Whitefield",
  "560056": "Rajarajeshwari Nagar",
  "560058": "Kadugodi",
  "560060": "Bommanahalli",
  "560062": "Uttarahalli",
  "560064": "Electronic City",
  "560066": "Yelahanka",
  "560068": "Thanisandra",
  "560070": "Hennur",
  "560073": "Jakkur",
  "560076": "Dasarahalli",
  "560078": "Vidyaranyapura",
  "560085": "Hoodi",
  "560087": "Devanahalli",
  "560097": "Anekal",
  "560100": "Hoskote",
};

/**
 * Look up area name from a 6-digit pincode.
 * Returns the area name if found in the Bangalore pincode map, or null otherwise.
 */
export function getAreaFromPincode(pin: string): string | null {
  if (!pin || pin.length !== 6) return null;
  return BANGALORE_PINCODES[pin] ?? null;
}

/**
 * Check if a pincode is within the Bangalore delivery zone (starts with "560").
 */
export function isBangalorePincode(pin: string): boolean {
  return pin.startsWith("560");
}
