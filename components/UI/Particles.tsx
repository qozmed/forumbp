import React, { useMemo } from 'react';

const Particles: React.FC = () => {
  // Generate particles once. CSS handles the animation on the GPU/Compositor thread.
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const size = Math.random() * 3 + 1;
      const left = Math.random() * 100;
      const duration = Math.random() * 20 + 10; // 10-30s
      const delay = Math.random() * -20; // Start immediately at different cycles
      
      return (
        <div
          key={i}
          className="fixed rounded-full bg-white opacity-[0.03] pointer-events-none z-0"
          style={{
            width: size,
            height: size,
            left: `${left}%`,
            top: '100%',
            animation: `float-up ${duration}s linear infinite`,
            animationDelay: `${delay}s`,
            willChange: 'transform'
          }}
        />
      );
    });
  }, []);

  return (
    <>
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0vh) translateX(0px); opacity: 0; }
          10% { opacity: 0.05; }
          90% { opacity: 0.05; }
          100% { transform: translateY(-110vh) translateX(${Math.random() * 50 - 25}px); opacity: 0; }
        }
      `}</style>
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
        {particles}
      </div>
    </>
  );
};

export default Particles;