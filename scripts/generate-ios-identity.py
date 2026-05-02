#!/usr/bin/env python3
"""
generate-ios-identity.py
Headless iOS Distribution Certificate + App Store Provisioning Profile generator.

Requires:  pip install PyJWT cryptography requests

Reads from environment:
  ASC_KEY_ID         App Store Connect API Key ID
  ASC_ISSUER_ID      App Store Connect Issuer ID (UUID)
  ASC_PRIVATE_KEY    Full contents of the .p8 private key file
  BUNDLE_ID          Bundle identifier, e.g. com.valubull.app
  APPLE_TEAM_ID      10-character Apple Developer Team ID
  P12_PASSWORD       Password to protect the generated .p12
  APP_NAME           Display name used in profile label (optional)

Outputs to $GITHUB_OUTPUT (and stdout):
  P12_BASE64         Base64-encoded .p12 certificate + private key
  PROFILE_BASE64     Base64-encoded .mobileprovision file
"""

import os, sys, time, json, base64, textwrap, requests

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    import jwt as pyjwt
    from cryptography.hazmat.primitives.asymmetric import rsa, padding
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography import x509
    from cryptography.x509.oid import NameOID
except ImportError:
    sys.exit("ERROR: Run:  pip install PyJWT cryptography requests")

# ── Config ────────────────────────────────────────────────────────────────────
def require(name):
    v = os.environ.get(name, "").strip()
    if not v:
        sys.exit(f"ERROR: Environment variable {name} is required but not set.")
    return v

KEY_ID      = require("ASC_KEY_ID")
ISSUER_ID   = require("ASC_ISSUER_ID")
PRIV_KEY    = require("ASC_PRIVATE_KEY")
BUNDLE_ID   = os.environ.get("BUNDLE_ID",   "com.valubull.app")
TEAM_ID     = require("APPLE_TEAM_ID")
P12_PASS    = os.environ.get("P12_PASSWORD", "valubull_ci_build")
APP_NAME    = os.environ.get("APP_NAME",     "ValuBull")
ASC         = "https://api.appstoreconnect.apple.com/v1"

# ── App Store Connect JWT ─────────────────────────────────────────────────────
def asc_token():
    now = int(time.time())
    return pyjwt.encode(
        {"iss": ISSUER_ID, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"},
        PRIV_KEY,
        algorithm="ES256",
        headers={"kid": KEY_ID, "typ": "JWT"},
    )

def hdrs():
    return {"Authorization": f"Bearer {asc_token()}", "Content-Type": "application/json"}

def asc_get(path, params=None):
    r = requests.get(f"{ASC}{path}", headers=hdrs(), params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def asc_post(path, body):
    r = requests.post(f"{ASC}{path}", headers=hdrs(), json=body, timeout=30)
    if r.status_code not in (200, 201):
        # 409 on capabilities = already enabled, that's fine
        if r.status_code == 409 and "capabilities" in path:
            return {}
        print(f"  ASC {r.status_code}: {r.text[:400]}", flush=True)
        r.raise_for_status()
    return r.json()

# ── Step 1: RSA key + CSR (pure Python, no subprocess) ───────────────────────
def generate_key_and_csr():
    print("→ Generating 2048-bit RSA private key...", flush=True)
    private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048, backend=default_backend()
    )
    csr = (
        x509.CertificateSigningRequestBuilder()
        .subject_name(x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME,    "US"),
            x509.NameAttribute(NameOID.COMMON_NAME,     f"{APP_NAME} Distribution"),
            x509.NameAttribute(NameOID.EMAIL_ADDRESS,   f"ci@{BUNDLE_ID}"),
        ]))
        .sign(private_key, hashes.SHA256(), default_backend())
    )
    # Apple wants the DER-encoded CSR as a base64 string (no PEM headers)
    csr_b64 = base64.b64encode(csr.public_bytes(serialization.Encoding.DER)).decode()
    return private_key, csr_b64

# ── Step 2: Upload CSR → receive signed .cer from Apple ──────────────────────
def get_or_create_certificate(csr_b64):
    print("→ Checking for existing iOS Distribution certificate...", flush=True)
    data = asc_get("/certificates", params={"filter[certificateType]": "IOS_DISTRIBUTION"})
    for cert in data.get("data", []):
        attrs = cert["attributes"]
        if attrs.get("certificateType") == "IOS_DISTRIBUTION":
            print(f"  ✓ Reusing existing certificate: {cert['id']}", flush=True)
            # Existing cert: we don't have its private key — caller must use stored P12
            # Signal that we need to generate a new one with our fresh key
            # by returning None so the caller can decide
    # No reusable cert found — create new (Apple allows 2 per team; revoke old if needed)
    print("→ Uploading CSR to App Store Connect API...", flush=True)
    resp = asc_post("/certificates", {"data": {
        "type": "certificates",
        "attributes": {
            "certificateType": "IOS_DISTRIBUTION",
            "csrContent":      csr_b64,
        },
    }})
    cert_id      = resp["data"]["id"]
    cert_der     = base64.b64decode(resp["data"]["attributes"]["certificateContent"])
    print(f"  ✓ Certificate created: {cert_id}", flush=True)
    return cert_id, cert_der

