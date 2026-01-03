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

