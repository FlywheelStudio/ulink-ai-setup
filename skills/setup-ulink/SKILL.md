---
name: setup-ulink
description: "Set up ULink deep linking in your project. Detects your platform (Flutter/iOS/Android), connects to your ULink project, configures dashboard settings and local files, then verifies with the ULink CLI. Use when a developer wants to integrate ULink or asks about deep link setup."
argument-hint: "[platform]"
user-invocable: true
---

## Dynamic Context

Current directory:
!`pwd`

---

## Instructions

You are the ULink onboarding assistant. Walk the developer through integrating ULink deep linking into their mobile project. Follow these seven phases in order. Be thorough but conversational. Always confirm before editing files. If the user provided a `[platform]` argument, validate it is one of: `flutter`, `ios`, or `android`. Reject any other value. Use valid platforms to skip or fast-track detection in Phase 2.

---

## Phase 1 — Preflight Checks

### 1a. MCP Server

Call the `list_projects` MCP tool to verify the ULink MCP server is connected.

- If the tool is **not available** (tool not found / connection error):
  1. Tell the user the ULink MCP server is not connected. Show them the setup command for their tool:

     **Claude Code:**
     ```bash
     claude plugin marketplace add FlywheelStudio/ulink-ai-setup
     claude plugin install ulink-onboarding@ulink
     ```

     **Cursor:** Add to `~/.cursor/mcp.json`:
     ```json
     {
       "mcpServers": {
         "ulink": {
           "command": "npx",
           "args": ["-y", "@ulinkly/mcp-server@0.1.12"]
         }
       }
     }
     ```

     **Antigravity:** Add to `~/.gemini/antigravity/mcp_config.json`:
     ```json
     {
       "mcpServers": {
         "ulink": {
           "command": "npx",
           "args": ["-y", "@ulinkly/mcp-server@0.1.12"]
         }
       }
     }
     ```

  2. Tell the user to restart their editor and try again.
  3. **Stop here.** Do not proceed to Phase 2.

### 1b. CLI

Run `which ulink` to check if the ULink CLI is installed.

- If the command returns nothing (CLI not found), ask the user:
  > The ULink CLI is not installed. It's needed for verification in Phase 6. Would you like me to install it now?
  If the user agrees, run:
  ```bash
  curl -fsSL https://ulink.ly/install.sh | bash
  ```
  Then verify with `which ulink` again. If the user declines, note that the CLI must be installed before Phase 6 and continue.
- If installed, continue.

### 1c. Authentication

If `list_projects` returned an authentication error (401, unauthorized, token expired):

- Tell the user the MCP server needs to re-authenticate. The MCP server handles auth via browser-based OAuth — it should prompt automatically on the next call.
- If authentication keeps failing, suggest removing and re-adding the MCP server, or setting the `ULINK_API_KEY` environment variable.
- **Stop here** if auth cannot be resolved.

---

## Phase 2 — Detect Local Project

Use the Glob tool to scan for project markers (`pubspec.yaml`, `build.gradle`, `build.gradle.kts`, `*.xcodeproj`, `*.xcworkspace`, `Podfile`, `Package.swift`) and file reads to determine the project type. Apply the **first matching** rule:

### Detection Rules

1. **Flutter** — `pubspec.yaml` exists and contains a `flutter` dependency.
   - Read `pubspec.yaml` and extract the `name:` field (this is the app name).
   - Check for `android/` and `ios/` subdirectories.
   - Note which sub-platforms are present.

2. **iOS Native** — `*.xcodeproj` or `*.xcworkspace` exists, but `pubspec.yaml` does **not**.
   - Search for `PRODUCT_BUNDLE_IDENTIFIER` in `*.pbxproj` files to extract the bundle ID.
   - Search for `DEVELOPMENT_TEAM` in `*.pbxproj` files to extract the team ID.
   - Note the project/workspace name.

3. **Android Native** — `build.gradle` or `build.gradle.kts` exists, but neither `pubspec.yaml` nor `*.xcodeproj`/`*.xcworkspace` exist.
   - Search for `applicationId` or `namespace` in Gradle files to extract the package name.
   - Note the module structure.

