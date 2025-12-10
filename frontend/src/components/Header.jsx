import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Server,
  Settings,
  Sun,
  Moon,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  Save,
  List,
  Globe,
  User as UserIcon,
  LogOut,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "../context/AuthContext.jsx";

import {
  useSettings,
  getIconComponent,
  availableIcons,
} from "../context/SettingsContext.jsx";

const colorOptions = [
  { label: "Blue (Default)", value: "from-blue-500 to-blue-600", displayClass: "bg-blue-500" },
  { label: "Purple", value: "from-purple-500 to-pink-600", displayClass: "bg-purple-500" },
  { label: "Green", value: "from-green-500 to-emerald-600", displayClass: "bg-green-500" },
  { label: "Red", value: "from-orange-500 to-red-600", displayClass: "bg-red-500" },
  { label: "Orange", value: "from-yellow-500 to-orange-600", displayClass: "bg-orange-500" },
  { label: "Cyan", value: "from-cyan-500 to-blue-600", displayClass: "bg-cyan-500" },
  { label: "Indigo", value: "from-indigo-500 to-violet-500", displayClass: "bg-indigo-500" },
  { label: "Gray", value: "from-gray-500 to-slate-600", displayClass: "bg-slate-500" },
  { label: "Pink", value: "from-pink-500 to-rose-600", displayClass: "bg-pink-500" },
  { label: "Teal", value: "from-teal-500 to-cyan-600", displayClass: "bg-teal-500" },
  { label: "Lime", value: "from-lime-500 to-green-600", displayClass: "bg-lime-500" },
  { label: "Yellow", value: "from-yellow-400 to-amber-500", displayClass: "bg-yellow-400" },
  { label: "Brown", value: "from-amber-700 to-yellow-800", displayClass: "bg-amber-700" },
];

