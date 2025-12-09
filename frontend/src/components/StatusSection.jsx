import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Download, Clock, Film, FileDown, Star, CheckCircle2, Hourglass, User, Settings, RefreshCw, Activity, FileText, Globe, Key, Lock, Save } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const SectionHeader = ({ title, icon: Icon, colorClass, serviceName, onConfigure }) => {
  const { toast } = useToast();

  const handleAction = (action) => {
    if (action === 'Configure') {
      onConfigure(serviceName);
    } else {
      toast({
        title: `${action} ${serviceName}`,
        description: `🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀`
      });
    }
  };

  return (
    <div className="flex items-center justify-between mb-2 flex-shrink-0">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${colorClass}`} /> {title}
      </h3>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 -mr-1.5">
            <Settings className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel className="text-xs">{serviceName} Config</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAction('Refresh')} className="text-xs cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction('View Logs')} className="text-xs cursor-pointer">
            <FileText className="w-3.5 h-3.5 mr-2" /> Logs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction('Configure')} className="text-xs cursor-pointer">
            <Settings className="w-3.5 h-3.5 mr-2" /> Configure
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const StatusSection = () => {
  const { toast } = useToast();
  const [configOpen, setConfigOpen] = useState(false);
  const [activeService, setActiveService] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    url: '',
    apiKey: '',
    username: '',
    password: ''
  });

  // Mock data for Plex (Watching)
  const watching = [
    { title: "Inception", user: "alice_w", progress: 75, type: "Movie" },
    { title: "The Office S03E04", user: "bob_m", progress: 30, type: "TV" },
    { title: "Dune: Part Two", user: "guest_01", progress: 15, type: "Movie" },
    { title: "Breaking Bad S05E14", user: "sarah_j", progress: 92, type: "TV" }
  ];

  // Mock data for Bittorrent (Downloading)
  const downloading = [
    { name: "Ubuntu 22.04.3 LTS", speed: "12.5 MB/s", progress: 45, eta: "10m" },
    { name: "Big Buck Bunny 4K Remaster", speed: "8.2 MB/s", progress: 88, eta: "2m" },
    { name: "Debian 12 Bookworm", speed: "4.1 MB/s", progress: 12, eta: "1h 20m" },
    { name: "Arch Linux ISO 2024.01", speed: "15.0 MB/s", progress: 99, eta: "10s" },
    { name: "Fedora Workstation 39", speed: "6.5 MB/s", progress: 33, eta: "45m" }
  ];

  // Mock data for Overseerr (Requests) - Original unsorted
  const rawRequests = [
    { title: "Oppenheimer", user: "bob_m", status: "approved", type: "Movie", date: "2h ago" },
    { title: "The Bear Season 3", user: "alice_w", status: "pending", type: "TV", date: "5h ago" },
    { title: "Poor Things", user: "sarah_j", status: "approved", type: "Movie", date: "1d ago" },
    { title: "Fallout Season 1", user: "guest_01", status: "pending", type: "TV", date: "2d ago" }
  ];

  // Sort Requests: Approved first, then Pending
  const requests = [...rawRequests].sort((a, b) => {
    if (a.status === 'approved' && b.status !== 'approved') return -1;
    if (a.status !== 'approved' && b.status === 'approved') return 1;
    return 0;
  });

  const handleConfigure = (service) => {
    setActiveService(service);
    // Reset form or load existing (mock) data
    setFormData({
      url: 'http://localhost:8080', // Mock default
      apiKey: '',
      username: '',
      password: ''
    });
    setConfigOpen(true);
  };

  const handleSaveConfig = () => {
    toast({
      title: "Configuration Saved",
      description: `Settings for ${activeService} have been updated successfully.`
    });
    setConfigOpen(false);
  };

  const renderConfigFields = () => {
    return (
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="url" className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Server URL</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              id="url" 
              value={formData.url} 
              onChange={(e) => setFormData({...formData, url: e.target.value})}
              className="pl-9" 
              placeholder="http://192.168.1.100:port" 
            />
          </div>
        </div>

        {activeService === 'qBittorrent' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  id="username" 
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="pl-9" 
                  placeholder="admin" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  id="password" 
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="pl-9" 
                  placeholder="••••••••" 
                />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              {activeService === 'Plex' ? 'X-Plex-Token' : 'API Key'}
            </Label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                id="apiKey" 
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                className="pl-9" 
                placeholder={activeService === 'Plex' ? "Your Plex Token" : "Your API Key"} 
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="h-full flex flex-col gap-3">
      {/* Plex / Watching Section */}
      <div className="flex-1 min-h-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col group/section">
        <SectionHeader 
          title="Now Playing (Plex)" 
          icon={Play} 
          colorClass="text-orange-500"
          serviceName="Plex"
          onConfigure={handleConfigure}
        />
        <div className="space-y-2 overflow-y-auto pr-2 flex-1 custom-scrollbar">
          {watching.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
              <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded flex-shrink-0 flex items-center justify-center">
                 <Film className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-medium text-xs text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-none">{item.title}</h4>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{item.user}</span>
                </div>
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 rounded-full" 
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {watching.length === 0 && <p className="text-xs text-slate-400 text-center py-2">Idle.</p>}
        </div>
      </div>

      {/* Downloads / Torrent Section */}
      <div className="flex-1 min-h-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col group/section">
        <SectionHeader 
          title="Downloads (qBittorrent)" 
          icon={Download} 
          colorClass="text-green-500"
          serviceName="qBittorrent"
          onConfigure={handleConfigure}
        />
        <div className="space-y-2 overflow-y-auto pr-2 flex-1 custom-scrollbar">
          {downloading.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
              <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded flex-shrink-0 flex items-center justify-center">
                 <FileDown className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1.5">
                  <h4 className="font-medium text-xs text-slate-900 dark:text-white truncate max-w-[50%]">{item.name}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    <span className="text-green-600 dark:text-green-400 font-semibold">{item.speed}</span>
                    <span className="w-px h-2.5 bg-slate-300 dark:bg-slate-600"></span>
                    <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {item.eta}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-green-500 rounded-full"
                      />
                   </div>
                </div>
              </div>
            </div>
          ))}
           {downloading.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No active downloads.</p>}
        </div>
      </div>

      {/* Overseerr / Requests Section */}
      <div className="flex-1 min-h-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col group/section">
        <SectionHeader 
          title="Requests (Overseerr)" 
          icon={Star} 
          colorClass="text-purple-500"
          serviceName="Overseerr"
          onConfigure={handleConfigure}
        />
        <div className="space-y-2 overflow-y-auto pr-2 flex-1 custom-scrollbar">
          {requests.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
              {/* Status Icon Indicator */}
              <div className={`w-8 h-8 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                item.status === 'approved' 
                  ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-900' 
                  : 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-900'
              }`}>
                 {item.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> : <Hourglass className="w-4 h-4" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <h4 className="font-medium text-xs text-slate-900 dark:text-white truncate max-w-[120px]">{item.title}</h4>
                  
                  {/* Status Badge */}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    item.status === 'approved' 
                      ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' 
                      : 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-2.5 h-2.5 opacity-70" /> {item.user}
                  </span>
                  <span className="font-mono opacity-70">{item.date}</span>
                </div>
              </div>
            </div>
          ))}
           {requests.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No pending requests.</p>}
        </div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"> {/* Added explicit solid backgrounds */}
          <DialogHeader>
            <DialogTitle>Configure {activeService}</DialogTitle>
            <DialogDescription>
              Enter the connection details for your {activeService} instance.
            </DialogDescription>
          </DialogHeader>
          
          {renderConfigFields()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" /> Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default StatusSection;