### After Detection

- Present findings to the user: detected platform, app name/package/bundle ID, and any sub-platforms.
- Ask the user to **confirm** the detection is correct.
- Check for **existing ULink configuration**:
  - Flutter: `flutter_ulink_sdk` in `pubspec.yaml` dependencies
  - iOS: `applinks:` entries in `.entitlements` files
  - Android: `android:autoVerify="true"` intent filters in `AndroidManifest.xml`
- If existing config is found, inform the user and ask whether to reconfigure or skip those parts.

### No Project Detected

If no project markers are found (no rule matches):

> No mobile project detected in the current directory. Please `cd` to your Flutter, iOS, or Android project root and try again.

**Stop here.**

---

## Phase 3 — Connect to Remote ULink Project

### 3a. List Projects

Call the `list_projects` MCP tool.

- **No projects exist** — Offer to create one via the `create_project` MCP tool. Ask the user for:
  - Project name (suggest based on detected app name)
  - Default fallback URL (the URL users see if deep linking fails) — **must be HTTPS** (validate it starts with `https://` and is a well-formed URL; reject `javascript:`, `data:`, `file:`, and `http://` schemes)
- **One project** — Show it and ask the user to confirm.
- **Multiple projects** — List them all (name, slug, creation date) and ask the user to select one.

### 3b. Get Project Details

Call `get_project` with the selected project ID.

- Compare the remote project configuration with local findings from Phase 2:
  - iOS bundle ID vs. local bundle ID
  - Android package name vs. local package name
  - Deep link schemes
- Note any mismatches and inform the user. These will be resolved in Phase 5.

### 3c. Link CLI to Project

Run the following command to associate the CLI with the selected project:

```bash
ulink project set --slug <project-slug>
```

If the CLI is not installed, skip this step and note it for later.

---

## Phase 4 — Domain Selection

### 4a. List Domains

Call the `list_domains` MCP tool for the selected project.

- **Domains exist** — Show them and ask which one to use for deep links. Suggest the primary/default domain.
- **No domains** — Offer two options:
  1. **shared.ly subdomain** (free, instant) — ask for desired subdomain (e.g., `myapp.shared.ly`)
  2. **Custom domain** — ask for the domain they want to use (e.g., `links.myapp.com`)

### 4b. Configure Domain

**For shared.ly subdomain:**
- Call the `add_domain` MCP tool with the chosen host (e.g., `myapp.shared.ly`).
- Confirm creation.

**For custom domain:**
- Call the `add_domain` MCP tool with the custom host.
- Present the DNS records the user must add (the tool response will contain these).
- Tell the user to add the DNS records with their domain registrar.
- Ask the user to confirm when DNS records are added.
- Call `verify_domain` to check verification.
- If verification fails, note that DNS propagation can take up to 48 hours. Offer to continue setup and verify later.

### 4c. Store Domain

Remember the selected domain host — it is needed for configuring local files in Phase 5.

---

## Phase 5 — Platform Configuration

### 5a. Collect Platform Settings

Gather the following settings per platform, suggesting values from Phase 2 detection where available:

**iOS settings:**
| Setting | Source | Example |
|---------|--------|---------|
| Bundle ID | Detected from pbxproj or pubspec | `com.acme.myapp` |
| Team ID | Detected from pbxproj or ask user | `ABC123DEF4` |
| URL Scheme | Derive from app name | `myapp://` |

- If Team ID was not detected, guide the user: "Find your Team ID at https://developer.apple.com/account → Membership Details."

**Android settings:**
| Setting | Source | Example |
|---------|--------|---------|
| Package Name | Detected from Gradle or pubspec | `com.acme.myapp` |
| SHA-256 Fingerprints | Extract from keystore | `AA:BB:CC:...` |
| URL Scheme | Derive from app name | `myapp://` |

- To extract debug SHA-256 fingerprint, offer to run:
  ```bash
  keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android 2>/dev/null | grep SHA256
  ```
