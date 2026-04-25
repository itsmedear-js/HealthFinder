/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Search, 
  Hospital as HospitalIcon, 
  Phone, 
  Star, 
  Navigation, 
  Loader2,
  AlertCircle,
  Stethoscope,
  Heart,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { findNearbyHospitals, Hospital } from './services/geminiService';

export default function App() {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const categories = ["Emergency", "Pediatrics", "Cardiology", "Dental", "Pharmacy", "Clinic"];

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    performSearch(searchQuery, activeCategory || undefined);
  };

  const handleCategoryClick = (cat: string) => {
    const newCat = activeCategory === cat ? null : cat;
    setActiveCategory(newCat);
    
    if (location) {
      performSearch(location, newCat || undefined);
    } else if (searchQuery) {
      performSearch(searchQuery, newCat || undefined);
    }
  };

  const getLocation = () => {
    setIsLocating(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lon: longitude });
        setIsLocating(false);
        performSearch({ lat: latitude, lon: longitude }, activeCategory || undefined);
      },
      (err) => {
        setError("Please enable location access to find nearby hospitals.");
        setIsLocating(false);
        console.error(err);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const performSearch = async (loc: string | { lat: number; lon: number }, cat?: string) => {
    setLoading(true);
    setError(null);
    try {
      const results = await findNearbyHospitals(loc, cat);
      setHospitals(results);
    } catch (err) {
      setError("Failed to fetch nearby healthcare facilities. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getDirections = (hospital: Hospital) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hospital.name + ' ' + hospital.address)}`;
    window.open(url, '_blank', 'referrer');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-sky-100 selection:text-sky-900 overflow-x-hidden flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 h-20 bg-white border-b border-slate-200 shadow-sm backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-200 transition-transform hover:scale-105">
              <Activity className="text-white" size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-slate-800">HealthScan<span className="text-sky-600">+</span></h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Nearby Finder</p>
            </div>
          </div>
          
          <button 
            onClick={getLocation}
            disabled={isLocating || loading}
            className="group relative flex items-center gap-2 bg-sky-100 text-sky-600 px-5 py-2 rounded-xl font-bold transition-all hover:bg-sky-200 active:scale-95 disabled:opacity-50"
          >
            {isLocating ? <Loader2 className="animate-spin" size={16} /> : <MapPin size={16} />}
            <span className="text-xs uppercase tracking-wider hidden sm:inline">Use GPS</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 flex-grow w-full">
        {/* Search & Filter Bar */}
        <div className="space-y-6 mb-12">
          <form onSubmit={handleManualSearch} className="relative group">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by city, zip code, or address..."
              className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-5 pl-14 text-slate-800 focus:outline-none focus:border-sky-500 transition-all shadow-xl shadow-slate-200/50 text-lg font-medium"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors" size={24} />
            <button 
              type="submit"
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm tracking-tight hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${
                  activeCategory === cat 
                    ? 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-100' 
                    : 'bg-white border-slate-100 text-slate-400 hover:border-sky-200 hover:text-sky-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Intro Section */}
        {!location && !searchQuery && !loading && !hospitals.length && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 space-y-8"
          >
            <div className="inline-flex p-6 bg-sky-100/50 rounded-[3rem] text-sky-600 mb-2 relative">
               <div className="absolute inset-0 bg-sky-400 rounded-full blur-3xl opacity-20 animate-pulse" />
              <Heart size={64} className="relative" />
            </div>
            <div className="space-y-4">
              <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight leading-none">
                Immediate specialized <br/> <span className="text-sky-600">healthcare</span> access.
              </h2>
              <p className="text-slate-500 text-xl max-w-xl mx-auto font-medium leading-relaxed">
                Connect with hospital specialists, trauma units, and 24-hour pharmacies in your grid.
              </p>
            </div>
          </motion.div>
        )}
        
        {/* Error State */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-start gap-4 mb-8"
          >
            <AlertCircle className="text-red-500 shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-red-900 uppercase tracking-tighter">Request Interrupted</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="flex space-x-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }}
                    className="w-2.5 h-2.5 bg-sky-600 rounded-full"
                  />
                ))}
              </div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Synchronizing with global health grid...</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 h-64 animate-pulse shadow-sm" />
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && hospitals.length > 0 && (
          <div className="space-y-10">
            <div className="flex items-end justify-between border-b border-slate-200 pb-8">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Search Results</h3>
                {location && (
                  <p className="text-slate-400 text-sm font-medium mt-1 flex items-center gap-1.5 uppercase tracking-widest">
                    <Navigation size={14} className="text-sky-500" /> Lat {location.lat.toFixed(3)} • Lon {location.lon.toFixed(3)}
                  </p>
                )}
              </div>
              <div className="text-[10px] font-black text-sky-600 bg-sky-50 border border-sky-100 px-4 py-2 rounded-xl uppercase tracking-[0.2em]">
                {hospitals.length} Units Found
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <AnimatePresence mode="popLayout">
                {hospitals.map((hospital, index) => (
                  <motion.div
                    key={hospital.name + index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 hover:border-sky-400 hover:shadow-2xl hover:shadow-sky-100/30 transition-all duration-500 flex flex-col h-full relative"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="bg-slate-50 p-4 rounded-2xl group-hover:bg-sky-600 transition-all duration-300">
                        <HospitalIcon className="text-slate-300 group-hover:text-white transition-colors" size={28} />
                      </div>
                      {hospital.rating && (
                        <div className="flex items-center gap-1 bg-white text-slate-900 border border-slate-100 px-3 py-1.5 rounded-xl text-sm font-black shadow-sm group-hover:border-sky-100">
                          <Star size={14} className="text-amber-400" fill="currentColor" />
                          <span>{hospital.rating}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-grow space-y-3">
                      <h4 className="text-2xl font-bold text-slate-800 leading-tight group-hover:text-sky-700 transition-colors">
                        {hospital.name}
                      </h4>
                      <div className="flex items-center gap-2">
                         <span className="text-sky-600 font-black text-[10px] uppercase tracking-[0.2em] bg-sky-50 px-2 py-1 rounded">
                           {hospital.distance}
                         </span>
                      </div>
                      <p className="text-slate-500 text-sm font-medium leading-relaxed">
                        {hospital.address}
                      </p>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-1.5">
                      {hospital.specialists.slice(0, 4).map((spec, i) => (
                        <span 
                          key={i} 
                          className="text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 px-2.5 py-1 rounded-lg border border-slate-100"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-50 flex items-center justify-between">
                      {hospital.phone ? (
                        <a 
                          href={`tel:${hospital.phone}`} 
                          className="flex items-center gap-2 text-slate-600 hover:text-sky-600 transition-colors text-sm font-bold group/link"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover/link:bg-sky-100/50">
                            <Phone size={16} />
                          </div>
                          <span>Call</span>
                        </a>
                      ) : (
                        <div className="w-1" />
                      )}
                      
                      <button 
                        onClick={() => getDirections(hospital)}
                        className="h-12 px-6 bg-slate-900 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest group-hover:bg-sky-600 group-hover:shadow-lg group-hover:shadow-sky-100 transition-all active:scale-95"
                      >
                        <Navigation size={18} />
                        Get Directions
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Empty State after search */}
        {!loading && (location || searchQuery) && hospitals.length === 0 && (
          <div className="text-center py-20 px-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
            <Search className="mx-auto text-slate-100 mb-6" size={80} />
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">No health facilities found.</h3>
            <p className="text-slate-400 font-medium mt-2">Try widening your search or using a different category.</p>
            <button 
              onClick={() => { setSearchQuery(''); setHospitals([]); setLocation(null); }}
              className="mt-8 text-sky-600 font-black uppercase tracking-[0.2em] text-[10px] hover:text-sky-700 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-slate-200 py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-3 opacity-30 group grayscale hover:grayscale-0 transition-all">
            <Activity size={24} className="text-slate-900 group-hover:text-sky-600 transition-colors" />
            <span className="text-sm tracking-[0.3em] font-black uppercase text-slate-900">HealthScan<span className="text-sky-600">+</span></span>
          </div>
          <div className="flex flex-col md:items-end gap-2 text-center md:text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-loose">
              AI-Augmented Medical Search <br/> Powered by Google Gemini
            </p>
            <div className="flex gap-6 mt-2">
              <a href="#" className="text-[9px] font-black text-slate-300 hover:text-sky-600 transition-colors uppercase tracking-[0.2em]">Contact Emergency</a>
              <a href="#" className="text-[9px] font-black text-slate-300 hover:text-sky-600 transition-colors uppercase tracking-[0.2em]">Global Network</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
