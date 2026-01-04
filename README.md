# Digital Business Card

A modern React-based digital business card featuring a 3D floating BizBox model in the hero section, built with Three.js.

## Features

- 🎨 Modern, clean UI design
- 🎭 3D floating business card box model
- 🖱️ Interactive 3D model (drag to rotate)
- 📱 Responsive design
- ⚡ Built with Vite for fast development
- 🎯 Smooth animations with Framer Motion

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

## Project Structure

```
digitalcard/
├── public/
│   └── bizbox.glb          # 3D model file
├── src/
│   ├── components/
│   │   ├── Hero.jsx        # Hero section component
│   │   ├── Hero.css        # Hero styles
│   │   ├── BizBoxModel.jsx # Three.js 3D model component
│   │   └── BizBoxModel.css # 3D model styles
│   ├── App.jsx             # Main app component
│   ├── App.css             # App styles
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Customization

### Update Your Name

Edit `src/components/Hero.jsx` and change:
```jsx
<h1 className="hero-name">
  <span>YOUR</span>
  <span className="name-accent"> NAME</span>
</h1>
```

### Change Colors

Update the color scheme in `tailwind.config.js` or modify the CSS variables in the component CSS files.

### Modify 3D Model

Replace `public/bizbox.glb` with your own GLB model. The component will automatically load and display it.

### BizCard Configuration

The BizCard model (`bizcard_with_nfc_chip.glb`) position and rotation values in `src/components/BizBoxModel.jsx`:

```javascript
// Scale
cardModel.scale.set(1, 1, 1);

// Position
cardModel.position.x = -0.02;
cardModel.position.y = 0.9;
cardModel.position.z = 0;

// Rotation
cardModel.rotation.x = 0;
cardModel.rotation.y = 0;
cardModel.rotation.z = 1.55;
```

**Position values:**
- `position.x` - left/right
- `position.y` - up/down
- `position.z` - forward/backward

**Rotation values (in radians):**
- `rotation.x` - tilt forward/backward
- `rotation.y` - turn left/right
- `rotation.z` - roll left/right
- Common values: `Math.PI / 2` = 90°, `Math.PI` = 180°, `1.55` ≈ 89°

## Debug Spheres

The project includes hidden debug spheres that help visualize bone/object positions during development. These are disabled by default but can be enabled for debugging.

### Available Debug Spheres

| Sphere | Color | Follows | Location in Code |
|--------|-------|---------|------------------|
| Red | `#ff0000` | Bone003 (OuterBox) | Line ~610 |
| Blue | `#0066ff` | Bone002 (OuterBox) | Line ~647 |
| Green | `#00ff00` | BizCard model | Line ~982 |

### Enabling Debug Spheres

In `src/components/BizBoxModel.jsx`, find the debug sphere you want to enable and change `visible = false` to `visible = true`:

```javascript
// === DEBUG SPHERE - RED (follows Bone003) ===
// To enable for debugging: set debugSphere.visible = true
debugSphere.visible = true; // Change from false to true
```

### Text Labels with Pointer Lines

Each debug sphere has an associated text label with a bent pointer line:
- **Red sphere**: "OUTER_BOX / BONE_003" (frames 0-30)
- **Blue sphere**: "OUTER_BOX / BONE_002" (frames 70-100)
- **Green sphere**: "BIZCARD / NFC_CHIP" (frames 110-150)
- **Green sphere alt**: "SCAN THIS / QR CODE" (frames 150-200)
- **NFC Chip**: "THIS NFC / CHIP" (frames 200-250)

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Technologies Used

- React 18
- Three.js
- Vite
- Framer Motion
- Tailwind CSS

## License

MIT

