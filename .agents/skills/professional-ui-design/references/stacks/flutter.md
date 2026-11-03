# Flutter

Applies the ten rules to Flutter. The core rule never changes: widget files contain no raw colors, text styles or dimension constants. Everything comes from the theme. If a widget needs a style that does not exist, add it to the theme first, then reference it.

Contents: 1 Where tokens live · 2 Theme setup · 3 Using tokens in widgets · 4 Layout and adaptivity · 5 Components and states · 6 Accessibility · 7 Avoid

## 1. Where tokens live

| Kind | Owner | Read with |
|---|---|---|
| Color roles | `ColorScheme` inside `ThemeData` (`primary`, `onPrimary`, `surface`, `onSurface`, `outline`, `error`, ...) | `Theme.of(context).colorScheme` |
| Text styles | `TextTheme` inside `ThemeData` | `Theme.of(context).textTheme` |
| Status colors, spacing, radius, motion and other custom tokens | A `ThemeExtension` (for example `AppTokens`) | `Theme.of(context).extension<AppTokens>()` |
| Constants that never change by theme | Constant classes (`AppSpacing`, `AppRadius`) in the theme folder | direct reference |

Keep these in `lib/theme/` (for example `app_theme.dart`, `app_tokens.dart`). Follow the project's existing folder and naming if it already has them.

## 2. Theme setup

```dart
// lib/theme/app_spacing.dart
abstract final class AppSpacing {
  static const double xs = 4, sm = 8, md = 12, lg = 16, xl = 24, xxl = 32;
}
abstract final class AppRadius {
  static const double sm = 4, md = 6, lg = 10;
}
```

```dart
// lib/theme/app_theme.dart
ThemeData buildTheme(Brightness brightness) {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppBrand.primary,         // brand color defined once, in the theme folder
    brightness: brightness,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    textTheme: AppTypography.textTheme(scheme),      // one family, short scale
    visualDensity: VisualDensity.standard,
    cardTheme: CardThemeData(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        side: BorderSide(color: scheme.outlineVariant),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
    ),
    extensions: const [AppTokens.light],             // switch per brightness
  );
}
```

- `AppBrand`, `AppTypography` and `AppTokens` stand for the project's own theme classes; create them in `lib/theme/` if they do not exist.
- `ColorScheme.fromSeed` generates a tonal palette; when the brand needs exact colors, set the key roles explicitly (`copyWith(primary: ..., onPrimary: ...)`) and check contrast. Keep the generated scheme restrained.
- Provide `theme:` and `darkTheme:` to `MaterialApp` and let `themeMode` follow the system by default.
- Class names and constructors (`CardThemeData` vs `CardTheme`) differ between Flutter versions; match what the project's SDK uses.

## 3. Using tokens in widgets

```dart
final theme = Theme.of(context);

Container(
  padding: const EdgeInsets.all(AppSpacing.lg),
  decoration: BoxDecoration(
    color: theme.colorScheme.surface,
    borderRadius: BorderRadius.circular(AppRadius.md),
    border: Border.all(color: theme.colorScheme.outlineVariant),
  ),
  child: Text('Team members', style: theme.textTheme.titleMedium),
);
```

- No `Color(0xFF...)`, no `Colors.blue`, no `TextStyle(fontSize: 14)`, no numeric padding literals in widget files. `Colors.transparent` is acceptable.
- Text on a colored surface uses the matching `on` color (`onPrimary` on `primary`).
- Prefer `const` constructors where the values are constants.
- If a token is missing, add it to the theme or extension first and reference it.

## 4. Layout and adaptivity

- Build with `Row`, `Column`, `Expanded`, `Flexible`, `Wrap`, `Padding`, `SizedBox`, `Align`; use `LayoutBuilder` or `MediaQuery.sizeOf(context)` with named breakpoints (for example compact below 600, medium to 840, expanded above) rather than fixed pixel layouts.
- Phones: `NavigationBar` at the bottom. Tablets and desktop: `NavigationRail` or a side drawer. Content in a `ConstrainedBox` with a max width so lines and forms do not stretch across wide windows.
- Wrap scrollable screens in `SafeArea`; use `SingleChildScrollView` or `ListView` so small screens and large text sizes never overflow (watch for the yellow-black overflow stripes).
- Spacing from `AppSpacing`, aligned left edges, groups tighter than gaps between groups.

## 5. Components and states

- Use Material 3 components: `FilledButton` (one primary per area), `OutlinedButton`, `TextButton`, `IconButton` (with `tooltip:`), `TextField`/`TextFormField` with `labelText` and `helperText`/`errorText`, `SegmentedButton`, `Switch`, `DropdownMenu`, `SearchBar`, `Card`, `ListTile`, `AlertDialog`, `BottomSheet`, `SnackBar`.
- Forms: `Form` with `TextFormField` validators; labels always visible; correct `keyboardType`, `textInputAction` and `autofillHints`; submit button shows progress while saving.
- Lists: `ListView.builder` for long lists with stable `key`s.
- States for every data screen: loading (skeleton or `CircularProgressIndicator` for small areas), empty (message plus one action), error (message plus retry), success (`SnackBar`, past tense). Use the copy rules in `references/microcopy.md`.
- Destructive actions confirm with an `AlertDialog` that names the action ("Delete invoice"), and use the error color only on that button.

## 6. Accessibility

- Touch targets at least 48 by 48 dp (`kMinInteractiveDimension`). Do not shrink `IconButton` padding below it.
- Give icon-only widgets a `tooltip` or `Semantics(label: ...)`; images get `semanticLabel`; decorative ones `excludeFromSemantics: true`.
- Respect text scaling: do not clamp `textScaler` globally, and test with a large font size. Ensure 4.5:1 contrast for text in both themes. Honor reduce-motion (`MediaQuery.disableAnimationsOf(context)`).
- Focus and keyboard on desktop and web: use `FocusTraversalGroup`, visible focus highlights, and `Shortcuts`/`Actions` for key commands.

## 7. Avoid

- Hardcoded colors, font sizes or paddings in widget files; a second theme file with overlapping values.
- Gradient backgrounds, glow `BoxShadow`s, heavy elevations, and emoji as icons. Use `Icons`/`Symbols` from one family.
- Rebuilding Material components with `GestureDetector` on a `Container`; use `InkWell` inside `Material` or the button widgets, so there is ripple, focus and semantics.
- `Opacity` and animations on large subtrees for decoration; looped animations.
