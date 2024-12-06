Download the TeacherScannerApp.apk Directly 
if corrupted rebuild using

Install cordova dependencies first
# Install Node.js (if not installed)
npm install -g node

# Install Cordova globally
npm install -g cordova

# Create a new Cordova project (replace with your app name)
cordova create myApp com.example.myapp MyApp
cd myApp

# Add platforms (Android, iOS)
cordova platform add android
cordova platform add ios

# Install QR Scanner plugin
cordova plugin add cordova-plugin-qrscanner

# Install QR Code generator (optional)
cordova plugin add cordova-plugin-qrcode-generator

# Install Git LFS (if needed for large files)
git lfs install
git lfs track "*.apk"

# Then Build the APK using or if ganahn ka IOS
-> cordova build android <-
-> cordova build ios <-
gabzcahGwapo