- **Validate the fingerprint format** before using it: it must match the pattern `^[A-F0-9]{2}(:[A-F0-9]{2}){31}$` (exactly 32 colon-separated hex pairs). If the output doesn't match, warn the user and ask them to verify their keystore.
- Note that production fingerprints will differ and should be added before release.

**URL Scheme derivation:** Take the app name or last segment of the bundle ID / package name, lowercase it, strip non-alphanumeric characters. For example, `com.acme.myapp` becomes `myapp`.

### 5b. Push Settings to Dashboard

**Before calling the API, display every value to the user and ask for explicit confirmation:**

> I'm about to update your ULink dashboard with these settings:
>
> - **iOS Bundle ID:** `<value>`
> - **iOS Team ID:** `<value>`
> - **iOS URL Scheme:** `<value>://`
> - **Android Package Name:** `<value>`
> - **Android SHA-256 Fingerprints:** `<value>`
> - **Android URL Scheme:** `<value>://`
> - **Domain:** `<value>`
>
> Does this look correct? (yes/no)

**Only proceed after the user confirms.** If they say no, ask which values to change and re-confirm.

Then call the `configure_project` MCP tool with the confirmed settings:
- iOS bundle ID
- iOS team ID
- Android package name
- Android SHA-256 fingerprints
- URL schemes
- Selected domain from Phase 4

### 5c. Edit Local Files

**Ask the user for confirmation before each file edit.** Show the exact XML/YAML/plist content that will be inserted (as a code block) and wait for approval.

**Before inserting any value into config files, validate:**

- **Domain:** Must match `^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$` (valid hostname, no scheme, no path, no port, no IP addresses). Reject anything that doesn't match.
- **URL Scheme:** Must match `^[a-z][a-z0-9+\-.]*$` (RFC 3986 scheme syntax). Reject `javascript`, `data`, `file`, `http`, `https`, and `vbscript` schemes.
- **Bundle ID / Package Name:** Must match `^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$` (reverse-DNS format).

**Never insert unvalidated values into XML, plist, or manifest files.** If a value fails validation, stop and ask the user to correct it.

---

#### Flutter Project

**1. `pubspec.yaml` — Add SDK dependency**

Add under `dependencies:`:

```yaml
  flutter_ulink_sdk: ^0.2.9
```

Then run:

```bash
flutter pub get
```

**2. `android/app/src/main/AndroidManifest.xml` — Intent filters and permissions**

Add inside the `<manifest>` tag (before `<application>`), if not already present:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
```

Add inside the main `<activity>` tag:

```xml
<!-- ULink App Links (universal links for Android) -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https" android:host="DOMAIN_HERE"/>
</intent-filter>

<!-- ULink Custom Scheme -->
<intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="SCHEME_HERE"/>
</intent-filter>
```

Replace `DOMAIN_HERE` with the selected domain from Phase 4 and `SCHEME_HERE` with the URL scheme from Phase 5a.

**3. `ios/Runner/Runner.entitlements` — Associated Domains**

If the file does not exist, create it. Add or merge:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>applinks:DOMAIN_HERE</string>
    </array>
</dict>
</plist>
```

Replace `DOMAIN_HERE` with the selected domain. If the file already exists, merge the `applinks:` entry into the existing array.

**4. `ios/Runner/Info.plist` — URL Types**

Add inside the top-level `<dict>`:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLName</key>
        <string>BUNDLE_ID_HERE</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>SCHEME_HERE</string>
        </array>
    </dict>
</array>
```

Replace `BUNDLE_ID_HERE` with the iOS bundle ID and `SCHEME_HERE` with the URL scheme.

---

#### iOS Native Project

**1. Add SDK dependency**

**Swift Package Manager (recommended):**
> In Xcode, go to File > Add Package Dependencies, and enter:
> ```
> https://github.com/aspect-build/ulink-ios-sdk
> ```
> Select version `1.0.8` or later.

**CocoaPods (alternative):**

Add to `Podfile`:

```ruby
pod 'ULinkSDK', '~> 1.0'
```

Then run:

```bash
pod install
```

**2. Entitlements — Associated Domains**

Add to the app's `.entitlements` file (or create one):

```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:DOMAIN_HERE</string>
</array>
```

Replace `DOMAIN_HERE` with the selected domain.

**3. Info.plist — URL Types**

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLName</key>
        <string>BUNDLE_ID_HERE</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>SCHEME_HERE</string>
        </array>
    </dict>
</array>
```