const Header = () => {
  const { theme, setTheme } = useTheme();
  const {
    containers,
    addContainer,
    deleteContainer,
    updateContainer,
    moveContainer,
    dialogState,
    openAddDialog,
    openManageDialog,
    openEditDialog,
    closeDialog,
  } = useSettings();
  const { toast } = useToast();

  const { user, logout, createUserAsAdmin } = useAuth();

  const initials =
    (user?.name &&
      user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()) ||
    (user?.email?.[0] || "?").toUpperCase();

  const initialFormState = {
    name: "",
    description: "",
    url: "",
    iconName: "Box",
    color: "from-blue-500 to-blue-600",
  };

  const [formData, setFormData] = useState(initialFormState);

  // user-management dialog
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState("");

  useEffect(() => {
    if (dialogState.isOpen) {
      if (dialogState.mode === "edit" && dialogState.containerIndex !== null) {
        const container = containers[dialogState.containerIndex];
        setFormData({
          name: container.name,
          description: container.description || "",
          url: container.url || "",
          iconName: container.iconName || "Box",
          color: container.color || "from-blue-500 to-blue-600",
        });
      } else if (dialogState.mode === "new") {
        setFormData(initialFormState);
      }
    }
  }, [dialogState.isOpen, dialogState.mode, dialogState.containerIndex, containers]);

  const handleSaveContainer = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.url) {
      toast({
        title: "Validation Error",
        description: "Name and URL are required fields.",
        variant: "destructive",
      });
      return;
    }
    if (dialogState.mode === "edit" && dialogState.containerIndex !== null) {
      updateContainer(dialogState.containerIndex, {
        ...containers[dialogState.containerIndex],
        ...formData,
      });
      toast({
        title: "Container Updated",
        description: `${formData.name} has been updated successfully.`,
      });
      closeDialog();
    } else {
      addContainer({
        ...formData,
        status: "running",
      });
      toast({
        title: "Container Added",
        description: `${formData.name} added successfully!`,
      });
      closeDialog();
    }
  };

  const handleDeleteClick = (index) => {
    deleteContainer(index);
    toast({
      title: "Container Deleted",
      description: "Container has been removed.",
      variant: "destructive",
    });
  };

  const getDialogTitle = () => {
    switch (dialogState.mode) {
      case "new":
        return "Add Service";
      case "manage":
        return "Manage Services";
      case "edit":
        return "Edit Service";
      default:
        return "Settings";
    }
  };

  const isAdmin = user?.role === "admin";

  const handleCreateUser = async () => {
    setUserError("");
    if (!newUserForm.email || !newUserForm.password) {
      setUserError("E-mail en wachtwoord zijn verplicht.");
      return;
    }
    setCreatingUser(true);
    try {
      await createUserAsAdmin({
        name: newUserForm.name,
        email: newUserForm.email,
        password: newUserForm.password,
      });
      toast({
        title: "User aangemaakt",
        description: `Account voor ${newUserForm.email} is aangemaakt.`,
      });
      setNewUserForm({ name: "", email: "", password: "" });
      setUserDialogOpen(false);
    } catch (err) {
      setUserError(err.message || "User aanmaken mislukt.");
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <motion.header
      initial={{
        opacity: 0,
        y: -20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.6,
      }}
      className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-sm"
    >
      <div className="flex items-center gap-3 min-w-max">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg">
          <Server className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Server Connect
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Status: Online
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-max ml-auto">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 relative"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-orange-500" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-slate-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Settings dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <Settings className="h-[1.2rem] w-[1.2rem] text-slate-700 dark:text-slate-200" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openAddDialog} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              <span>Add Container</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openManageDialog} className="cursor-pointer">
              <List className="mr-2 h-4 w-4" />
              <span>Manage Containers</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                className="rounded-full border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 p-0"
              >
                <span className="inline-flex w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 items-center justify-center text-xs font-semibold text-white shadow-md">
                  {initials}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-start gap-2 cursor-default">
                <div className="mt-0.5">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {user.name || "User"}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate">
                    {user.email}
                  </span>
                  {isAdmin && (
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      Admin
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setUserDialogOpen(true)}
                  >
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Manage users</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-500 focus:text-red-500"
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log uit</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Container settings dialog */}
        <Dialog open={dialogState.isOpen} onOpenChange={(val) => !val && closeDialog()}>
          <DialogContent className="sm:max-w-[550px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg shadow-xl">
            <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <DialogTitle className="text-xl text-slate-900 dark:text-white flex items-center gap-2">
                {dialogState.mode === "new" && (
                  <Plus className="w-5 h-5 text-blue-500" />
                )}
                {dialogState.mode === "manage" && (
                  <Settings className="w-5 h-5 text-purple-500" />
                )}
                {dialogState.mode === "edit" && (
                  <Edit2 className="w-5 h-5 text-orange-500" />
                )}
                {getDialogTitle()}
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                {dialogState.mode === "new" &&
                  "Configure a new service to monitor on your dashboard."}
                {dialogState.mode === "manage" &&
                  "View and manage your active service containers. Reorder them using the arrows."}
                {dialogState.mode === "edit" &&
                  `Modifying settings for ${formData.name}`}
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              {(dialogState.mode === "new" || dialogState.mode === "edit") && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="name"
                      className="text-xs font-semibold uppercase text-slate-500 tracking-wider"
                    >
                      Service Name
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Plex Media Server"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="icon"
                        className="text-xs font-semibold uppercase text-slate-500 tracking-wider"
                      >
                        Icon
                      </Label>
                      <Select
                        value={formData.iconName}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            iconName: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Icon" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[250px] bg-white dark:bg-slate-950">
                          {availableIcons.map((icon) => {
                            const IconComp = getIconComponent(icon);
                            return (
                              <SelectItem key={icon} value={icon}>
                                <div className="flex items-center gap-2">
                                  <IconComp className="w-4 h-4" />
                                  <span>{icon}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="color"
                        className="text-xs font-semibold uppercase text-slate-500 tracking-wider"
                      >
                        Color Theme
                      </Label>
                      <Select
                        value={formData.color}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            color: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Color" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[250px] bg-white dark:bg-slate-950">
                          {colorOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 rounded-full ${option.displayClass}`}
                                ></div>
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="url"
                      className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3" /> Service URL
                    </Label>
                    <Input
                      id="url"
                      value={formData.url}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          url: e.target.value,
                        })
                      }
                      placeholder="https://plex.jouwdomein.nl"
                    />
                  </div>
                </div>
              )}

              {dialogState.mode === "manage" && (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 -mr-2">
                  {containers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                      <Server className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">
                        No containers configured.
                      </p>
                      <Button
                        variant="link"
                        onClick={openAddDialog}
                        className="text-blue-500"
                      >
                        Add your first container
                      </Button>
                    </div>
                  ) : (
                    containers.map((container, idx) => {
                      const IconComp = getIconComponent(container.iconName);
                      return (
                        <div
                          key={idx}
                          className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`p-2.5 rounded-lg bg-gradient-to-br ${
                                container.color || "from-gray-500 to-gray-600"
                              } shadow-sm`}
                            >
                              <IconComp className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {container.name}
                              </p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">
                                {container.url}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1 items-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                              onClick={() => moveContainer(idx, idx - 1)}
                              disabled={idx === 0}
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                              onClick={() => moveContainer(idx, idx + 1)}
                              disabled={idx === containers.length - 1}
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                              onClick={() => openEditDialog(idx)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                              onClick={() => handleDeleteClick(idx)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
              {dialogState.mode === "edit" && (
                <Button
                  variant="outline"
                  onClick={openManageDialog}
                  className="mr-auto"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to List
                </Button>
              )}

              {dialogState.mode === "manage" && (
                <Button
                  onClick={openAddDialog}
                  className="ml-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add New Service
                </Button>
              )}

              {(dialogState.mode === "new" || dialogState.mode === "edit") && (
                <div className="flex gap-2 w-full sm:w-auto ml-auto">
                  <Button variant="ghost" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    onClick={handleSaveContainer}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                  >
                    {dialogState.mode === "edit" ? (
                      <>
                        <Save className="w-4 h-4 mr-2" /> Save Changes
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" /> Add Service
                      </>
                    )}
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* User management dialog (alleen admin) */}
        <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
          <DialogContent className="sm:max-w-[420px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle>Manage users</DialogTitle>
              <DialogDescription>
                Alleen admin kan nieuwe accounts toevoegen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="newUserName">Naam (optioneel)</Label>
                <Input
                  id="newUserName"
                  value={newUserForm.name}
                  onChange={(e) =>
                    setNewUserForm((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newUserEmail">E-mail</Label>
                <Input
                  id="newUserEmail"
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) =>
                    setNewUserForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newUserPass">Wachtwoord</Label>
                <Input
                  id="newUserPass"
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) =>
                    setNewUserForm((p) => ({ ...p, password: e.target.value }))
                  }
                />
              </div>
              {userError && (
                <div className="text-xs text-red-400 bg-red-900/40 border border-red-500/60 rounded-md px-3 py-2">
                  {userError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                Sluiten
              </Button>
              <Button
                onClick={handleCreateUser}
                disabled={creatingUser}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {creatingUser ? "Bezig..." : "Account aanmaken"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </motion.header>
  );
};

export default Header;
