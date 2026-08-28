"use client";

import React from "react";
import { Box, Typography, TextField, TextFieldProps } from "@mui/material";

export interface FormFieldProps extends Omit<TextFieldProps, "label"> {
  label?: React.ReactNode;
  subLabel?: React.ReactNode;
  containerSx?: object;
}

export function FormField({
  label,
  subLabel,
  placeholder,
  helperText,
  containerSx,
  fullWidth = true,
  size = "small",
  sx,
  ...props
}: FormFieldProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, width: fullWidth ? "100%" : "auto", ...containerSx }}>
      {label && (
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography
            variant="caption"
            sx={{
              color: "#d4d4d8",
              fontWeight: 700,
              fontSize: "0.75rem",
              letterSpacing: "0.01em",
            }}
          >
            {label}
          </Typography>
          {subLabel && (
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
              {subLabel}
            </Typography>
          )}
        </Box>
      )}

      <TextField
        fullWidth={fullWidth}
        size={size}
        placeholder={placeholder}
        helperText={helperText}
        sx={{
          "& .MuiInputBase-input": {
            color: "#ffffff",
            fontSize: "0.8rem",
            py: 0.9,
            px: 1.2,
            "&::placeholder": {
              color: "#52525b",
              opacity: 1,
            },
          },
          "& .MuiFormHelperText-root": {
            color: "#71717a",
            fontSize: "0.68rem",
            mx: 0.5,
            mt: 0.4,
          },
          "& .MuiOutlinedInput-root": {
            bgcolor: "#0b0b0f",
            borderRadius: 1,
            "& fieldset": {
              borderColor: "#23232b",
            },
            "&:hover fieldset": {
              borderColor: "#3a3a46",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#3b82f6",
            },
          },
          ...sx,
        }}
        {...props}
      />
    </Box>
  );
}

export default FormField;
