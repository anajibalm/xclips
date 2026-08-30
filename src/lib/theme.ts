"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#f4f4f5", // Zinc-100 for crisp text/accents
      contrastText: "#09090b",
    },
    secondary: {
      main: "#3b82f6", // Vibrant modern blue
    },
    background: {
      default: "#09090b", // Zinc-950 deep black
      paper: "#121215",   // Zinc-900 surface
    },
    text: {
      primary: "#f4f4f5",
      secondary: "#a1a1aa", // Zinc-400
    },
    divider: "#27272a", // Zinc-800
    error: {
      main: "#f43f5e", // Rose-500
    },
    success: {
      main: "#10b981", // Emerald-500
    },
    warning: {
      main: "#f59e0b", // Amber-500
    },
    info: {
      main: "#38bdf8", // Sky-400
    },
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      "Helvetica",
      "Arial",
      "sans-serif",
    ].join(","),
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h5: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#121215",
          border: "1px solid #27272a",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.4)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#121215",
          border: "1px solid #27272a",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.4)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#09090b",
          color: "#f4f4f5",
          borderBottom: "1px solid #27272a",
          boxShadow: "none",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#121215",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#27272a",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#3f3f46",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#3b82f6",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: "#27272a",
          color: "#e4e4e7",
          border: "1px solid #3f3f46",
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: "#121215",
          backgroundImage: "none",
          border: "1px solid #27272a",
          borderRadius: "8px !important",
          color: "#f4f4f5",
          "&:before": {
            display: "none",
          },
          "&.Mui-expanded": {
            margin: "0 0 12px 0",
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          backgroundColor: "#121215",
          color: "#f4f4f5",
          "& .MuiAccordionSummary-expandIconWrapper": {
            color: "#a1a1aa",
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          backgroundColor: "#121215",
          color: "#f4f4f5",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        // Uniform global scrollbar (Masagi Zinc Dark scheme)
        "*": {
          scrollbarWidth: "thin",
          scrollbarColor: "#27272a transparent",
        },
        "*::-webkit-scrollbar": {
          width: 6,
          height: 6,
        },
        "*::-webkit-scrollbar-track": {
          background: "transparent",
        },
        "*::-webkit-scrollbar-thumb": {
          backgroundColor: "#27272a",
          borderRadius: 3,
        },
        "*::-webkit-scrollbar-thumb:hover": {
          backgroundColor: "#3f3f46",
        },
        "*::-webkit-scrollbar-corner": {
          background: "transparent",
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: "#18181b",
          backgroundImage: "none",
          border: "1px solid #27272a",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.85)",
          maxHeight: 320,
        },
        list: {
          padding: 4,
          "&::-webkit-scrollbar": {
            width: 5,
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#27272a",
            borderRadius: 3,
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 36,
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "#e4e4e7",
          borderRadius: 6,
          "&:hover": {
            backgroundColor: "#202026",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            color: "#ffffff",
          },
          "&.Mui-selected:hover": {
            backgroundColor: "rgba(59, 130, 246, 0.18)",
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: "#121215",
          border: "1px solid #27272a",
          backgroundImage: "none",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          paddingTop: "20px",
        },
      },
    },
  },
});
