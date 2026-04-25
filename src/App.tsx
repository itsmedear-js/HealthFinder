/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useRef } from 'react';
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
  Activity,
  MessageSquare,
  Send,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { findNearbyHospitals, Hospital } from './services/geminiService';
import { 
  db, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp
} from './lib/firebase';

interface Review {
  id?: string;
  hospitalName: string;
  hospitalAddress: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export default function App() {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [radius, setRadius] = useState(10);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const lastSearchLocation = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const citySuggestions = [
    "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Hyderabad", "Peshawar", "Quetta", "Gujranwala",
    "Sialkot", "Bahawalpur", "Sargodha", "Sukkur", "Jhang", "Sheikhupura", "Larkana", "Gujrat", "Mardan", "Kasur",
    "Rahim Yar Khan", "Sahiwal", "Okara", "Wah Cantonment", "Dera Ghazi Khan", "Mirpur Khas", "Nawabshah", "Mingora",
    "Chiniot", "Kamoke", "Sadiqabad", "Burewala", "Jacobabad", "Shikarpur", "Muzaffargarh", "Kohat", "Khanewal",
    "Gojra", "Bahawalnagar", "Muridke", "Pakpattan", "Abbottabad", "Tanda Adam", "Jhelum", "Khanpur", "Dera Ismail Khan",
    "Chaman", "Charsadda", "Nowshera", "Khuzdar", "Phalia", "Mandi Bahauddin", "Gujar Khan"
  ];

  const filteredCities = searchQuery.length > 0 
    ? citySuggestions.filter(city => city.toLowerCase().startsWith(searchQuery.toLowerCase())).slice(0, 5)
    : [];
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  // Review specific states
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    let watchId: number;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Only re-search if location changed significantly (approx > 0.05 deg shift in any direction)
          if (!lastSearchLocation.current || 
              Math.abs(lastSearchLocation.current.lat - latitude) > 0.05 || 
              Math.abs(lastSearchLocation.current.lon - longitude) > 0.05) {
            
            setLocation({ lat: latitude, lon: longitude });
            lastSearchLocation.current = { lat: latitude, lon: longitude };
            setSearchQuery(""); // Clear manual search when GPS takes over
          }
        },
        (err) => console.error("Location watch error:", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    if (location && !searchQuery) {
       performSearch(location, activeCategory || undefined, radius);
    }
  }, [location, activeCategory, radius]);

  useEffect(() => {
    if (!selectedHospital) return;

    const q = query(
      collection(db, 'reviews'),
      where('hospitalName', '==', selectedHospital.name),
      where('hospitalAddress', '==', selectedHospital.address),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const revs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(revs);
    });

    return () => unsubscribe();
  }, [selectedHospital]);

  const categories = ["Emergency", "Pediatrics", "Cardiology", "Dental", "Pharmacy", "Clinic"];

  const handleManualSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    performSearch(searchQuery, activeCategory || undefined, radius);
  };

  const handleCategoryClick = (cat: string) => {
    const newCat = activeCategory === cat ? null : cat;
    setActiveCategory(newCat);
    
    if (location) {
      performSearch(location, newCat || undefined, radius);
    } else if (searchQuery) {
      performSearch(searchQuery, newCat || undefined, radius);
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
        performSearch({ lat: latitude, lon: longitude }, activeCategory || undefined, radius);
      },
      (err) => {
        setError("Please enable location access to find nearby hospitals.");
        setIsLocating(false);
        console.error(err);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const performSearch = async (loc: string | { lat: number; lon: number }, cat?: string, r: number = 10) => {
    setLoading(true);
    setError(null);
    try {
      const response = await findNearbyHospitals(loc, cat, r) as any;
      const detected = response.city || null;
      
      // Validation: If manual text search, check if result matches query
      if (typeof loc === 'string' && detected) {
        const queryLower = loc.toLowerCase();
        const detectedLower = detected.toLowerCase();
        // Simple fuzzy match: query part of detected or vice versa
        if (!detectedLower.includes(queryLower) && !queryLower.includes(detectedLower)) {
          setError("Location not match. Showing results for " + detected);
          setHospitals([]);
          setDetectedCity(detected);
          return;
        }
      }

      setHospitals(response.hospitals || []);
      setDetectedCity(detected);
      if (detected && typeof loc !== 'string') {
        setSearchQuery(detected); // Sync search bar with GPS result
      }
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

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedHospital || !newComment.trim()) return;

    setIsSubmittingReview(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        hospitalName: selectedHospital.name,
        hospitalAddress: selectedHospital.address,
        userName: 'Anonymous Guest',
        rating: newRating,
        comment: newComment,
        createdAt: serverTimestamp()
      });
      setNewComment('');
      setNewRating(5);
    } catch (err) {
      console.error("Error adding review:", err);
      alert("Failed to post review. Please check your connection.");
    } finally {
      setIsSubmittingReview(false);
    }
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
              <h1 className="font-extrabold text-xl tracking-tight text-slate-800 uppercase">NEAR<span className="text-sky-600">me</span> hospital</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Emergency & Specialist Care</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={getLocation}
              disabled={isLocating || loading}
              className="group relative flex items-center gap-2 bg-sky-100 text-sky-600 px-5 py-2 rounded-xl font-bold transition-all hover:bg-sky-200 active:scale-95 disabled:opacity-50"
            >
              {isLocating ? <Loader2 className="animate-spin" size={16} /> : <MapPin size={16} />}
              <span className="text-xs uppercase tracking-wider hidden sm:inline">Use GPS</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 flex-grow w-full">
        {/* Search & Filter Bar */}
        <div ref={searchRef} className="space-y-6 mb-12 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
          <form onSubmit={handleManualSearch} className="relative group">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search city, zip code, or address..."
              className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-5 pl-14 text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all text-lg font-medium"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors" size={24} />
            
            <AnimatePresence>
              {showSuggestions && filteredCities.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50"
                >
                  {filteredCities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        setSearchQuery(city);
                        setShowSuggestions(false);
                        performSearch(city, activeCategory || undefined, radius);
                      }}
                      className="w-full px-6 py-4 text-left hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0"
                    >
                      <MapPin size={16} className="text-slate-300" />
                      <span className="font-semibold text-slate-700">{city}</span>
                      <span className="text-[10px] uppercase tracking-widest text-slate-400 ml-auto">Pakistan</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm tracking-tight hover:bg-sky-600 transition-colors disabled:opacity-50 shadow-md"
            >
              Search
            </button>
          </form>

          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Search Radius</label>
                <span className="text-sm font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-lg">{radius} km</span>
              </div>
              <input 
                type="range"
                min="1"
                max="50"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-sky-600"
              />
            </div>
            
            <div className="flex flex-wrap gap-2 sm:max-w-md justify-end">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${
                    activeCategory === cat 
                      ? 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-100' 
                      : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-sky-200 hover:text-sky-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
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
              <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight leading-none uppercase">
                Find care <br/> near <span className="text-sky-600">you.</span>
              </h2>
              <p className="text-slate-500 text-xl max-w-xl mx-auto font-medium leading-relaxed">
                Search specialists and emergency units within <span className="text-sky-600 font-bold">{radius}km</span> area.
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
                <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Search Results</h3>
                <p className="text-slate-400 text-sm font-medium mt-1 flex items-center gap-1.5 uppercase tracking-widest">
                  {detectedCity && <span className="text-sky-600 font-bold">{detectedCity}</span>}
                  {detectedCity && <span> • </span>}
                  Showing results within <span className="text-sky-600 font-bold">{radius}km</span>
                </p>
              </div>
              <div className="text-[10px] font-black text-sky-600 bg-sky-50 border border-sky-100 px-4 py-2 rounded-xl uppercase tracking-[0.2em]">
                {hospitals.length} Found in Range
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
                         <span className="text-sky-600 font-black text-[10px] uppercase tracking-[0.2em] bg-sky-50 px-2.5 py-1.5 rounded-lg border border-sky-100/50">
                           {hospital.distance.toLowerCase().includes('km') ? hospital.distance : `${hospital.distance} KM`} Away
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
                        <div className="flex items-center gap-3">
                          {hospital.phone ? (
                            <a 
                              href={`tel:${hospital.phone}`} 
                              className="flex items-center gap-2 text-slate-600 hover:text-sky-600 transition-colors text-sm font-bold group/link"
                            >
                              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover/link:bg-sky-100/50">
                                <Phone size={16} />
                              </div>
                            </a>
                          ) : null}
                          <button 
                            onClick={() => setSelectedHospital(hospital)}
                            className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-all"
                          >
                            <MessageSquare size={16} />
                          </button>
                        </div>
                        
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

          {/* Review Modal Overlay */}
          <AnimatePresence>
            {selectedHospital && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedHospital(null)}
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                >
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 line-clamp-1">{selectedHospital.name}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Patient Reviews</p>
                    </div>
                    <button 
                      onClick={() => setSelectedHospital(null)}
                      className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="flex-grow overflow-y-auto p-8 space-y-6">
                    {reviews.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="mx-auto text-slate-100 mb-4" size={48} />
                        <p className="text-slate-400 text-sm font-medium">No reviews yet. Be the first to share your experience!</p>
                      </div>
                    ) : (
                      reviews.map((rev) => (
                        <div key={rev.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-[10px] font-bold text-sky-600">
                                {rev.userName[0]}
                              </div>
                              <span className="text-sm font-bold text-slate-700">{rev.userName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  size={10} 
                                  className={i < rev.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"} 
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed pl-8 italic">"{rev.comment}"</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-8 bg-slate-50 border-t border-slate-100 space-y-4">
                    <form onSubmit={handleReviewSubmit} className="space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate Experience</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button 
                              key={star}
                              type="button"
                              onClick={() => setNewRating(star)}
                              className="focus:outline-none transition-transform active:scale-125"
                            >
                              <Star 
                                size={18} 
                                className={star <= newRating ? "text-amber-400 fill-amber-400" : "text-slate-300"} 
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <textarea 
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Tell others about your visit..."
                          rows={3}
                          className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm focus:outline-none focus:border-sky-500 transition-all resize-none"
                        />
                        <button 
                          disabled={isSubmittingReview || !newComment.trim()}
                          className="absolute bottom-3 right-3 w-10 h-10 bg-sky-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-sky-100 disabled:opacity-50 hover:bg-sky-700 transition-all"
                        >
                          {isSubmittingReview ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

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
            <span className="text-sm tracking-[0.3em] font-black uppercase text-slate-900">NEAR<span className="text-sky-600">me</span> hospital</span>
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
