# 🐔 PoultryDex Mobile

> Modern, Multi-Tenant Mobile Application for Poultry & Layer Farm Operations (React Native & Expo)

---

## 📱 Features

- **Multi-Tenant Farm Management**: Easily switch between multiple farms and manage flocks, daily logs, and financials.
- **Flock & Batch Tracking**: Monitor initial vs. current bird count, mortality rates, and breed data.
- **Daily Operations Logging**: Record egg production, broken eggs, feed consumption (kg), water intake (liters), and medications.
- **Sales & Invoicing**: Track bird and egg sales, customer dues, and payment records.
- **Expenses & Feed Inventory**: Log farm expenses with category tags and monitor feed stock bag inventory.
- **Offline & Low-Bandwidth Friendly**: Resilient caching with intuitive dark/light rustic styling.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18.x
- **npm** >= 9.x
- **Expo CLI** (`npm install -g expo-cli` or `npx expo`)
- **Expo Go** mobile app (iOS / Android) for testing

### Installation

```bash
# Clone the repository
git clone https://github.com/Utsho11/poultry-ops.git
cd poultry-ops

# Install dependencies
npm install
```

### Running Locally

```bash
# Start the Expo development server
npm start

# Or with network tunnel (if testing on physical device on different Wi-Fi)
npm run start:tunnel

# Run directly on Android / iOS emulator
npm run android
npm run ios
```

---

## 🔐 Environment Configuration

Create a `.env` file in the project root:

```env
# Point to your deployed backend API or local server
EXPO_PUBLIC_API_URL=https://poultrydex.vercel.app/api

# For local development with backend running on port 4000:
# EXPO_PUBLIC_API_URL=http://localhost:4000/api
```

---

## 📦 Building for Production (EAS Build)

```bash
# Build Android APK for preview / testing
npx eas-cli build --platform android --profile preview

# Build for Google Play Store (AAB)
npx eas-cli build --platform android --profile production

# Build for Apple App Store (IPA)
npx eas-cli build --platform ios --profile production
```

---

## 🧪 Verification & Type Checking

```bash
# Run TypeScript compilation check
npx tsc --noEmit
```
