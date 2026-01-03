import { useState, useEffect } from 'react';
import BizBoxModel from './BizBoxModel';
import './Hero.css';

const Hero = () => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollTop = window.scrollY;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="scroll-container">
      {/* Fixed 3D Scene */}
      <BizBoxModel />

      {/* Scroll spacer - provides scroll height for animation */}
      <div className="scroll-spacer" />

      {/* Scroll indicator - fades out as you scroll */}
      <div
        className="scroll-indicator"
        style={{ opacity: Math.max(0, 1 - scrollProgress * 5) }}
      >
        <div className="scroll-mouse">
          <div className="scroll-wheel" />
        </div>
        <span className="scroll-text">Scroll to explore</span>
      </div>

      {/* Progress bar */}
      <div className="progress-container">
        <div
          className="progress-bar"
          style={{ height: `${scrollProgress * 100}%` }}
        />
      </div>
    </div>
  );
};

export default Hero;
