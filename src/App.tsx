import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, 
  Search, 
  User, 
  Users, 
  Plus, 
  Play, 
  Save, 
  LogOut, 
  Sparkles,
  Heart,
  Share2,
  ChevronRight,
  BadgeCheck,
  Crown,
  Code,
  Star
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UserProfile {
  id: string;
  username: string;
  email: string;
  profilePicture: string;
  bannerImage: string;
  badges: string[];
}

interface Song {
  title: string;
  artist: string;
  spotifyUri?: string;
}

interface Playlist {
  id?: string;
  name: string;
  description: string;
  songs: Song[];
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState('');
  const [generating, setGenerating] = useState(false);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [savedPlaylists, setSavedPlaylists] = useState<Playlist[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'library' | 'profile'>('generate');

  useEffect(() => {
    fetchUser();
    fetchPlaylists();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.error('Failed to fetch user', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const res = await fetch('/api/playlists');
      if (res.ok) {
        const data = await res.json();
        setSavedPlaylists(data);
      }
    } catch (err) {
      console.error('Failed to fetch playlists', err);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/auth/url');
      const { url } = await res.json();
      const authWindow = window.open(url, 'spotify_auth', 'width=600,height=800');
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          fetchUser();
          fetchPlaylists();
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setCurrentPlaylist(null);
    setSavedPlaylists([]);
  };

  const generatePlaylist = async () => {
    if (!mood.trim()) return;
    setGenerating(true);
    setCurrentPlaylist(null);
    try {
      const res = await fetch('/api/generate-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentPlaylist(data);
      }
    } catch (err) {
      console.error('Generation failed', err);
    } finally {
      setGenerating(false);
    }
  };

  const savePlaylist = async () => {
    if (!currentPlaylist) return;
    try {
      const res = await fetch('/api/save-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPlaylist),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedPlaylists([data, ...savedPlaylists]);
        alert('Playlist saved to library!');
      }
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-emerald-500"
        >
          <Music size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full animate-pulse delay-700" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center px-6 max-w-2xl"
        >
          <div className="mb-8 inline-flex p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <Music className="text-emerald-500" size={40} />
          </div>
          <h1 className="text-6xl font-bold mb-6 tracking-tight bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
            The Moody Men Player
          </h1>
          <p className="text-xl text-zinc-400 mb-10 leading-relaxed">
            AI-powered music curation for your every mood. Connect your Spotify to start generating personalized soundtracks.
          </p>
          <button 
            onClick={handleLogin}
            className="group relative px-8 py-4 bg-emerald-500 text-black font-bold rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative flex items-center gap-2">
              Login with Spotify <ChevronRight size={20} />
            </span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-12">
          <div className="p-2 bg-emerald-500 rounded-lg">
            <Music size={20} className="text-black" />
          </div>
          <span className="font-bold text-lg tracking-tight">Moody Men</span>
        </div>

        <nav className="space-y-2 flex-1">
          <SidebarItem 
            icon={<Sparkles size={20} />} 
            label="Generate" 
            active={activeTab === 'generate'} 
            onClick={() => setActiveTab('generate')}
          />
          <SidebarItem 
            icon={<Music size={20} />} 
            label="Library" 
            active={activeTab === 'library'} 
            onClick={() => setActiveTab('library')}
          />
          <SidebarItem 
            icon={<User size={20} />} 
            label="Profile" 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')}
          />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Friends" 
            active={false} 
          />
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-zinc-500 hover:text-white transition-colors w-full px-4 py-2"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'generate' && (
            <motion.div 
              key="generate"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <header className="mb-12">
                <h2 className="text-4xl font-bold mb-4">How are you feeling today?</h2>
                <p className="text-zinc-500">Describe your mood, and let Gemini curate the perfect playlist.</p>
              </header>

              <div className="relative mb-12">
                <input 
                  type="text"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="e.g. Late night overthinking, Sigma gym energy..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-xl focus:outline-none focus:border-emerald-500/50 transition-colors pr-32"
                  onKeyDown={(e) => e.key === 'Enter' && generatePlaylist()}
                />
                <button 
                  onClick={generatePlaylist}
                  disabled={generating || !mood.trim()}
                  className="absolute right-3 top-3 bottom-3 px-6 bg-emerald-500 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
                >
                  {generating ? '...' : 'Generate'}
                </button>
              </div>

              {currentPlaylist && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl"
                >
                  <div className="p-8 border-b border-white/10 flex justify-between items-end">
                    <div>
                      <h3 className="text-3xl font-bold mb-2">{currentPlaylist.name}</h3>
                      <p className="text-zinc-400">{currentPlaylist.description}</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={savePlaylist}
                        className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                      >
                        <Save size={20} />
                      </button>
                      <button className="p-3 bg-emerald-500 text-black rounded-full hover:scale-105 transition-transform">
                        <Play size={20} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    {currentPlaylist.songs.map((song, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl transition-colors group">
                        <span className="text-zinc-600 w-6 text-sm">{i + 1}</span>
                        <div className="flex-1">
                          <div className="font-medium">{song.title}</div>
                          <div className="text-sm text-zinc-500">{song.artist}</div>
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:text-emerald-500">
                          <Plus size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div 
              key="library"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-4xl font-bold mb-8">Your Library</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedPlaylists.map((p, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-colors cursor-pointer group">
                    <div className="w-full aspect-square bg-emerald-500/10 rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden">
                      <Music size={48} className="text-emerald-500/20" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="p-4 bg-emerald-500 text-black rounded-full">
                          <Play size={24} fill="currentColor" />
                        </div>
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-1">{p.name}</h3>
                    <p className="text-sm text-zinc-500 line-clamp-2">{p.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="relative h-64 rounded-3xl overflow-hidden mb-20">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-purple-500/20" />
                <img 
                  src={user.bannerImage || 'https://picsum.photos/seed/banner/1200/400'} 
                  className="w-full h-full object-cover opacity-50"
                  alt="Banner"
                />
                <div className="absolute -bottom-16 left-8 flex items-end gap-6">
                  <div className="w-32 h-32 rounded-3xl border-4 border-[#050505] overflow-hidden bg-zinc-800">
                    <img src={user.profilePicture} className="w-full h-full object-cover" alt="PFP" />
                  </div>
                  <div className="pb-4">
                    <h2 className="text-4xl font-bold flex items-center gap-3">
                      {user.username}
                      <BadgeCheck className="text-emerald-500" size={24} />
                    </h2>
                    <div className="flex gap-2 mt-2">
                      {user.badges.map((badge, i) => (
                        <Badge key={i} type={badge} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-12">
                <StatCard label="Playlists" value={savedPlaylists.length.toString()} />
                <StatCard label="Friends" value="12" />
                <StatCard label="Moods Explored" value="42" />
              </div>

              <div className="space-y-6">
                <h3 className="text-2xl font-bold">Recent Activity</h3>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center text-zinc-500">
                  No recent activity to show.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 w-full px-4 py-3 rounded-xl transition-all",
        active ? "bg-emerald-500 text-black font-bold" : "text-zinc-500 hover:text-white hover:bg-white/5"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Badge({ type }: { type: string }) {
  const getIcon = () => {
    switch (type) {
      case 'Owner': return <Crown size={12} />;
      case 'Developer': return <Code size={12} />;
      case 'Premium User': return <Star size={12} />;
      default: return <BadgeCheck size={12} />;
    }
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-md text-[10px] font-bold uppercase tracking-wider text-zinc-400 border border-white/5">
      {getIcon()}
      {type}
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
      <div className="text-zinc-500 text-sm mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
