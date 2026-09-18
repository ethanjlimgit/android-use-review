# Helper Scripts

This directory contains helper scripts for common development tasks.

## Speech Recognition Mode Scripts

### enable-ondevice-recognition.sh

Enables on-device speech recognition (default mode).

**What it does:**
- Removes `RECORD_AUDIO` permission from AndroidManifest.xml
- Prints instructions for commenting out permission request code

**Usage:**
```bash
./scripts/enable-ondevice-recognition.sh
```

**Benefits:**
- No microphone permission required
- Better privacy (audio never leaves device)
- Works offline

---

### enable-cloud-recognition.sh

Enables cloud-based speech recognition.

**What it does:**
- Adds `RECORD_AUDIO` permission to AndroidManifest.xml
- Prints instructions for uncommenting permission request code

**Usage:**
```bash
./scripts/enable-cloud-recognition.sh
```

**Benefits:**
- Works on all Android versions
- More accurate recognition
- Better language support

---

## Notes

These scripts modify the AndroidManifest.xml but **do not** automatically uncomment/comment the permission request code in Kotlin files. You need to manually uncomment the code as instructed by the script output.

See [SPEECH_RECOGNITION.md](../SPEECH_RECOGNITION.md) for detailed documentation on speech recognition modes.
