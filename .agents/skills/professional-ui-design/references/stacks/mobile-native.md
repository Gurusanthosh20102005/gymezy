# SwiftUI, Jetpack Compose, React Native, and any stack not listed

Every UI stack has a place where theme decisions belong. The skill's job on an unfamiliar stack is to find that place, put the decisions there once, and have every screen read from it.

Contents: 1 Recipe for any stack · 2 SwiftUI · 3 Jetpack Compose · 4 React Native · 5 Platform conventions

## 1. Recipe for any stack

1. **Find the theme mechanism.** Search the project and the framework's docs for "theme", "design tokens", "styles", "colors": a theme object, an asset catalog, a resource file, a CSS-variables file, a styling provider.
2. **Find the component library the project already uses** and use its components for buttons, inputs, lists, dialogs and navigation. Add no second library.
3. **Create or reuse the token source** with the same roles as `references/design-tokens.md`: color roles, type scale, spacing, radius, elevation, control sizes, motion. Values start from `assets/tokens.css`.
4. **Express screens only in tokens.** If a view needs a value that is missing, add it to the token source first.
5. **Apply the ten rules** in SKILL.md, the state catalogue in `references/components-and-states.md`, the copy rules in `references/microcopy.md`, and the accessibility baseline in `references/accessibility-responsive.md`, using the platform's own accessibility APIs.
6. **Run the audit** if any web-style source (CSS, HTML) exists, and review the rest against the checklist by hand.

## 2. SwiftUI

- Colors: named colors in the asset catalog with light and dark variants, exposed through one `Color` extension (`Color.surface`, `Color.textMuted`, `Color.brand`) or system semantic colors (`.primary`, `.secondary`, `Color(.systemBackground)`). No inline `Color(red:green:blue:)` in views.
- Type: system text styles (`.font(.body)`, `.title3`) so Dynamic Type works; custom fonts through one `Font` extension scaled with `relativeTo:`; use `@ScaledMetric` for sizes that must grow with text.
- Spacing and radius from an `enum Spacing` / `enum Radius` of constants. Icons from SF Symbols in one weight.
- Layout with `VStack`, `HStack`, `Grid`, `LazyVStack`, `ViewThatFits`, and `NavigationStack`/`TabView`; respect safe areas.
- Accessibility: `accessibilityLabel`, `accessibilityHint`, `accessibilityElement(children:)`, 44pt minimum hit area, support Dark Mode, Reduce Motion (`@Environment(\.accessibilityReduceMotion)`) and Increase Contrast.

## 3. Jetpack Compose

- One `MaterialTheme(colorScheme, typography, shapes)` at the root, built in a `Theme.kt`; read values with `MaterialTheme.colorScheme.primary`, `MaterialTheme.typography.bodyMedium`, `MaterialTheme.shapes.medium`. No `Color(0xFF...)` in screens.
- Custom tokens (spacing, status colors) via a `CompositionLocal` (`LocalSpacing`, `LocalExtendedColors`) provided next to the theme.
- Use `dp` for layout and `sp` for text; do not fix text heights. Layout with `Column`, `Row`, `Box`, `LazyColumn`, `Scaffold`, `NavigationBar`/`NavigationRail`, and `WindowSizeClass` for adaptivity.
- Accessibility: `contentDescription` on icons and images, `Modifier.semantics`, minimum 48dp touch targets, Dark theme with `isSystemInDarkTheme()`.

## 4. React Native

- One theme object (colors by role, spacing, radius, typography) provided through context, read with a `useTheme()` hook; styles are created from it (`StyleSheet.create` inside a `useMemo` or a `makeStyles(theme)` helper). No color or size literals in screens.
- Follow `useColorScheme()` for dark mode. Use a safe-area library (`react-native-safe-area-context`) and `useWindowDimensions` for responsive layout.
- Use `Pressable` (with `accessibilityRole`, `accessibilityLabel`, `accessibilityState`, and `hitSlop` to reach 44pt), not touchable `View`s. Leave `allowFontScaling` on and test large text.
- One icon set. Lists with `FlatList` and stable `keyExtractor`. Build loading, empty and error states for each list.

## 5. Platform conventions

- Follow the platform before the web habits you know: navigation patterns (tab bar and stack on iOS, bottom navigation and top app bar on Android), back behavior, system dialogs and sheets, haptics used sparingly.
- Hit targets 44pt (iOS) and 48dp (Android). Safe areas for notches and home indicators. Text scales with system settings.
- Native feel beats custom decoration: standard controls, system fonts unless the brand specifies one, motion from the platform's defaults.
