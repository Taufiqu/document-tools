"""Design system — colours, fonts, and spacing constants for Document Tools GUI."""
from __future__ import annotations

# ------------------------------------------------------------------ #
# Colour palette                                                        #
# ------------------------------------------------------------------ #

# Background layers
BG_APP        = "#0f1117"   # root window
BG_SIDEBAR    = "#151820"   # left nav panel
BG_CARD       = "#1a1f2e"   # content cards
BG_INPUT      = "#1e2435"   # entry / listbox bg
BG_HOVER      = "#252d40"   # hover state
BG_SELECTED   = "#1d2d50"   # selected nav item

# Accent
ACCENT        = "#4f8ef7"   # primary blue
ACCENT_HOVER  = "#6ba3ff"
ACCENT_DIM    = "#2d5ab5"   # pressed / disabled

# Status
SUCCESS       = "#2dd4a0"
SUCCESS_BG    = "#0d3328"
ERROR         = "#f76f6f"
ERROR_BG      = "#3a1212"
WARNING       = "#f5a623"
WARNING_BG    = "#3a2800"

# Text
TEXT_PRIMARY   = "#e8eaf0"
TEXT_SECONDARY = "#8b92a8"
TEXT_MUTED     = "#4e556b"
TEXT_ACCENT    = ACCENT

# Border
BORDER         = "#252d40"
BORDER_FOCUS   = ACCENT

# ------------------------------------------------------------------ #
# Fonts                                                                 #
# ------------------------------------------------------------------ #

FONT_FAMILY   = "Segoe UI"          # Windows native; falls back fine on Linux
FONT_FAMILY_MONO = "Consolas"

FONT_XS    = (FONT_FAMILY, 10)
FONT_SM    = (FONT_FAMILY, 11)
FONT_BASE  = (FONT_FAMILY, 12)
FONT_MD    = (FONT_FAMILY, 13)
FONT_LG    = (FONT_FAMILY, 15, "bold")
FONT_XL    = (FONT_FAMILY, 18, "bold")
FONT_TITLE = (FONT_FAMILY, 22, "bold")

FONT_MONO  = (FONT_FAMILY_MONO, 11)

# ------------------------------------------------------------------ #
# Spacing / sizing                                                      #
# ------------------------------------------------------------------ #

PAD_XS   = 4
PAD_SM   = 8
PAD_BASE = 12
PAD_MD   = 16
PAD_LG   = 24
PAD_XL   = 32

SIDEBAR_WIDTH  = 200
CORNER_RADIUS  = 8
BUTTON_HEIGHT  = 36

# ------------------------------------------------------------------ #
# CustomTkinter appearance bootstrap                                    #
# ------------------------------------------------------------------ #

CTK_THEME = {
    "CTk": {
        "fg_color": [BG_APP, BG_APP],
    },
    "CTkFrame": {
        "fg_color": [BG_CARD, BG_CARD],
        "border_color": [BORDER, BORDER],
        "border_width": 1,
        "corner_radius": CORNER_RADIUS,
    },
    "CTkButton": {
        "fg_color": [ACCENT, ACCENT],
        "hover_color": [ACCENT_HOVER, ACCENT_HOVER],
        "text_color": ["#ffffff", "#ffffff"],
        "corner_radius": CORNER_RADIUS,
        "border_width": 0,
    },
    "CTkEntry": {
        "fg_color": [BG_INPUT, BG_INPUT],
        "border_color": [BORDER, BORDER],
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
        "placeholder_text_color": [TEXT_MUTED, TEXT_MUTED],
        "corner_radius": CORNER_RADIUS,
    },
    "CTkLabel": {
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
    },
    "CTkScrollableFrame": {
        "fg_color": [BG_CARD, BG_CARD],
        "scrollbar_button_color": [BORDER, BORDER],
        "scrollbar_button_hover_color": [ACCENT_DIM, ACCENT_DIM],
        "label_fg_color": [BG_CARD, BG_CARD],
    },
    "CTkTabview": {
        "fg_color": [BG_CARD, BG_CARD],
        "segmented_button_fg_color": [BG_INPUT, BG_INPUT],
        "segmented_button_selected_color": [ACCENT, ACCENT],
        "segmented_button_selected_hover_color": [ACCENT_HOVER, ACCENT_HOVER],
        "segmented_button_unselected_color": [BG_INPUT, BG_INPUT],
        "segmented_button_unselected_hover_color": [BG_HOVER, BG_HOVER],
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
        "text_color_disabled": [TEXT_MUTED, TEXT_MUTED],
    },
    "CTkOptionMenu": {
        "fg_color": [BG_INPUT, BG_INPUT],
        "button_color": [ACCENT_DIM, ACCENT_DIM],
        "button_hover_color": [ACCENT, ACCENT],
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
        "corner_radius": CORNER_RADIUS,
    },
    "CTkSlider": {
        "fg_color": [BG_INPUT, BG_INPUT],
        "progress_color": [ACCENT, ACCENT],
        "button_color": [ACCENT, ACCENT],
        "button_hover_color": [ACCENT_HOVER, ACCENT_HOVER],
    },
    "CTkProgressBar": {
        "fg_color": [BG_INPUT, BG_INPUT],
        "progress_color": [ACCENT, ACCENT],
        "corner_radius": 4,
    },
    "CTkSwitch": {
        "progress_color": [ACCENT, ACCENT],
        "button_color": [TEXT_PRIMARY, TEXT_PRIMARY],
    },
}
