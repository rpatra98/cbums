"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, createContext } from "react";
import Link from "next/link";
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Button, 
  Avatar, 
  Chip, 
  IconButton, 
  Menu, 
  MenuItem, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton,
  ListItemIcon, 
  ListItemText, 
  Divider 
} from "@mui/material";
import { 
  Menu as MenuIcon, 
  AccountCircle, 
  Dashboard, 
  Business, 
  Person, 
  Logout, 
  History 
} from "@mui/icons-material";

// Create a context to update coin balance
export const SessionUpdateContext = createContext({
  refreshUserSession: async () => {}
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, update: updateSession } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isMenuOpen = Boolean(anchorEl);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    // Use our dedicated logout page
    window.location.href = '/logout?callbackUrl=/';
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Function to refresh the user session data
  const refreshUserSession = async () => {
    try {
      await updateSession();
    } catch (error) {
      console.error("Error updating session:", error);
    }
  };

  const renderMenu = (
    <Menu
      anchorEl={anchorEl}
      open={isMenuOpen}
      onClose={handleMenuClose}
      transformOrigin={{ horizontal: "right", vertical: "top" }}
      anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
    >
      <MenuItem onClick={handleMenuClose}>
        <ListItemIcon>
          <AccountCircle fontSize="small" />
        </ListItemIcon>
        <ListItemText>Profile</ListItemText>
      </MenuItem>
      <MenuItem onClick={handleLogout}>
        <ListItemIcon>
          <Logout fontSize="small" />
        </ListItemIcon>
        <ListItemText>Logout</ListItemText>
      </MenuItem>
    </Menu>
  );

  return (
    <SessionUpdateContext.Provider value={{ refreshUserSession }}>
      <div className="min-h-screen bg-gray-50">
        <AppBar position="static">
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={toggleDrawer}
              sx={{ mr: 2, display: { xs: "block", sm: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 2 }}>
              CBUMS
            </Typography>
            <Box sx={{ display: { xs: "none", sm: "block" }, mr: 2 }}>
              <Button color="inherit" component={Link} href="/dashboard">
                Dashboard
              </Button>
              {(session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN") && (
                <Button color="inherit" component={Link} href="/dashboard/activity-logs">
                  Activity Logs
                </Button>
              )}
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            {session?.user && (
              <>
                {session.user.role !== "COMPANY" && session.user.subrole !== "GUARD" && (
                  <Chip
                    label={`${session.user.coins || 0} Coins`}
                    color="secondary"
                    sx={{ mr: 2, bgcolor: "rgba(255,255,255,0.15)" }}
                  />
                )}
                <Box display="flex" alignItems="center">
                  <Typography variant="body2" sx={{ mr: 1, display: { xs: "none", sm: "block" } }}>
                    {session.user.name}
                  </Typography>
                  <Chip
                    label={session.user.role.toLowerCase()}
                    size="small"
                    sx={{ 
                      mr: 2, 
                      textTransform: "capitalize",
                      bgcolor: "rgba(255,255,255,0.15)", 
                      display: { xs: "none", sm: "block" } 
                    }}
                  />
                  <IconButton
                    edge="end"
                    color="inherit"
                    onClick={handleProfileMenuOpen}
                  >
                    <Avatar
                      sx={{ width: 32, height: 32, bgcolor: "secondary.main" }}
                    >
                      {session.user.name?.[0] || "U"}
                    </Avatar>
                  </IconButton>
                </Box>
              </>
            )}
          </Toolbar>
        </AppBar>
        {renderMenu}

        <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer}>
          <Box
            sx={{ width: 250 }}
            role="presentation"
            onClick={toggleDrawer}
          >
            <List>
              <ListItem>
                <Typography variant="h6" color="primary">CBUMS Menu</Typography>
              </ListItem>
              <Divider />
              
              <ListItem disablePadding>
                <ListItemButton component={Link} href="/dashboard">
                  <ListItemIcon>
                    <Dashboard />
                  </ListItemIcon>
                  <ListItemText primary="Dashboard" />
                </ListItemButton>
              </ListItem>
              
              {session?.user?.role === "ADMIN" && (
                <ListItem disablePadding>
                  <ListItemButton component={Link} href="/dashboard/companies">
                    <ListItemIcon>
                      <Business />
                    </ListItemIcon>
                    <ListItemText primary="Companies" />
                  </ListItemButton>
                </ListItem>
              )}
              
              {(session?.user?.role === "ADMIN" || session?.user?.role === "COMPANY") && (
                <ListItem disablePadding>
                  <ListItemButton component={Link} href="/dashboard/employees">
                    <ListItemIcon>
                      <Person />
                    </ListItemIcon>
                    <ListItemText primary="Employees" />
                  </ListItemButton>
                </ListItem>
              )}
              
              {(session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN") && (
                <ListItem disablePadding>
                  <ListItemButton component={Link} href="/dashboard/activity-logs">
                    <ListItemIcon>
                      <History />
                    </ListItemIcon>
                    <ListItemText primary="Activity Logs" />
                  </ListItemButton>
                </ListItem>
              )}
              
              <Divider />
              
              <ListItem disablePadding>
                <ListItemButton onClick={handleLogout}>
                  <ListItemIcon>
                    <Logout />
                  </ListItemIcon>
                  <ListItemText primary="Logout" />
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
        </Drawer>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </SessionUpdateContext.Provider>
  );
} 