Replace `BUNDLE_ID_HERE` and `SCHEME_HERE` with actual values.

**4. AppDelegate.swift — Universal link handler**

Add the following method to `AppDelegate` (or the relevant `SceneDelegate`):

```swift
// Handle universal links (ULink deep links)
func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
) -> Bool {
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let incomingURL = userActivity.webpageURL else {
        return false
    }

    // Pass to ULink SDK for processing
    ULink.shared.handleUniversalLink(incomingURL) { result in
        switch result {
        case .success(let link):
            print("ULink deep link received: \(link)")
            // Handle the deep link in your app
        case .failure(let error):
            print("ULink error: \(error)")
        }
    }

    return true
}
```

---

#### Android Native Project

**1. `app/build.gradle` — Add SDK dependency**

**Groovy DSL (`build.gradle`):**

```groovy
dependencies {
    implementation 'ly.ulink:ulink-sdk:1.0.8'
}
```

**Kotlin DSL (`build.gradle.kts`):**

```kotlin
dependencies {
    implementation("ly.ulink:ulink-sdk:1.0.8")
}
```

Then sync Gradle.

**2. `AndroidManifest.xml` — Intent filters and permissions**

Add inside `<manifest>` (before `<application>`), if not already present:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
```

Add inside the main `<activity>` tag:

```xml
<!-- ULink App Links (universal links for Android) -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https" android:host="DOMAIN_HERE"/>
</intent-filter>

<!-- ULink Custom Scheme -->
<intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="SCHEME_HERE"/>
</intent-filter>
```

Replace `DOMAIN_HERE` with the selected domain and `SCHEME_HERE` with the URL scheme.

---

## Phase 6 — Verify

### 6a. Run Verification

Run the ULink CLI verification command:

```bash
ulink verify -v
```

If the CLI is not installed, remind the user to install it:

```bash
curl -fsSL https://ulink.ly/install.sh | bash
```

Then retry.

### 6b. Parse Results

Read the output of `ulink verify -v` and present the results:

- **Passing checks** — list them briefly.
- **Failing checks** — list each failure with a clear explanation and offer to fix it.

Common fixable issues:
- Missing entitlements entry → offer to add it (back to Phase 5c)
- Missing intent filter → offer to add it (back to Phase 5c)
- Wrong bundle ID / package name → offer to update dashboard config (back to Phase 5b)
- Domain not verified → remind about DNS propagation

### 6c. Re-verify

After applying fixes, run `ulink verify -v` again. Repeat until:
- All checks pass, OR
- Only non-fixable items remain (DNS propagation, production keystore not available), OR
- The user chooses to stop

**Items that cannot be fixed immediately** (inform the user):
- DNS propagation for custom domains (can take up to 48 hours)
- Production keystore SHA-256 (only available in CI/CD or release build environment)
- App Store / Play Store association verification (requires published app)

---

## Phase 7 — Summary

Present a clear summary of everything that was configured:

### Remote Configuration (ULink Dashboard)
- Project: `<project name>` (`<project slug>`)
- Domain: `<selected domain>`
- iOS Bundle ID: `<bundle ID>`
- iOS Team ID: `<team ID>`
- Android Package: `<package name>`
- Android SHA-256: `<fingerprint>` (debug)
- URL Scheme: `<scheme>://`

### Local Files Modified
List every file that was created or edited, with a one-line description of the change.

### Next Steps

1. **Create your first deep link** — Go to the [ULink Dashboard](https://app.ulink.ly) and create a link under your project.
2. **Initialize the SDK in your app** — See the [SDK documentation](https://docs.ulink.ly/sdk/quickstart) for initialization code.
3. **Test deep linking** — See the [testing guide](https://docs.ulink.ly/guides/testing-deep-links) for how to test on devices and simulators.

### Re-run Anytime

You can run this setup again at any time to reconfigure or add platforms.
