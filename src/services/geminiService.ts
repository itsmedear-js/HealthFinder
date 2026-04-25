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
}

export async function findNearbyHospitals(location: string | { lat: number; lon: number }, category?: string): Promise<Hospital[]> {
  try {
    const locationDescription = typeof location === 'string' 
      ? `near "${location}"` 
      : `at latitude ${location.lat} and longitude ${location.lon}`;

    const categoryConstraint = category ? `specifically looking for "${category}" related facilities` : '';

    const prompt = `Find 5-7 nearby hospitals, clinics, or medical centers ${locationDescription}. ${categoryConstraint}
    Provide the name, approximate distance, full address (must include city/state), and a list of key specialists or departments.
    Include their rating (out of 5) and phone number if available. `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
              phone: { type: Type.STRING }
            },
            required: ["name", "distance", "address", "specialists"]
          }
        },
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw error;
  }
}
