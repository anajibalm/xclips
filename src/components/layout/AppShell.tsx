"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Box } from "@mui/material";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isXclipsStudio = pathname === "/xclips/studio";
  const isXclipsDownloader = pathname === "/xclips/downloader";
  const isFixed100vh = isXclipsStudio || isXclipsDownloader;
  const isXclips = pathname.startsWith("/xclips");

  // Standalone xClips Studio & Downloader: 100vh fixed desktop container without padding overflow
  if (isFixed100vh) {
    return (
      <Box
        sx={{
          height: "100vh",
          maxHeight: "100vh",
          overflow: "hidden",
          bgcolor: "#09090b",
          color: "#f4f4f5",
          width: "100%",
          maxWidth: "100vw",
          m: 0,
          p: 0,
          boxSizing: "border-box",
        }}
      >
        {children}
      </Box>
    );
  }

  // Standalone xClips mode: Complete isolation from live-assist menus and constraints
  if (isXclips) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#09090b",
          color: "#f4f4f5",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: "100%",
            maxWidth: "1800px",
            mx: "auto",
            px: { xs: 1.5, sm: 2.5, md: 3 },
            py: { xs: 1.5, sm: 2 },
          }}
        >
          {children}
        </Box>
      </Box>
    );
  }

  // Fallback for any non-xclips route (should not happen; root redirects to /xclips)
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#09090b",
        color: "#f4f4f5",
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          maxWidth: "1800px",
          mx: "auto",
          px: { xs: 1.5, sm: 2.5, md: 3 },
          py: { xs: 1.5, sm: 2 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
