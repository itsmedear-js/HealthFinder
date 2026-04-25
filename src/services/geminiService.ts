import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export interface Hospital {
  name: string;
  distance: string;
  address: string;
  specialists: string[];
  rating?: number;
  phone?: string;
  lat: number;
  lng: number;
}

export async function findNearbyHospitals(location: string | { lat: number; lon: number }, category?: string, radiusKm: number = 10): Promise<{ city: string; hospitals: Hospital[] }> {
  try {
    const locationDescription = typeof location === 'string' 
      ? `near "${location}"` 
      : `at latitude ${location.lat} and longitude ${location.lon}`;

    const categoryConstraint = category ? `specifically looking for "${category}" related facilities` : '';

    const prompt = `Find 5-10 nearby hospitals, clinics, or medical centers ${locationDescription} strictly within a radius of approximately ${radiusKm} kilometers. ${categoryConstraint}
    If the location is ambiguous, assume it is in Pakistan.
    For each facility, provide:
    1. The name.
    2. Approximate distance from the starting location (must be less than ${radiusKm}km).
    3. Full address (including city and district/state).
    4. List of key specialists or departments.
    5. A rating (out of 5) if available.
    6. Phone number if available.
    7. Precise latitude and longitude coordinates. This is CRITICAL for GPS navigation, ensure high precision.

    Identify the City and State for the center of this search.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING, description: "The name of the city for this location" },
            hospitals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  distance: { type: Type.STRING },
                  address: { type: Type.STRING },
                  specialists: { 
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  rating: { type: Type.NUMBER },
                  phone: { type: Type.STRING },
                  lat: { type: Type.NUMBER },
                  lng: { type: Type.NUMBER }
                },
                required: ["name", "distance", "address", "specialists", "lat", "lng"]
              }
            }
          },
          required: ["hospitals", "city"]
        }
      }
    });

    const text = response.text || '{"city": "Unknown", "hospitals": []}';
    const parsed = JSON.parse(text);
    return parsed;
  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw error;
  }
}
