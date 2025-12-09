import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Download,
  Clock,
  Film,
  FileDown,
  Star,
  CheckCircle2,
  Hourglass,
  User,
  Settings,
  RefreshCw,
  FileText,
  Globe,
  Key,
  Lock,
  Save,
} from 'lucide-react';

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

/**
 * SectionHeader
 * - toont titel + icoon + tandwiel
 * - roept onConfigure(serviceName) aan wanneer "Configure" gekozen wordt
 * - roept onRefresh(serviceName) aan wanneer "Refresh" gekozen wordt (als meegegeven)
 */
const SectionHeader = ({ title, icon: Icon, colorClass, serviceName, onConfigure, onRefresh }) => {
  const { toast } = useToast();

  const handleAction = (action) => {
    if (action === 'Configure') {
      onConfigure && onConfigure(serviceName);
    } else if (action === 'Refresh') {
      if (onRefresh) {
        onRefresh(serviceName);
      } else {
        toast({
          title: `Refresh ${serviceName}`,
          description: `No refresh handler implemented yet.`,
        });
      }
    } else {
      toast({
        title: `${action} ${serviceName}`,
        description: `🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀`,
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
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 -mr-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel className="text-xs">{serviceName} Config</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleAction('Refresh')}
            className="text-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleAction('View Logs')}
            className="text-xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 mr-2" /> Logs
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleAction('Configure')}
            className="text-xs cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 mr-2" /> Configure
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const StatusSection = () => {
  const { toast } = useToast();

  // === CONFIG DIALOG STATE ===
  const [configOpen, setConfigOpen] = useState(false);
  const [activeService, setActiveService] = useState(''); // 'Plex' | 'qBittorrent' | 'Overseerr'

  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState(null);

  const [formData, setFormData] = useState({
    serverUrl: '',
    apiKey: '',
    username: '',
    password: '',
    token: '',
    enabled: true,
  });

  // === DATA STATE: PLEX / QBIT / OVERSEERR ===
  const [plexSessions, setPlexSessions] = useState([]);
  const [plexLoading, setPlexLoading] = useState(false);
  const [plexError, setPlexError] = useState(null);

  const [downloads, setDownloads] = useState([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [downloadsError, setDownloadsError] = useState(null);

  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState(null);

  // ===== Helpers voor API =====

  const serviceNameToId = (serviceName) => {
    if (serviceName === 'Plex') return 'plex';
    if (serviceName === 'qBittorrent') return 'qbittorrent';
    if (serviceName === 'Overseerr') return 'overseerr';
    return null;
  };

  const loadPlexNowPlaying = async () => {
    setPlexLoading(true);
    setPlexError(null);

    try {
      const res = await fetch('/api/integrations/plex/now-playing');
      const data = await res.json();

      if (!res.ok || data.online === false) {
        setPlexSessions([]);
        setPlexError(data.message || data.error || `Status ${data.statusCode || res.status}`);
        return;
      }

      setPlexSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (e) {
      setPlexSessions([]);
      setPlexError(e.message);
    } finally {
      setPlexLoading(false);
    }
  };

  const loadQbitDownloads = async () => {
    setDownloadsLoading(true);
    setDownloadsError(null);

    try {
      const res = await fetch('/api/integrations/qbittorrent/downloads');
      const data = await res.json();

      if (!res.ok || data.online === false) {
        setDownloads([]);
        setDownloadsError(data.message || data.error || `Status ${data.statusCode || res.status}`);
        return;
      }

      setDownloads(Array.isArray(data.downloads) ? data.downloads : []);
    } catch (e) {
      setDownloads([]);
      setDownloadsError(e.message);
    } finally {
      setDownloadsLoading(false);
    }
  };

  const loadOverseerrRequests = async () => {
    setRequestsLoading(true);
    setRequestsError(null);

    try {
      const res = await fetch('/api/integrations/overseerr/requests');
      const data = await res.json();

      if (!res.ok || data.online === false) {
        setRequests([]);
        setRequestsError(data.message || data.error || `Status ${data.statusCode || res.status}`);
        return;
      }

      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (e) {
      setRequests([]);
      setRequestsError(e.message);
    } finally {
      setRequestsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadPlexNowPlaying();
    loadQbitDownloads();
    loadOverseerrRequests();
  }, []);

  // Helper: download speed formatter (bytes/s -> MB/s)
  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
    const mb = bytesPerSec / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB/s`;
    }
    const kb = bytesPerSec / 1024;
    return `${kb.toFixed(1)} KB/s`;
  };

  // Helper: ETA formatter (seconden -> simpele string)
  const formatEta = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Helper: datum formatter voor Overseerr
  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  // === CONFIG LOGICA ===

  const handleConfigure = async (service) => {
    setActiveService(service);
    setConfigOpen(true);
    setConfigLoading(true);
    setConfigError(null);

    const id = serviceNameToId(service);
    if (!id) {
      setConfigError('Unknown service');
      setConfigLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/integrations/${id}/settings`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Failed to load settings (${res.status})`);
      }

      // Standaard veld serverUrl + enabled
      const serverUrl = data.serverUrl || '';
      const enabled = typeof data.enabled === 'boolean' ? data.enabled : true;

      if (id === 'plex') {
        setFormData({
          serverUrl,
          enabled,
          token: '',
          apiKey: '',
          username: '',
          password: '',
        });
      } else if (id === 'qbittorrent') {
        setFormData({
          serverUrl,
          enabled,
          username: '',
          password: '',
          token: '',
          apiKey: '',
        });
      } else if (id === 'overseerr') {
        setFormData({
          serverUrl,
          enabled,
          apiKey: '',
          token: '',
          username: '',
          password: '',
        });
      }
    } catch (e) {
      setConfigError(e.message);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!activeService) return;

    setConfigSaving(true);
    setConfigError(null);

    const id = serviceNameToId(activeService);

    try {
      const body = {
        enabled: formData.enabled,
        serverUrl: formData.serverUrl,
      };

      if (id === 'plex' && formData.token.trim() !== '') {
        body.token = formData.token.trim();
      }

      if (id === 'qbittorrent') {
        if (formData.username.trim() !== '') body.username = formData.username.trim();
        if (formData.password.trim() !== '') body.password = formData.password.trim();
      }

      if (id === 'overseerr' && formData.apiKey.trim() !== '') {
        body.apiKey = formData.apiKey.trim();
      }

      const res = await fetch(`/api/integrations/${id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || `Failed to save settings (${res.status})`);
      }

      toast({
        title: 'Configuration Saved',
        description: `Settings for ${activeService} have been updated successfully.`,
      });

      setConfigOpen(false);

      // Na save: relevante data opnieuw laden
      if (id === 'plex') {
        loadPlexNowPlaying();
      } else if (id === 'qbittorrent') {
        loadQbitDownloads();
      } else if (id === 'overseerr') {
        loadOverseerrRequests();
      }
    } catch (e) {
      setConfigError(e.message);
    } finally {
      setConfigSaving(false);
    }
  };

  const renderConfigFields = () => {
    if (!activeService) return null;

    return (
      <div className="space-y-4 py-2">
        {/* Server URL */}
        <div className="space-y-2">
          <Label
            htmlFor="serverUrl"
            className="text-xs font-semibold uppercase text-slate-500 tracking-wider"
          >
            Server URL
          </Label>
          <div className="relative">
            <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              id="serverUrl"
              value={formData.serverUrl}
              onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
              className="pl-9"
              placeholder="http://192.168.1.100:port"
            />
          </div>
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            />
            <span className="text-slate-500 dark:text-slate-300">Enabled</span>
          </label>
        </div>

        {/* Specifieke velden per service */}
        {activeService === 'qBittorrent' ? (
          <>
            <div className="space-y-2">
              <Label
                htmlFor="username"
                className="text-xs font-semibold uppercase text-slate-500 tracking-wider"
              >
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="pl-9"
                  placeholder="admin"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs font-semibold uppercase text-slate-500 tracking-wider"
              >
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="pl-9"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </>
        ) : activeService === 'Plex' ? (
          <div className="space-y-2">
            <Label
              htmlFor="token"
              className="text-xs font-semibold uppercase text-slate-500 tracking-wider"
            >
              X-Plex-Token
            </Label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="token"
                type="password"
                value={formData.token}
                onChange={(e) =>
                  setFormData({ ...formData, token: e.target.value })
                }
                className="pl-9"
                placeholder="Your Plex Token"
              />
            </div>
          </div>
        ) : (
          // Overseerr
          <div className="space-y-2">
            <Label
              htmlFor="apiKey"
              className="text-xs font-semibold uppercase text-slate-500 tracking-wider"
            >
              API Key
            </Label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="apiKey"
                type="password"
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
                className="pl-9"
                placeholder="Your API Key"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // === RENDER ===

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
          onRefresh={() => loadPlexNowPlaying()}
        />
        <div className="space-y-2 overflow-y-auto pr-2 flex-1 custom-scrollbar">
          {plexLoading && (
            <p className="text-xs text-slate-400 text-center py-2">Loading…</p>
          )}
          {plexError && !plexLoading && (
            <p className="text-xs text-red-400 text-center py-2">
              {plexError}
            </p>
          )}
          {!plexLoading &&
            !plexError &&
            plexSessions.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded flex-shrink-0 flex items-center justify-center">
                  <Film className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-medium text-xs text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-none">
                      {item.title || item.grandparentTitle || 'Unknown'}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      {item.user || 'Unknown'}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full"
                      style={{ width: `${item.progressPercent || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          {!plexLoading &&
            !plexError &&
            plexSessions.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">
                Idle.
              </p>
            )}
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
          onRefresh={() => loadQbitDownloads()}
        />
        <div className="space-y-2 overflow-y-auto pr-2 flex-1 custom-scrollbar">
          {downloadsLoading && (
            <p className="text-xs text-slate-400 text-center py-2">
              Loading…
            </p>
          )}
          {downloadsError && !downloadsLoading && (
            <p className="text-xs text-red-400 text-center py-2">
              {downloadsError}
            </p>
          )}
          {!downloadsLoading &&
            !downloadsError &&
            downloads.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded flex-shrink-0 flex items-center justify-center">
                  <FileDown className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <h4 className="font-medium text-xs text-slate-900 dark:text-white truncate max-w-[50%]">
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        {formatSpeed(item.downloadSpeed)}
                      </span>
                      <span className="w-px h-2.5 bg-slate-300 dark:bg-slate-600"></span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {formatEta(item.eta)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progressPercent || 0}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-green-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          {!downloadsLoading &&
            !downloadsError &&
            downloads.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">
                No active downloads.
              </p>
            )}
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
          onRefresh={() => loadOverseerrRequests()}
        />
        <div className="space-y-2 overflow-y-auto pr-2 flex-1 custom-scrollbar">
          {requestsLoading && (
            <p className="text-xs text-slate-400 text-center py-2">
              Loading…
            </p>
          )}
          {requestsError && !requestsLoading && (
            <p className="text-xs text-red-400 text-center py-2">
              {requestsError}
            </p>
          )}

          {!requestsLoading &&
            !requestsError &&
            requests.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                    item.status === 'approved'
                      ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-900'
                      : 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-900'
                  }`}
                >
                  {item.status === 'approved' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Hourglass className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className="font-medium text-xs text-slate-900 dark:text-white truncate max-w-[120px]">
                      {item.title}
                    </h4>

                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        item.status === 'approved'
                          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <User className="w-2.5 h-2.5 opacity-70" />{' '}
                      {item.requestedBy || 'Unknown'}
                    </span>
                    <span className="font-mono opacity-70">
                      {formatDate(item.requestedAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

          {!requestsLoading &&
            !requestsError &&
            requests.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">
                No pending requests.
              </p>
            )}
        </div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle>Configure {activeService}</DialogTitle>
            <DialogDescription>
              Enter the connection details for your {activeService} instance.
            </DialogDescription>
          </DialogHeader>

          {configLoading ? (
            <p className="text-sm text-slate-400">Loading settings…</p>
          ) : (
            <>
              {configError && (
                <div className="mb-2 rounded-md bg-red-900/40 border border-red-500 px-3 py-2 text-xs text-red-100">
                  {configError}
                </div>
              )}
              {renderConfigFields()}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={configSaving || configLoading}
            >
              <Save className="w-4 h-4 mr-2" />{" "}
              {configSaving ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default StatusSection;
