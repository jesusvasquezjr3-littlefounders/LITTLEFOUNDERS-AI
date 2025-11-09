import React from 'react';

interface PasswordStrengthProps {
  password?: string;
}

const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password = '' }) => {
  const getStrength = (password: string) => {
    let score = 0;
    if (!password) return score;

    // Award points for different criteria
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    return Math.min(score, 5); // Cap score at 5 for simplicity
  };

  const strength = getStrength(password);

  const strengthLabels = [
    'Muy Débil',
    'Débil',
    'Aceptable',
    'Buena',
    'Fuerte',
    'Muy Fuerte'
  ];

  const strengthColors = [
    'bg-red-500',    // Muy Débil
    'bg-red-500',    // Débil
    'bg-yellow-500', // Aceptable
    'bg-blue-500',   // Buena
    'bg-green-500',  // Fuerte
    'bg-green-700'   // Muy Fuerte
  ];

  if (!password) {
    return null; // Don't render anything if there's no password
  }

  const barWidth = `${(strength / 5) * 100}%`;
  const barColor = strengthColors[strength];

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold text-gray-600">
          Seguridad de la contraseña:
        </span>
        <span className="text-xs font-bold text-gray-800">
          {strengthLabels[strength]}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: barWidth }}
        ></div>
      </div>
    </div>
  );
};

export { PasswordStrength };
