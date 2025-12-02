import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, RoundedBox, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface ThreeDCardProps {
  cardNumber: string;
  holderName: string;
  expiryDate: string;
  cvv: string;
  theme: 'gradient-blue' | 'gradient-purple' | 'gradient-green' | 'custom';
  isFlipped: boolean;
  showDetails: boolean;
  isFrozen: boolean;
}

const CardMesh = ({ cardNumber, holderName, expiryDate, cvv, theme, isFlipped, showDetails, isFrozen }: ThreeDCardProps) => {
  const mesh = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);

  // Animation for flipping
  useFrame((state, delta) => {
    if (mesh.current) {
      // Smooth rotation for flip
      const targetRotationY = isFlipped ? Math.PI : 0;
      mesh.current.rotation.y = THREE.MathUtils.lerp(mesh.current.rotation.y, targetRotationY, 0.1);

      // Subtle floating animation
      mesh.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;

      // Tilt effect on hover
      if (hovered) {
        const mouseX = (state.mouse.x * Math.PI) / 10;
        const mouseY = (state.mouse.y * Math.PI) / 10;
        mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, -mouseY, 0.1);
        mesh.current.rotation.z = THREE.MathUtils.lerp(mesh.current.rotation.z, -mouseX, 0.1);
      } else {
        mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, 0, 0.1);
        mesh.current.rotation.z = THREE.MathUtils.lerp(mesh.current.rotation.z, 0, 0.1);
      }
    }
  });

  // Theme colors
  const getThemeColors = () => {
    switch (theme) {
      case 'gradient-blue': return ['#2563eb', '#06b6d4'];
      case 'gradient-purple': return ['#9333ea', '#ec4899'];
      case 'gradient-green': return ['#16a34a', '#10b981'];
      case 'custom': return ['#4b5563', '#1f2937'];
      default: return ['#2563eb', '#06b6d4'];
    }
  };

  const [color1, color2] = getThemeColors();

  // Create gradient texture
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 512, 512);
      gradient.addColorStop(0, color1);
      gradient.addColorStop(1, color2);
      context.fillStyle = gradient;
      context.fillRect(0, 0, 512, 512);

      // Add some noise/texture
      for (let i = 0; i < 5000; i++) {
        context.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.05})`;
        context.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
    }
    return new THREE.CanvasTexture(canvas);
  }, [color1, color2]);

  return (
    <group
      ref={mesh}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Card Body */}
      <RoundedBox args={[3.2, 2, 0.02]} radius={0.1} smoothness={4}>
        <meshStandardMaterial
          map={texture}
          roughness={0.3}
          metalness={0.5}
        />
      </RoundedBox>

      {/* Front Content */}
      <group position={[0, 0, 0.03]} visible={!isFlipped || (mesh.current && mesh.current.rotation.y < Math.PI / 2) as any}>
        {/* Chip */}
        <mesh position={[-1.2, 0.2, 0]}>
          <planeGeometry args={[0.4, 0.3]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Logo */}
        <Text
          position={[1.1, 0.7, 0]}
          fontSize={0.15}
          color="white"
          anchorX="right"
        >
          LITTLE FOUNDERS
        </Text>

        {/* Card Number */}
        <Text
          position={[0, -0.1, 0]}
          fontSize={0.22}
          color="white"
          letterSpacing={0.1}
        >
          {showDetails
            ? cardNumber.replace(/(\d{4})/g, '$1 ').trim()
            : `•••• •••• •••• ${cardNumber.slice(-4)}`
          }
        </Text>

        {/* Holder Name */}
        <Text
          position={[-1.3, -0.7, 0]}
          fontSize={0.12}
          color="white"
          anchorX="left"
        >
          {holderName.toUpperCase()}
        </Text>

        {/* Expiry Label */}
        <Text
          position={[0.8, -0.55, 0]}
          fontSize={0.06}
          color="white"
          anchorX="center"
          fillOpacity={0.8}
        >
          VALID THRU
        </Text>

        {/* Expiry Date */}
        <Text
          position={[0.8, -0.7, 0]}
          fontSize={0.12}
          color="white"
          anchorX="center"
        >
          {showDetails ? expiryDate : "••/••"}
        </Text>

        {/* Frozen Overlay */}
        {isFrozen && (
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[3.2, 2]} />
            <meshBasicMaterial color="black" transparent opacity={0.5} />
          </mesh>
        )}

        {/* Frozen Text */}
        {isFrozen && (
          <Text position={[0, 0, 0.02]} fontSize={0.3} color="white">
            BLOQUEADA
          </Text>
        )}
      </group>

      {/* Back Content */}
      <group rotation={[0, Math.PI, 0]} position={[0, 0, -0.03]}>
        {/* Magnetic Strip */}
        <mesh position={[0, 0.6, 0]}>
          <planeGeometry args={[3.2, 0.4]} />
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </mesh>

        {/* CVV Box */}
        <mesh position={[0.5, 0.1, 0]}>
          <planeGeometry args={[0.5, 0.3]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* CVV Text */}
        <Text
          position={[0.5, 0.1, 0.01]}
          fontSize={0.15}
          color="black"
          rotation={[0, 0, 0]} // Ensure text is not mirrored relative to back face
        >
          {showDetails ? cvv : "•••"}
        </Text>

        <Text
          position={[0.5, -0.15, 0]}
          fontSize={0.08}
          color="white"
        >
          CVV
        </Text>

        {/* Signature Strip */}
        <mesh position={[-0.5, -0.5, 0]}>
          <planeGeometry args={[1.5, 0.3]} />
          <meshStandardMaterial color="#e5e7eb" transparent opacity={0.3} />
        </mesh>

        {/* Signature Text */}
        <Text
          position={[-0.5, -0.5, 0.01]}
          fontSize={0.1}
          color="black"
        >
          {holderName}
        </Text>

        {/* Frozen Overlay Back */}
        {isFrozen && (
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[3.2, 2]} />
            <meshBasicMaterial color="black" transparent opacity={0.5} />
          </mesh>
        )}
      </group>
    </group>
  );
};

export const ThreeDCard = (props: ThreeDCardProps) => {
  return (
    <div className="w-full h-96 cursor-pointer">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <CardMesh {...props} />

        <Environment preset="city" />
        <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
      </Canvas>
    </div>
  );
};
