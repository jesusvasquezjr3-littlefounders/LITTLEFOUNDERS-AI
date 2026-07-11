---
name: Tactile Learning Lab
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#464555'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#7e3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-xl:
    fontFamily: Quicksand
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Quicksand
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Quicksand
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Nunito Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
  display-lg-mobile:
    fontFamily: Quicksand
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  sidebar-width: 280px
---

## Brand & Style

This design system is built on the principle of **Tactile Gamification**. It leverages a "Claymorphic" aesthetic to make digital education feel physical, approachable, and toy-like. The goal is to reduce the cognitive friction of learning by presenting complex information through friendly, "squishy" UI elements that respond to user interaction with physical depth.

The target audience ranges from students to adult learners seeking a low-stress, high-engagement environment. The UI should evoke feelings of optimism, playfulness, and safety. Every element is designed to look like it was molded by hand, encouraging exploration through a soft, three-dimensional visual language.

## Colors

The palette is vibrant and high-energy, utilizing a broad spectrum of "Brand Accents" to categorize subjects and reward tiers. 

**Light Mode (Default):**
Uses a crisp `Chrome Base` (#f8fafc) for the background to let the claymorphic shadows breathe. Surfaces are pure white to maximize the visibility of the inner-glow effects.

**Dark Mode:**
Shifts to a deep `Base` (#0f172a) with `Surface` (#1e293b) containers. In dark mode, the "inner glow" of the claymorphism effect should switch from white highlights to subtle, low-opacity variations of the surface color to maintain the 3D effect without harsh glare.

**Functional Colors:**
Primary Indigo and Secondary Warm Blue drive the main actions. Success Green and Warning Amber are reserved for feedback loops (correct/incorrect answers).

## Typography

The typography strategy focuses on "Rounded Legibility." Since the UI is highly illustrative and 3D, the typefaces must be clean but friendly.

- **Headlines:** Quicksand (Bold/Semi-Bold) is used for all major titles. Its rounded terminals mirror the UI's corner radii.
- **Body:** Nunito Sans provides a slightly more structured but still warm reading experience for long-form lesson content.
- **Visual Hierarchy:** Follows a base-16px scale. We use generous line heights (1.5x for body) to ensure the text feels airy and non-intimidating. 
- **Formatting:** Important keywords in lessons should be bolded and colored using one of the Brand Accents to aid memorization.

## Layout & Spacing

The design system utilizes a **Fluid Grid** model with a 12-column structure for desktop and a 4-column structure for mobile. 

- **The Sidebar:** A fixed macOS-style sidebar (280px) sits on the left for the dashboard view. It uses a semi-transparent background with a backdrop blur when overlapping content.
- **Spacing Rhythm:** Based on an 8px scale. Padding inside claymorphic cards should be generous (minimum 24px/32px) to prevent content from feeling "squeezed" by the thick inner-shadows.
- **Breakpoints:** 
  - Mobile: < 768px (Sidebars collapse into a bottom navigation bar).
  - Tablet: 768px - 1024px.
  - Desktop: > 1024px.

## Elevation & Depth

This system ignores standard flat elevation in favor of **Claymorphism**. All primary interactive surfaces must implement a three-layer shadow system:

1.  **The Outer Shadow:** A large, soft, low-opacity shadow that matches the hue of the background (e.g., a faint indigo shadow on the light base). Offset: 16px 16px, Blur: 32px.
2.  **The Inner Highlight:** A white `inset` shadow on the top-left to simulate light hitting the edge of the "clay." Offset: 4px 4px, Blur: 8px.
3.  **The Inner Shadow:** A darker `inset` shadow on the bottom-right to create the concave depth. Offset: -6px -6px, Blur: 12px.

When a button is pressed, the outer shadow should shrink, and the inner shadows should deepen to simulate the physical compression of the element.

## Shapes

The shape language is "Hyper-Rounded." Sharp corners are strictly prohibited as they break the claymorphic metaphor.

- **Base Radius:** 16px (`rounded-md`).
- **Large Radius:** 32px (`rounded-xl`) used for lesson cards and pricing tiers.
- **Interactive Elements:** Use the "Pill" shape for buttons and progress bars to emphasize the toy-like nature of the UI.

## Components

**Buttons**
Buttons are "chunky." They use the primary color with a visible 4px bottom border (darker shade) to create a 3D "pressable" look. On hover, the button should lift (shadow increases); on click, it should translate 2px down.

**Lesson Cards**
Inspired by Brilliant, these are minimalist white containers. They feature a single Lucide icon in a colored circle at the top-left. Content is centered with a clear `Primary` action button at the bottom.

**Sidebar**
The macOS-style sidebar uses `Lucide` icons with a 2px stroke weight. Active states are indicated by a claymorphic "pill" background behind the icon and text.

**Pricing Cards**
Multi-tier cards use the Brand Accents (e.g., Purple for 'Pro', Gold for 'Legendary'). The 'Popular' tier should be scaled 1.05x larger than the others with a more pronounced outer shadow.

**Stats Widgets**
Small, square cards showing "Streaks" (Orange), "XP" (Indigo), and "Rank" (Yellow). Each widget features a prominent Lucide icon and a large `display-lg` number.

**Input Fields**
Inputs should appear "sunken" into the surface using a reverse claymorphism effect (heavy inner shadow, no outer shadow).