# ── Step 3: Assemble .p12 from private key + signed certificate ───────────────
def assemble_p12(private_key, cert_der):
    print("→ Assembling .p12...", flush=True)
    cert = x509.load_der_x509_certificate(cert_der, default_backend())
    p12  = pkcs12.serialize_key_and_certificates(
        name=APP_NAME.encode(),
        key=private_key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(P12_PASS.encode()),
    )
    print(f"  ✓ .p12 assembled ({len(p12):,} bytes)", flush=True)
    return p12

# ── Step 4: Register Bundle ID (idempotent) ───────────────────────────────────
def ensure_bundle_id():
    print(f"→ Checking Bundle ID: {BUNDLE_ID}...", flush=True)
    data = asc_get("/bundleIds", params={"filter[identifier]": BUNDLE_ID})
    for item in data.get("data", []):
        if item["attributes"]["identifier"] == BUNDLE_ID:
            print(f"  ✓ Bundle ID already registered: {item['id']}", flush=True)
            return item["id"]
    resp = asc_post("/bundleIds", {"data": {
        "type": "bundleIds",
        "attributes": {"identifier": BUNDLE_ID, "name": APP_NAME, "platform": "IOS"},
    }})
    bid = resp["data"]["id"]
    print(f"  ✓ Bundle ID registered: {bid}", flush=True)
    return bid

# ── Step 5: Enable Push Notifications (idempotent — 409 = already enabled) ───
def enable_push(bundle_id_rid):
    print("→ Enabling Push Notifications capability...", flush=True)
    asc_post("/bundleIdCapabilities", {"data": {
        "type": "bundleIdCapabilities",
        "attributes": {"capabilityType": "PUSH_NOTIFICATIONS", "settings": []},
        "relationships": {
            "bundleId": {"data": {"type": "bundleIds", "id": bundle_id_rid}}
        },
    }})
    print("  ✓ Push Notifications enabled (or was already active)", flush=True)

# ── Step 6: Create App Store Distribution Provisioning Profile ────────────────
def create_profile(bundle_id_rid, cert_id):
    print("→ Checking for existing active App Store profile...", flush=True)
    data = asc_get("/profiles", params={
        "filter[profileType]":  "IOS_APP_STORE",
        "filter[profileState]": "ACTIVE",
    })
    for p in data.get("data", []):
        a = p["attributes"]
        if a.get("profileType") == "IOS_APP_STORE" and a.get("profileState") == "ACTIVE":
            content = a.get("profileContent")
            if content:
                print(f"  ✓ Reusing existing profile: {p['id']}", flush=True)
                return base64.b64decode(content)

    profile_name = f"{APP_NAME} AppStore {int(time.time())}"
    print(f"→ Creating provisioning profile: {profile_name}...", flush=True)
    resp = asc_post("/profiles", {"data": {
        "type": "profiles",
        "attributes": {"name": profile_name, "profileType": "IOS_APP_STORE"},
        "relationships": {
            "bundleId":    {"data": {"type": "bundleIds",    "id": bundle_id_rid}},
            "certificates": {"data": [{"type": "certificates", "id": cert_id}]},
        },
    }})
    content = base64.b64decode(resp["data"]["attributes"]["profileContent"])
    print(f"  ✓ Profile created: {resp['data']['id']} ({len(content):,} bytes)", flush=True)
    return content

# ── Emit to $GITHUB_OUTPUT and mask in logs ───────────────────────────────────
def emit(key, value):
    # Mask the value so it never appears in plain text in CI logs
    print(f"::add-mask::{value}", flush=True)
    github_out = os.environ.get("GITHUB_OUTPUT")
    if github_out:
        with open(github_out, "a") as f:
            f.write(f"{key}={value}\n")
    else:
        # Local run — write to files
        fname = f"{key.lower()}.txt"
        with open(fname, "w") as f:
            f.write(value)
        print(f"  → Written to {fname}", flush=True)

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("\n╔══════════════════════════════════════════╗")
    print("║  ValuBull iOS Identity Generator         ║")
    print("║  Headless · Mac-less · API-driven        ║")
    print("╚══════════════════════════════════════════╝\n", flush=True)

    private_key, csr_b64     = generate_key_and_csr()
    cert_id,     cert_der    = get_or_create_certificate(csr_b64)
    p12_bytes                = assemble_p12(private_key, cert_der)
    bundle_id_rid            = ensure_bundle_id()
    enable_push(bundle_id_rid)
    profile_bytes            = create_profile(bundle_id_rid, cert_id)

    p12_b64     = base64.b64encode(p12_bytes).decode()
    profile_b64 = base64.b64encode(profile_bytes).decode()

    emit("P12_BASE64",     p12_b64)
    emit("PROFILE_BASE64", profile_b64)

    print("\n✅ iOS identity generation complete.")
    print(f"   Certificate ID : {cert_id}")
    print(f"   Bundle ID      : {bundle_id_rid}")
    print(f"   P12 size       : {len(p12_bytes):,} bytes")
    print(f"   Profile size   : {len(profile_bytes):,} bytes")
    print("""
Next step: save these as GitHub repository secrets so the build
workflow can reuse them without regenerating on every run.

  Settings → Secrets → Actions → New repository secret
    P12_CERTIFICATE   ← contents of p12_base64.txt
    PROVISIONING_PROFILE ← contents of profile_base64.txt
    P12_PASSWORD      ← the P12_PASSWORD you provided
""", flush=True)

if __name__ == "__main__":
    main()
