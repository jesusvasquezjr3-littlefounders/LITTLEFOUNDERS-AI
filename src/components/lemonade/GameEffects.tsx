import React from 'react';

interface FloatingMoneyProps {
  amount: number;
  isVisible: boolean;
}

export const FloatingMoney: React.FC<FloatingMoneyProps> = ({ amount, isVisible }) => {
  return (
    <>
      {isVisible && (
        <div className="absolute top-4 right-4 z-10 pointer-events-none animate-bounce">
          <div className="bg-green-500 text-white px-3 py-1 rounded-full font-bold text-lg shadow-lg animate-pulse">
            +${amount.toFixed(2)}
          </div>
        </div>
      )}
    </>
  );
};

interface BouncingCustomerProps {
  emoji: string;
  name: string;
  mood: 'happy' | 'neutral' | 'sad';
}

export const BouncingCustomer: React.FC<BouncingCustomerProps> = ({ emoji, name, mood }) => {
  const getMoodColor = () => {
    switch (mood) {
      case 'happy': return 'bg-green-100 border-green-300';
      case 'sad': return 'bg-red-100 border-red-300';
      default: return 'bg-yellow-100 border-yellow-300';
    }
  };

  return (
    <div className="text-center animate-pulse">
      <div className="text-6xl mb-2 animate-bounce">
        {emoji}
      </div>
      <div className={`px-3 py-1 rounded-full text-sm font-semibold shadow-lg ${getMoodColor()}`}>
        {name}
      </div>
    </div>
  );
};

interface PulsingIconProps {
  children: React.ReactNode;
  isActive: boolean;
}

export const PulsingIcon: React.FC<PulsingIconProps> = ({ children, isActive }) => {
  return (
    <div className={isActive ? "animate-pulse" : ""}>
      {children}
    </div>
  );
};

interface WeatherAnimationProps {
  weather: 'sunny' | 'cloudy' | 'rainy' | 'cold';
}

export const WeatherAnimation: React.FC<WeatherAnimationProps> = ({ weather }) => {
  const getWeatherElements = () => {
    switch (weather) {
      case 'sunny':
        return (
          <div className="text-yellow-500 text-4xl animate-spin" style={{ animationDuration: '20s' }}>
            ☀️
          </div>
        );
      case 'rainy':
        return (
          <div className="relative">
            <div className="text-gray-600 text-4xl">☁️</div>
            <div className="absolute top-8 left-2 text-blue-500 animate-bounce">💧</div>
            <div className="absolute top-8 left-6 text-blue-500 animate-bounce" style={{ animationDelay: '0.3s' }}>💧</div>
            <div className="absolute top-8 left-10 text-blue-500 animate-bounce" style={{ animationDelay: '0.6s' }}>💧</div>
          </div>
        );
      case 'cold':
        return (
          <div className="text-cyan-400 text-4xl animate-pulse">
            ❄️
          </div>
        );
      default:
        return <div className="text-gray-500 text-4xl animate-pulse">☁️</div>;
    }
  };

  return (
    <div className="absolute top-8 left-8">
      {getWeatherElements()}
    </div>
  );
};

interface StandAnimationProps {
  isActive: boolean;
  children: React.ReactNode;
}

export const StandAnimation: React.FC<StandAnimationProps> = ({ isActive, children }) => {
  return (
    <div className={`relative ${isActive ? 'animate-pulse' : ''}`}>
      {children}
    </div>
  );
};

interface SuccessAnimationProps {
  isVisible: boolean;
  message: string;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({ isVisible, message }) => {
  return (
    <>
      {isVisible && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-green-500 text-white px-8 py-4 rounded-full font-bold text-xl shadow-2xl animate-bounce">
            🎉 {message}
          </div>
        </div>
      )}
    </>
  );
};
