# Setting Up GitHub Secrets for App Store Deployment

You need to add 7 secrets to your GitHub repository. Each one gives the
build machine permission to sign and upload your app as you.

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

---

## Secret 1 — NEXT_PUBLIC_API_URL
Your Railway backend URL.

**Value:** `https://your-app.up.railway.app` (copy from Railway dashboard)

---

## Secret 2 & 3 — P12_CERTIFICATE + P12_PASSWORD
Your iOS Distribution certificate, exported as a .p12 file.

**Steps:**
1. On any Mac (or borrow one), open **Keychain Access**
2. Go to **Certificates** → find **iPhone Distribution: Your Name**
   - If it's not there: go to [developer.apple.com](https://developer.apple.com) →
     Certificates → **+** → **Apple Distribution** → follow the CSR steps
3. Right-click the certificate → **Export** → save as `distribution.p12`
4. Set a password when prompted — this becomes **P12_PASSWORD**
5. Convert the file to base64:
   ```
   base64 -i distribution.p12 | pbcopy
   ```
6. Paste the copied text as **P12_CERTIFICATE**

---

## Secret 4 — PROVISIONING_PROFILE
Your App Store distribution provisioning profile.

**Steps:**
1. Go to [developer.apple.com](https://developer.apple.com) → **Profiles** → **+**
2. Select **App Store Connect** under Distribution
3. Select your App ID (`com.valubull.app`)
4. Select your Distribution certificate
5. Name it `ValuBull Distribution` → **Generate** → **Download**
6. Convert to base64:
   ```
   base64 -i ValuBull_Distribution.mobileprovision | pbcopy
   ```
7. Paste the copied text as **PROVISIONING_PROFILE**

---

## Secret 5 — APPLE_TEAM_ID
Your 10-character Apple Developer Team ID.

**Where to find it:**
Go to [developer.apple.com](https://developer.apple.com) → account name (top right) →
**Membership details** → copy **Team ID** (looks like `AB12CD34EF`)

---

## Secrets 6, 7, 8 — ASC_KEY_ID + ASC_ISSUER_ID + ASC_PRIVATE_KEY
An API key that lets the build machine upload to App Store Connect without
your password.

**Steps:**
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) →
   **Users and Access** → **Integrations** → **App Store Connect API**
2. Click **+** → name it `GitHub Actions` → Role: **App Manager** → **Generate**
3. Copy the **Key ID** → save as **ASC_KEY_ID**
4. Copy the **Issuer ID** (shown at the top of the page) → save as **ASC_ISSUER_ID**
5. Click **Download API Key** (you can only download it once — save it safely)
6. Convert to base64 and save as **ASC_PRIVATE_KEY**:
   ```
   base64 -i AuthKey_XXXX.p8 | pbcopy
   ```

---

## Summary Table

| Secret name          | Where it comes from                        |
|----------------------|--------------------------------------------|
| NEXT_PUBLIC_API_URL  | Railway dashboard                          |
| P12_CERTIFICATE      | Keychain export → base64                   |
| P12_PASSWORD         | Password you set during .p12 export        |
| PROVISIONING_PROFILE | developer.apple.com → Profiles → base64   |
| APPLE_TEAM_ID        | developer.apple.com → Membership           |
| ASC_KEY_ID           | App Store Connect → API Keys               |
| ASC_ISSUER_ID        | App Store Connect → API Keys (top of page) |
| ASC_PRIVATE_KEY      | Downloaded .p8 file → base64               |

---

## After Adding All Secrets

Push any commit to the `main` branch (or go to **Actions** → **iOS → App Store** →
**Run workflow**). The build takes about 15–20 minutes. When it finishes, your
build will appear in App Store Connect under **TestFlight** within a few minutes.
From there, go to your app → **1.0 Prepare for Submission** → select the build →
**Submit for Review**.
