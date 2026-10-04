# Aetheris Presentation & Live Demo Rules

When asked to start or demonstrate the application for presentation:

1. **Run the 1-Click Launch Script**:
   Run `npm run presentation` or `powershell -ExecutionPolicy Bypass -File ./start_presentation.ps1` from workspace root `c:\Users\Parth\OneDrive\Desktop\Aetheris`.

2. **Active Ports & URLs**:
   - Web Command Operations Center: `http://localhost:3000`
   - Mobile Web Simulation App: `http://localhost:3000/mobile`
   - Expo Go Metro Native App: `exp://192.168.0.105:8081`
   - FastAPI Mesh Routing Engine: `http://localhost:8000/docs`

3. **Key Components**:
   - `backend/app/main.py`: FastAPI Layer 3 Hyperbolic + ACO routing engine
   - `dashboard/src/app/page.tsx`: Web Command Operations Center (Next.js)
   - `dashboard/src/app/mobile/page.tsx`: Mobile Victim / Helper web UI
   - `App.tsx`: Expo / React Native mobile app with 18-byte binary frame packing, FNV-1a hashing, +4dBm BLE advertising simulation.
